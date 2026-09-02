// 과거 기간 **백필**(ADR-094 결정 7로 store.ts 에서 분리). 어떤 (캐릭터, 기간)을 조회할지
// 정하고, 조회해서 기록으로 남기고, 직전 기간 총액과 더 뒤로 갈 수 있는지를 판단한다.
//
// 의 조회 원장(같은 날짜 재조회 금지)이 여기서 읽고 쓰인다.

import { getAuthConfig } from '../../storage/api-key'
import { findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import { matchBossContent, selectBossProfitBosses } from '../../lib/boss/boss-matching'
import { getComparisonPeriodKeys } from '../../lib/boss/boss-profit-delta'
import { getAdjacentPeriodKey, getBackfillQueryDate, getCurrentBossProfitPeriod, getWeeklyPeriodKeysInMonth, isEarliestNavigablePeriod, isPeriodQueryable } from '../../lib/boss/boss-profit-period'
import type { PeriodQueryOutcome } from '../../lib/boss/boss-profit-period'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { getBossDropRecords } from '../../storage/boss-drops'
import { getBossPartySize } from '../../storage/boss-party-settings'
import { getBossProfitRecords, hasBossProfitRecordsAtOrBefore, upsertBossProfitRecord } from '../../storage/boss-profit'
import { markPeriodChecked } from '../../storage/boss-profit-period-checks'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import type { BossCycle } from '../../types'
import { toScheduleSyncError } from '../schedule-sync/schedule-sync'
import { migrateDropsToConfirmedDifficulty } from './drops-loader'
import { withSqliteFallback, withSqliteTimeout } from './sqlite-guards'

export interface BackfillTarget {
  ocid: string
  cycle: BossCycle
  periodKey: string
}
export function buildBackfillTargets(tab: BossCycle, periodKey: string, ocids: string[], now: Date): BackfillTarget[] {
  const targets: BackfillTarget[] = []

  if (tab === 'weekly') {
    for (const ocid of ocids) {
      targets.push({ ocid, cycle: 'weekly', periodKey })
    }
    return targets
  }

  const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', now).periodKey
  const weekKeysInMonth = getWeeklyPeriodKeysInMonth(periodKey).filter((key) => key <= currentWeeklyPeriodKey)

  for (const ocid of ocids) {
    targets.push({ ocid, cycle: 'monthly', periodKey })
    for (const weekKey of weekKeysInMonth) {
      targets.push({ ocid, cycle: 'weekly', periodKey: weekKey })
    }
  }

  return targets
}

// 과거 기간 백필: 성공하면 markPeriodChecked를 호출해 다음 방문부터 재조회하지 않게 하고,
// 실패하면 호출하지 않아 다음 방문 때 재시도된다. 이미 기록된 보스(setPartySize로 override된 값
// 포함)는 건드리지 않는다. 기존 refresh() 자동 기록 로직과 동일하게 "기록이 없는 조합만"
// 기본값(파티 관리 설정, 없으면 1)으로 채운다. 즉 **실시간으로 쌓인 기록이 base이고 백필은 빠진
// 것만 채우는 delta**다.
//
// 반환값은 이번 시도의 결과다. null이면 확인 완료(0건이든 기록을 채웠든),
// 'notCollected'면 아직 집계 전(시간이 지나면 풀린다), 'failed'면 그 외 실패(지금 재시도 가능).
// **조회 불가(구간 밖) 대상은 여기 들어오지 않는다**. 호출부가 걸러낸다. 전에는 이 함수가 그
// 대상을 markPeriodChecked로 굳혔는데, 그러면 "조회해서 0건을 봤다"와 "조회 불가라 굳혔다"가
// 같은 기록이 되어 confirmedEmpty가 outOfRange로 격하되는 원인이었다.
export async function backfillTarget(target: BackfillTarget, now: Date): Promise<PeriodQueryOutcome | null> {
  const date = getBackfillQueryDate(target.cycle, target.periodKey)

  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return 'failed'
  }

  try {
    const state = await fetchSchedulerCharacterState(authConfig.apiKey, target.ocid, date)
    // selectBossProfitBosses로 그룹(content_name)당 실제 처치 난이도만 골라야 한다. 그렇지
    // 않으면 등록 난이도와 실제 처치 난이도가 다를 때 둘 다 완료로 잡혀 같은 보스 하나를 두 번
    // 기록(이중 계산)하게 된다(ADR-032). 과거 기간 백필이므로 미완료 placeholder(ownComplete:
    // false)는 기록 대상에서 제외한다.
    const completedBosses = selectBossProfitBosses(
      state.bossContents.map(matchBossContent).filter((boss) => boss.cycle === target.cycle),
    ).filter((boss) => boss.ownComplete)

    const existingRecords = await withSqliteFallback(
      getBossProfitRecords([target.ocid], [target.periodKey]),
      [],
    )
    // ADR-069 결정 1: 백필로 만드는 delta 행에도 월드를 박는다. 그 시점 캐시의 월드를 쓰는데,
    // **리프 이전 주는 API가 400을 주므로 백필 자체가 불가능**하고(실측) 백필로 채워지는 리프 이후
    // 주는 현재 월드가 정답이라 실질 부정확이 없다.
    const backfillWorld = (await getCachedCharacterBasic(target.ocid))?.profile.world ?? null

    // ADR-069 결정 4: 백필 응답이 **처치 난이도를 확정하는 지점**이다. 대상(캐릭터×기간)당 한 번만
    // 읽어 아래 루프에서 재사용한다. 보스마다 조회하면 같은 쿼리를 보스 수만큼 반복한다.
    const dropRecords =
      completedBosses.length === 0
        ? []
        : await withSqliteFallback(getBossDropRecords([target.ocid], [target.periodKey]), [])

    for (const boss of completedBosses) {
      const bossName = boss.matchedBossName ?? boss.apiName
      // 이관은 `alreadyRecorded` 판정보다 앞에 둔다. 이미 수익 기록이 있든 없든 이 응답이 말하는
      // 처치 난이도는 같고, 아래 continue 들(이미 기록됨·가격 미확정)에 막히면 안 되기 때문이다.
      await migrateDropsToConfirmedDifficulty(
        { ocid: target.ocid, boss: bossName, difficulty: boss.difficulty, periodKey: target.periodKey },
        dropRecords,
        now,
      )

      const alreadyRecorded = existingRecords.some(
        (record) =>
          record.ocid === target.ocid &&
          record.boss === bossName &&
          record.difficulty === boss.difficulty &&
          record.periodKey === target.periodKey,
      )
      if (alreadyRecorded) {
        continue
      }

      const priceEntry = findPriceEntry(bossName, boss.difficulty)
      if (priceEntry === undefined || priceEntry.priceMeso === null) {
        continue
      }

      const configuredPartySize = await withSqliteFallback(
        getBossPartySize(target.ocid, bossName, boss.difficulty),
        null,
      )
      const partySize = configuredPartySize ?? 1
      const payoutMeso = Math.floor(priceEntry.priceMeso / partySize)

      await withSqliteTimeout(
        upsertBossProfitRecord({
          ocid: target.ocid,
          boss: bossName,
          difficulty: boss.difficulty,
          cycle: target.cycle,
          periodKey: target.periodKey,
          partySize,
          priceMeso: priceEntry.priceMeso,
          payoutMeso,
          recordedAt: now.toISOString(),
          world: backfillWorld,
        }),
      )
    }

    await withSqliteTimeout(markPeriodChecked(target.ocid, target.cycle, target.periodKey, now.toISOString()))
    return null
  } catch (error) {
    // 코드가 알려주는 사실을 상태로 옮긴다.
    //  - notCollected(00009): 실패가 아니라 "아직" — 재시도 유도 문구를 띄우지 않는다.
    //  - periodOutOfRange(00004): 우리 계산상 조회 구간 안인데 API가 거부한 것. 월드 리프 이전·
    //    휴면 등 그 캐릭터·날짜에 고유한 사정이라 "다시 시도"가 아니라 "조회할 수 없다"가 맞다.
    const kind = toScheduleSyncError(error).kind
    if (kind === 'notCollected') return 'notCollected'
    if (kind === 'periodOutOfRange') return 'outOfRange'
    return 'failed'
  }
}

// 현재 기간(periodKey)에서 한 칸 더 과거로 이동해도 되는지 판단한다(#29). 이전 버튼 게이트와
// "조회 불가" 경계가 서로 다른 하한을 쓰던 버그를 없앤다. 착지할 이전 기간이 실제로 데이터를
// 보여줄 수 있을 때만 이동을 허용한다.
//  1) MIN_SCHEDULER_DATE 이전(스케줄러 API 존재 이전)은 어떤 경우에도 데이터가 없다 → 불가.
//  2) 지금 API로 조회 가능하면(롤링 윈도우 안) 도달 시 백필로 데이터를 채울 수 있다 → 가능.
//  3) 롤링 윈도우 밖이라 지금은 조회 불가지만 과거에 저장해둔 기록이 있으면 그대로 보여줄 수 있다 → 가능.
// (이 캐시 존중이 롤링 하한을 그대로 이전 게이트로 쓰지 않는 이유다.)
/**
 * 직전 기간 총 수익. SQLite 한 번이면 끝난다.
 *
 * `getComparisonPeriodKeys` 가 **그 화면 총액 산식과 짝을 맞춘 키 목록**을 준다. 월간 탭이면
 * 직전 달(monthly)과 그 달에 속한 주차들(weekly)이 함께 들어 있고, 화면 총액도 그 둘을 더하므로
 * (`groupTotalMeso`) cycle 로 거르지 않고 전부 합치는 것이 맞다.
 *
 * 기간 상태를 묻지 않는다. 기록이 없는 기간은 그냥 0이다(결정 3).
 */
export async function loadPreviousPeriodTotal(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
): Promise<number> {
  if (ocids.length === 0) {
    return 0
  }
  // **결정석만 센다**(정정, 2026-08-10 사용자 지정). 아이템 판매가는 그 주에
  // 실제로 판 값이라 주마다 들쭉날쭉하고, 섞으면 증감이 "이번 주 보스를 얼마나 돌았나"가 아니라
  // "비싼 게 떴나"를 말하게 된다. 화면도 같은 잣대로 이번 기간의 결정석 합만 넘긴다.
  const records = await withSqliteFallback(
    getBossProfitRecords(ocids, getComparisonPeriodKeys(tab, periodKey)),
    [],
  )
  return records.reduce((sum, record) => sum + record.payoutMeso, 0)
}

export async function canReachPreviousPeriod(
  tab: BossCycle,
  periodKey: string,
  ocids: string[],
  now: Date,
): Promise<boolean> {
  if (isEarliestNavigablePeriod(tab, periodKey)) {
    return false
  }
  const prevPeriodKey = getAdjacentPeriodKey(tab, periodKey, 'prev')
  if (isPeriodQueryable(tab, prevPeriodKey, now)) {
    return true
  }
  // ADR-068 결정 5: **그 기간 또는 더 과거에** 기록이 있으면 통과시킨다. 전에는 바로 이전 한 칸의
  // 기록만 봐서, 접속하지 않은 주가 벽이 되어 그 뒤의 기록 전체에 도달할 수 없었다(이슈 #78 —
  // 3·4주차 미접속 캐릭터의 1·2주차 기록이 DB에 있어도 화면으로 갈 방법이 없었다).
  // 빈 기간은 한 칸씩 지나가야 하지만(시안 A) 벽은 사라진다.
  return hasBossProfitRecordsAtOrBefore(ocids, tab, prevPeriodKey)
}

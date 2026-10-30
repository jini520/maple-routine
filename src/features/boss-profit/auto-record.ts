/**
 * 완료 행의 드롭 이관과 자동 기록.
 *
 * 이 루프가 `refresh` 의 동기화 완료 분기 안에만 있으면 동기화를 건너뛴다 가 곧 기록을
 * 건너뛴다 가 된다. 캐시 우선 표시 단계에서도 같은 일을 하려면 먼저 호출 가능한 형태여야 한다.
 *
 * 두 경로가 다른 것은 이 행의 출처가 지금의 사실인가 하나뿐이라, 그 자리만 술어로 주입받는다.
 */

import { crystalPayoutMeso } from '../../lib/boss/party-shares'
import { periodStartDateKey } from '../../lib/boss/boss-profit-period'
import { lazyAutoFeePercent, settingSplitFee } from '../mvp-grade/auto-fee'
import { getBossPartySetting } from '../../storage/boss-party-settings'
import { getBossPartyPeriodOverride } from '../../storage/boss-party-period-overrides'
import {
  markBossProfitRecordAuto,
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../storage/boss-profit'
import type { BossDropRecord } from '../../storage/boss-drops'
import { batchRecordWrites } from '../../storage/record-revision-batch'
import type { BossContent } from '../../types'
import { migrateDropsToConfirmedDifficulty } from './drops-loader'
import type { BossProfitRow } from './rows'
import { withSqliteFallback } from './sqlite-guards'

/** 넥슨 완료 목록의 키. 같은 보스·난이도라도 캐릭터가 다르면 다른 사실이라 ocid 가 든다. */
export function nexonCompleteKey(ocid: string, bossKey: string, difficulty: string): string {
  return `${ocid}|${bossKey}|${difficulty}`
}

/**
 * 넥슨이 그 캐릭터에 완료로 준 조합. API 원문·캐시 원문에서 바로 뽑는다.
 *
 * 화면 행으로는 못 만든다. 직접 적은 완료가 행의 `isComplete` · `ownComplete` 를 켜기 때문에,
 * 행에서 뽑으면 사용자가 방금 적은 것을 넥슨이 준 것으로 되읽는다.
 */
export function nexonCompletedKeysOf(ocid: string, bossContents: readonly BossContent[]): string[] {
  const keys: string[] = []
  for (const content of bossContents) {
    if (content.ownComplete && content.bossKey !== null) {
      keys.push(nexonCompleteKey(ocid, content.bossKey, content.difficulty))
    }
  }
  return keys
}

export interface AutoRecordParams {
  rows: BossProfitRow[]
  /** null = getBossProfitRecords 조회 자체가 실패했다는 뜻. 이때는 아무것도 기록하지 않는다. */
  records: BossProfitRecord[] | null
  /** 드롭 이관 대상 조회 결과. records 가 null 이면 호출부가 [] 를 넘긴다. */
  dropRecords: BossDropRecord[]
  now: Date
  /**
   * 이 행의 출처가 "지금의 사실"인가. false 면 드롭 이관·자동 기록 **둘 다** 건너뛴다.
   * - 동기화 경로: 동기화가 실패해 낡은 캐시로 그려진 행을 배제한다
   * - 캐시 경로: 캐시가 보스 리셋 경계를 넘어 지난 기간 처치를 이번 기간으로 굳히는 행을 배제한다
   */
  isSourceCurrent: (row: BossProfitRow) => boolean
  /**
   * 넥슨이 완료로 준 조합(`nexonCompletedKeysOf`). 직접 적은 완료의 표식을 걷을지가 이 목록으로
   * 갈린다. 행의 완료 여부로 대신하면 방금 적은 표식을 그 기록 때문에 걷는다.
   */
  nexonCompleted: ReadonlySet<string>
}

/**
 * 기록이 없는 완료 보스를 화면 진입 전에 기본 파티원 수로 남기는 자동 기록. 기본값은
 * boss_party_settings 조회 결과, 없으면 1(솔로)이다.
 *
 * `upsertBossProfitRecord` 는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로 `Promise.all`
 * 로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다. 순차 실행으로 처리한다.
 *
 * 입력 rows 와 같은 순서로, 자동 기록된 행은 partySize·payoutMeso 가 채워진 새 배열을 돌려준다.
 */
export function autoRecordRows(params: AutoRecordParams): Promise<BossProfitRow[]> {
  // 한 회차가 수십 건을 적는다. 판 알림은 반복이 끝날 때 한 번이다.
  return batchRecordWrites(() => recordEachRow(params))
}

async function recordEachRow({
  rows,
  records,
  dropRecords,
  now,
  isSourceCurrent,
  nexonCompleted,
}: AutoRecordParams): Promise<BossProfitRow[]> {
  const autoRecordedRows: BossProfitRow[] = []
  const autoFee = lazyAutoFeePercent()

  for (const row of rows) {
    const sourceIsCurrent = isSourceCurrent(row)

    // 완료 행은 처치 난이도가 확정된 것이다. 다른 난이도 키에 남은 드롭을 이 난이도로 옮긴다.
    // 아래 자동 기록 가드보다 조건이 넓다. 가격 미확정이거나 이미 기록된 조합도 난이도는
    // 확정된 상태다. 출처가 지금의 사실이 아닌 행은 제외한다.
    if (records !== null && sourceIsCurrent && row.isComplete) {
      await migrateDropsToConfirmedDifficulty(row, dropRecords, now)
    }

    // 넥슨이 같은 난이도 완료를 주면 사용자가 직접 적은 기록의 표식을 걷는다. 값은 안 건드린다 -
    // 사용자가 적은 날짜와 파티원 수가 더 정확하다.
    //
    // 판정은 `row.isComplete` 가 아니라 **넥슨이 준 목록**으로 한다. 직접 적은 기록이 그 행을
    // 완료로 만들기 때문에, 행으로 판정하면 적는 순간 표식이 걷혀 수정·취소로 가는 문이 닫힌다.
    if (
      records !== null &&
      sourceIsCurrent &&
      nexonCompleted.has(nexonCompleteKey(row.ocid, row.bossKey, row.difficulty))
    ) {
      const same = records.find(
        (record) =>
          record.ocid === row.ocid &&
          record.bossKey === row.bossKey &&
          record.difficulty === row.difficulty &&
          record.periodKey === row.periodKey,
      )
      if (same?.source === 'manual') {
        await withSqliteFallback(
          markBossProfitRecordAuto({
            ocid: row.ocid,
            bossKey: row.bossKey,
            difficulty: row.difficulty,
            periodKey: row.periodKey,
          }),
          undefined,
        )
      }
    }

    // 같은 (캐릭터, 보스, 기간)에 기록이 있으면 **난이도가 달라도** 새로 안 쓴다. 한 주에 한 보스를
    // 두 난이도로 잡을 수 없어(게임 규칙) 한 줄이 더 써지면 같은 처치를 두 번 세게 된다.
    const recordedInPeriod =
      records !== null &&
      records.some(
        (record) =>
          record.ocid === row.ocid &&
          record.bossKey === row.bossKey &&
          record.periodKey === row.periodKey,
      )

    // 미완료 placeholder 는 절대 자동 기록하지 않는다. 여기서 기록하면 나중에 실제로 완료됐을 때
    // 이미 기록이 있다 고 오판해 0메소로 영구히 고정된다.
    //
    // records 가 null 이면 조회 자체가 실패한 것이라 이 조합에 기록이 있는지 알 수 없다.
    // 기본값으로 덮어쓰지 말고 다음 새로고침의 정상 커넥션에 맡긴다.
    //
    // 출처가 지금의 사실이 아닌 행도 제외한다. 그 행은 낡은 캐시에서 나왔고, 여기서 기록하면
    // 4주 전 처치가 이번 주 수익으로 영구히 남는다(기록이 생긴 뒤에는 mergeRecordsIntoRows 가
    // 계속 복원하므로 스스로 사라지지 않는다).
    if (
      records === null ||
      !sourceIsCurrent ||
      !row.isComplete ||
      recordedInPeriod ||
      row.partySize !== null ||
      row.priceMeso === null
    ) {
      autoRecordedRows.push(row)
      continue
    }

    // 설정을 한 줄로 읽는다. 인원만 읽으면 비율 약속이 있는 보스가 균등으로 굳는다.
    // 미완료 행에서 그 기간만 고쳐 둔 값이 있으면 그것이 이긴다.
    const configured =
      (await withSqliteFallback(
        getBossPartyPeriodOverride(row.ocid, row.bossKey, row.difficulty, row.periodKey),
        null,
      )) ??
      (await withSqliteFallback(getBossPartySetting(row.ocid, row.bossKey, row.difficulty), null))
    const partySize = configured?.partySize ?? 1
    const splitFee = await settingSplitFee(configured, row.ocid, periodStartDateKey(row.periodKey), autoFee)
    const shares = {
      myShare: configured?.crystalMyShare ?? null,
      sharesTotal: configured?.crystalSharesTotal ?? null,
      splitFeePercent: splitFee.splitFeePercent,
    }
    const payoutMeso = crystalPayoutMeso(row.priceMeso, partySize, shares)

    await withSqliteFallback(
      upsertBossProfitRecord({
        ocid: row.ocid,
        bossKey: row.bossKey,
        boss: row.bossName,
        difficulty: row.difficulty,
        cycle: row.cycle,
        periodKey: row.periodKey,
        partySize,
        priceMeso: row.priceMeso,
        payoutMeso,
        crystalMyShare: shares.myShare,
        crystalSharesTotal: shares.sharesTotal,
        splitFeePercent: shares.splitFeePercent,
        splitFeeAuto: splitFee.splitFeeAuto,
        recordedAt: now.toISOString(),
        world: row.world,
        worldKey: row.worldKey,
      }),
      undefined,
    )

    autoRecordedRows.push({
      ...row,
      partySize,
      payoutMeso,
      crystalMyShare: shares.myShare,
      crystalSharesTotal: shares.sharesTotal,
      splitFeePercent: shares.splitFeePercent,
    })
  }

  return autoRecordedRows
}

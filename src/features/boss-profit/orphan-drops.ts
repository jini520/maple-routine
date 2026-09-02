/**
 * **잡지 않은 보스에 남은 드롭 정리**.
 *
 * 미완료 placeholder 행에도 드롭을 적을 수 있다(배경 3. 처치 직후 `complete_flag` 가
 * 갱신되기 전에 적으려고 연 자리다). 그래서 **끝내 잡지 않은 보스에 기록이 남는** 경로가 생긴다.
 *
 * ## 규칙은 하나다
 *
 * > 설 자리도 처치 기록도 없는 드롭 그룹은 지운다.
 *
 * 고아가 생기는 경로가 셋인데(① 주간 한도를 채워 행이 사라짐 ② 수동 추적에서 뺌 ③ 주가 바뀌어
 * 영영 미처치로 굳음) **셋이 같은 모양**이라 술어 하나로 덮는다. 경로마다 정리 코드를 쓰면 넷째
 * 경로가 생길 때 또 빠진다(**선택 불가** 를 사유 하나로 모델링한 것과 같다).
 *
 * ## 왜 지워야 하나. 안 지우면 화면마다 다르게 보인다
 *
 * | 소비처 | 고아 드롭이 |
 * |---|---|
 * | 보스 수익(행·총 수익) | **사라진다**. `groupTotalMeso` 가 `group.bossRows` 로만 훑는다 |
 * | 가계부 | 안 잡힌다. 짝인 `boss_profit_records` 가 없어 날짜를 못 물려받는다 |
 * | 드롭 히스토리 · today 위젯 | **남는다**. `getAllBossDropRecords` 가 테이블 전체를 읽는다 |
 *
 *  로 판매가가 같은 행에 붙어 있어 **금액까지** 그 상태가 된다.
 *
 * ## 지우는 조건은 **미처치** 이지 **추적 해제** 가 아니다 (결정 6)
 *
 * 실제로 잡은 보스는 추적을 꺼도 이 화면에 계속 뜬다(`selectProfitDisplayBosses` ①). 술어를
 * `추적 목록에 없다`로 쓰면 진짜 처치 기록의 드롭이 날아간다.
 */
import { findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import { getBossDropRecords, replaceBossDropRecords, type BossDropRecord } from '../../storage/boss-drops'
import type { BossDifficulty } from '../../types'
import { withSqliteFallback } from './sqlite-guards'
import type { BossProfitRow } from './rows'

/** 지울 드롭 한 무리. `replaceBossDropRecords` 의 삭제 단위와 같은 키다. */
export interface OrphanDropGroup {
  ocid: string
  boss: string
  difficulty: string
  periodKey: string
  /** 이 무리가 들고 있던 기록 수. 토스트가 말할 값이다. */
  dropCount: number
}

export interface OrphanDropPlanInput {
  /** 이 회차가 그린 행 전부(보고 있는 기간 ∪ 지금 기간). */
  rows: readonly Pick<BossProfitRow, 'ocid' | 'boss' | 'periodKey'>[]
  /** 이미 읽어 둔 드롭 기록. */
  records: readonly BossDropRecord[]
  /**
   * 판정을 믿어도 되는 캐릭터. 동기화가 실패해 낡은 캐시로 그려진 캐릭터는 여기 없다
   * (자동 기록에 쓰는 술어와 같다).
   */
  trustedOcids: ReadonlySet<string>
  /** 이 회차가 사실 을 아는 기간. 그 밖의 기간은 손대지 않는다. */
  knownPeriodKeys: ReadonlySet<string>
}

const bossKey = (ocid: string, boss: string, periodKey: string): string => `${ocid}|${boss}|${periodKey}`
const periodKeyOf = (ocid: string, periodKey: string): string => `${ocid}|${periodKey}`

/**
 * 지울 무리를 고른다. **쓰지 않는다**(계획과 실행을 갈라야 이 규칙을 입출력으로 검증할 수 있다).
 *
 * 안전 장치 넷이 행이 없다가 안 잡았다를 뜻하지 않는 경우를 전부 막는다:
 *
 * 1. **같은 (ocid, 보스, 기간) 에 행이 하나도 없어야 한다.** 난이도만 다른 행이 있으면 그것은
 *  고아가 아니라 난이도 키가 어긋난 것이고, 옮기는 일은 의 몫이다.
 *    그래서 이 정리는 **언제나 이관 뒤**에 돈다.
 * 2. **그 (ocid, 기간) 에 행이 하나라도 있어야 한다.** 백필된 적 없는 과거 주는 기록이 통째로
 *    비어 행 없음이 아무것도 뜻하지 않는다.
 * 3. **결정석 가격을 아는 (보스, 난이도) 만.** 가격 미확정 보스는 완료여도 자동 기록이 안 남으므로
 *    (`auto-record.ts` 의 `row.priceMeso === null` 가드) 과거 기간에서 행이 없는 것이 정상이다.
 *  참조표 조합엔 전부 가격이 있어, 이 가드가 실제로 막는 것은 매칭 실패 원문명이다.
 * 4. **믿을 수 있는 캐릭터·아는 기간만**(위 두 필드).
 */
export function planOrphanDropCleanup(input: OrphanDropPlanInput): OrphanDropGroup[] {
  const bossesWithRow = new Set<string>()
  const periodsWithRow = new Set<string>()
  for (const row of input.rows) {
    bossesWithRow.add(bossKey(row.ocid, row.boss, row.periodKey))
    periodsWithRow.add(periodKeyOf(row.ocid, row.periodKey))
  }

  // 삽입 순서를 유지한다. 지우는 차례가 조회 순서와 같아야 실패 지점을 읽을 수 있다.
  const groups = new Map<string, OrphanDropGroup>()
  for (const record of input.records) {
    if (!input.trustedOcids.has(record.ocid)) continue
    if (!input.knownPeriodKeys.has(record.periodKey)) continue
    if (!periodsWithRow.has(periodKeyOf(record.ocid, record.periodKey))) continue
    if (bossesWithRow.has(bossKey(record.ocid, record.boss, record.periodKey))) continue
    if (findPriceEntry(record.boss, record.difficulty as BossDifficulty) === undefined) continue

    const key = `${record.ocid}|${record.boss}|${record.difficulty}|${record.periodKey}`
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, {
        ocid: record.ocid,
        boss: record.boss,
        difficulty: record.difficulty,
        periodKey: record.periodKey,
        dropCount: 1,
      })
      continue
    }
    group.dropCount += 1
  }

  return [...groups.values()]
}

export interface OrphanDropSweepInput {
  ocids: string[]
  rows: readonly BossProfitRow[]
  trustedOcids: ReadonlySet<string>
  knownPeriodKeys: ReadonlySet<string>
  now: Date
}

/**
 * 계획대로 지우고 **지운 기록 수**를 돌려준다(0이면 아무것도 안 했다. 멱등).
 *
 * 빈 배열로 `replaceBossDropRecords` 를 부르는 것이 곧 삭제다(그 함수의 계약. DELETE 뒤 0건 삽입).
 * 실패는 삼킨다. 정리는 화면의 목적이 아니라 뒷정리라, 못 지웠다고 보스 수익이 서지 못하면 안 된다.
 */
export async function sweepOrphanDrops(input: OrphanDropSweepInput): Promise<number> {
  const periodKeys = [...input.knownPeriodKeys]
  if (input.ocids.length === 0 || periodKeys.length === 0) return 0

  const records = await withSqliteFallback(getBossDropRecords(input.ocids, periodKeys), [])
  const groups = planOrphanDropCleanup({
    rows: input.rows,
    records,
    trustedOcids: input.trustedOcids,
    knownPeriodKeys: input.knownPeriodKeys,
  })
  if (groups.length === 0) return 0

  const recordedAt = input.now.toISOString()
  let removed = 0
  for (const group of groups) {
    // 순차 실행이다. `replaceBossDropRecords` 가 공유 커넥션에 자체 트랜잭션을 열어
    // 동시에 던지면 겹친다(`auto-record.ts` 의 upsert 루프와 같은 이유).
    await withSqliteFallback(
      replaceBossDropRecords(group.ocid, group.boss, group.difficulty, group.periodKey, [], recordedAt),
      undefined,
    )
    removed += group.dropCount
  }
  return removed
}

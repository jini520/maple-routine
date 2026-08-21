// 완료 행의 **드롭 이관과 자동 기록**(ADR-111 로 store.ts 에서 분리).
//
// 왜 분리하나 — 이 루프는 지금까지 `refresh` 의 **동기화 완료 분기 안에만** 있어서 "동기화를
// 건너뛴다"가 곧 "기록을 건너뛴다"였다([[ADR-097]] 결정 6). 그 결합은 설계된 것이 아니라 코드
// 배치의 결과라, 캐시 우선 표시 단계에서도 같은 일을 하려면 먼저 호출 가능한 형태여야 한다
// ([[ADR-111]] 결정 1).
//
// 두 경로가 다른 것은 **"이 행의 출처가 지금의 사실인가"** 하나뿐이라, 그 자리만 술어로 주입받는다.

import { getBossPartySize } from '../../storage/boss-party-settings'
import { upsertBossProfitRecord, type BossProfitRecord } from '../../storage/boss-profit'
import type { BossDropRecord } from '../../storage/boss-drops'
import { migrateDropsToConfirmedDifficulty } from './drops-loader'
import type { BossProfitRow } from './rows'
import { withSqliteFallback } from './sqlite-guards'

export interface AutoRecordParams {
  rows: BossProfitRow[]
  /** null = getBossProfitRecords 조회 자체가 실패했다는 뜻. 이때는 아무것도 기록하지 않는다([[ADR-050]] 결정 3). */
  records: BossProfitRecord[] | null
  /** 드롭 이관 대상 조회 결과. records 가 null 이면 호출부가 [] 를 넘긴다. */
  dropRecords: BossDropRecord[]
  now: Date
  /**
   * 이 행의 출처가 "지금의 사실"인가. false 면 드롭 이관·자동 기록 **둘 다** 건너뛴다.
   * - 동기화 경로: 동기화가 실패해 낡은 캐시로 그려진 행을 배제한다([[ADR-067]] 결정 7)
   * - 캐시 경로: 캐시가 보스 리셋 경계를 넘어 지난 기간 처치를 이번 기간으로 굳히는 행을 배제한다([[ADR-111]])
   */
  isSourceCurrent: (row: BossProfitRow) => boolean
}

/**
 * ADR-014/ADR-019: 기록이 없는 완료 보스는 화면 진입 전에도 즉시 기본 파티원 수로 자동 기록한다.
 * 기본값은 boss_party_settings(파티 관리) 조회 결과, 없으면 1(솔로)이다.
 * upsertBossProfitRecord는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로,
 * Promise.all로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다 — 순차 실행으로 처리한다.
 * ADR-069 결정 4: 아래 루프에서 완료 행의 드롭 이관에 쓴다(자동 기록과 같은 순회를 쓴다).
 *
 * 입력 rows 와 **같은 순서**로, 자동 기록된 행은 partySize·payoutMeso 가 채워진 새 배열을 돌려준다.
 */
export async function autoRecordRows({
  rows,
  records,
  dropRecords,
  now,
  isSourceCurrent,
}: AutoRecordParams): Promise<BossProfitRow[]> {
  const autoRecordedRows: BossProfitRow[] = []

  for (const row of rows) {
    const sourceIsCurrent = isSourceCurrent(row)

    // 완료 행은 처치 난이도가 확정된 것이다 — 다른 난이도 키에 남은 드롭을 이 난이도로 옮긴다
    // ([[ADR-069]] 결정 4). 아래 자동 기록 가드보다 조건이 넓다: 가격 미확정이거나 이미 기록된
    // 조합도 난이도는 확정된 상태다. 출처가 지금의 사실이 아닌 행은 제외한다([[ADR-067]] 결정 7 —
    // 그 행의 난이도는 지금의 사실이 아니다).
    if (records !== null && sourceIsCurrent && row.isComplete) {
      await migrateDropsToConfirmedDifficulty(row, dropRecords, now)
    }

    // 미완료 placeholder(ADR-032)는 절대 자동 기록하지 않는다 — 여기서 기록해버리면
    // 나중에 실제로 완료됐을 때 "이미 기록이 있다"고 오판해 실제 처치 수익으로 다시
    // 계산되지 않고 0메소로 영구히 고정된다.
    // records가 null이면 조회 자체가 실패한 것이라 이 조합에 기록이 있는지 알 수 없다 —
    // 기본값으로 덮어쓰지 말고 다음 새로고침의 정상 커넥션에 맡긴다([[ADR-050]] 결정 3).
    // 출처가 지금의 사실이 아닌 행도 제외한다([[ADR-067]] 결정 7) — 그 행은 낡은 캐시에서 나왔고,
    // 여기서 기록하면 4주 전 처치가 이번 주 수익으로 **영구히** 남는다(기록이 생긴 뒤에는
    // mergeRecordsIntoRows가 계속 복원하므로 스스로 사라지지 않는다). 동기화 경로에서는 폴백 캐시가,
    // 캐시 경로에서는 리셋 경계를 넘은 캐시가 그 자리다([[ADR-111]] 결정 2).
    if (
      records === null ||
      !sourceIsCurrent ||
      !row.isComplete ||
      row.partySize !== null ||
      row.priceMeso === null
    ) {
      autoRecordedRows.push(row)
      continue
    }

    const configuredPartySize = await withSqliteFallback(
      getBossPartySize(row.ocid, row.boss, row.difficulty),
      null,
    )
    const partySize = configuredPartySize ?? 1
    const payoutMeso = Math.floor(row.priceMeso / partySize)

    await withSqliteFallback(
      upsertBossProfitRecord({
        ocid: row.ocid,
        boss: row.boss,
        difficulty: row.difficulty,
        cycle: row.cycle,
        periodKey: row.periodKey,
        partySize,
        priceMeso: row.priceMeso,
        payoutMeso,
        recordedAt: now.toISOString(),
        world: row.world,
      }),
      undefined,
    )

    autoRecordedRows.push({ ...row, partySize, payoutMeso })
  }

  return autoRecordedRows
}

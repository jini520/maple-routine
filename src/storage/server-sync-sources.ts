/**
 * 서버로 보낼 기록을 기기 표에서 읽는 자리. 한 건 전송 · 대기 표 · 과거 올리기가 함께 쓴다.
 *
 * 값을 화면 타입으로 바꾸지 않고 서버로 보낼 칸 그대로 읽는다. 화면 타입은 이름 · 파생값을 더해 서버 칸과 어긋난다.
 */
import { PERIODS_JOIN, PERIOD_KEY_WHERE } from './boss-periods'
import type { BossProfitRecordKey } from './boss-profit'
import { readEntries, type StoredEntry } from './cashbook-entries'
import { getBossProfitDb } from './sqlite/db'

/** 처치 기간 행에서 서버로 보낼 칸. */
export interface BossClearSource {
  periodId: string
  ocid: string
  bossKey: string
  difficulty: string
  cycle: 'weekly' | 'monthly'
  periodKey: string
  worldKey: string | null
  priceMeso: number
  payoutMeso: number
  splitMode: 'even' | 'ratio'
  partySize: number
  myShare: number | null
  sharesTotal: number | null
  splitFeePercent: number | null
  defeatedDate: string | null
  source: 'auto' | 'manual'
}

/** 가계부 기록과 그 기록이 속한 넥슨 계정. */
export interface CashbookEntrySource {
  entry: StoredEntry
  nexonAccountId: string | null
}

const numberOrNull = (value: unknown): number | null => (value as number | null | undefined) ?? null
const textOrNull = (value: unknown): string | null => (value as string | null | undefined) ?? null

/**
 * 처치한 기간 행 하나. 행이 없거나 처치가 아니면(`open`) `null` 이다. 그때 서버에서는 지운다.
 *
 * @param periodId 기기의 `boss_party_periods.id`
 */
export async function getBossClearSource(periodId: string): Promise<BossClearSource | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT pe.id, pa.ocid, pa.boss_key, pa.difficulty, pe.cycle, pe.period_key, pe.world_key, pe.price_meso,
            pe.payout_meso, pe.split_mode, pe.party_size, pe.my_share, pe.shares_total, pe.split_fee_percent,
            pe.defeated_date, pe.source
       FROM ${PERIODS_JOIN}
      WHERE pe.id = ? AND pe.clear_status = 'cleared'`,
    [periodId],
  )
  const row = (values ?? [])[0]
  if (row === undefined) return null
  return {
    periodId: row.id as string,
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    difficulty: row.difficulty as string,
    cycle: row.cycle === 'monthly' ? 'monthly' : 'weekly',
    periodKey: row.period_key as string,
    worldKey: textOrNull(row.world_key),
    priceMeso: row.price_meso as number,
    payoutMeso: row.payout_meso as number,
    splitMode: row.split_mode === 'ratio' ? 'ratio' : 'even',
    partySize: row.party_size as number,
    myShare: numberOrNull(row.my_share),
    sharesTotal: numberOrNull(row.shares_total),
    splitFeePercent: numberOrNull(row.split_fee_percent),
    defeatedDate: textOrNull(row.defeated_date),
    source: row.source === 'manual' ? 'manual' : 'auto',
  }
}

/** 키 넷으로 기간 행 id 를 찾는다. 행이 없는 키는 빠진다. 처치를 취소해 행이 남은 기간도 돌려준다. */
export async function findBossPeriodIds(keys: readonly BossProfitRecordKey[]): Promise<string[]> {
  if (keys.length === 0) return []
  const db = await getBossProfitDb()
  const ids: string[] = []
  for (const key of keys) {
    const { values } = await db.query(`SELECT pe.id FROM ${PERIODS_JOIN} WHERE ${PERIOD_KEY_WHERE}`, [
      key.ocid,
      key.bossKey,
      key.difficulty,
      key.periodKey,
    ])
    const id = (values ?? [])[0]?.id
    if (typeof id === 'string') ids.push(id)
  }
  return ids
}

/** 드롭 하나가 붙은 기간 행 id. 드롭이 없으면 `null`. */
export async function getDropPeriodId(dropRecordId: string): Promise<string | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT period_id FROM boss_drops WHERE id = ?', [dropRecordId])
  return textOrNull((values ?? [])[0]?.period_id)
}

/** 가계부 기록 하나와 그 계정. 없으면 `null` 이다. 그때 서버에서는 지운다. */
export async function getCashbookEntrySource(entryId: string): Promise<CashbookEntrySource | null> {
  const db = await getBossProfitDb()
  const [entry] = await readEntries(db, 'e.id = ?', [entryId])
  if (entry === undefined) return null
  const { values } = await db.query('SELECT nexon_account_id FROM cashbook_entries WHERE id = ?', [entryId])
  return { entry, nexonAccountId: textOrNull((values ?? [])[0]?.nexon_account_id) }
}

/** 과거 올리기가 나눠 읽는 종류. 표와 조건이 종류마다 다르다. */
export type BackfillKind = 'bossClear' | 'dropPrice' | 'cashbookEntry' | 'enhancementTotal'

const BACKFILL_QUERIES: Record<BackfillKind, string> = {
  bossClear: `SELECT id FROM boss_party_periods WHERE clear_status = 'cleared' AND id > ? ORDER BY id LIMIT ?`,
  dropPrice: 'SELECT id FROM boss_drops WHERE id > ? ORDER BY id LIMIT ?',
  cashbookEntry: 'SELECT id FROM cashbook_entries WHERE id > ? ORDER BY id LIMIT ?',
  // 지출로 세는 줄만 보낸다. 이벤트 월드 · 판정 못 한 줄 · 비용이 0 인 줄은 서버에 두지 않는다.
  enhancementTotal:
    'SELECT id FROM enhancement_totals WHERE event_world = 0 AND attempt_cost_meso + destroy_defence_cost_meso > 0 AND id > ? ORDER BY id LIMIT ?',
}

/**
 * id 차례로 `after` 뒤의 기록 id 를 `limit` 개까지. 과거 올리기가 어디까지 보냈는지를 id 하나로 들 수 있게 차례가 id 다.
 *
 * @param after 지난번 마지막으로 보낸 id. 처음이면 빈 글자
 */
export async function listRecordIdsAfter(kind: BackfillKind, after: string, limit: number): Promise<string[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(BACKFILL_QUERIES[kind], [after, limit])
  return (values ?? []).map((row) => row.id as string)
}

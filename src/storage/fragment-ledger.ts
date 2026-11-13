/**
 * 솔 에르다 조각 장부를 가계부 기록에서 읽고, 장부를 바꾸는 저장을 검사하는 자리.
 *
 * 장부는 저장하지 않고 기록에서 센다. 가격 빈 사냥 기록이 조각을 들이고, `솔 에르다 조각` 정산과 헥사 기록이 보관에서
 * 가져간 개수(`cashbook_entry_fragment_uses`)가 조각을 낸다. 개수를 따로 저장하면 기록을 고칠 때마다 그 값도 맞춰야 한다.
 */
import { fragmentShortfall, type FragmentMove, type FragmentShortDay } from '../lib/cashbook/fragment-ledger'
import { inventoryShortagesOf, InventoryShortageError, readInventoryRemaining } from './inventory'
import type { SqliteDbConnection } from './ports'

/** 장부 한 줄을 낸 기록의 종류. */
export type FragmentMoveKind = 'hunt' | 'settle' | 'hexa'

/** 장부 한 줄과 그 줄을 낸 기록. */
export interface StoredFragmentMove extends FragmentMove {
  entryId: string
  ocid: string
  kind: FragmentMoveKind
}

/** 캐릭터 하나의 모자란 날. */
export interface FragmentShortage {
  ocid: string
  days: FragmentShortDay[]
}

/** 저장으로 조각 장부가 모자라게 되어 쓴 것을 되돌렸다는 뜻. */
export class FragmentShortageError extends Error {
  readonly shortages: readonly FragmentShortage[]

  constructor(shortages: readonly FragmentShortage[]) {
    super(`솔 에르다 조각이 모자랍니다: ${shortages.map((each) => each.ocid).join(', ')}`)
    this.name = 'FragmentShortageError'
    this.shortages = shortages
  }
}

const MOVES_SQL = `
  SELECT e.id AS entry_id, 'hunt' AS kind, e.ocid AS ocid, e.entry_date AS date, h.fragments AS delta, e.created_at AS created_at
    FROM cashbook_entries e JOIN cashbook_entry_hunt_inputs h ON h.entry_id = e.id
   WHERE e.entry_type = 'income' AND e.category_key = 'hunting' AND h.fragment_price_meso IS NULL
     AND e.ocid IS NOT NULL AND h.fragments > 0
  UNION ALL
  SELECT e.id, 'settle', e.ocid, e.entry_date, -i.quantity, e.created_at
    FROM cashbook_entries e JOIN cashbook_entry_items i ON i.entry_id = e.id
   WHERE e.entry_type = 'income' AND e.category_key = 'sol_erda_fragment' AND e.ocid IS NOT NULL AND i.quantity > 0
  UNION ALL
  SELECT e.id, 'hexa', u.ocid, e.entry_date, -u.fragments, e.created_at
    FROM cashbook_entries e JOIN cashbook_entry_fragment_uses u ON u.entry_id = e.id
   WHERE u.fragment_source = 'hunt' AND u.fragments > 0`

/**
 * 조각 장부. 날짜 차례이고, 같은 날이면 먼저 적은 기록이 앞이다.
 *
 * @param ocid 이 캐릭터의 장부만. 비우면 모든 캐릭터
 */
export async function readFragmentMoves(db: SqliteDbConnection, ocid?: string): Promise<StoredFragmentMove[]> {
  const where = ocid === undefined ? '' : 'WHERE ocid = ?'
  const { values } = await db.query(
    `SELECT * FROM (${MOVES_SQL}) ${where} ORDER BY date, created_at, entry_id`,
    ocid === undefined ? [] : [ocid],
  )
  return (values ?? []).map((row: Record<string, unknown>) => ({
    entryId: row.entry_id as string,
    kind: row.kind as FragmentMoveKind,
    ocid: row.ocid as string,
    date: row.date as string,
    delta: Number(row.delta),
  }))
}

/** 저장 앞뒤 장부를 캐릭터마다 견줘 모자라게 된 캐릭터와 날. */
export function shortagesOf(
  before: readonly StoredFragmentMove[],
  after: readonly StoredFragmentMove[],
): FragmentShortage[] {
  const ocids = [...new Set([...before, ...after].map((move) => move.ocid))]
  return ocids.flatMap((ocid) => {
    const days = fragmentShortfall(
      before.filter((move) => move.ocid === ocid),
      after.filter((move) => move.ocid === ocid),
    )
    return days.length === 0 ? [] : [{ ocid, days }]
  })
}

/**
 * 조각 장부를 바꿀 수 있는 쓰기를 검사와 함께 한다. 쓴 뒤 장부가 모자라게 되었으면 던진다. 부르는 쪽이 트랜잭션으로
 * 감싸므로 던지면 쓴 것이 모두 되돌아간다. 인벤토리에 넣은 아이템과 기타 조각의 남은 개수도 같이 본다
 * (`InventoryShortageError`). 판매 · 헥사 강화가 그 개수를 가져가기 때문이다.
 *
 * @param cut 쓴 뒤 검사 전에 부르는 일. 사냥 기록을 고쳐 모자라게 된 뒤 기록을 함께 줄인다. 받는 것은 쓰기 전 장부
 * @returns `cut` 이 돌려준 값
 */
export async function writeCheckingFragments<T = undefined>(
  db: SqliteDbConnection,
  write: () => Promise<void>,
  cut?: (before: readonly StoredFragmentMove[]) => Promise<T>,
): Promise<T | undefined> {
  const before = await readFragmentMoves(db)
  const inventoryBefore = await readInventoryRemaining(db)
  await write()
  const result = cut === undefined ? undefined : await cut(before)
  const shortages = shortagesOf(before, await readFragmentMoves(db))
  if (shortages.length > 0) throw new FragmentShortageError(shortages)
  const inventoryShortages = inventoryShortagesOf(inventoryBefore, await readInventoryRemaining(db))
  if (inventoryShortages.length > 0) throw new InventoryShortageError(inventoryShortages)
  return result
}

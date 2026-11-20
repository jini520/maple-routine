/**
 * 사냥 기록을 고쳐 조각 장부가 모자라게 되었을 때, 그 조각을 가져간 헥사 강화를 다른 보관으로 옮기는 자리.
 *
 * 옮겨도 강화가 보관에서 가져온 개수는 그대로라 금액이 안 바뀐다. 정산은 판 캐릭터의 보관에서 나온 것이라 옮기지 않는다.
 * 옮기고도 모자라면 부르는 쪽의 검사(`writeCheckingFragments`)가 던져, 옮긴 것까지 되돌아간다.
 */
import { availableFragmentsOn, planFragmentMoves } from '../lib/cashbook/fragment-ledger'
import { readEntries, replaceEntry } from './cashbook-entries'
import { spendEntryOf, spendRecordOf } from './cashbook-entry-shape'
import { readFragmentMoves, shortagesOf, type StoredFragmentMove } from './fragment-ledger'
import type { IncomeRecord } from './income'
import { readInventoryRemaining } from './inventory'
import type { SqliteDbConnection } from './ports'
import type { SpendRecord } from './spend'
import { getBossProfitDb } from './sqlite/db'

/** 헥사 강화를 옮길 곳. 화면 쪽이 캐릭터 목록과 메이플 ID 기록에서 읽어 넘긴다. */
export interface HexaSources {
  /** 헥사 강화가 보관을 가져올 캐릭터의 차례. 강화한 캐릭터를 받는다 */
  candidatesOf: (ocid: string) => readonly string[]
  /** 강화한 캐릭터의 메이플 ID · 월드. 그 기타 조각으로 먼저 옮긴다. 없으면 그 기록이 이미 가져간 기타 조각의 주인만 본다 */
  ownerOf?: (ocid: string) => { accountId: string; worldKey: string } | null
}

/** 장부에 나오는 헥사 기록. id 가 열쇠다. */
async function readHexas(db: SqliteDbConnection, ids: readonly string[]): Promise<Map<string, SpendRecord>> {
  if (ids.length === 0) return new Map()
  const entries = await readEntries(db, `e.id IN (${ids.map(() => '?').join(', ')})`, [...ids])
  return new Map(entries.map((entry) => [entry.head.id, spendRecordOf(entry)]))
}

/** 그 캐릭터들의 장부에서 보관을 가져간 헥사 기록의 id. */
function hexaIdsOf(moves: readonly StoredFragmentMove[], ocids: readonly string[]): string[] {
  return [...new Set(moves.filter((move) => move.kind === 'hexa' && ocids.includes(move.ocid)).map((move) => move.entryId))]
}

/**
 * 쓰기 뒤 모자라게 된 장부에서 헥사 강화를 옮길 계획. 받은 장부와 기록으로 세기만 하고 쓰지 않는다.
 *
 * 모자란 캐릭터마다 고친 날짜에 가까운 헥사 강화부터, 강화한 캐릭터의 메이플 ID · 월드의 기타 조각, 그다음 다른 캐릭터의
 * 보관으로 옮긴다. 차례가 강화할 때의 배분(`allocateHexaStorage`)과 같아야 고칠 때마다 배분이 달라지지 않는다.
 *
 * @param input.otherLeft 메이플 ID · 월드마다 남은 기타 조각. 옮긴 만큼 줄인다
 * @returns 옮긴 뒤의 헥사 기록과, 옮긴 것까지 든 장부
 */
function planMoves(input: {
  before: readonly StoredFragmentMove[]
  after: readonly StoredFragmentMove[]
  savingIds: readonly string[]
  hexas: ReadonlyMap<string, SpendRecord>
  otherLeft: Map<string, number>
  sources: HexaSources
}): { changes: SpendRecord[]; ledger: StoredFragmentMove[] } {
  const shortOcids = shortagesOf(input.before, input.after).map((each) => each.ocid)
  /** 옮긴 것까지 든 장부. 앞의 헥사 기록이 가져간 보관을 뒤 기록이 또 가져가지 않게 한다. */
  const ledger = [...input.after]
  const changed = new Map<string, SpendRecord>()

  for (const ocid of shortOcids) {
    const mine = input.after.filter((move) => move.ocid === ocid)
    planFragmentMoves({
      before: input.before.filter((move) => move.ocid === ocid),
      after: mine,
      takers: mine
        .filter((move) => move.kind === 'hexa' && move.delta < 0 && !input.savingIds.includes(move.entryId))
        .map((move) => ({ id: move.entryId, date: move.date, fragments: -move.delta })),
      take: (taker, wanted) => {
        const record = changed.get(taker.id) ?? input.hexas.get(taker.id)
        const hexa = record?.hexa
        if (record === undefined || hexa == null) return 0
        let rest = wanted

        let otherUse = hexa.otherUse
        const owner = otherUse ?? (record.ocid === null ? null : (input.sources.ownerOf?.(record.ocid) ?? null))
        if (owner !== null) {
          const key = `other:${owner.accountId}:${owner.worldKey}`
          const got = Math.min(Math.max(input.otherLeft.get(key) ?? 0, 0), rest)
          if (got > 0) {
            input.otherLeft.set(key, (input.otherLeft.get(key) ?? 0) - got)
            otherUse = { accountId: owner.accountId, worldKey: owner.worldKey, fragments: (otherUse?.fragments ?? 0) + got }
            rest -= got
          }
        }

        const uses = hexa.storageUses.map((use) => ({ ...use }))
        const candidates = record.ocid === null ? [] : input.sources.candidatesOf(record.ocid)
        for (const each of candidates.filter((candidate) => !shortOcids.includes(candidate))) {
          if (rest === 0) break
          const stored = availableFragmentsOn(ledger.filter((move) => move.ocid === each), record.spentOn)
          const got = Math.min(Math.max(stored, 0), rest)
          if (got === 0) continue
          ledger.push({ entryId: record.id, kind: 'hexa', ocid: each, date: record.spentOn, delta: -got })
          const held = uses.find((use) => use.ocid === each)
          if (held === undefined) uses.push({ ocid: each, fragments: got })
          else held.fragments += got
          rest -= got
        }

        const moved = wanted - rest
        if (moved === 0) return 0
        const from = uses.find((use) => use.ocid === ocid)
        if (from !== undefined) from.fragments -= moved
        ledger.push({ entryId: record.id, kind: 'hexa', ocid, date: record.spentOn, delta: moved })
        changed.set(record.id, {
          ...record,
          hexa: { ...hexa, storageUses: uses.filter((use) => use.fragments > 0), ...(otherUse === undefined ? {} : { otherUse }) },
        })
        return moved
      },
    })
  }
  return { changes: [...changed.values()], ledger }
}

/**
 * 쓰기 뒤 모자라게 된 장부에서 헥사 강화를 다른 보관으로 옮겨 쓰는 일. 부르는 쪽이 트랜잭션으로 감싸고, 옮긴 뒤에도
 * 모자라면 그 검사가 던져 모두 되돌린다.
 *
 * @param savingIds 지금 쓰는 기록. 옮길 기록에서 뺀다
 * @param before 쓰기 전 장부
 * @returns 옮긴 헥사 기록이 있으면 `true`. 지출 판을 올린다
 */
export async function moveHexaAfterWrite(
  db: SqliteDbConnection,
  savingIds: readonly string[],
  before: readonly StoredFragmentMove[],
  sources: HexaSources,
  now: Date,
): Promise<boolean> {
  const after = await readFragmentMoves(db)
  const shortOcids = shortagesOf(before, after).map((each) => each.ocid)
  if (shortOcids.length === 0) return false
  const { changes } = planMoves({
    before,
    after,
    savingIds,
    hexas: await readHexas(db, hexaIdsOf(after, shortOcids)),
    otherLeft: await readInventoryRemaining(db),
    sources,
  })
  for (const record of changes) await replaceEntry(db, spendEntryOf(record), now)
  return changes.length > 0
}

/**
 * 사냥 기록의 조각을 이보다 적게 저장하면, 헥사 강화를 옮겨도 장부가 모자라게 되는 경계. 저장된 기록의 캐릭터 · 날짜
 * 그대로 센다. 보관이 아닌 기록(조각 가격이 있다)과 아직 저장하지 않은 기록은 0 이다.
 *
 * @param record 수정으로 연 사냥 기록
 */
export async function getHuntFragmentFloor(record: IncomeRecord, sources: HexaSources): Promise<number> {
  const db = await getBossProfitDb()
  const before = await readFragmentMoves(db)
  const stored = before.find((move) => move.kind === 'hunt' && move.entryId === record.id)
  if (stored === undefined) return 0
  const hexas = await readHexas(db, hexaIdsOf(before, [stored.ocid]))
  const otherLeft = await readInventoryRemaining(db)
  /** 이 개수로 저장하면 옮긴 뒤 장부가 버티는가. 개수가 늘수록 버티므로 경계를 반씩 좁혀 찾는다. */
  const holds = (kept: number): boolean => {
    const after = before.flatMap((move) => (move !== stored ? [move] : kept > 0 ? [{ ...move, delta: kept }] : []))
    const { ledger } = planMoves({ before, after, savingIds: [record.id], hexas, otherLeft: new Map(otherLeft), sources })
    return shortagesOf(before, ledger).length === 0
  }
  let low = 0
  let high = stored.delta
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (holds(middle)) high = middle
    else low = middle + 1
  }
  return low
}

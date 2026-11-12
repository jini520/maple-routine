/**
 * 사냥 기록을 고쳐 조각 장부가 모자라게 되었을 때 함께 줄일 뒤 기록(정산 · 헥사 강화)을 세고 쓰는 자리.
 *
 * 계획은 사냥 기록을 쓴 뒤의 기기 DB 에서 센다. 확인 창을 띄울 때와 저장할 때가 같은 함수로 세야 사용자가 본 것과
 * 같은 기록이 바뀐다. 그래서 확인 창용 계획은 쓰고 되돌리는 트랜잭션 안에서 센다(`income.ts` 의 `previewIncomeCuts`).
 */
import { availableFragmentsOn, planFragmentCuts } from '../lib/cashbook/fragment-ledger'
import { hexaPricedFragments } from '../lib/cashbook/hexa-matrix'
import { netProceedsMeso } from '../lib/cashbook/item-split'
import { deleteEntry, readEntries, replaceEntry } from './cashbook-entries'
import { incomeEntryOf, incomeRecordOf, spendEntryOf, spendRecordOf } from './cashbook-entry-shape'
import { readFragmentMoves, shortagesOf, type StoredFragmentMove } from './fragment-ledger'
import type { IncomeRecord } from './income'
import type { SqliteDbConnection } from './ports'
import type { SpendRecord } from './spend'

/** 함께 바뀌는 기록 하나. 정산은 0개가 되면 지워져 `after` 가 `null` 이다. */
export type FragmentCutChange =
  | { kind: 'settle'; before: IncomeRecord; after: IncomeRecord | null }
  | { kind: 'hexa'; before: SpendRecord; after: SpendRecord }

/** 함께 바뀌는 기록과 그 계획을 가리키는 열쇠. 열쇠가 같으면 같은 기록이 같은 만큼 바뀐다. */
export interface FragmentCutPlan {
  changes: FragmentCutChange[]
  key: string
}

/** 확인 창에 보인 계획과 그 창에서 받은 값. */
export interface FragmentCutsApproval {
  /** 헥사 강화가 보관을 가져올 캐릭터의 차례. 강화한 캐릭터를 받는다 */
  candidatesOf: (ocid: string) => readonly string[]
  key: string
  /** 가격 없이 저장된 헥사 기록에 넣을 개당 가격. 기록 id 가 열쇠이고 0 도 값이다 */
  prices: Readonly<Record<string, number>>
}

/** 확인 창을 띄운 뒤 다른 저장이 끼어 바뀌는 기록이 달라졌다는 뜻. 아무것도 쓰지 않았다. */
export class FragmentCutsChangedError extends Error {
  constructor() {
    super('함께 바뀌는 기록이 달라졌습니다')
    this.name = 'FragmentCutsChangedError'
  }
}

export const NO_FRAGMENT_CUTS: FragmentCutPlan = { changes: [], key: '' }

/** 헥사 기록에서 개당 가격을 곱할 개수. 보관에서 가져온 개수가 줄면 는다. */
function pricedOf(record: SpendRecord): number {
  const hexa = record.hexa!
  return hexaPricedFragments({
    fragments: hexa.fragmentCount,
    untradable: hexa.untradableFragmentCount,
    taken: hexa.storageUses.reduce((sum, use) => sum + use.fragments, 0),
    takenAsSpend: hexa.storageAsSpend,
  })
}

/** 가격 없이 저장된 헥사 기록이 줄어 곱할 개수가 생겼는가. 그러면 확인 창에서 가격을 받는다. */
export function cutNeedsPrice(change: FragmentCutChange): boolean {
  return change.kind === 'hexa' && change.after.hexa!.fragmentPrice === null && pricedOf(change.after) > 0
}

/** 판 개수를 줄인 정산. 금액은 그 기록의 단가와 수수료율로 다시 센다. 0개면 `null` 이다. */
function cutSettle(record: IncomeRecord, cut: number): IncomeRecord | null {
  const sold = record.quantity ?? 0
  const quantity = sold - cut
  if (quantity <= 0) return null
  const unit = Math.round(((record.mesoAmount ?? 0) + (record.saleFeeMeso ?? 0)) / sold)
  const gross = quantity * unit
  const percent = record.saleFeePercent
  const mesoAmount = percent === null ? gross : netProceedsMeso(gross, percent)
  return { ...record, quantity, mesoAmount, saleFeeMeso: percent === null ? record.saleFeeMeso : gross - mesoAmount }
}

/** 보관 사용을 고친 헥사 기록. 금액은 그 기록의 개당 가격으로 다시 센다. 가격이 없으면 0 이다. */
function withUses(record: SpendRecord, uses: readonly { ocid: string; fragments: number }[]): SpendRecord {
  const next: SpendRecord = { ...record, hexa: { ...record.hexa!, storageUses: uses.filter((use) => use.fragments > 0) } }
  return { ...next, mesoAmount: pricedOf(next) * (next.hexa!.fragmentPrice ?? 0) }
}

function keyOf(changes: readonly FragmentCutChange[]): string {
  return changes
    .map((change) =>
      change.kind === 'settle'
        ? `${change.before.id}=${change.after?.quantity ?? 0}`
        : `${change.before.id}=${change.after.hexa!.storageUses.map((use) => `${use.ocid}:${use.fragments}`).join(',')}`,
    )
    .join('|')
}

/**
 * 쓰기 뒤 모자라게 된 장부를 되돌릴 계획. 모자란 캐릭터마다 고친 날짜에 가까운 기록부터 줄인다. 헥사 강화는 줄인 만큼을
 * 먼저 다른 캐릭터의 보관에서 다시 가져오고, 그래도 모자란 만큼만 보관 사용을 줄인다.
 *
 * @param savingIds 지금 쓰는 기록. 줄일 기록에서 뺀다
 * @param before 쓰기 전 장부
 */
export async function planCutsAfterWrite(
  db: SqliteDbConnection,
  savingIds: readonly string[],
  before: readonly StoredFragmentMove[],
  candidatesOf: (ocid: string) => readonly string[],
): Promise<FragmentCutPlan> {
  const after = await readFragmentMoves(db)
  const shortOcids = shortagesOf(before, after).map((each) => each.ocid)
  if (shortOcids.length === 0) return NO_FRAGMENT_CUTS

  const order: string[] = []
  const settleCuts = new Map<string, number>()
  const hexaCuts = new Map<string, Map<string, number>>()
  for (const ocid of shortOcids) {
    const ledgerAfter = after.filter((move) => move.ocid === ocid)
    const takers = ledgerAfter
      .filter((move) => move.delta < 0 && !savingIds.includes(move.entryId))
      .map((move) => ({ id: move.entryId, date: move.date, fragments: -move.delta }))
    const cuts = planFragmentCuts({ before: before.filter((move) => move.ocid === ocid), after: ledgerAfter, takers })
    for (const cut of cuts) {
      if (!order.includes(cut.id)) order.push(cut.id)
      if (ledgerAfter.find((move) => move.entryId === cut.id)?.kind === 'settle') {
        settleCuts.set(cut.id, (settleCuts.get(cut.id) ?? 0) + cut.fragments)
        continue
      }
      const byOcid = hexaCuts.get(cut.id) ?? new Map<string, number>()
      byOcid.set(ocid, (byOcid.get(ocid) ?? 0) + cut.fragments)
      hexaCuts.set(cut.id, byOcid)
    }
  }

  const entries = await readEntries(db, `e.id IN (${order.map(() => '?').join(', ')})`, order)
  const entryOf = new Map(entries.map((entry) => [entry.head.id, entry]))
  /** 다시 가져온 몫까지 든 장부. 앞의 헥사 기록이 가져간 보관을 뒤 기록이 또 가져가지 않게 한다. */
  const simulated: { ocid: string; date: string; delta: number }[] = [...after]
  const changes = order.map((id): FragmentCutChange => {
    const entry = entryOf.get(id)!
    const settleCut = settleCuts.get(id)
    if (settleCut !== undefined) {
      const record = incomeRecordOf(entry)
      return { kind: 'settle', before: record, after: cutSettle(record, settleCut) }
    }
    const record = spendRecordOf(entry)
    const cutByOcid = hexaCuts.get(id)!
    const uses = record.hexa!.storageUses.map((use) => ({ ...use, fragments: use.fragments - (cutByOcid.get(use.ocid) ?? 0) }))
    let rest = [...cutByOcid.values()].reduce((sum, each) => sum + each, 0)
    const candidates = record.ocid === null ? [] : candidatesOf(record.ocid)
    for (const ocid of candidates.filter((each) => !shortOcids.includes(each))) {
      if (rest === 0) break
      const ledger = simulated.filter((move) => move.ocid === ocid)
      const take = Math.min(Math.max(availableFragmentsOn(ledger, record.spentOn), 0), rest)
      if (take === 0) continue
      simulated.push({ ocid, date: record.spentOn, delta: -take })
      const held = uses.find((use) => use.ocid === ocid)
      if (held === undefined) uses.push({ ocid, fragments: take })
      else held.fragments += take
      rest -= take
    }
    return { kind: 'hexa', before: record, after: withUses(record, uses) }
  })
  return { changes, key: keyOf(changes) }
}

/**
 * 확인 창에서 받은 계획을 쓴다. 지금 센 계획의 열쇠가 다르면 쓰지 않고 던진다. 부르는 쪽이 트랜잭션으로 감싼다.
 *
 * @returns 쓴 계획. 헥사 기록이 바뀌었는지 보고 지출 판을 올린다
 */
export async function applyApprovedCuts(
  db: SqliteDbConnection,
  savingIds: readonly string[],
  before: readonly StoredFragmentMove[],
  approval: FragmentCutsApproval,
  now: Date,
): Promise<FragmentCutPlan> {
  const plan = await planCutsAfterWrite(db, savingIds, before, approval.candidatesOf)
  if (plan.key !== approval.key) throw new FragmentCutsChangedError()
  for (const change of plan.changes) {
    if (change.kind === 'settle') {
      if (change.after === null) await deleteEntry(db, change.before.id)
      else await replaceEntry(db, incomeEntryOf(change.after), now)
      continue
    }
    const price = approval.prices[change.before.id]
    const priced = cutNeedsPrice(change)
    // 가격 없이 쓰면 산 조각이 0 메소로 남는다. 확인 창은 가격을 넣어야 저장을 켠다.
    if (priced && price === undefined) throw new Error(`개당 가격이 없는 헥사 기록입니다: ${change.before.id}`)
    const after = priced && price !== undefined
      ? { ...change.after, mesoAmount: pricedOf(change.after) * price, hexa: { ...change.after.hexa!, fragmentPrice: price } }
      : change.after
    await replaceEntry(db, spendEntryOf(after), now)
  }
  return plan
}

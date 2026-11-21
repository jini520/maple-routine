/**
 * 헥사 매트릭스 표(`hexaMatrix` 칸)를 읽는 자리. 비용 값은 사용자가 준 표 그대로다.
 *
 * 코어 줄이 직업과 종류를 줄 id 로 가리킨다. 한 직업의 코어 목록은 그 직업의 코어와 `전직업` 줄의 코어(솔 야누스 · 솔 헤카테)를
 * 함께 읽어 종류의 차례, 같은 종류 안에서는 코어의 차례로 세운다. 새 종류가 나와도 서버 표에 줄을 더하면 되도록 종류 글자를
 * 코드에 적지 않는다.
 */
import type {
  HexaCoreLevelCostRow,
  HexaCoreRow,
  HexaCoreTypeRow,
  HexaMatrixTable,
  HexaStatRow,
  JobRow,
} from '../../types/game-data'
import {
  compact,
  isBoolean,
  isInteger,
  isNonEmptyString,
  isNonNegativeInteger,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'

export interface HexaCoreKind {
  readonly key: string
  readonly name: string
  readonly maxLevel: number
  /** 종류 라벨이 붙은 그림의 id. */
  readonly iconAssetId: string
}

export interface HexaCore {
  /** 기록의 `item_key`. 넥슨이 준 이름에서 앞뒤 공백을 걷은 글자다. */
  readonly name: string
  /** 코어 스킬 그림의 id. */
  readonly iconAssetId: string
  readonly kind: HexaCoreKind
}

export type HexaStat = HexaStatRow

const trimmed = (name: string): string => name.normalize('NFC').trim()

function toJob(row: Row): JobRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.name) || !isBoolean(row.isAllJobs)) return null
  return { id: row.id, name: row.name, isAllJobs: row.isAllJobs }
}

function toType(row: Row): HexaCoreTypeRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.apiType) || !isBoolean(row.isDefault) || !isPositiveInteger(row.maxLevel)) return null
  if (!isNonEmptyString(row.iconAssetId) || !isInteger(row.sortOrder)) return null
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    apiType: row.apiType,
    isDefault: row.isDefault,
    maxLevel: row.maxLevel,
    iconAssetId: row.iconAssetId,
    sortOrder: row.sortOrder,
  }
}

function toCore(row: Row): HexaCoreRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.jobId) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.typeId) || !isNonEmptyString(row.iconAssetId) || !isInteger(row.sortOrder)) return null
  return {
    id: row.id,
    jobId: row.jobId,
    name: trimmed(row.name),
    typeId: row.typeId,
    iconAssetId: row.iconAssetId,
    sortOrder: row.sortOrder,
  }
}

function toLevelCost(row: Row): HexaCoreLevelCostRow | null {
  if (!isNonEmptyString(row.typeId) || !isNonNegativeInteger(row.fromLevel)) return null
  if (!isNonNegativeInteger(row.fragmentQuantity) || !isNonNegativeInteger(row.solErdaQuantity)) return null
  return {
    typeId: row.typeId,
    fromLevel: row.fromLevel,
    fragmentQuantity: row.fragmentQuantity,
    solErdaQuantity: row.solErdaQuantity,
  }
}

function toStat(row: Row): HexaStatRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  const activationFragmentQuantity = optional(row.activationFragmentQuantity, isNonNegativeInteger)
  if (activationFragmentQuantity === false) return null
  return compact({ id: row.id, key: row.key, name: row.name, activationFragmentQuantity })
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 코어와 비용 줄은 이 칸의 직업 · 종류를 가리켜야 한다. 없는 종류를 가리키는 코어는 비용을 낼 수 없다.
 */
export function parseHexaMatrix(value: unknown): HexaMatrixTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const jobs = rowsOf(value.jobs, toJob)
  const hexaCoreTypes = rowsOf(value.hexaCoreTypes, toType)
  const hexaCores = rowsOf(value.hexaCores, toCore)
  const hexaCoreLevelCosts = rowsOf(value.hexaCoreLevelCosts, toLevelCost)
  const hexaStats = rowsOf(value.hexaStats, toStat)
  if (jobs === null || hexaCoreTypes === null || hexaCores === null || hexaCoreLevelCosts === null || hexaStats === null) {
    return null
  }
  if (!uniqueBy(jobs, (job) => job.id) || !uniqueBy(jobs, (job) => job.name)) return null
  if (!uniqueBy(hexaCoreTypes, (type) => type.id) || !uniqueBy(hexaCoreTypes, (type) => type.key)) return null
  if (!uniqueBy(hexaCores, (core) => `${core.jobId}|${core.name}`) || !uniqueBy(hexaStats, (stat) => stat.key)) return null
  if (!uniqueBy(hexaCoreLevelCosts, (row) => `${row.typeId}|${row.fromLevel}`)) return null
  const jobIds = new Set(jobs.map((job) => job.id))
  const typeIds = new Set(hexaCoreTypes.map((type) => type.id))
  if (hexaCores.some((core) => !jobIds.has(core.jobId) || !typeIds.has(core.typeId))) return null
  if (hexaCoreLevelCosts.some((row) => !typeIds.has(row.typeId))) return null
  return { updatedAt, jobs, hexaCoreTypes, hexaCores, hexaCoreLevelCosts, hexaStats }
}

export const hexaMatrixTable = gameTable<HexaMatrixTable>(
  'hexaMatrix',
  { updatedAt: null, jobs: [], hexaCoreTypes: [], hexaCores: [], hexaCoreLevelCosts: [], hexaStats: [] },
  parseHexaMatrix,
)

const index = derive(hexaMatrixTable, (table) => {
  const typeById = new Map(table.hexaCoreTypes.map((type) => [type.id, type]))
  const kinds = new Map<string, HexaCoreKind>(
    table.hexaCoreTypes.map((type) => [
      type.key,
      { key: type.key, name: type.name, maxLevel: type.maxLevel, iconAssetId: type.iconAssetId },
    ]),
  )
  const coreOf = (row: HexaCoreRow): HexaCore | null => {
    const kind = kinds.get(typeById.get(row.typeId)?.key ?? '')
    return kind === undefined ? null : { name: row.name, iconAssetId: row.iconAssetId, kind }
  }
  const order = (row: HexaCoreRow): [number, number] => [typeById.get(row.typeId)?.sortOrder ?? 0, row.sortOrder]
  const allJobIds = new Set(table.jobs.filter((job) => job.isAllJobs).map((job) => job.id))
  const shared = table.hexaCores.filter((core) => allJobIds.has(core.jobId))
  const coresByJob = new Map<string, HexaCore[]>()
  for (const job of table.jobs) {
    if (job.isAllJobs) continue
    const rows = [...table.hexaCores.filter((core) => core.jobId === job.id), ...shared].sort((a, b) => {
      const [typeA, coreA] = order(a)
      const [typeB, coreB] = order(b)
      return typeA - typeB || coreA - coreB
    })
    coresByJob.set(job.name, rows.flatMap((row) => coreOf(row) ?? []))
  }
  const coresByName = new Map<string, HexaCore>()
  for (const row of table.hexaCores) {
    const core = coreOf(row)
    // 여러 직업이 가진 같은 이름의 코어는 그림이 다를 수 있다. 직업을 모를 때는 먼저 선 줄로 충분하다.
    if (core !== null && !coresByName.has(row.name)) coresByName.set(row.name, core)
  }
  const costs = new Map<string, HexaCoreLevelCostRow>(
    table.hexaCoreLevelCosts.map((row) => [`${typeById.get(row.typeId)?.key}|${row.fromLevel}`, row]),
  )
  return { kinds, coresByJob, coresByName, costs, stats: table.hexaStats }
})

/** 그 직업의 코어 전부. 종류의 차례, 같은 종류 안에서는 코어의 차례다. 활성화하지 않은 코어는 넥슨이 안 주므로 이 표가 목록이다. */
export function hexaJobCores(job: string): readonly HexaCore[] {
  return index().coresByJob.get(job) ?? []
}

/** 기록의 key(코어 이름)로 코어를 되짚는다. 직업을 몰라도 된다. */
export function findHexaCore(name: string | null): HexaCore | null {
  if (name === null) return null
  return index().coresByName.get(trimmed(name)) ?? null
}

/** 종류 key 로 종류를 찾는다. */
export function findHexaKind(key: string): HexaCoreKind | null {
  return index().kinds.get(key) ?? null
}

/**
 * Lv.`from` 에서 Lv.`to` 까지 올리는 데 드는 조각과 솔 에르다. 그 사이 단계 비용의 합이다.
 *
 * 범위가 비었거나(`from >= to`) 만렙을 넘거나 비용 줄이 빠진 단계가 있으면 `null` 이다. 0 으로 세우면 저장이
 * 거짓 금액으로 열린다.
 */
export function hexaFragmentsBetween(kindKey: string, from: number, to: number): { fragments: number; solErda: number } | null {
  const kind = index().kinds.get(kindKey)
  if (kind === undefined || from < 0 || from >= to || to > kind.maxLevel) return null
  let fragments = 0
  let solErda = 0
  for (let level = from; level < to; level += 1) {
    const row = index().costs.get(`${kindKey}|${level}`)
    if (row === undefined) return null
    fragments += row.fragmentQuantity
    solErda += row.solErdaQuantity
  }
  return { fragments, solErda }
}

/** 헥사 스탯 전부. 표의 차례 그대로다. */
export function hexaStats(): readonly HexaStat[] {
  return index().stats
}

export function findHexaStat(key: string | null): HexaStat | null {
  if (key === null) return null
  return index().stats.find((stat) => stat.key === key) ?? null
}

/** 보관에서 가져온 조각. `takenAsSpend` 가 참이면 그 몫도 개당 가격으로 지출에 넣는다. */
interface HexaTaken {
  taken?: number
  takenAsSpend?: boolean
}

/** 필요 조각에서 교환 불가와 보관에서 가져온 개수를 뺀 수. 더 구해야 할 조각이다. */
export function hexaFragmentsLeft(input: { fragments: number; untradable: number; taken: number }): number {
  return Math.max(0, input.fragments - input.untradable - input.taken)
}

/** 개당 가격을 곱할 개수. 0 이면 개당 가격을 받지 않는다. */
export function hexaPricedFragments(input: { fragments: number; untradable: number } & HexaTaken): number {
  const taken = input.takenAsSpend === true ? 0 : (input.taken ?? 0)
  return hexaFragmentsLeft({ fragments: input.fragments, untradable: input.untradable, taken })
}

/**
 * 헥사 지출 금액. 개당 가격을 곱할 개수 × 개당 가격이다. 교환 불가 조각은 이벤트로 얻어 돈이 안 든 조각이고,
 * 보관 조각은 사냥한 날 수입으로 잡히지 않아 지출 체크를 켰을 때만 넣는다.
 */
export function hexaSpendMeso(input: { fragments: number; untradable: number; price: number } & HexaTaken): number {
  return hexaPricedFragments(input) * input.price
}

/**
 * 보관 조각을 가져오는 캐릭터의 차례. 강화한 캐릭터가 먼저이고, 그다음은 메이플 ID 도 월드도 같은 추적 캐릭터를
 * 캐릭터 관리 순서로 둔다. 강화한 캐릭터의 메이플 ID 나 월드를 모르면 같은지 알 수 없어 자신뿐이다.
 *
 * @param input.trackedOcids 캐릭터 관리에 저장한 순서
 */
export function hexaStorageCandidates(input: {
  ocid: string
  trackedOcids: readonly string[]
  accountOf: (ocid: string) => string | null
  worldOf: (ocid: string) => string | null
}): string[] {
  const account = input.accountOf(input.ocid)
  const world = input.worldOf(input.ocid)
  if (account === null || world === null) return [input.ocid]
  const others = input.trackedOcids.filter(
    (ocid) => ocid !== input.ocid && input.accountOf(ocid) === account && input.worldOf(ocid) === world,
  )
  return [input.ocid, ...others]
}

/** 한 메이플 ID · 월드의 기타 조각(인벤토리에 넣은 조각). 날짜가 없어 어느 날의 강화에도 쓴다. */
export interface OtherFragmentStorage {
  accountId: string
  worldKey: string
  stored: number
}

/** 헥사 강화가 가져올 수 있는 보관. 기타 조각은 강화한 캐릭터의 메이플 ID · 월드를 모르면 `null` 이다. */
export interface HexaStorages {
  other: OtherFragmentStorage | null
  /** `hexaStorageCandidates` 차례의 캐릭터별 사냥 조각 보관 */
  hunts: readonly { ocid: string; stored: number }[]
}

/**
 * 보관에서 가져오는 배분. 교환 불가를 먼저 빼고, 남은 개수를 강화한 캐릭터의 메이플 ID · 월드의 기타 조각에서 먼저
 * 가져온 뒤 `storages` 차례대로 사냥 조각에서 가져온다. 보관이 0 이하인 자리는 건너뛴다.
 *
 * 기타 조각이 먼저인 것은 캐릭터가 아니라 메이플 ID · 월드의 것이라 어느 캐릭터의 강화에 써도 같아서다.
 *
 * @param input.storages `hexaStorageCandidates` 차례의 캐릭터별 사냥 조각 보관
 */
export function allocateHexaStorage(input: {
  fragments: number
  untradable: number
  other?: OtherFragmentStorage | null
  storages: readonly { ocid: string; stored: number }[]
}): {
  uses: { ocid: string; fragments: number }[]
  otherUse?: { accountId: string; worldKey: string; fragments: number }
  taken: number
} {
  let rest = Math.max(0, input.fragments - input.untradable)
  const other = input.other ?? null
  const otherTaken = other === null || other.stored <= 0 ? 0 : Math.min(other.stored, rest)
  rest -= otherTaken
  const uses: { ocid: string; fragments: number }[] = []
  for (const { ocid, stored } of input.storages) {
    if (rest === 0) break
    if (stored <= 0) continue
    const fragments = Math.min(stored, rest)
    uses.push({ ocid, fragments })
    rest -= fragments
  }
  const taken = uses.reduce((sum, use) => sum + use.fragments, otherTaken)
  return otherTaken === 0 || other === null
    ? { uses, taken }
    : { uses, otherUse: { accountId: other.accountId, worldKey: other.worldKey, fragments: otherTaken }, taken }
}

/** 여러 스킬을 묶은 코어 이름(`가/나/다`)의 첫 스킬과 나머지 수. 목록에서 이름을 한 줄에 두기 위해서다. */
export function hexaCoreLabel(name: string): { first: string; more: number } {
  const parts = name.split('/')
  return { first: parts[0]?.trim() ?? name, more: parts.length - 1 }
}

/** 헥사 스킬 기록 이름. `매화검 본초 : 선참 VI Lv.25 → 28`. */
export function hexaSkillRecordName(coreName: string, from: number, to: number): string {
  return `${hexaCoreLabel(coreName).first} Lv.${from} → ${to}`
}

/**
 * 헥사 기록이 무엇을 올렸나. 헥사 스킬은 코어 이름의 첫 스킬, 헥사 스탯은 스탯 이름이다. 통계의 줄과 하루 목록이 같이 쓴다.
 * 표에서 못 찾으면 `null` 이다.
 *
 * @param isStat 헥사 스탯 기록인가. 기록의 활성화 칸이 참 · 거짓이면 스탯이다.
 */
export function hexaTargetOf(itemKey: string | null, isStat: boolean): { key: string; name: string } | null {
  if (itemKey === null) return null
  if (isStat) {
    const stat = findHexaStat(itemKey)
    return stat === null ? null : { key: `stat:${stat.key}`, name: stat.name }
  }
  return { key: `core:${trimmed(itemKey)}`, name: hexaCoreLabel(itemKey).first }
}

/**
 * 넥슨 `character/hexamatrix` 의 코어 줄을 코어 이름별 레벨로 옮긴다. 이름은 앞뒤 공백을 걷는다.
 * 레벨은 `hexa_core_level` 만 쓴다. 이벤트로 오른 레벨은 조각이 안 들었다.
 */
export function hexaLevelsOf(
  rows: ReadonlyArray<{ hexa_core_name?: string | null; hexa_core_level?: number | null }>,
): Record<string, number> {
  const levels: Record<string, number> = {}
  for (const row of rows) {
    if (row.hexa_core_name == null || row.hexa_core_level == null) continue
    levels[trimmed(row.hexa_core_name)] = row.hexa_core_level
  }
  return levels
}

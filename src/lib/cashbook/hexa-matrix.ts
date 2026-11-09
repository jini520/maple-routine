/**
 * 헥사 매트릭스 표(`hexaMatrix` 칸)를 읽는 자리. 비용 값은 사용자가 준 표 그대로다.
 *
 * 코어의 종류는 이름 표가 먼저 정하고, 없으면 그 API 타입의 기본 종류다. 넥슨 `hexa_core_type` 이 3rd 스킬 코어와
 * 직업 공용 코어를 가르지 않기 때문이다. 새 종류가 나와도 서버 표에 줄을 더하면 되도록 종류 글자를 코드에 적지 않는다.
 */
import type {
  HexaCoreKindRow,
  HexaCoreLevelCostRow,
  HexaCoreNameKindRow,
  HexaJobCoreRow,
  HexaMatrixTable,
  HexaStatRow,
} from '../../types/game-data'
import {
  compact,
  isBoolean,
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
  readonly apiType: string
  /** 코어 스킬 그림의 id. */
  readonly iconAssetId: string
  /** 종류 표에 없는 API 타입이면 `null` 이고 그 코어는 비용을 낼 수 없다. */
  readonly kind: HexaCoreKind | null
}

export interface HexaStat {
  readonly key: string
  readonly name: string
  readonly activationFragments?: number
}

const trimmed = (name: string): string => name.normalize('NFC').trim()

function toKind(row: Row): HexaCoreKindRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.name) || !isNonEmptyString(row.apiType)) return null
  if (!isBoolean(row.isDefault) || !isPositiveInteger(row.maxLevel) || !isNonEmptyString(row.iconAssetId)) return null
  return {
    key: row.key,
    name: row.name,
    apiType: row.apiType,
    isDefault: row.isDefault,
    maxLevel: row.maxLevel,
    iconAssetId: row.iconAssetId,
  }
}

function toLevelCost(row: Row): HexaCoreLevelCostRow | null {
  if (!isNonEmptyString(row.kind) || !isNonNegativeInteger(row.level)) return null
  if (!isNonNegativeInteger(row.fragments) || !isNonNegativeInteger(row.solErda)) return null
  return { kind: row.kind, level: row.level, fragments: row.fragments, solErda: row.solErda }
}

function toNameKind(row: Row): HexaCoreNameKindRow | null {
  if (!isNonEmptyString(row.name) || !isNonEmptyString(row.kind)) return null
  return { name: trimmed(row.name), kind: row.kind }
}

function toJobCore(row: Row): HexaJobCoreRow | null {
  if (!isNonEmptyString(row.job) || !isNonEmptyString(row.name)) return null
  if (!isNonEmptyString(row.apiType) || !isNonEmptyString(row.iconAssetId)) return null
  return { job: row.job, name: trimmed(row.name), apiType: row.apiType, iconAssetId: row.iconAssetId }
}

function toStat(row: Row): HexaStatRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  const activationFragments = optional(row.activationFragments, isNonNegativeInteger)
  if (activationFragments === false) return null
  return compact({ key: row.key, name: row.name, activationFragments })
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다. */
export function parseHexaMatrix(value: unknown): HexaMatrixTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const kinds = rowsOf(value.kinds, toKind)
  const levelCosts = rowsOf(value.levelCosts, toLevelCost)
  const nameKinds = rowsOf(value.nameKinds, toNameKind)
  const jobCores = rowsOf(value.jobCores, toJobCore)
  const stats = rowsOf(value.stats, toStat)
  if (kinds === null || levelCosts === null || nameKinds === null || jobCores === null || stats === null) return null
  if (!uniqueBy(kinds, (kind) => kind.key) || !uniqueBy(stats, (stat) => stat.key)) return null
  // 기본 종류가 둘이면 이름 표에 없는 코어가 어느 쪽인지 못 정한다.
  if (!uniqueBy(kinds.filter((kind) => kind.isDefault), (kind) => kind.apiType)) return null
  if (!uniqueBy(nameKinds, (row) => row.name) || !uniqueBy(jobCores, (row) => `${row.job}|${row.name}`)) return null
  if (!uniqueBy(levelCosts, (row) => `${row.kind}|${row.level}`)) return null
  const known = new Set(kinds.map((kind) => kind.key))
  if (!levelCosts.every((row) => known.has(row.kind)) || !nameKinds.every((row) => known.has(row.kind))) return null
  return { updatedAt, kinds, levelCosts, nameKinds, jobCores, stats }
}

export const hexaMatrixTable = gameTable(
  'hexaMatrix',
  { updatedAt: null, kinds: [], levelCosts: [], nameKinds: [], jobCores: [], stats: [] },
  parseHexaMatrix,
)

const index = derive(hexaMatrixTable, (table) => {
  const kinds = new Map<string, HexaCoreKind>(
    table.kinds.map((row) => [row.key, { key: row.key, name: row.name, maxLevel: row.maxLevel, iconAssetId: row.iconAssetId }]),
  )
  const defaults = new Map<string, HexaCoreKind>()
  for (const row of table.kinds) {
    const kind = kinds.get(row.key)
    if (row.isDefault && kind !== undefined) defaults.set(row.apiType, kind)
  }
  const named = new Map<string, HexaCoreKind>()
  for (const row of table.nameKinds) {
    const kind = kinds.get(row.kind)
    if (kind !== undefined) named.set(row.name, kind)
  }
  const kindOf = (core: { name: string; apiType: string }): HexaCoreKind | null =>
    named.get(trimmed(core.name)) ?? defaults.get(core.apiType) ?? null

  const coresByJob = new Map<string, HexaCore[]>()
  const coresByName = new Map<string, HexaCore>()
  for (const row of table.jobCores) {
    const core: HexaCore = { name: row.name, apiType: row.apiType, iconAssetId: row.iconAssetId, kind: kindOf(row) }
    const list = coresByJob.get(row.job)
    if (list === undefined) coresByJob.set(row.job, [core])
    else list.push(core)
    // 공용 코어(솔 야누스 등)는 직업마다 같은 이름 · 그림이라 먼저 선 것으로 충분하다.
    if (!coresByName.has(row.name)) coresByName.set(row.name, core)
  }
  const costs = new Map<string, HexaCoreLevelCostRow>(table.levelCosts.map((row) => [`${row.kind}|${row.level}`, row]))
  const stats: HexaStat[] = table.stats
  return { kinds, kindOf, coresByJob, coresByName, costs, stats }
})

/** 코어의 종류. 이름 표가 먼저이고 없으면 API 타입의 기본 종류다. 둘 다 없으면 `null`. */
export function hexaKindOf(core: { name: string; apiType: string }): HexaCoreKind | null {
  return index().kindOf(core)
}

/** 그 직업의 코어 전부. 넥슨 hexamatrix 의 차례 그대로다. 활성화하지 않은 코어는 넥슨이 안 주므로 이 표가 목록이다. */
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
    fragments += row.fragments
    solErda += row.solErda
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

/**
 * 보관에서 가져오는 배분. 교환 불가를 먼저 빼고 남은 개수를 `storages` 차례대로 가져온다. 보관이 0 이하인
 * 캐릭터는 건너뛴다.
 *
 * @param input.storages `hexaStorageCandidates` 차례의 캐릭터별 보관
 */
export function allocateHexaStorage(input: {
  fragments: number
  untradable: number
  storages: readonly { ocid: string; stored: number }[]
}): { uses: { ocid: string; fragments: number }[]; taken: number } {
  let rest = Math.max(0, input.fragments - input.untradable)
  const uses: { ocid: string; fragments: number }[] = []
  for (const { ocid, stored } of input.storages) {
    if (rest === 0) break
    if (stored <= 0) continue
    const fragments = Math.min(stored, rest)
    uses.push({ ocid, fragments })
    rest -= fragments
  }
  return { uses, taken: uses.reduce((sum, use) => sum + use.fragments, 0) }
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

// 보스 수익 화면의 **캐릭터 그룹 계산** 순수 함수들(ADR-094 결정 7로 화면에서 분리).
//
// 행을 캐릭터 단위로 묶고, 그 묶음에서 총액·처치 수·결정석 수·고가 드롭을 뽑는다.
// DOM 을 만들지 않으므로 화면의 취약 구조(sticky·실측·스태킹)와 무관하고, 그래서 옮겨도
// 렌더 결과가 바뀌지 않는다 — DOM 스냅샷 6케이스가 그것을 확인한다.

import { dropRowKey } from '@core/features/boss-profit/store'
import type { BossProfitRow, BossProfitWeeklySubtotal } from '@core/features/boss-profit/store'
import { isSeasonBossName } from '@core/lib/boss-matching'
import { isValuableDrop } from '@core/lib/valuable-drops'
import { sumDropPayout } from '@core/lib/drop-price'
import type { RecordedDrop } from '@core/types/drops'
import weeklyBossesData from '@core/data/weekly-bosses.json'

export interface BossReferenceEntry {
  boss: string
  portraitSlug?: string
}

export interface CharacterGroup {
  ocid: string
  characterName: string
  imageUrl: string | null
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
}

export interface WorldCrystalSummary {
  world: string
  cleared: number
}

export const REFERENCE_ENTRIES: BossReferenceEntry[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]),
]
export function findPortraitSlug(boss: string): string | null {
  return REFERENCE_ENTRIES.find((entry) => entry.boss === boss)?.portraitSlug ?? null
}

export function rowKey(row: BossProfitRow): string {
  return `${row.ocid}-${row.boss}-${row.difficulty}-${row.cycle}-${row.periodKey}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function sumPayout(rows: BossProfitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)
}

export function sumSubtotals(subtotals: BossProfitWeeklySubtotal[]): number {
  return subtotals.reduce((sum, subtotal) => sum + subtotal.totalMeso, 0)
}

export function buildCharacterGroups(
  rows: BossProfitRow[],
  weeklySubtotals: BossProfitWeeklySubtotal[],
): CharacterGroup[] {
  const groups: CharacterGroup[] = []
  const indexByOcid = new Map<string, number>()

  function ensureGroup(ocid: string, characterName: string, imageUrl: string | null): CharacterGroup {
    const existingIndex = indexByOcid.get(ocid)
    if (existingIndex !== undefined) {
      return groups[existingIndex]
    }
    const group: CharacterGroup = { ocid, characterName, imageUrl, bossRows: [], weeklySubtotals: [] }
    indexByOcid.set(ocid, groups.length)
    groups.push(group)
    return group
  }

  for (const row of rows) {
    ensureGroup(row.ocid, row.characterName, row.imageUrl).bossRows.push(row)
  }
  for (const subtotal of weeklySubtotals) {
    ensureGroup(subtotal.ocid, subtotal.characterName, subtotal.imageUrl).weeklySubtotals.push(subtotal)
  }

  return groups
}

/**
 * 이 캐릭터가 이 기간에 번 전부 — 결정석 + 아이템([[ADR-124]] 결정 7).
 *
 * **드롭을 프롭으로 받는 이유**: 보스 행의 `payoutMeso` 는 결정석만 담고(그 값이 DB 기록이라
 * 가격을 고칠 때마다 재기록할 수 없다) 아이템은 **읽는 시점에** 더한다. 그래서 이 함수가 그
 * 덧셈이 일어나는 **한 곳**이고, 화면(총 수익)과 카드 헤더가 같은 함수를 쓴다.
 *
 * `weeklySubtotals`(월간 탭)에는 아이템이 이미 들어 있다 — 스토어가 소계를 만들 때 더한다.
 * `dropsByRowKey` 는 지금 화면의 행만 담으므로(월간 탭이면 월간 보스 행) 이중 계산이 없다.
 */
export function groupTotalMeso(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): number {
  const drops = group.bossRows.reduce(
    (sum, row) =>
      sum + sumDropPayout(dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []),
    0,
  )
  return sumPayout(group.bossRows) + sumSubtotals(group.weeklySubtotals) + drops
}

// 이 캐릭터가 현재 기간에 기록한 고가 아이템 드롭 목록. 드롭은 dropRowKey(ocid,boss,difficulty,periodKey)로
// 저장되므로 그룹의 보스 행마다 조회해 isValuableDrop(ADR-038)로 거른다. weekly 탭 기준이며, monthly 탭에서는
// 월간 보스 행의 드롭만 집계된다(주차별 합계에는 보스 행이 없어 대상이 아님).
export function collectGroupValuableDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  const valuable: RecordedDrop[] = []
  for (const row of group.bossRows) {
    const drops = dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []
    for (const drop of drops) {
      if (isValuableDrop(drop.itemName)) valuable.push(drop)
    }
  }
  return valuable
}

// 이 캐릭터가 이 기간에 기록한 드롭 전체([[ADR-124]] 결정 7) — 고가로 거르지 않는다.
// 캐릭터 카드 내역 팝오버가 이것을 아이템 단위로 접어 보여준다.
export function collectGroupDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  return group.bossRows.flatMap(
    (row) => dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? [],
  )
}

// 이 기간 전체(모든 추적 캐릭터)의 고가 드롭 — 총 수익 헤드라인 뱃지용(ADR-046). 캐릭터별 집계를
// 그대로 합치므로 월간 탭 한계(주차별 합계 행엔 보스 행이 없어 월간 보스 드롭만 잡힘)도 동일하게 승계한다.
export function collectAllValuableDrops(
  groups: CharacterGroup[],
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  return groups.flatMap((group) => collectGroupValuableDrops(group, dropsByRowKey))
}

// 이 캐릭터가 이번 주에 처치한 주간 보스 수([[ADR-054]] 결정 3) — 처치 수는 store 필드가 아니라
// rows에서 파생한다. 보스명 기준 distinct라 같은 보스를 여러 난이도로 완료해도 1로 센다(게임 룰이
// 그렇고, 보스 스케줄러가 쓰는 countClearedWeeklyBosses도 content_name 그룹당 1이다 — 두 지표가
// 어긋나면 같은 숫자가 화면마다 다르게 보인다). 시즌 보스(메이린)는 12마리 제한 예외라 제외한다.
// cycle 필터는 호출부(주간 탭)에서 사실상 no-op이지만, 월드별 결정석 합계(#53)도 이 함수 하나를
// 공유하므로 함수 안에 둔다.
export function countGroupClearedWeeklyBosses(group: CharacterGroup): number {
  const clearedBossNames = new Set<string>()
  for (const row of group.bossRows) {
    if (row.cycle !== 'weekly' || !row.isComplete || isSeasonBossName(row.boss)) continue
    clearedBossNames.add(row.boss)
  }
  return clearedBossNames.size
}

// 월드별 주간 결정석 소진량([[ADR-054]] 결정 1 — 90은 계정이 아니라 월드당 한도다). 캐릭터별
// 처치 수는 위 countGroupClearedWeeklyBosses를 그대로 재사용하고(계산 두 벌 금지, 결정 3) 여기서는
// 월드 묶음만 얹는다. 그룹의 행은 모두 같은 캐릭터에서 나오므로 월드도 첫 행에서 읽으면 된다.
// world가 null인 캐릭터(구버전 캐시)는 어느 월드 한도에도 귀속시킬 수 없어 조용히 제외한다
// (결정 6 — "미분류" 줄을 만들지 않는다). 결과 순서는 Map 삽입 순서 = 월드가 처음 등장한 캐릭터의
// 정렬 순서라 렌더마다 흔들리지 않는다(표시 순서 고정, [[ADR-036]]).
// ADR-069 결정 2: 집계 단위가 **행**이다. 전에는 `group.bossRows[0]?.world` 로 캐릭터당 월드를
// 하나로 정했는데, 주 중간에 월드를 옮기면 한 캐릭터의 행이 두 월드에 걸치므로 첫 행의 월드로
// 전부 쏠렸다. 판매 한도(90)는 **월드마다 따로 산정**되므로(사용자 확인) 그 주의 판매량은 두
// 월드에 각각 계상돼야 한다.
//
// 같은 보스는 한 주에 한 번만 처치할 수 있어(사용자 확인) 한 행은 정확히 한 월드에 속한다 —
// 그래서 행 단위로 갈라도 "보스명 distinct"의 의미가 유지된다(캐릭터별로 세던 것과 결과가 같고,
// 걸치는 주에서만 갈린다). 월드를 모르는 행(컬럼 도입 전 기록)은 조용히 빠진다([[ADR-054]] 결정 5).
//
// 캐릭터 카드의 진행 링은 이 함수를 쓰지 않는다 — 클리어 수는 캐릭터 단위로 이어지므로 월드와
// 무관하게 그 주 전체를 센다. 두 숫자의 집계 단위가 다른 것은 게임 규칙이 그렇게 갈려 있어서다.
export function summarizeWorldCrystals(groups: CharacterGroup[]): WorldCrystalSummary[] {
  // 월드 → (캐릭터 → 그 월드에서 처치한 보스명 집합). 캐릭터를 한 번 더 갈라야 서로 다른
  // 캐릭터가 같은 보스를 잡은 것이 하나로 합쳐지지 않는다.
  const bossNamesByWorld = new Map<string, Map<string, Set<string>>>()

  for (const group of groups) {
    for (const row of group.bossRows) {
      if (row.world === null) {
        continue
      }
      // **월드 집합과 처치 수를 분리한다**: 월드를 아는 행이 있으면 처치가 0이어도 그 월드를
      // 목록에 넣어 `0 / 90` 을 보여준다([[ADR-054]] 결정 — "월드는 알고 처치가 0이면 0 / 90을
      // 그대로 보여준다"). 완료 조건을 월드 판정에 섞으면 그 표시가 사라진다.
      const byCharacter = bossNamesByWorld.get(row.world) ?? new Map<string, Set<string>>()
      const bossNames = byCharacter.get(row.ocid) ?? new Set<string>()
      if (row.cycle === 'weekly' && row.isComplete && !isSeasonBossName(row.boss)) {
        bossNames.add(row.boss)
      }
      byCharacter.set(row.ocid, bossNames)
      bossNamesByWorld.set(row.world, byCharacter)
    }
  }

  return [...bossNamesByWorld].map(([world, byCharacter]) => ({
    world,
    cleared: [...byCharacter.values()].reduce((sum, bossNames) => sum + bossNames.size, 0),
  }))
}

// 이 캐릭터가 이 달에 처치한 월간 보스 수(보스명 distinct — 같은 보스를 여러 난이도로 잡아도 1).
// 주간 쪽 countGroupClearedWeeklyBosses와 대칭이며, **월간 탭 진행 링과 월간 결정석 칩이 이 함수
// 하나를 공유한다**([[ADR-059]] 결정 5 — [[ADR-054]] 결정 3의 "계산 두 벌 금지"를 월간에도 적용).
export function countGroupClearedMonthlyBosses(group: CharacterGroup): number {
  const clearedBossNames = new Set<string>()
  for (const row of group.bossRows) {
    if (row.cycle !== 'monthly' || !row.isComplete) continue
    clearedBossNames.add(row.boss)
  }
  return clearedBossNames.size
}

// 이 기간 월간 보스(검은마법사) 결정석 개수. 주간 90 한도에 포함되지 않는 별개 수치라([[ADR-054]]
// 결정 1·8) 위 주간 집계와 섞지 않는다 — 시즌 보스는 weekly 소속이라 여기선 판정할 것이 없다.
// 결정석은 캐릭터마다 각자 나오므로 그룹별 처치 수를 더한다.
export function countMonthlyCrystals(groups: CharacterGroup[]): number {
  return groups.reduce((total, group) => total + countGroupClearedMonthlyBosses(group), 0)
}

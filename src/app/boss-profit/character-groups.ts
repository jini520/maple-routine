/**
 * 보스 수익 화면의 캐릭터 그룹 계산. 행을 캐릭터 단위로 묶고 그 묶음에서 총액 · 처치 수 ·
 * 결정석 수 · 고가 드롭을 뽑는 순수 함수들.
 *
 * 뷰가 한 줄도 없고 `react-native` 를 import 하지 않는다.
 */

import { dropRowKey } from '../../features/boss-profit/store'
import type { BossProfitRow, BossProfitWeeklySubtotal } from '../../features/boss-profit/store'
import { isSeasonBoss } from '../../lib/boss/bosses'
import { isValuableDropItem } from '../../lib/drop/valuable-drops'
import { worldNameOf } from '../../lib/world/worlds'
import { sumDropPayout } from '../../lib/drop/drop-price'
import type { RecordedDrop } from '../../types/drops'

export interface CharacterGroup {
  ocid: string
  characterName: string
  imageUrl: string | null
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
}

export interface WorldCrystalSummary {
  /** 월드 key. 한도를 세는 단위이고 엠블럼을 찾는 열쇠다. */
  worldKey: string
  /** 보이는 월드 이름. 월드 표 이름이다. */
  world: string
  /** 주간 90 한도에 드는 주간 보스 결정석 수. */
  cleared: number
  /** 그 월드의 월간 보스 결정석 수. 90 한도와 무관한 별개 수치다. */
  monthlyCleared: number
}

export function rowKey(row: BossProfitRow): string {
  return `${row.ocid}-${row.bossKey}-${row.difficulty}-${row.cycle}-${row.periodKey}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 보스 행의 결정석 합.
 *
 * `payoutMeso` 가 `null` 인 두 경우(미완료 placeholder / 가격 미확정 보스)를 0 으로 접는다.
 * 드롭 판매가의 미입력 ≠ 0원 과는 다른 `null` 이다. 저쪽은 사용자가 아직 안 적은 값이라 화면이
 * 금액 대신 상태를 말해야 하고, 이쪽은 그 자리에 이미 미완료·가격 미확정 배지가 서 있어 0 이
 * 금액으로 읽히지 않는다.
 */
export function sumPayout(rows: BossProfitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)
}

export function sumSubtotals(subtotals: BossProfitWeeklySubtotal[]): number {
  return subtotals.reduce((sum, subtotal) => sum + subtotal.totalMeso, 0)
}

/** 행이 없어도 카드를 세워야 하는 캐릭터. 이름과 얼굴만 있으면 된다. */
export interface CharacterCardStub {
  ocid: string
  characterName: string
  imageUrl: string | null
}

/**
 * 카드는 **행에서 생긴다**. 셋째 인자는 그 규칙의 유일한 예외다.
 *
 * 이전으로 남겨진 ocid 는 동기화가 안 돌고 그 주 기록도 없어 행이 0개인데, 행이 없다고 카드를
 * 안 세우면 화면이 **빠진 것과 0원인 것을 같게** 말한다. 그 캐릭터는 조회할 수 없다는 사실
 * 자체를 카드가 배지로 말해야 해서, 비어 있어도 자리를 준다.
 *
 * **미완료 행을 지어내는 것과 다르다.** 그 캐릭터가 이번 주에 무엇을 잡았는지는 모르는 사실이라
 * 행으로 단정하면 안 되고, 모른다는 것을 말하는 자리가 카드와 배지다.
 *
 * 행이 이미 있는 ocid 는 건너뛴다. 순서는 행에서 만든 카드가 먼저다.
 */
export function buildCharacterGroups(
  rows: BossProfitRow[],
  weeklySubtotals: BossProfitWeeklySubtotal[],
  emptyCards: readonly CharacterCardStub[] = [],
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
  for (const card of emptyCards) {
    ensureGroup(card.ocid, card.characterName, card.imageUrl)
  }

  return groups
}

/**
 * 이 캐릭터가 이 기간에 번 전부. 결정석 + 아이템.
 *
 * 드롭을 프롭으로 받는 것은 보스 행의 `payoutMeso` 가 결정석만 담고(그 값이 DB 기록이라 가격을
 * 고칠 때마다 재기록할 수 없다) 아이템은 읽는 시점에 더하기 때문이다. 그래서 이 함수가 그
 * 덧셈이 일어나는 한 곳이고, 화면(총 수익)과 카드 헤더가 같은 함수를 쓴다.
 *
 * `weeklySubtotals`(월간 탭)에는 아이템이 이미 들어 있다. 스토어가 소계를 만들 때 더한다.
 * `dropsByRowKey` 는 지금 화면의 행만 담으므로 이중 계산이 없다.
 *
 * 값을 안 매긴 드롭은 여기서도 0 이다. `sumDropPayout` 이 `priceState !== 'entered'` 를 통째로
 * 거른다. 합산에서 스킵과 미입력이 같은 것은 의도이고, 둘을 가르는 일은 표시 층이 한다.
 *
 * 미완료 행의 드롭도 0 이다(`payableDropsOf`).
 */
export function groupTotalMeso(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): number {
  // 화면에 보이는 줄을 더하면 카드 금액이 되어야 한다(사용자 선택). 월간 탭은 **월간 보스 줄 +
  // 주차별 합계**이고, 주간 탭은 보스 행들이다. 그래서 산식이 하나로 합쳐진다 - 소계가 있으면
  // 더 더할 뿐이다.
  //
  // 월간 보스 수익을 주차 소계에서 뺀 것이 이 산식의 짝이다. 소계가 그 돈을 품으면 눈에 보이는
  // 줄들의 합이 카드보다 커진다.
  const drops = group.bossRows.reduce((sum, row) => sum + sumDropPayout(confirmedDropsOf(row, dropsByRowKey)), 0)
  return sumSubtotals(group.weeklySubtotals) + sumPayout(group.bossRows) + drops
}

/**
 * **처치가 확정된** 행의 드롭. 미완료 행은 빈 배열이다.
 *
 * 미완료 행에도 드롭과 가격을 적을 수 있다. 처치 직후 `complete_flag` 가 갱신되기 전에 적으라고
 * 열어 둔 자리라 막으면 실제로 잡은 보스의 드롭을 못 적는 시간이 생긴다. 그런데 그 행은 금액
 * 자리에 `미완료` 배지를 세워 돈을 아예 안 그린다.
 *
 * 그래서 규칙이 하나다. **완료 전에는 그 보스가 카드 겉면에 아무것도 못 만든다.** 총액도 골드
 * 링·글로우·고가 배지도 그 행을 못 본다. 안 그러면 카드가 펼쳐 봐도 찾을 수 없는 것을 겉면에서
 * 주장한다. 완료로 바뀌면 같은 기록이 그대로 돌아온다.
 *
 * 행 **안**은 이 규칙 밖이다. 드롭 지시자와 드롭 시트는 적은 것을 그대로 보여준다.
 */
function confirmedDropsOf(
  row: CharacterGroup['bossRows'][number],
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  if (!row.isComplete) return []
  return dropsByRowKey[dropRowKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)] ?? []
}

/**
 * 이 캐릭터가 이 기간에 **번** 드롭. 미완료 행의 것은 빠진다.
 *
 * `collectGroupDrops` 와 갈라 두는 것은 두 물음이 다르기 때문이다. 이쪽은 얼마를 벌었나 이고
 * 그쪽은 기록한 것이 있나 다. 금액을 그리는 자리는 전부 이 함수를 쓴다.
 *
 * @see collectGroupDrops 기록 전부. today 의 `hasRecords` 가 그쪽이다
 */
export function collectPayableDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  return group.bossRows.flatMap((row) => confirmedDropsOf(row, dropsByRowKey))
}

/**
 * 수익 내역 상자의 목록과 `아이템` 줄이 읽는 드롭. `groupTotalMeso` 와 같은 원천이다.
 *
 * 주차 소계가 있으면(월간 탭) 소계의 드롭에 월간 보스 행의 드롭을 더한다. 소계는 그 보스의 것을
 * 안 담으므로(금액과 같은 규칙) 겹치지 않는다.
 */
export function collectRevenueDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  if (group.weeklySubtotals.length > 0) {
    return [
      ...group.weeklySubtotals.flatMap((subtotal) => subtotal.drops),
      ...collectPayableDrops(group, dropsByRowKey),
    ]
  }
  return collectPayableDrops(group, dropsByRowKey)
}

// 이 캐릭터가 현재 기간에 먹은 고가 아이템 드롭 목록. 카드의 골드 링·글로우·우상단 배지가
// 이것을 본다. weekly 탭 기준이며 monthly 탭에서는 월간 보스 행의 드롭만 집계된다.
//
// 미완료 행은 안 든다(`confirmedDropsOf`). 카드 겉면이라 총액과 같은 규칙을 따른다.
export function collectGroupValuableDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  const valuable: RecordedDrop[] = []
  for (const row of group.bossRows) {
    for (const drop of confirmedDropsOf(row, dropsByRowKey)) {
      if (isValuableDropItem(drop.itemKey)) valuable.push(drop)
    }
  }
  return valuable
}

// 이 캐릭터가 이 기간에 기록한 드롭 전체. 고가로도 완료 여부로도 거르지 않는다.
// 기록한 것이 있나 를 묻는 자리가 쓴다. 금액을 그리는 자리는 `collectPayableDrops` 다.
export function collectGroupDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  return group.bossRows.flatMap(
    (row) => dropsByRowKey[dropRowKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)] ?? [],
  )
}

// 이 기간 전체(모든 추적 캐릭터)의 고가 드롭. 총 수익 헤드라인 뱃지용. 캐릭터별 집계를
// 그대로 합치므로 월간 탭 한계(주차별 합계 행엔 보스 행이 없어 월간 보스 드롭만 잡힘)도 동일하게 승계한다.
export function collectAllValuableDrops(
  groups: CharacterGroup[],
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  return groups.flatMap((group) => collectGroupValuableDrops(group, dropsByRowKey))
}

// 이 캐릭터가 이번 주에 처치한 주간 보스 수. 처치 수는 스토어 필드가 아니라 rows 에서
// 파생한다. 보스 key 기준 distinct 라 같은 보스를 여러 난이도로 완료해도 1 로 센다. 게임 룰이
// 그렇고 보스 스케줄러가 쓰는 `countClearedWeeklyBosses` 도 보스 그룹당 1 이다.
// 시즌 보스(메이린)는 12마리 제한 예외라 제외한다. 주간 탭의 행에는 그 주에 선 월간 보스도
// 들어 있어, cycle 필터가 월간 보스를 12 · 90 한도에서 빼는 방어선이다.
export function countGroupClearedWeeklyBosses(group: CharacterGroup): number {
  const clearedBossKeys = new Set<string>()
  for (const row of group.bossRows) {
    if (row.cycle !== 'weekly' || !row.isComplete || isSeasonBoss(row.bossKey)) continue
    clearedBossKeys.add(row.bossKey)
  }
  return clearedBossKeys.size
}

// 월드별 주간 결정석 소진량(90 은 계정이 아니라 월드당 한도다). 캐릭터별 처치 수는 위
// `countGroupClearedWeeklyBosses` 를 그대로 재사용하고 여기서는 월드 묶음만 얹는다. 그룹의
// 행은 모두 같은 캐릭터에서 나오므로 월드도 첫 행에서 읽으면 된다. 월드 key 가 null 인
// 캐릭터(구버전 캐시)는 어느 월드 한도에도 귀속시킬 수 없어 조용히 제외한다. 결과 순서는
// Map 삽입 순서라 렌더마다 흔들리지 않는다. 월드는 이름이 아니라 월드 key 로 가른다.
//
// 집계 단위가 행이다. `group.bossRows[0]?.world` 로 캐릭터당 월드를 하나로 정하면 주 중간에
// 월드를 옮겼을 때 한 캐릭터의 행이 두 월드에 걸치는데 첫 행의 월드로 전부 쏠린다. 판매
// 한도(90)는 월드마다 따로 산정되므로 그 주의 판매량은 두 월드에 각각 계상돼야 한다.
//
// 같은 보스는 한 주에 한 번만 처치할 수 있어 한 행은 정확히 한 월드에 속한다. 그래서 행
// 단위로 갈라도 보스 key distinct 의 의미가 유지된다.
//
// 캐릭터 카드의 진행 링은 이 함수를 쓰지 않는다. 클리어 수는 캐릭터 단위로 이어지므로 월드와
// 무관하게 그 주 전체를 센다.
export function summarizeWorldCrystals(groups: CharacterGroup[]): WorldCrystalSummary[] {
  // 월드 → (캐릭터 → 그 월드에서 처치한 보스 key 집합). 캐릭터를 한 번 더 갈라야 서로 다른
  // 캐릭터가 같은 보스를 잡은 것이 하나로 합쳐지지 않는다. 주간과 월간은 한도가 갈려 집합도 따로다.
  const byWorld = new Map<string, Map<string, { weekly: Set<string>; monthly: Set<string> }>>()
  // 보이는 이름의 폴백. 월드 표 이름이 먼저고, 표에 없는 key 면 행이 적어 둔 이름이다.
  const nameByWorldKey = new Map<string, string>()

  for (const group of groups) {
    for (const row of group.bossRows) {
      if (row.worldKey === null) {
        continue
      }
      if (!nameByWorldKey.has(row.worldKey)) nameByWorldKey.set(row.worldKey, row.world ?? row.worldKey)
      // 월드 집합과 처치 수를 분리한다. 월드를 아는 행이 있으면 처치가 0 이어도 그 월드를
      // 목록에 넣어 `0 / 90` 을 보여준다. 완료 조건을 월드 판정에 섞으면 그 표시가 사라진다.
      const byCharacter = byWorld.get(row.worldKey) ?? new Map<string, { weekly: Set<string>; monthly: Set<string> }>()
      const bossKeys = byCharacter.get(row.ocid) ?? { weekly: new Set<string>(), monthly: new Set<string>() }
      if (row.isComplete && row.cycle === 'weekly' && !isSeasonBoss(row.bossKey)) {
        bossKeys.weekly.add(row.bossKey)
      }
      if (row.isComplete && row.cycle === 'monthly') {
        bossKeys.monthly.add(row.bossKey)
      }
      byCharacter.set(row.ocid, bossKeys)
      byWorld.set(row.worldKey, byCharacter)
    }
  }

  return [...byWorld].map(([worldKey, byCharacter]) => ({
    worldKey,
    world: worldNameOf(worldKey, nameByWorldKey.get(worldKey) ?? worldKey),
    cleared: [...byCharacter.values()].reduce((sum, bossKeys) => sum + bossKeys.weekly.size, 0),
    monthlyCleared: [...byCharacter.values()].reduce((sum, bossKeys) => sum + bossKeys.monthly.size, 0),
  }))
}

// 이 캐릭터가 이 달에 처치한 월간 보스 수(보스 key distinct. 같은 보스를 여러 난이도로 잡아도 1).
// 주간 쪽 `countGroupClearedWeeklyBosses` 와 대칭이며 월간 탭 진행 링이 쓴다. 결정석 칩의 월간
// 수는 월드별로 세는 `summarizeWorldCrystals` 에서 나온다.
export function countGroupClearedMonthlyBosses(group: CharacterGroup): number {
  const clearedBossKeys = new Set<string>()
  for (const row of group.bossRows) {
    if (row.cycle !== 'monthly' || !row.isComplete) continue
    clearedBossKeys.add(row.bossKey)
  }
  return clearedBossKeys.size
}

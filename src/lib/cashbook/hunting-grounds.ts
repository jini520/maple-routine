/**
 * 사냥터 참조표(`huntingGrounds` 칸)를 **읽는 자리**. 화면이 표를 직접 뒤지지 않게 한다.
 * `lib/cashbook/spend-catalog.ts` 가 지출 참조표에 하는 일과 같은 자리다.
 *
 * 응답은 지역 · 사냥터 · 몬스터 레벨이 납작한 줄 표다. 여기서 지역 안에 사냥터를, 사냥터 안에 레벨을 품게
 * 묶어(`huntingRegions`) 조회 여섯이 그 모양을 읽는다. 값은 전부 사용자가 준 것이다.
 *
 * ## 사냥터 key 하나로 지역이 따라온다
 *
 * 기록은 사냥터 key 만 적고 지역을 안 적는다. 그래서 `findHuntingGround` 가 사냥터와 지역을
 * **함께** 돌려준다. 부르는 쪽이 지역을 다시 찾게 두면 그 조회가 화면마다 한 벌씩 생긴다.
 */
import type {
  HuntingGroundLevelRow,
  HuntingGroundRow,
  HuntingGroundsTable,
  HuntingRegionRow,
} from '../../types/game-data'
import type { HuntingGround, HuntingRegion } from '../../types/hunting-grounds'
import {
  compact,
  isBoolean,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPositiveInteger,
  isRow,
  optional,
  rowsOf,
  uniqueBy,
  updatedAtOf,
  type Row,
} from '../game-data/contract'
import { gameTable, derive } from '../game-data/table'
import { LEVEL_PENALTY_PATCHED_ON } from './hunting-meso'

const FORCE_TYPES = ['arcane', 'authentic'] as const

function toRegion(row: Row): HuntingRegionRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.name)) return null
  if (!isOneOf(row.forceType, FORCE_TYPES)) return null
  const iconAssetId = optional(row.iconAssetId, isNonEmptyString)
  if (iconAssetId === false) return null
  return compact({ id: row.id, key: row.key, name: row.name, forceType: row.forceType, iconAssetId })
}

function toGround(row: Row): HuntingGroundRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.key) || !isNonEmptyString(row.regionId)) return null
  if (!isNonEmptyString(row.name) || !isNonNegativeInteger(row.requiredForce) || !isPositiveInteger(row.mobQuantity)) return null
  if (!isBoolean(row.isPopular)) return null
  return {
    id: row.id,
    key: row.key,
    regionId: row.regionId,
    name: row.name,
    requiredForce: row.requiredForce,
    mobQuantity: row.mobQuantity,
    isPopular: row.isPopular,
  }
}

function toLevel(row: Row): HuntingGroundLevelRow | null {
  if (!isNonEmptyString(row.groundId) || !isPositiveInteger(row.mobLevel)) return null
  return { groundId: row.groundId, mobLevel: row.mobLevel }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 레벨이 없는 사냥터도 어긴 것이다. 몬스터 레벨 범위를 빈 목록에서 재면 `Infinity` 가 되어 지역 목록이 깨진다. 사냥터와 레벨
 * 줄은 이 칸의 지역 · 사냥터를 가리켜야 한다.
 */
export function parseHuntingGrounds(value: unknown): HuntingGroundsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const huntingRegions = rowsOf(value.huntingRegions, toRegion)
  const huntingGrounds = rowsOf(value.huntingGrounds, toGround)
  const huntingGroundLevels = rowsOf(value.huntingGroundLevels, toLevel)
  if (huntingRegions === null || huntingGrounds === null || huntingGroundLevels === null) return null
  if (!uniqueBy(huntingRegions, (region) => region.key) || !uniqueBy(huntingRegions, (region) => region.id)) return null
  if (!uniqueBy(huntingGrounds, (ground) => ground.key) || !uniqueBy(huntingGrounds, (ground) => ground.id)) return null
  const regionIds = new Set(huntingRegions.map((region) => region.id))
  const groundIds = new Set(huntingGrounds.map((ground) => ground.id))
  if (huntingGrounds.some((ground) => !regionIds.has(ground.regionId))) return null
  if (huntingGroundLevels.some((row) => !groundIds.has(row.groundId))) return null
  const leveled = new Set(huntingGroundLevels.map((row) => row.groundId))
  if (huntingGrounds.some((ground) => !leveled.has(ground.id))) return null
  return { updatedAt, huntingRegions, huntingGrounds, huntingGroundLevels }
}

export const huntingGroundsTable = gameTable<HuntingGroundsTable>(
  'huntingGrounds',
  { updatedAt: null, huntingRegions: [], huntingGrounds: [], huntingGroundLevels: [] },
  parseHuntingGrounds,
)

/** 줄 표를 지역 → 사냥터 → 레벨로 묶은 것. 차례는 표에 적힌 그대로다(사용자가 매긴 순서라 정렬하지 않는다). */
const regions = derive(huntingGroundsTable, (table): readonly HuntingRegion[] => {
  const levelsByGround = new Map<string, number[]>()
  for (const row of table.huntingGroundLevels) {
    const levels = levelsByGround.get(row.groundId)
    if (levels === undefined) levelsByGround.set(row.groundId, [row.mobLevel])
    else levels.push(row.mobLevel)
  }
  const groundsByRegion = new Map<string, HuntingGround[]>()
  for (const row of table.huntingGrounds) {
    const ground: HuntingGround = {
      key: row.key,
      name: row.name,
      force: row.requiredForce,
      mobs: row.mobQuantity,
      levels: [...(levelsByGround.get(row.id) ?? [])].sort((a, b) => a - b),
      popular: row.isPopular,
    }
    const grounds = groundsByRegion.get(row.regionId)
    if (grounds === undefined) groundsByRegion.set(row.regionId, [ground])
    else grounds.push(ground)
  }
  return table.huntingRegions.map((row) => ({
    key: row.key,
    name: row.name,
    forceType: row.forceType,
    iconAssetId: row.iconAssetId ?? null,
    grounds: groundsByRegion.get(row.id) ?? [],
  }))
})

/** 참조표 전체. 지역 안에 사냥터, 사냥터 안에 레벨이다. */
export function huntingRegions(): readonly HuntingRegion[] {
  return regions()
}

/**
 * 목록의 바닥. 캐릭터 레벨에서 아래로 몇 레벨까지 세우나.
 *
 * 메소가 나오는 몬스터까지라 10 이다. 패치 뒤의 표는 11 레벨 낮으면 -100% 다. 패치 전 날짜의 기록은
 * 20 이다. 그때 적은 기록에는 차이 11~20 인 지역이 있고, 목록에서 빠지면 수정으로 열 때 지역 칸이
 * `지역 선택` 으로 선다.
 *
 * 위쪽에는 짝이 되는 값이 없다. 천장은 갈 수 있는 데까지 이고 그것은 지역이 정한다.
 */
function levelBelowOn(earnedOn: string): number {
  return earnedOn < LEVEL_PENALTY_PATCHED_ON ? 20 : 10
}

/**
 * 지역이 실제로 내놓는 **몬스터 레벨의 범위**.
 *
 * 옛 참조표의 추천 캐릭터 레벨은 이것과 달랐다. 리버스 시티는 205-209 로 적혀 있었지만 몬스터는 **213 까지**
 * 있고, 그래서 213 짜리 캐릭터에게 효율이 가장 좋다(사용자 지적). 목록을 거르는 근거는 이쪽이다.
 */
export function monsterLevelRangeOf(region: HuntingRegion): { min: number; max: number } {
  const levels = region.grounds.flatMap((ground) => ground.levels)
  return { min: Math.min(...levels), max: Math.max(...levels) }
}

/**
 * 캐릭터 레벨로 지역을 거른다. 아래로 10(패치 전 날짜는 20) ~ 갈 수 있는 데까지.
 *
 * 창이 위아래로 대칭이 아니다. 캐릭터 레벨보다 높은 지역에는 못 가기 때문이다. lv.277 은
 * 도원경(275-279)까지이고 아르테리아(280-284)는 갈 수 없다. 갈 수 없는 자리를 세우면 고를 수
 * 있는 것처럼 보인다.
 *
 * 두 끝을 몬스터 레벨로 잰다(`monsterLevelRangeOf`).
 *
 * - 천장. 그 지역의 가장 낮은 몬스터가 캐릭터 레벨 이하여야 간다.
 * - 바닥. 그 지역의 가장 높은 몬스터가 캐릭터 − 바닥(`levelBelowOn`) 이상이어야 한다. 한 맵이라도 걸리면 선다.
 *
 * 지역 안의 맵까지 거르지는 않는다. 한 맵이라도 들면 지역이 서고 그 안에는 창 밖의 맵도 있다.
 * 사냥터 줄이 레벨을 적어 두므로 고르는 사람이 본다.
 *
 * 레벨을 모르면(`null`) 전부 선다. 캐릭터 고르개의 기본이 선택 안함이라 그 상태가 정상이고,
 * 그때는 페널티도 0 이다.
 *
 * 차례는 참조표의 **역순**이다. 창의 천장이 갈 수 있는 데까지 라 목록 끝이 곧 지금 캐릭터가
 * 갈 만한 곳인데, 참조표 차례로 세우면 그것이 맨 아래에 묻힌다.
 *
 * @param earnedOn 기록 날짜(KST `YYYY-MM-DD`). 바닥을 고른다
 */
export function huntingRegionsForLevel(characterLevel: number | null, earnedOn: string): HuntingRegion[] {
  const 높은데부터 = [...huntingRegions()].reverse()
  if (characterLevel === null) return 높은데부터

  const floor = characterLevel - levelBelowOn(earnedOn)
  return 높은데부터.filter((region) => {
    const { min, max } = monsterLevelRangeOf(region)
    return min <= characterLevel && max >= floor
  })
}

/**
 * 캐릭터 레벨과 그 사냥터 몬스터의 차이.
 *
 * 레벨이 둘인 맵은 레벨마다 재서 평균낸다. 평균 레벨로 접는 것과는 캐릭터가 두 레벨 사이에
 * 있을 때 갈린다(217·219 짜리 맵과 218 짜리 캐릭터. 이쪽은 1, 접으면 0). 실제로 마주치는
 * 몬스터가 저마다 1 씩 어긋나 있으므로 이쪽이 사실에 가깝다.
 */
export function levelGapOf(ground: HuntingGround, characterLevel: number): number {
  const sum = ground.levels.reduce((total, level) => total + Math.abs(level - characterLevel), 0)
  return sum / ground.levels.length
}

/**
 * 지역 안의 사냥터를 줄 세운 차례. 레벨 차이가 적은 순, 같으면 인기 사냥터 먼저, 그다음 마릿수가 많은 순.
 *
 * 참조표에 적힌 순서를 그대로 쓰면 지금 내가 갈 만한 곳 이 목록 한가운데 묻힌다. 고르는 사람이
 * 실제로 재는 두 값이 레벨 차이와 마릿수라 그대로 차례로 삼는다.
 *
 * 인기는 레벨 차이 다음 열쇠다. 첫 열쇠로 두면 레벨이 먼 인기 사냥터가 가까운 사냥터 위로 올라간다.
 *
 * 거르지 않는다. 지역이 목록에 섰으면 그 안의 맵은 전부 선다. 여기서 또 걸러 내면 지역은
 * 떴는데 안이 비어 있다 가 생긴다.
 *
 * 레벨을 모르면 인기 사냥터가 먼저고 그 안은 마릿수 많은 순이다. 차이가 다 모름 이라 첫 열쇠에서
 * 전부 동률이기 때문이다.
 *
 * 완전 동률이면 참조표 순서다(`sort` 가 안정 정렬이다). 원본 배열은 안 건드린다.
 * 표에서 묶은 값이라 제자리 정렬하면 다음 호출이 달라진다.
 */
export function huntingGroundsFor(
  region: HuntingRegion,
  characterLevel: number | null,
): HuntingGround[] {
  return [...region.grounds].sort((a, b) => {
    if (characterLevel !== null) {
      const gap = levelGapOf(a, characterLevel) - levelGapOf(b, characterLevel)
      if (gap !== 0) return gap
    }
    if (a.popular !== b.popular) return a.popular ? -1 : 1
    return b.mobs - a.mobs
  })
}

/** 지역 key 로 지역 하나. 없으면 `null`. 화면이 지운 key 를 들고 있을 수 있다. */
export function findHuntingRegion(key: string): HuntingRegion | null {
  return huntingRegions().find((region) => region.key === key) ?? null
}

/**
 * 사냥터 key 로 사냥터 하나. **지역과 함께** 돌려준다.
 *
 * 못 찾으면 `null` 이다. 참조표에서 빠진 사냥터를 기록이 들고 있을 수 있고, 그때 화면은 계산기
 * 대신 옛 모양으로 연다.
 */
export function findHuntingGround(
  key: string,
): { region: HuntingRegion; ground: HuntingGround } | null {
  return findGround((ground) => ground.key === key)
}

/** 이름으로 사냥터 하나. 이름만 저장된 옛 사냥 기록을 key 로 옮기는 이관만 쓴다. */
export function findHuntingGroundByName(
  name: string,
): { region: HuntingRegion; ground: HuntingGround } | null {
  return findGround((ground) => ground.name === name)
}

function findGround(
  matches: (ground: HuntingGround) => boolean,
): { region: HuntingRegion; ground: HuntingGround } | null {
  for (const region of huntingRegions()) {
    const ground = region.grounds.find(matches)
    if (ground !== undefined) return { region, ground }
  }
  return null
}

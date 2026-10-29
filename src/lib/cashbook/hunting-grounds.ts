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

const FORCE_TYPES = ['arcane', 'authentic'] as const

function toRegion(row: Row): HuntingRegionRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.name) || !isOneOf(row.forceType, FORCE_TYPES)) return null
  const iconMap = optional(row.iconMap, isNonEmptyString)
  if (iconMap === false) return null
  return { key: row.key, name: row.name, forceType: row.forceType, iconMap: iconMap ?? null }
}

function toGround(row: Row): HuntingGroundRow | null {
  if (!isNonEmptyString(row.key) || !isNonEmptyString(row.region) || !isNonEmptyString(row.name)) return null
  if (!isNonNegativeInteger(row.force) || !isPositiveInteger(row.mobs)) return null
  return { key: row.key, region: row.region, name: row.name, force: row.force, mobs: row.mobs }
}

function toLevel(row: Row): HuntingGroundLevelRow | null {
  if (!isNonEmptyString(row.ground) || !isPositiveInteger(row.level)) return null
  return { ground: row.ground, level: row.level }
}

/**
 * 계약을 지킨 값만 통과시킨다. 어긴 값은 줄이 아니라 표 전체가 `null` 이다.
 *
 * 레벨이 없는 사냥터도 어긴 것이다. 몬스터 레벨 범위를 빈 목록에서 재면 `Infinity` 가 되어 지역 목록이 깨진다.
 */
export function parseHuntingGrounds(value: unknown): HuntingGroundsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const regions = rowsOf(value.regions, toRegion)
  const grounds = rowsOf(value.grounds, toGround)
  const groundLevels = rowsOf(value.groundLevels, toLevel)
  if (regions === null || grounds === null || groundLevels === null) return null
  if (!uniqueBy(regions, (region) => region.key) || !uniqueBy(grounds, (ground) => ground.key)) return null
  const leveled = new Set(groundLevels.map((row) => row.ground))
  if (grounds.some((ground) => !leveled.has(ground.key))) return null
  return { updatedAt, regions, grounds, groundLevels }
}

export const huntingGroundsTable = gameTable('huntingGrounds', { updatedAt: null, regions: [], grounds: [], groundLevels: [] }, parseHuntingGrounds)

/** 줄 표를 지역 → 사냥터 → 레벨로 묶은 것. 차례는 표에 적힌 그대로다(사용자가 매긴 순서라 정렬하지 않는다). */
const regions = derive(huntingGroundsTable, (table): readonly HuntingRegion[] => {
  const levelsByGround = new Map<string, number[]>()
  for (const row of table.groundLevels) {
    const levels = levelsByGround.get(row.ground)
    if (levels === undefined) levelsByGround.set(row.ground, [row.level])
    else levels.push(row.level)
  }
  const groundsByRegion = new Map<string, HuntingGround[]>()
  for (const row of table.grounds) {
    const ground: HuntingGround = {
      key: row.key,
      name: row.name,
      force: row.force,
      mobs: row.mobs,
      levels: [...(levelsByGround.get(row.key) ?? [])].sort((a, b) => a - b),
    }
    const grounds = groundsByRegion.get(row.region)
    if (grounds === undefined) groundsByRegion.set(row.region, [ground])
    else grounds.push(ground)
  }
  return table.regions.map((row) => ({
    key: row.key,
    name: row.name,
    forceType: row.forceType,
    iconMap: row.iconMap,
    grounds: groundsByRegion.get(row.key) ?? [],
  }))
})

/** 참조표 전체. 지역 안에 사냥터, 사냥터 안에 레벨이다. */
export function huntingRegions(): readonly HuntingRegion[] {
  return regions()
}

/**
 * 목록의 바닥. 캐릭터 레벨에서 아래로 몇 레벨까지 세우나.
 *
 * 위쪽에는 짝이 되는 상수가 없다. 천장은 갈 수 있는 데까지 이고 그것은 지역이 정한다.
 */
export const HUNTING_LEVEL_BELOW = 20

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
 * 캐릭터 레벨로 지역을 거른다. 아래로 20 ~ 갈 수 있는 데까지.
 *
 * 창이 위아래로 대칭이 아니다. 캐릭터 레벨보다 높은 지역에는 못 가기 때문이다. lv.277 은
 * 도원경(275-279)까지이고 아르테리아(280-284)는 갈 수 없다. 갈 수 없는 자리를 세우면 고를 수
 * 있는 것처럼 보인다.
 *
 * 두 끝을 몬스터 레벨로 잰다(`monsterLevelRangeOf`).
 *
 * - 천장. 그 지역의 가장 낮은 몬스터가 캐릭터 레벨 이하여야 간다.
 * - 바닥. 그 지역의 가장 높은 몬스터가 캐릭터 − 20 이상이어야 한다. 한 맵이라도 걸리면 선다.
 *
 * 지역 안의 맵까지 거르지는 않는다. 한 맵이라도 들면 지역이 서고 그 안에는 창 밖의 맵도 있다.
 * 사냥터 줄이 레벨을 적어 두므로 고르는 사람이 본다.
 *
 * 레벨을 모르면(`null`) 전부 선다. 캐릭터 고르개의 기본이 선택 안함이라 그 상태가 정상이고,
 * 그때는 페널티도 0 이다.
 *
 * 차례는 참조표의 **역순**이다. 창의 천장이 갈 수 있는 데까지 라 목록 끝이 곧 지금 캐릭터가
 * 갈 만한 곳인데, 참조표 차례로 세우면 그것이 맨 아래에 묻힌다.
 */
export function huntingRegionsForLevel(characterLevel: number | null): HuntingRegion[] {
  const 높은데부터 = [...huntingRegions()].reverse()
  if (characterLevel === null) return 높은데부터

  return 높은데부터.filter((region) => {
    const { min, max } = monsterLevelRangeOf(region)
    return min <= characterLevel && max >= characterLevel - HUNTING_LEVEL_BELOW
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
 * 지역 안의 사냥터를 줄 세운 차례. 레벨 차이가 적은 순, 같으면 마릿수가 많은 순.
 *
 * 참조표에 적힌 순서를 그대로 쓰면 지금 내가 갈 만한 곳 이 목록 한가운데 묻힌다. 고르는 사람이
 * 실제로 재는 두 값이 이 둘이라 그대로 차례로 삼는다.
 *
 * 거르지 않는다. 지역이 목록에 섰으면 그 안의 맵은 전부 선다. 여기서 또 걸러 내면 지역은
 * 떴는데 안이 비어 있다 가 생긴다.
 *
 * 레벨을 모르면 마릿수 많은 순이다. 차이가 다 모름 이라 첫 열쇠에서 전부 동률이고 둘째 열쇠가
 * 그대로 차례가 된다.
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

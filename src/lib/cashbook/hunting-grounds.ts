/**
 * 사냥터 참조표를 **읽는 자리**. 화면이 JSON 을 직접 뒤지지 않게 한다.
 * `lib/cashbook/spend-catalog.ts` 가 지출 참조표에 하는 일과 같은 자리다.
 *
 * 파일 자체는 대상이라 **사용자가 준 값 그대로**이고, 그 형태는
 * `data/__tests__/hunting-grounds.spec.ts` 가 붙든다. 여기 있는 것은 조회 셋뿐이다.
 *
 * ## 이름 하나로 지역이 따라온다
 *
 * 사냥터 이름이 **전역 유일**이라(408개 중 중복 0. 그 사실을 테스트가 지킨다) 기록에 지역을
 * 안 적는다. 그래서 `findHuntingGround` 가 사냥터와 지역을 **함께** 돌려준다.
 * 부르는 쪽이 지역을 다시 찾게 두면 그 조회가 화면마다 한 벌씩 생긴다.
 */
import huntingGrounds from '../../data/hunting-grounds.json'
import type { HuntingGround, HuntingGroundTable, HuntingRegion } from '../../types/hunting-grounds'

/** 참조표 전체. **차례는 파일에 적힌 그대로**다(사용자가 매긴 순서라 정렬하지 않는다). */
export const HUNTING_REGIONS: readonly HuntingRegion[] = (huntingGrounds as HuntingGroundTable)
  .regions

/**
 * 목록의 바닥. 캐릭터 레벨에서 아래로 몇 레벨까지 세우나.
 *
 * 위쪽에는 짝이 되는 상수가 없다. 천장은 갈 수 있는 데까지 이고 그것은 지역이 정한다.
 */
export const HUNTING_LEVEL_BELOW = 20

/**
 * 지역이 실제로 내놓는 **몬스터 레벨의 범위**.
 *
 * 참조표의 `minLevel`·`maxLevel` 은 **추천 캐릭터 레벨**이라 이것과 다르다. 리버스 시티는
 * 205-209 로 적혀 있지만 몬스터는 **213 까지** 있고, 그래서 213 짜리 캐릭터에게 효율이 가장 좋다
 * (사용자 지적). 목록을 거르는 근거는 추천 레벨이 아니라 이쪽이다.
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
 * 추천 레벨로 재면 목록이 뒤집힌다. 리버스 시티(추천 205-209)가 lv.213 짜리에게서 빠지는데
 * 거기 몬스터는 213 까지라 정작 그 캐릭터가 가장 잘 잡는 자리다.
 *
 * 지역 안의 맵까지 거르지는 않는다. 한 맵이라도 들면 지역이 서고 그 안에는 창 밖의 맵도 있다.
 * 사냥터 줄이 레벨을 적어 두므로 고르는 사람이 본다.
 *
 * 레벨을 모르면(`null`) 전부 선다. 캐릭터 고르개의 기본이 선택 안함이라 그 상태가 정상이고,
 * 그때는 페널티도 0 이다.
 */
export function huntingRegionsForLevel(characterLevel: number | null): HuntingRegion[] {
  if (characterLevel === null) return [...HUNTING_REGIONS]

  return HUNTING_REGIONS.filter((region) => {
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
 * `HUNTING_REGIONS` 는 모듈 하나가 들고 도는 값이라 제자리 정렬하면 다음 호출이 달라진다.
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

/** 슬러그로 지역 하나. 없으면 `null`. 화면이 지운 슬러그를 들고 있을 수 있다. */
export function findHuntingRegion(slug: string): HuntingRegion | null {
  return HUNTING_REGIONS.find((region) => region.slug === slug) ?? null
}

/**
 * 이름으로 사냥터 하나. **지역과 함께** 돌려준다.
 *
 * 못 찾으면 `null` 이고, 그것이 정상 경로다: 이전에 적힌 사냥 기록은 이 칸에
 * **자유 입력 글자**를 들고 있어 어느 사냥터에도 안 걸린다. 그때 화면은 계산기 대신 옛 모양으로
 * 연다.
 */
export function findHuntingGround(
  name: string,
): { region: HuntingRegion; ground: HuntingGround } | null {
  for (const region of HUNTING_REGIONS) {
    const ground = region.grounds.find((each) => each.name === name)
    if (ground !== undefined) return { region, ground }
  }
  return null
}

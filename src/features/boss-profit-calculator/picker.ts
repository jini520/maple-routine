/**
 * 계산기의 보스 선택에 늘어놓을 보스와 고르기 규칙.
 *
 * 묶음은 `시즌 보스` · `스케줄러` · `모든 보스` 셋이다. 월간 보스는 없다. 12개 한도가 주 단위라 월간 보스는 그 셈에 없기
 * 때문이다. 시즌 보스는 솔로 보스라 파티 스케줄의 보스 고르기에는 없고 여기에만 있다.
 */
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { sortByReferenceOrder, type CalculatorBoss } from '../../lib/boss/boss-profit-calculator'
import { BOSS_ENTRIES, activeDifficultiesOf, isSeasonBoss, WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/bosses'
import { isChallengersWorld } from '../../lib/world/worlds'
import type { PickerTile } from '../party-appointments/boss-picker'

export interface CalculatorPickerSections {
  season: PickerTile[]
  scheduler: PickerTile[]
  all: PickerTile[]
}

export interface CalculatorPickerInput {
  worldKey: string | null | undefined
  /** 그 캐릭터가 보스 관리에 등록한 주간 보스. 스케줄러 화면이 세우는 차례 그대로 */
  registered: readonly PickerTile[]
  now: Date
}

export function calculatorPickerSections(input: CalculatorPickerInput): CalculatorPickerSections {
  const periodKey = getCurrentBossProfitPeriod('weekly', input.now).periodKey
  const registeredDifficulty = new Map(input.registered.map((tile) => [tile.bossKey, tile.difficulty]))
  const tilesOf = (section: 'weekly' | 'eventWeekly'): PickerTile[] =>
    BOSS_ENTRIES.flatMap((entry): PickerTile[] => {
      if (entry.section !== section) return []
      const difficulties = activeDifficultiesOf(entry.key, periodKey, input.now)
      if (difficulties.length === 0) return []
      // 표의 난이도는 낮은 것부터라 끝이 가장 높다.
      return [{ bossKey: entry.key, difficulty: registeredDifficulty.get(entry.key) ?? difficulties[difficulties.length - 1]! }]
    })
  return {
    // 시즌 보스는 챌린저스 월드 캐릭터만 잡는다.
    season: isChallengersWorld(input.worldKey) ? tilesOf('eventWeekly') : [],
    scheduler: input.registered.filter((tile) => !isSeasonBoss(tile.bossKey)),
    all: tilesOf('weekly'),
  }
}

/** 12개를 고른 뒤 남은 주간 보스. 고른 보스는 빼야 하므로, 시즌 보스는 한도에 세지 않으므로 잠그지 않는다 */
export function isPickLocked(picked: readonly CalculatorBoss[], tile: PickerTile): boolean {
  if (isSeasonBoss(tile.bossKey) || picked.some((boss) => boss.bossKey === tile.bossKey)) return false
  return picked.filter((boss) => !isSeasonBoss(boss.bossKey)).length >= WEEKLY_BOSS_CLEAR_LIMIT
}

/**
 * 안 고른 보스는 보스 표 순서 자리에 넣고, 고른 보스는 뺀다.
 *
 * @param make 새로 넣을 보스의 인원 · 비율을 채우는 함수
 */
export function toggleCalculatorPick(
  picked: readonly CalculatorBoss[],
  tile: PickerTile,
  make: (tile: PickerTile) => CalculatorBoss,
): CalculatorBoss[] {
  if (picked.some((boss) => boss.bossKey === tile.bossKey)) return picked.filter((boss) => boss.bossKey !== tile.bossKey)
  return sortByReferenceOrder([...picked, make(tile)])
}

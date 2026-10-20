// 계산기의 보스 선택에 늘어놓을 보스와 12개 한도.
import { BUNDLED_BOSS_CATALOG, setBossCatalog } from '../../../lib/boss/catalog'
import { bossCycleOf } from '../../../lib/boss/bosses'
import type { CalculatorBoss } from '../../../lib/boss/boss-profit-calculator'
import { calculatorPickerSections, isPickLocked, toggleCalculatorPick } from '../picker'

const NOW = new Date('2026-10-20T12:00:00+09:00')
const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }

function picked(bossKey: string): CalculatorBoss {
  return { bossKey, difficulty: 'hard', partySize: 1, shares: EVEN }
}

/** 시즌이 끝난 메이린을 다시 연 표 */
function openMeirin(): void {
  setBossCatalog({
    ...BUNDLED_BOSS_CATALOG,
    bosses: BUNDLED_BOSS_CATALOG.bosses.map((boss) =>
      boss.key === 'meirin' ? { ...boss, from: undefined, until: undefined } : boss,
    ),
  })
}

afterEach(() => {
  setBossCatalog(BUNDLED_BOSS_CATALOG)
})

describe('calculatorPickerSections', () => {
  // 12개 한도가 주 단위라 월간 보스는 셈에 없다.
  it('모든 보스 묶음에 월간 보스가 없다', () => {
    const sections = calculatorPickerSections({ worldKey: 'scania', registered: [], now: NOW })

    expect(sections.all.length).toBeGreaterThan(0)
    expect(sections.all.every((tile) => bossCycleOf(tile.bossKey) === 'weekly')).toBe(true)
  })

  it('모든 보스 타일은 등록한 난이도로, 등록하지 않았으면 가장 높은 난이도로 선다', () => {
    const sections = calculatorPickerSections({
      worldKey: 'scania',
      registered: [{ bossKey: 'lotus', difficulty: 'normal' }],
      now: NOW,
    })

    expect(sections.all.find((tile) => tile.bossKey === 'lotus')?.difficulty).toBe('normal')
    expect(sections.all.find((tile) => tile.bossKey === 'damien')?.difficulty).toBe('hard')
  })

  it('시즌 보스는 열려 있고 챌린저스 월드일 때만 맨 위 묶음에 선다', () => {
    openMeirin()

    expect(calculatorPickerSections({ worldKey: 'challengers', registered: [], now: NOW }).season.map((tile) => tile.bossKey)).toEqual(['meirin'])
    expect(calculatorPickerSections({ worldKey: 'scania', registered: [], now: NOW }).season).toEqual([])
    expect(calculatorPickerSections({ worldKey: 'challengers', registered: [], now: NOW }).all.map((tile) => tile.bossKey)).not.toContain('meirin')
  })
})

describe('isPickLocked', () => {
  const 열둘 = ['lotus', 'damien', 'lucid', 'will', 'gloom', 'verus_hilla', 'darknell', 'chosen_seren', 'guardian_kalos', 'first_adversary', 'kaling', 'guardian_angel_slime'].map(picked)

  it('12개를 고르면 안 고른 주간 보스는 잠긴다', () => {
    expect(isPickLocked(열둘, { bossKey: 'papulatus', difficulty: 'chaos' })).toBe(true)
    expect(isPickLocked(열둘.slice(1), { bossKey: 'papulatus', difficulty: 'chaos' })).toBe(false)
  })

  // 고른 것은 빼야 하므로 잠그지 않는다. 시즌 보스는 한도에 세지 않는다.
  it('고른 보스와 시즌 보스는 잠그지 않는다', () => {
    expect(isPickLocked(열둘, { bossKey: 'lotus', difficulty: 'hard' })).toBe(false)
    expect(isPickLocked(열둘, { bossKey: 'meirin', difficulty: 'normal' })).toBe(false)
  })
})

describe('toggleCalculatorPick', () => {
  it('안 고른 보스는 보스 표 순서 자리에 넣고, 고른 보스는 뺀다', () => {
    const make = (tile: { bossKey: string; difficulty: string }): CalculatorBoss => ({ ...picked(tile.bossKey), difficulty: 'normal' })

    const 넣은것 = toggleCalculatorPick([picked('lotus'), picked('kaling')], { bossKey: 'first_adversary', difficulty: 'normal' }, make)
    expect(넣은것.map((one) => one.bossKey)).toEqual(['lotus', 'first_adversary', 'kaling'])

    expect(toggleCalculatorPick(넣은것, { bossKey: 'lotus', difficulty: 'hard' }, make).map((one) => one.bossKey)).toEqual(['first_adversary', 'kaling'])
  })
})

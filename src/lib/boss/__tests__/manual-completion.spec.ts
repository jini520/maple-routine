// 서버가 연 보스가 **이 기간에도 열려 있는가**. 서버는 보스와 여는 날만 들고 기간 판정은 앱이 한다.
import {
  applyManualCompletions,
  isManualCompletionOpen,
  manualCompletionKey,
} from '../manual-completion'

const 검마 = { boss: 'black_mage', from: '2026-09-01' }
const 메이린 = { boss: 'meirin', from: '2026-09-17' }

describe('여는 날이 든 기간부터 열린다', () => {
  it('여는 날이 그 주 안이면 그 주가 열린다', () => {
    // 09-17 주는 9/17(목) ~ 9/23(수)
    expect(
      isManualCompletionOpen([메이린], { bossKey: 'meirin', cycle: 'weekly', periodKey: '2026-09-17' }),
    ).toBe(true)
  })

  it('여는 날이 주 한가운데여도 그 주가 열린다', () => {
    expect(
      isManualCompletionOpen([{ boss: 'meirin', from: '2026-09-19' }], {
        bossKey: 'meirin',
        cycle: 'weekly',
        periodKey: '2026-09-17',
      }),
    ).toBe(true)
  })

  it('여는 날보다 앞선 기간은 안 열린다', () => {
    expect(
      isManualCompletionOpen([메이린], { bossKey: 'meirin', cycle: 'weekly', periodKey: '2026-09-10' }),
    ).toBe(false)
  })

  it('여는 날 뒤의 기간은 계속 열린다', () => {
    expect(
      isManualCompletionOpen([메이린], { bossKey: 'meirin', cycle: 'weekly', periodKey: '2026-10-01' }),
    ).toBe(true)
  })

  it('월간은 달의 마지막 날로 잰다', () => {
    expect(
      isManualCompletionOpen([검마], { bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-09' }),
    ).toBe(true)
    expect(
      isManualCompletionOpen([검마], { bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-08' }),
    ).toBe(false)
  })
})

describe('목록에 없으면 안 열린다', () => {
  it('다른 보스는 안 열린다', () => {
    expect(
      isManualCompletionOpen([검마], { bossKey: 'lucid', cycle: 'weekly', periodKey: '2026-09-17' }),
    ).toBe(false)
  })

  it('빈 목록이면 아무것도 안 열린다', () => {
    expect(
      isManualCompletionOpen([], { bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-09' }),
    ).toBe(false)
  })

  // 서버를 못 받았을 때 `null` 이 그대로 흘러온다. 닫힘이 기본값이다.
  it('목록을 모르면 안 열린다', () => {
    expect(
      isManualCompletionOpen(null, { bossKey: 'black_mage', cycle: 'monthly', periodKey: '2026-09' }),
    ).toBe(false)
  })

  it('여는 날의 모양이 이상하면 안 열린다', () => {
    expect(
      isManualCompletionOpen([{ boss: 'black_mage', from: '2026-9-1' }], {
        bossKey: 'black_mage',
        cycle: 'monthly',
        periodKey: '2026-09',
      }),
    ).toBe(false)
  })
})

describe('직접 적은 완료를 표시 목록에 얹는다', () => {
  const 보스 = (bossKey: string | null, difficulty: string) => ({
    bossKey,
    difficulty,
    isComplete: false,
    ownComplete: false,
  })

  it('같은 보스 · 같은 난이도만 완료가 된다', () => {
    const applied = applyManualCompletions(
      [보스('black_mage', 'hard'), 보스('black_mage', 'extreme'), 보스('lucid', 'hard')],
      new Set([manualCompletionKey('black_mage', 'hard')]),
    )

    expect(applied.map((boss) => boss.isComplete)).toEqual([true, false, false])
  })

  // 보스 수익이 **실제로 어느 난이도를 처치했는가** 를 `ownComplete` 로 판정한다. 직접 적은 완료는
  // 사용자가 난이도까지 고른 것이라 승격이 아니라 사실이다.
  it('ownComplete 도 함께 세운다', () => {
    const [첫줄] = applyManualCompletions(
      [보스('black_mage', 'hard')],
      new Set([manualCompletionKey('black_mage', 'hard')]),
    )

    expect(첫줄.ownComplete).toBe(true)
  })

  it('열쇠가 없으면 원본 그대로다', () => {
    const bosses = [보스('black_mage', 'hard')]

    expect(applyManualCompletions(bosses, new Set())).toEqual(bosses)
  })

  // 보스 표에 없는 보스는 기록할 key 자체가 없다.
  it('key 가 없는 보스는 안 건드린다', () => {
    const [첫줄] = applyManualCompletions([보스(null, 'hard')], new Set(['|hard']))

    expect(첫줄.isComplete).toBe(false)
  })
})

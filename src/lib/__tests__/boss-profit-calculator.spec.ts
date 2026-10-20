// 주간 보스 수익 계산기의 계산. 몫은 보스 수익과 같은 식으로 센다.
import {
  bossPayoutMeso,
  formatEok,
  keepTopByPayout,
  sortByReferenceOrder,
  totalPayoutMeso,
  type CalculatorBoss,
} from '../boss/boss-profit-calculator'
import { crystalPayoutMeso } from '../boss/party-shares'
import { findPriceEntry } from '../boss/boss-crystal-prices'
import { getCurrentBossProfitPeriod } from '../boss/boss-profit-period'

// 09-17 패치 뒤의 주. 가격이 바뀌기 전 주를 고르면 다른 값이 나온다.
const NOW = new Date('2026-10-20T12:00:00+09:00')
const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }

function boss(bossKey: string, difficulty: CalculatorBoss['difficulty'], partySize = 1): CalculatorBoss {
  return { bossKey, difficulty, partySize, shares: EVEN }
}

function priceOf(bossKey: string, difficulty: CalculatorBoss['difficulty']): number {
  return findPriceEntry(bossKey, difficulty, getCurrentBossProfitPeriod('weekly', NOW).periodKey, NOW)?.priceMeso ?? 0
}

describe('bossPayoutMeso', () => {
  it('인원으로 나누면 보스 수익과 같은 내림 몫이다', () => {
    const 카링 = boss('kaling', 'normal', 3)

    expect(bossPayoutMeso(카링, NOW)).toBe(Math.floor(priceOf('kaling', 'normal') / 3))
  })

  it('비율로 나누면 수수료를 뗀 내 몫이다', () => {
    const shares = { myShare: 2, sharesTotal: 5, splitFeePercent: 3 }
    const 카링 = { ...boss('kaling', 'normal', 2), shares }

    expect(bossPayoutMeso(카링, NOW)).toBe(crystalPayoutMeso(priceOf('kaling', 'normal'), 2, shares))
    expect(bossPayoutMeso(카링, NOW)).toBeLessThan(Math.floor(priceOf('kaling', 'normal') * 0.4))
  })
})

describe('keepTopByPayout', () => {
  // 보스 관리에 13개가 들어 있으면 몫이 가장 작은 하나가 빠진다.
  it('주간 보스가 12개를 넘으면 몫이 큰 12개만 남긴다', () => {
    const 열셋 = [
      boss('papulatus', 'chaos'),
      boss('lotus', 'hard'),
      boss('damien', 'hard'),
      boss('guardian_angel_slime', 'chaos'),
      boss('lucid', 'hard'),
      boss('will', 'hard'),
      boss('gloom', 'chaos'),
      boss('verus_hilla', 'hard'),
      boss('darknell', 'hard'),
      boss('chosen_seren', 'hard'),
      boss('guardian_kalos', 'normal'),
      boss('first_adversary', 'normal'),
      boss('kaling', 'normal'),
    ]

    const 남은것 = keepTopByPayout(열셋, NOW)

    expect(남은것).toHaveLength(12)
    expect(남은것.map((one) => one.bossKey)).not.toContain('papulatus')
  })

  // 게임의 주간 처치 한도가 시즌 보스를 세지 않는다.
  it('시즌 보스는 12개에 세지 않고 남긴다', () => {
    const 열둘 = Array.from({ length: 12 }, () => boss('lotus', 'hard')).map((one, index) => ({ ...one, bossKey: `lotus-${index}` }))

    const 남은것 = keepTopByPayout([...열둘, boss('meirin', 'normal')], NOW)

    expect(남은것).toHaveLength(13)
    expect(남은것.map((one) => one.bossKey)).toContain('meirin')
  })
})

describe('sortByReferenceOrder', () => {
  it('보스 표의 기준 순서로 늘어놓는다', () => {
    const 섞인 = [boss('kaling', 'normal'), boss('lotus', 'hard'), boss('first_adversary', 'normal')]

    expect(sortByReferenceOrder(섞인).map((one) => one.bossKey)).toEqual(['lotus', 'first_adversary', 'kaling'])
  })
})

describe('totalPayoutMeso', () => {
  it('보스마다 몫을 더한다', () => {
    const 둘 = [boss('kaling', 'normal', 2), boss('lotus', 'hard')]

    expect(totalPayoutMeso(둘, NOW)).toBe(bossPayoutMeso(둘[0]!, NOW) + bossPayoutMeso(둘[1]!, NOW))
  })
})

describe('formatEok', () => {
  it('억 단위 소수 둘째 자리까지 반올림한다', () => {
    expect(formatEok(264_900_000)).toBe('2.65억')
    expect(formatEok(1_810_233_333)).toBe('18.10억')
    expect(formatEok(67_350_000)).toBe('0.67억')
    expect(formatEok(0)).toBe('0억')
  })
})

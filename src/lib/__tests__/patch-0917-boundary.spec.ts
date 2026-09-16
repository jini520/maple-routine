// 09-17 패치는 오전 10시에 적용되는데 주간 리셋은 그 날 00:00 이다. 그 열 시간은 기간이 이미
// 09-17 인데 게임은 옛 가격 결정석을 준다.
import { findPriceEntry } from '../boss/boss-crystal-prices'
import { getBossDropCandidates } from '../boss/boss-drops'

const 리셋직후 = new Date('2026-09-17T00:30:00+09:00')
const 아홉시 = new Date('2026-09-17T09:59:00+09:00')
const 열시 = new Date('2026-09-17T10:00:00+09:00')

describe('09-17 패치 당일의 가격', () => {
  it('10시 전에 굳는 09-17 주 기록은 옛 가격이다', () => {
    expect(findPriceEntry('zakum', 'chaos', '2026-09-17', 리셋직후)?.priceMeso).toBe(8_080_000)
    expect(findPriceEntry('zakum', 'chaos', '2026-09-17', 아홉시)?.priceMeso).toBe(8_080_000)
  })

  it('10시부터 새 가격이다', () => {
    expect(findPriceEntry('zakum', 'chaos', '2026-09-17', 열시)?.priceMeso).toBe(4_040_000)
  })

  it('지난 주와 다음 주는 시계를 안 탄다', () => {
    expect(findPriceEntry('zakum', 'chaos', '2026-09-10', 열시)?.priceMeso).toBe(8_080_000)
    expect(findPriceEntry('zakum', 'chaos', '2026-09-24', 리셋직후)?.priceMeso).toBe(4_040_000)
  })

  // 월간 기간이 시작하는 순간부터 새 가격이다(사용자 결정 2026-09-17).
  it('검은마법사의 10-01 경계는 00시 그대로다', () => {
    expect(findPriceEntry('black_mage', 'hard', '2026-09', 열시)?.priceMeso).toBe(665_000_000)
    expect(findPriceEntry('black_mage', 'hard', '2026-10', new Date('2026-10-01T00:00:00+09:00'))?.priceMeso).toBe(
      465_000_000,
    )
  })
})

describe('09-17 패치 당일의 드롭 타일', () => {
  const 이름 = (now: Date): string[] =>
    getBossDropCandidates('guardian_angel_slime', '2026-09-17', now).map((candidate) => candidate.name)

  it('10시 전에는 교환권이 서고 소울 에테르는 안 선다', () => {
    expect(이름(아홉시)).toContain('매지컬 무기 주문서 교환권')
  })

  it('10시부터 교환권이 빠진다', () => {
    expect(이름(열시)).not.toContain('매지컬 무기 주문서 교환권')
  })
})

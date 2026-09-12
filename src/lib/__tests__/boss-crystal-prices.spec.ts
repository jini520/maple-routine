// 결정석 가격은 처치의 기간으로 고른다. 값은 2026-09-17 패치에서 사용자가 준 것이다(2026-09-11).
import { findPriceEntry, getMaxPartySize } from '../boss/boss-crystal-prices'

describe('findPriceEntry: 그 기간의 가격', () => {
  it('주간 보스는 09-17 주부터 새 가격이다', () => {
    expect(findPriceEntry('자쿰', '카오스', '2026-09-10')?.priceMeso).toBe(8_080_000)
    expect(findPriceEntry('자쿰', '카오스', '2026-09-17')?.priceMeso).toBe(4_040_000)
  })

  it('검은마법사는 10월 기간부터 새 가격이다. 9월 기간은 옛 가격이다', () => {
    expect(findPriceEntry('검은마법사', '하드', '2026-09')?.priceMeso).toBe(665_000_000)
    expect(findPriceEntry('검은마법사', '하드', '2026-10')?.priceMeso).toBe(465_000_000)
    expect(findPriceEntry('검은마법사', '익스트림', '2026-10')?.priceMeso).toBe(5_680_000_000)
  })

  // 사용자가 목록에 주지 않은 것은 그대로다.
  it('바뀌지 않은 보스는 두 기간이 같다', () => {
    expect(findPriceEntry('감시자 칼로스', '익스트림', '2026-09-10')?.priceMeso).toBe(4_104_000_000)
    expect(findPriceEntry('감시자 칼로스', '익스트림', '2026-09-17')?.priceMeso).toBe(4_104_000_000)
  })

  it('없는 조합은 undefined 다', () => {
    expect(findPriceEntry('존재하지않는보스', '하드', '2026-09-17')).toBeUndefined()
  })
})

// 파티 인원 상한은 보스·난이도의 성질이지 그 기간의 값이 아니다.
describe('getMaxPartySize: 기간을 안 탄다', () => {
  it('가격 줄이 여럿인 보스도 상한이 하나다', () => {
    expect(getMaxPartySize('최초의 대적자', '노멀')).toBe(3)
    expect(getMaxPartySize('스우', '익스트림')).toBe(2)
    expect(getMaxPartySize('자쿰', '카오스')).toBe(6)
  })
})

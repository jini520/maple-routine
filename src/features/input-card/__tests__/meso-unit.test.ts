import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { __resetMesoUnitsForTest, loadMesoUnits, mesoUnitOf, rememberMesoUnit } from '../meso-unit'

beforeEach(() => {
  installFakePreferences()
  __resetMesoUnitsForTest()
})

describe('금액 칸마다 고른 단위를 기억한다', () => {
  it('고른 적이 없는 칸은 기본으로 연다', async () => {
    await loadMesoUnits()

    expect(mesoUnitOf('dropPrice')).toBe('base')
  })

  // 드롭 판매가에서 억을 골라도 개당 가격 칸은 몇 만 메소를 치는 칸이라 따라오면 안 된다.
  it('한 칸에서 고른 단위가 다른 칸으로 번지지 않는다', async () => {
    await loadMesoUnits()

    rememberMesoUnit('dropPrice', 'eok')

    expect(mesoUnitOf('dropPrice')).toBe('eok')
    expect(mesoUnitOf('catalogUnitPrice')).toBe('base')
  })

  it('다음 실행에서 저장된 단위를 읽어 온다', async () => {
    await loadMesoUnits()
    rememberMesoUnit('itemSale', 'man')
    rememberMesoUnit('itemSplit', 'eok')
    await Promise.resolve()

    __resetMesoUnitsForTest()
    await loadMesoUnits()

    expect(mesoUnitOf('itemSale')).toBe('man')
    expect(mesoUnitOf('itemSplit')).toBe('eok')
  })
})

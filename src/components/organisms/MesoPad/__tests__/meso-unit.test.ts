import { MAX_MESO } from '../meso-pad'
import { acceptUnitText, mesoTextOfUnit, shownUnitText, unitTextOf } from '../meso-unit'

describe('단위 글자와 메소 글자를 서로 옮긴다', () => {
  it('99억 9천만을 단위마다 다르게 친다', () => {
    expect(unitTextOf('9990000000', 'base')).toBe('9990000000')
    expect(unitTextOf('9990000000', 'man')).toBe('999000')
    expect(unitTextOf('9990000000', 'eok')).toBe('99.9')
  })

  it('어느 단위로 쳐도 같은 메소로 돌아온다', () => {
    expect(mesoTextOfUnit('9990000000', 'base')).toBe('9990000000')
    expect(mesoTextOfUnit('999000', 'man')).toBe('9990000000')
    expect(mesoTextOfUnit('99.9', 'eok')).toBe('9990000000')
  })

  // 곱하면 8.29 * 1e8 이 828999999.9999999 가 되어 1메소가 사라진다.
  it('곱셈으로 1메소를 잃지 않는다', () => {
    expect(mesoTextOfUnit('8.29', 'eok')).toBe('829000000')
    expect(mesoTextOfUnit('1.15', 'eok')).toBe('115000000')
    expect(mesoTextOfUnit('0.00000001', 'eok')).toBe('1')
    expect(unitTextOf('829000000', 'eok')).toBe('8.29')
  })

  it('만 미만 끝수도 소수로 남는다', () => {
    expect(unitTextOf('12345', 'man')).toBe('1.2345')
    expect(unitTextOf('1', 'eok')).toBe('0.00000001')
  })

  it('치는 중인 소수점은 메소로 옮겨도 값을 바꾸지 않는다', () => {
    expect(mesoTextOfUnit('99.', 'eok')).toBe('9900000000')
  })

  it('빈 칸은 어느 쪽으로도 빈 칸이다', () => {
    expect(unitTextOf('', 'eok')).toBe('')
    expect(mesoTextOfUnit('', 'eok')).toBe('')
  })
})

describe('칸에 남길 단위 글자', () => {
  it('만은 소수 4자리, 억은 8자리까지 받는다', () => {
    expect(acceptUnitText('1.234', '1.2345', 'man')).toBe('1.2345')
    expect(acceptUnitText('1.2345', '1.23456', 'man')).toBe('1.2345')
    expect(acceptUnitText('1.2345678', '1.23456789', 'eok')).toBe('1.23456789')
    expect(acceptUnitText('1.23456789', '1.234567891', 'eok')).toBe('1.23456789')
  })

  it('소수점은 하나뿐이고 기본 단위에는 없다', () => {
    expect(acceptUnitText('9.9', '9.9.', 'eok')).toBe('9.9')
    expect(acceptUnitText('99', '99.', 'base')).toBe('99')
  })

  it('소수점부터 치면 앞에 0 을 붙인다', () => {
    expect(acceptUnitText('', '.', 'eok')).toBe('0.')
  })

  it('상한은 메소로 환산한 값에 건다', () => {
    expect(acceptUnitText('99999.9999999', '99999.99999999', 'eok')).toBe('99999.99999999')
    expect(mesoTextOfUnit('99999.99999999', 'eok')).toBe(String(MAX_MESO))
    expect(acceptUnitText('99999', '100000', 'eok')).toBe('99999')
  })

  it('숫자와 소수점이 아닌 글자는 걷는다', () => {
    expect(acceptUnitText('', '1,234.5', 'man')).toBe('1234.5')
  })
})

describe('칸에 보이는 글자', () => {
  it('정수부에만 콤마를 넣는다', () => {
    expect(shownUnitText('1234567.8901')).toBe('1,234,567.8901')
  })

  // 접으면 소수점을 칠 수 없다.
  it('치는 중인 소수점을 접지 않는다', () => {
    expect(shownUnitText('99.')).toBe('99.')
  })
})

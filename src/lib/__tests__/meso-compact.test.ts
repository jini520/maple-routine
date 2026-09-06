// 캘린더 칸은 너비가 **화면 폭 ÷ 7** 이라 `formatMesoUnits`(`1억 2345만 6789`)가 안 들어간다.
// 단위 하나만 남긴다.

import { formatMesoCompact } from '../cashbook/meso-compact'

describe('formatMesoCompact: 억', () => {
  // 유효숫자를 안 쓴다. 자리가 커져도 소수 둘이다(사용자 지정). 유효숫자 넷이던 때는 같은
  // 화면의 두 수가 소수 자리 수가 달라(`129.4억` 옆에 `5.432억`) 눈이 자릿수를 못 잡았다.
  it('소수 둘째 자리까지 적는다', () => {
    expect(formatMesoCompact(5_474_000_000)).toBe('54.74억')
    expect(formatMesoCompact(543_200_000)).toBe('5.43억')
    expect(formatMesoCompact(12_940_000_000)).toBe('129.4억')
    expect(formatMesoCompact(129_400_000_000)).toBe('1,294억')
  })

  it('셋째 자리에서 자른다. 반올림하지 않는다', () => {
    expect(formatMesoCompact(1_239_000_000)).toBe('12.39억')
    expect(formatMesoCompact(1_239_900_000)).toBe('12.39억')
  })

  it('뒤따르는 0 은 떼어낸다', () => {
    expect(formatMesoCompact(1_290_000_000)).toBe('12.9억')
    expect(formatMesoCompact(100_000_000)).toBe('1억')
    expect(formatMesoCompact(1_000_000_000)).toBe('10억')
  })

  it('음수도 같다', () => {
    expect(formatMesoCompact(-5_474_000_000)).toBe('-54.74억')
  })
})

describe('formatMesoCompact: 만과 그 아래', () => {
  // 만 단위는 소수점을 안 붙인다(사용자 지정).
  it('1억 미만은 만 단위 정수다', () => {
    expect(formatMesoCompact(39_080_000)).toBe('3,908만')
    expect(formatMesoCompact(10_000)).toBe('1만')
    expect(formatMesoCompact(99_999_999)).toBe('9,999만')
  })

  // 만 미만을 **0만** 으로 뭉개면 **적었는데 0** 이 되어 **모름** 과 **없음** 이 섞인다.
  it('만 미만은 그대로 적는다', () => {
    expect(formatMesoCompact(9_999)).toBe('9,999')
    expect(formatMesoCompact(1)).toBe('1')
  })

  it('0 은 0 이다', () => {
    expect(formatMesoCompact(0)).toBe('0')
  })
})

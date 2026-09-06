// 캘린더 칸은 너비가 **화면 폭 ÷ 7** 이라 `formatMesoUnits`(`1억 2345만 6789`)가 안 들어간다.
// 단위 하나만 남긴다.

import { formatMesoCompact } from '../cashbook/meso-compact'

describe('formatMesoCompact: 억', () => {
  // 숫자는 넷까지, 소수는 둘째 자리까지. 둘 중 먼저 걸리는 쪽이 이긴다(사용자 지정).
  it('정수부가 길면 소수 자리가 줄어든다', () => {
    expect(formatMesoCompact(5_474_000_000)).toBe('54.74억')
    expect(formatMesoCompact(12_940_000_000)).toBe('129.4억')
    expect(formatMesoCompact(129_400_000_000)).toBe('1,294억')
  })

  // 정수가 한 자리면 소수 셋이 들어갈 자리가 있어도 둘이 상한이다.
  it('소수는 둘째 자리를 안 넘는다', () => {
    expect(formatMesoCompact(543_200_000)).toBe('5.43억')
  })

  it('반올림한다', () => {
    expect(formatMesoCompact(1_239_000_000)).toBe('12.39억')
    expect(formatMesoCompact(1_235_000_000)).toBe('12.35억')
    expect(formatMesoCompact(1_236_000_000)).toBe('12.36억')
    expect(formatMesoCompact(543_600_000)).toBe('5.44억')
    expect(formatMesoCompact(12_950_000_000)).toBe('129.5억')
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

// 조가 없으면 숫자 넷이 깨진다. 1조 2,940억이 `12,940억`(다섯)이 된다(사용자 지적).
describe('formatMesoCompact: 조', () => {
  it('1조 부터는 조로 적는다', () => {
    expect(formatMesoCompact(1_000_000_000_000)).toBe('1조')
    expect(formatMesoCompact(1_294_000_000_000)).toBe('1.29조')
    expect(formatMesoCompact(12_940_000_000_000)).toBe('12.94조')
  })

  // 9,999억은 네 자리로 멀쩡하다. 그 위에서만 반올림이 `10,000억`(다섯)을 만든다.
  it('9,999억까지는 억으로 남는다', () => {
    expect(formatMesoCompact(999_900_000_000)).toBe('9,999억')
    expect(formatMesoCompact(999_949_999_999)).toBe('9,999억')
  })

  it('반올림이 다섯 자리를 만들 때만 조로 올린다', () => {
    expect(formatMesoCompact(999_950_000_000)).toBe('1조')
    expect(formatMesoCompact(999_990_000_000)).toBe('1조')
  })

  it('억과 같은 자릿수 규칙이다', () => {
    expect(formatMesoCompact(1_294_000_000_000_000)).toBe('1,294조')
  })
})

describe('formatMesoCompact: 만과 그 아래', () => {
  // 만 단위는 소수점을 안 붙인다(사용자 지정).
  it('1억 미만은 만 단위 정수다', () => {
    expect(formatMesoCompact(39_080_000)).toBe('3,908만')
    expect(formatMesoCompact(10_000)).toBe('1만')
    // 만은 자르므로 이런 일이 없다. 9,999만이 상한이고 그 위는 이미 억이다.
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

// 어느 값이 와도 숫자는 넷을 안 넘는다(사용자 지정). 단위 문턱과 반올림이 만나는 자리에서
// 깨지기 쉬워 경계를 훑는다.
it('숫자가 넷을 안 넘는다', () => {
  const edges = [1, 9_999, 10_000, EOK - 1, EOK, JO - 1, JO, JO * 9_999]
  const samples = edges.flatMap((edge) => [edge - 1, edge, edge + 1])
  for (const value of samples) {
    for (const signed of [value, -value]) {
      const digits = formatMesoCompact(signed).replace(/[^0-9]/g, '').length
      expect({ signed, out: formatMesoCompact(signed), digits }).toMatchObject({
        digits: expect.any(Number),
      })
      expect(digits).toBeLessThanOrEqual(4)
    }
  }
})

const EOK = 100_000_000
const JO = 1_000_000_000_000

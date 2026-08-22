// 캘린더 칸은 너비가 **화면 폭 ÷ 7** 이라 `formatMesoUnits`(「1억 2345만 6789」)가 안 들어간다
// ([[ADR-169]] 정정 1). 단위 하나 + 유효숫자 넷으로 줄인다.

import { formatMesoCompact } from '../meso-compact'

describe('formatMesoCompact — 억', () => {
  it('유효숫자 넷을 유지한다', () => {
    expect(formatMesoCompact(5_474_000_000)).toBe('54.74억')
    expect(formatMesoCompact(2_224_000_000)).toBe('22.24억')
    expect(formatMesoCompact(4_972_000_000)).toBe('49.72억')
  })

  it('자리가 커지면 소수 자리를 줄인다', () => {
    expect(formatMesoCompact(12_940_000_000)).toBe('129.4억')
    expect(formatMesoCompact(129_400_000_000)).toBe('1,294억')
  })

  it('10억 미만은 소수 셋까지 — 여전히 유효숫자 넷이다', () => {
    expect(formatMesoCompact(543_200_000)).toBe('5.432억')
  })

  it('뒤따르는 0 은 떼어낸다', () => {
    expect(formatMesoCompact(1_290_000_000)).toBe('12.9억')
    expect(formatMesoCompact(100_000_000)).toBe('1억')
    expect(formatMesoCompact(1_000_000_000)).toBe('10억')
  })
})

describe('formatMesoCompact — 만과 그 아래', () => {
  it('1억 미만은 만 단위 정수다', () => {
    expect(formatMesoCompact(39_080_000)).toBe('3,908만')
    expect(formatMesoCompact(10_000)).toBe('1만')
  })

  // 만 미만을 «0만» 으로 뭉개면 «적었는데 0» 이 되어 [[ADR-057]] 이 가른 «모름» 과 «없음» 이 섞인다.
  it('만 미만은 그대로 적는다', () => {
    expect(formatMesoCompact(9_999)).toBe('9,999')
    expect(formatMesoCompact(1)).toBe('1')
  })

  it('0 은 0 이다', () => {
    expect(formatMesoCompact(0)).toBe('0')
  })
})

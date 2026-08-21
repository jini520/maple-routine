import {
  contrastRatio,
  mixOklab,
  oklchToHex,
  parseHex,
  hexToOklch,
  relativeLuminance,
  toHex,
  withLightness,
} from '../color'

describe('parseHex / toHex', () => {
  it('6자리 hex를 왕복 변환한다', () => {
    expect(toHex(parseHex('#F58B0F'))).toBe('#F58B0F')
    expect(toHex(parseHex('#0c080f'))).toBe('#0C080F')
  })

  it('3자리 축약형을 확장한다', () => {
    expect(parseHex('#FFF')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('# 없는 표기도 받는다', () => {
    expect(parseHex('F58B0F')).toEqual(parseHex('#F58B0F'))
  })

  it('잘못된 표기는 던진다', () => {
    expect(() => parseHex('#GGGGGG')).toThrow()
    expect(() => parseHex('#12345')).toThrow()
  })
})

describe('relativeLuminance / contrastRatio', () => {
  it('흰색·검정의 상대 휘도는 1과 0이다', () => {
    expect(relativeLuminance(parseHex('#FFFFFF'))).toBeCloseTo(1, 5)
    expect(relativeLuminance(parseHex('#000000'))).toBeCloseTo(0, 5)
  })

  it('흰색 대 검정의 대비는 WCAG 최대값 21:1이다', () => {
    expect(contrastRatio(parseHex('#FFFFFF'), parseHex('#000000'))).toBeCloseTo(21, 2)
  })

  it('대비는 순서와 무관하다', () => {
    const a = parseHex('#F58B0F')
    const b = parseHex('#241208')
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })

  it('같은 색끼리는 1:1이다', () => {
    expect(contrastRatio(parseHex('#9975B3'), parseHex('#9975B3'))).toBeCloseTo(1, 10)
  })

  // 알려진 실패 사례 — 레테 info-tint 사고(ADR-064 배경 ①). 폐기 전 값이 실제로 AA에 한참 못 미쳤음을
  // 회귀로 박아둬, 대비 계산이 틀어지면 이 테스트가 먼저 깨지게 한다.
  it('폐기된 레테 info-tint(#C9D6F2) 대 text(#E8DFEC)는 1.2:1 미만이다', () => {
    expect(contrastRatio(parseHex('#C9D6F2'), parseHex('#E8DFEC'))).toBeLessThan(1.2)
  })

  it('교체된 레테 info-tint(#262A3A)는 같은 text에 대해 AA를 넘는다', () => {
    expect(contrastRatio(parseHex('#262A3A'), parseHex('#E8DFEC'))).toBeGreaterThan(4.5)
  })
})

describe('hexToOklch / oklchToHex', () => {
  it('무채색의 채도는 0에 가깝다', () => {
    expect(hexToOklch('#FFFFFF').c).toBeLessThan(0.001)
    expect(hexToOklch('#808080').c).toBeLessThan(0.001)
  })

  it('흰색의 명도는 1, 검정은 0이다', () => {
    expect(hexToOklch('#FFFFFF').l).toBeCloseTo(1, 3)
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 3)
  })

  it('왕복 변환이 원래 색을 보존한다', () => {
    for (const hex of ['#F58B0F', '#9975B3', '#DC171D', '#E86A16', '#C9EEF2', '#241208']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex)
    }
  })

  it('색상환 밖(gamut) 값은 표현 가능한 색으로 클램프된다', () => {
    const clamped = oklchToHex({ l: 0.6, c: 0.5, h: 150 })
    expect(clamped).toMatch(/^#[0-9A-F]{6}$/)
  })
})

describe('withLightness', () => {
  it('색상(H)을 유지한 채 명도만 바꾼다', () => {
    const original = hexToOklch('#F58B0F')
    const darker = hexToOklch(withLightness('#F58B0F', original.l - 0.2))
    expect(darker.h).toBeCloseTo(original.h, 0)
    expect(darker.l).toBeLessThan(original.l)
  })

  it('명도를 낮추면 대비(흰색 기준)가 커진다', () => {
    const white = parseHex('#FFFFFF')
    const before = contrastRatio(parseHex('#F58B0F'), white)
    const after = contrastRatio(parseHex(withLightness('#F58B0F', 0.4)), white)
    expect(after).toBeGreaterThan(before)
  })
})

describe('mixOklab', () => {
  it('비율 0이면 두 번째 색, 1이면 첫 번째 색이다', () => {
    expect(mixOklab('#F58B0F', '#FDFCF6', 1)).toBe('#F58B0F')
    expect(mixOklab('#F58B0F', '#FDFCF6', 0)).toBe('#FDFCF6')
  })

  it('중간 비율은 두 색 사이의 명도를 갖는다', () => {
    const a = hexToOklch('#F58B0F').l
    const b = hexToOklch('#FDFCF6').l
    const mid = hexToOklch(mixOklab('#F58B0F', '#FDFCF6', 0.5)).l
    expect(mid).toBeGreaterThan(Math.min(a, b))
    expect(mid).toBeLessThan(Math.max(a, b))
  })

  // CSS color-mix(in oklab, X 15%, surface)와 같은 결과여야 한다 — 이 함수가 만드는 값이
  // 브라우저가 계산하는 값과 어긋나면 대비 검증이 실제 화면과 달라진다(ADR-064 결정 2).
  it('15% 틴트는 바탕색 쪽에 훨씬 가깝다', () => {
    const surface = hexToOklch('#FDFCF6').l
    const tint = hexToOklch(mixOklab('#F58B0F', '#FDFCF6', 0.15)).l
    expect(Math.abs(tint - surface)).toBeLessThan(0.15)
  })
})

// 바 색의 **관계**를 등록된 테마 전부에 대고 검사한다.
//
// 이 파일이 커진 것은 색을 세 판 고쳐 돌았기 때문이다. 배경과 안 갈려서 어둡게 했더니 글자가 안
// 읽혔고, 글자를 살리려 밝게 했더니 다시 안 갈렸다. 하나를 고칠 때 나머지가 깨지는 것을 눈으로
// 잡을 수 없어서, 네 관계를 전부 수치로 못 박는다.
import jobThemes from '../../data/job-themes.json'
import { hexToOklch, parseHex, relativeLuminance } from '../../lib/color'
import type { ThemeDefinition } from '../../types/theme'

import { resolveBarColors } from '../bar-colors'

const THEMES = Object.entries(jobThemes) as ReadonlyArray<[string, ThemeDefinition]>

function luminance(hex: string): number {
  return relativeLuminance(parseHex(hex))
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** 두 색이 다른 색으로 보이는가. 명도만이 아니라 채도·색상까지 함께 본다. */
function oklabDistance(a: string, b: string): number {
  const point = (hex: string): readonly [number, number, number] => {
    const { l, c, h } = hexToOklch(hex)
    const radians = (h * Math.PI) / 180
    return [l, c * Math.cos(radians), c * Math.sin(radians)]
  }
  const [p, q] = [point(a), point(b)]

  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

describe('떠 있는 바의 색', () => {
  it('테마가 하나 이상 등록돼 있다. 아래 검사가 공회전하지 않는다', () => {
    expect(THEMES.length).toBeGreaterThan(0)
  })

  // 페이지와 바를 가르는 것은 색이 아니라 테두리다. 바탕을 어둡게 밀어 가르면 그 위 글자가 안
  // 읽힌다. 분리는 이 선이 지고 바탕은 밝은 쪽에 남는다.
  it.each(THEMES)('%s: 테두리가 페이지 배경과 갈린다', (_name, theme) => {
    expect(contrast(resolveBarColors(theme).edge, theme.bg)).toBeGreaterThan(1.3)
  })

  it.each(THEMES)('%s: 바가 그 모드에서 가장 밝은 표면이다', (_name, theme) => {
    const { bar } = resolveBarColors(theme)

    expect(bar).toBe(theme.mode === 'dark' ? theme.surface2 : theme.surface)
    expect(luminance(bar)).toBeGreaterThan(luminance(theme.mode === 'dark' ? theme.surface : theme.surface2))
  })

  it.each(THEMES)('%s: 활성 알약이 바와 갈린다', (_name, theme) => {
    const { bar, pill } = resolveBarColors(theme)

    expect(contrast(pill, bar)).toBeGreaterThan(theme.mode === 'dark' ? 1.2 : 1.03)
  })

  // 폴백 알약은 유리가 그리는 그 판이다.
  //
  // 유리 경로는 색을 얹지 않고 덜어내는 중립 판인데, 폴백의 `pill` 이 첫 판의
  // `mixOklab(primaryTint, primary, 0.85)` 로 남으면 안드로이드에서만 활성 자리가 진분홍
  // 덩어리로 뜬다(실기기 (255,215,239) 대 iOS (246,245,245)).
  //
  // 지키는 것은 어떤 색인가 가 아니라 방향이다. 채도가 없고(강조는 글리프가 진다) 유리 tint 와
  // 같은 쪽(`text` 쪽 = 바보다 어둡다)으로 간다.
  it.each(THEMES)('%s: 라이트 폴백 알약은 무채색이다', (_name, theme) => {
    if (theme.mode !== 'light') return

    expect(hexToOklch(resolveBarColors(theme).pill).c).toBeLessThan(0.005)
  })

  it.each(THEMES)('%s: 라이트 폴백 알약이 유리 tint 와 같은 방향이다', (_name, theme) => {
    if (theme.mode !== 'light') return
    const { pill, bar } = resolveBarColors(theme)

    // 유리 쪽(`pillOnGlass`)이 바보다 어두운 값인 것은 아래 마지막 검사가 따로 건다.
    expect(luminance(pill)).toBeLessThan(luminance(bar))
    // **판이 색을 지면 안 된다**. 옛 규칙(틴트+원색)은 여기서 1.23~1.46 이었다.
    expect(contrast(pill, bar)).toBeLessThan(1.2)
  })

  // 강조색은 테마의 메인 컬러다. 알약 위 대비 4.5 를 맞추려고 `text` 쪽으로 섞으면 채도를 같이
  // 빼앗아 머쉬맘의 주황이 갈색이 된다. 지키는 것은 대비가 아니라 그 색이 그 테마의 색인가 다.
  it.each(THEMES)('%s: 라이트는 메인 컬러를 그대로 쓴다', (_name, theme) => {
    if (theme.mode !== 'light') return

    expect(resolveBarColors(theme).accent).toBe(theme.primaryInk)
  })

  // 다크는 원색이 알약보다 어두워 활성이 비활성보다 흐려진다(레테 L0.62 대 muted L0.73).
  // 그때만 명도를 올리는데 색상도 채도도 건드리지 않는다.
  //
  // 채도가 상한이고 명도가 그 아래에서 움직인다. 목표 명도가 sRGB 밖이면 가뭄 매핑이 채도를
  // 깎는데(검은마법사 C0.219 → 0.131 · 60%) 그것은 `text` 쪽으로 섞기와 같은 것을 빼앗는
  // 일이다. 그래서 목표까지 올리되 원 채도를 못 지키는 지점에서 멈춘다.
  it.each(THEMES)('%s: 다크는 색상·채도를 유지한 채 명도만 올린다', (_name, theme) => {
    if (theme.mode !== 'dark') return

    const [lifted, origin] = [
      hexToOklch(resolveBarColors(theme).accent),
      hexToOklch(theme.primaryInk),
    ]

    expect(lifted.h).toBeCloseTo(origin.h, 0)
    expect(lifted.c).toBeGreaterThanOrEqual(origin.c * 0.97)
    // `textMuted` 위로 올라간다는 조건은 뺐다. 그것과 채도를 지킨다 가 sRGB 안에서 동시에
    // 성립하지 않는 테마가 있다(검은마법사 L0.672 대 muted L0.722). 남는 것은 원색보다
    // 어두워지지는 않는다 다.
    expect(lifted.l).toBeGreaterThanOrEqual(origin.l)
  })

  // 멈추는 자리가 **필요할 때만** 이다. 목표 명도가 sRGB 안이면 거기까지 올라간다(레테).
  it('가뭄에 안 걸리는 테마는 목표 명도까지 올라간다 (레테)', () => {
    const lethe = THEMES.find(([name]) => name === '레테')?.[1]
    expect(lethe).toBeDefined()
    if (!lethe) return

    expect(hexToOklch(resolveBarColors(lethe).accent).l).toBeCloseTo(
      hexToOklch(lethe.textMuted).l + 0.06,
      2,
    )
  })

  it.each(THEMES)('%s: 비활성 라벨이 바 위에서 읽힌다', (_name, theme) => {
    const { muted, bar } = resolveBarColors(theme)

    expect(contrast(muted, bar)).toBeGreaterThan(4.5)
  })

  // 바 안에서 색을 지는 자리는 활성 하나다. 레테의 `textMuted` 는 그 자체가 연보라(C0.056.
  // 여섯 중 가장 높고 혼테일의 4.7 배)라, 그대로 쓰면 비활성까지 강조색과 같은 계열로 읽힌다.
  //
  // 테마 이름으로 한 테마만 예외 두는 길은 막혀 있으므로 규칙으로 둔다.
  it.each(THEMES)('%s: 바의 비활성은 무채색이다', (_name, theme) => {
    expect(hexToOklch(resolveBarColors(theme).muted).c).toBeLessThan(0.005)
  })

  // 다만 **바 안에서만** 이다. 같은 테마의 다른 보조 텍스트는 `text-muted` 를 그대로 쓴다.
  it('테마의 text-muted 토큰 자체는 건드리지 않는다', () => {
    const lethe = THEMES.find(([name]) => name === '레테')
    expect(lethe).toBeDefined()
    expect(lethe?.[1].textMuted).toBe('#B89CBD')
  })

  // **활성과 비활성이 같은 색으로 보이면 안 된다.** 레테에서 활성 글리프 (176,148,196) 와
  // 비활성 (184,156,189) 이 사실상 같은 색이었다. 그 테마는 `textMuted` 자체가 연보라라, 강조색을
  // `text` 쪽으로 미는 것만으로는 비활성과 같은 자리에 도착한다.
  //
  // **명도 대비로 재면 안 된다.** 여섯 테마 전부 활성↔비활성 대비가 1.02~1.41 로 낮은데, 라이트는
  // 색상이 갈려서 멀쩡히 구분된다(머쉬맘 주황 ↔ 올리브). 명도만 보면 멀쩡한 테마까지 창백하게
  // 밀어 버리므로, 명도·채도·색상을 함께 보는 oklab 거리로 잰다.
  it.each(THEMES)('%s: 활성 강조색이 비활성 라벨과 **다른 색** 이다', (_name, theme) => {
    const { accent, muted } = resolveBarColors(theme)

    expect(oklabDistance(accent, muted)).toBeGreaterThan(0.07)
  })

  // 유리 알약의 tint 방향. 라이트에서 흰 tint 를 얹으면 알약이 뒤보다 밝아진다. `clear` 재질이
  // 이미 하이라이트를 얹고 있어 거기에 흰색을 더하면 흰 카드 위에서 그냥 흰 덩어리가 된다
  // (알약−카드 +11.4). 그래서 라이트의 tint 는 얹는 값이 아니라 그 하이라이트를 덜어내는
  // 값이어야 한다.
  it('라이트 유리 알약 tint 는 바보다 **어두운** 쪽이다', () => {
    const light = THEMES.filter(([, theme]) => theme.mode === 'light')
    expect(light.length).toBeGreaterThan(0)

    for (const [name, theme] of light) {
      const { pillOnGlass, bar } = resolveBarColors(theme)

      // 알파를 떼고 바탕색만 본다. 방향이 문제지 세기가 문제가 아니다.
      expect([name, luminance(pillOnGlass.slice(0, 7)) < luminance(bar)]).toEqual([name, true])
    }
  })
})

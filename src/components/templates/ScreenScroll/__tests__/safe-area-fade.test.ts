// 안전영역 페이드의 **두 값**. 어디를 깎는가와 어떻게 깎는가.
//
// 둘 다 화면을 렌더하지 않고 볼 수 있어서 여기 따로 있다. `bottom-inset.test.ts` 와 같은 이유이고,
// 실제로 하단 값은 그 판정에서 **파생**되므로 두 파일이 같은 자리를 지킨다.

import { resolveBottomSafeAreaPx } from '../../../../lib/safe-area'
import { resolveScreenBottomInset } from '../bottom-inset'
import { FADE_MASK_ALPHAS, FADE_MASK_LOCATIONS, resolveSafeAreaFade } from '../safe-area-fade'

/**
 * iPhone 계열(`render-atom.tsx` 의 테스트 안전영역과 같은 값).
 *
 * **위아래 다 인셋이 아니다**. 상단은 `useTopSafeAreaPx`, 하단은
 * `useBottomSafeAreaPx` 의 결과가 들어오는 자리다. iOS 는 둘 다 하한
 * (48·34) 위라 인셋과 같은 값이고, 안드로이드에서만 갈린다. 그 갈림은 `lib/` 의 두 테스트가 보고,
 * 여기서는 **받은 값을 그대로 페이드 길이로 쓰는지**만 본다.
 */
const 인셋 = { top: 59, bottom: 34 }

/** 기준 기기(402pt)의 바 몫. 기기마다 다르다(`bottom-bar-metrics.ts`). */
const 바_몫 = 72
/** 페이드가 바 위로 올라가는 몫. 바 몫의 절반. */
const 바_페이드 = 바_몫 / 2

/** 화면 하나분의 인자. 하단 판정(`bottom-inset.ts`)을 그대로 태워서 넘긴다. */
const 화면 = (
  hasTabBar: boolean,
  platform: string,
  insetBottomPx: number = 인셋.bottom,
): Parameters<typeof resolveSafeAreaFade>[0] => {
  const bottomSafeAreaPx = resolveBottomSafeAreaPx({ insetBottomPx, platform })

  return {
    hasHeader: true,
    hasTabBar,
    topSafeAreaPx: 인셋.top,
    bottomSafeAreaPx,
    barSpacePx: 바_몫,
    portBottomPx: resolveScreenBottomInset({
      hasTabBar,
      insetBottomPx,
      bottomSafeAreaPx,
      barSpacePx: 바_몫,
      platform,
    }).portBottomPx,
  }
}

describe('페이드는 콘텐츠가 실제로 지나가는 자리에만 있다', () => {
  it('헤더가 있으면 상단은 상단 안전영역만큼이다. 굴리면 콘텐츠가 상태바 밑을 지나간다', () => {
    const fade = resolveSafeAreaFade(화면(true, 'ios'))

    expect(fade.topPx).toBe(59)
  })

  // 설정 계열. 셸이 스크롤포트를 안전영역만큼 내리므로 콘텐츠가 그 자리에
  // 애초에 못 온다. 깎으면 **콘텐츠의 첫 줄**을 깎게 된다.
  it('헤더가 없으면 상단은 0이다. 셸이 이미 상자를 내렸다', () => {
    const fade = resolveSafeAreaFade({ ...화면(true, 'ios'), hasHeader: false })

    expect(fade.topPx).toBe(0)
  })

  // 안전영역까지만 두면 콘텐츠가 선명한 채로 캡슐 밑에 들어가고 녹는 것은 이미 바가 가린
  // 뒤가 된다. 콘텐츠가 크롬과 처음 겹치는 자리는 바닥이 아니라 바의 윗변이다.
  it('탭 화면의 하단은 안전영역 + 바의 절반이다. 캡슐 한가운데에서 0이 된다', () => {
    const fade = resolveSafeAreaFade(화면(true, 'ios'))

    expect(fade.bottomPx).toBe(인셋.bottom + 바_페이드)
    // 바 전체(72)까지 올리면 **너무 높다** 였고, 안전영역까지만이면 콘텐츠가 선명한 채로
    // 캡슐 밑에 들어간다. 그 사이의 값이라는 것이 이 상수의 전부다.
    expect(fade.bottomPx).toBeGreaterThan(인셋.bottom)
    expect(fade.bottomPx).toBeLessThan(인셋.bottom + 바_몫)
  })

  // 바 몫이 기기마다 다르다. 페이드를 상수로 두면 큰 화면에서는 캡슐 한가운데보다 아래에서
  // 0 이 되고(콘텐츠가 선명한 채로 캡슐에 들어간다), 작은 화면에서는 그 위에서 0 이 된다
  // (캡슐 위가 흐릿하다).
  it('바 몫이 달라지면 페이드도 그 절반으로 따라간다', () => {
    for (const barSpacePx of [64, 72, 81]) {
      const fade = resolveSafeAreaFade({ ...화면(true, 'ios'), barSpacePx })

      expect(fade.bottomPx).toBe(인셋.bottom + barSpacePx / 2)
    }
  })

  // 하위 페이지에는 바가 없다. 그래서 값이 안 바뀐다.
  it('하위 페이지에는 바가 없으므로 안전영역까지다', () => {
    const fade = resolveSafeAreaFade(화면(false, 'ios'))

    expect(fade.bottomPx).toBe(인셋.bottom)
  })

  // 안드로이드 3버튼 내비의 하위 페이지. `bottom-inset.ts` 가 스크롤포트를 인셋 위에서 끝낸다.
  // 겹치는 것이 없으니 깎을 것도 없다.
  it('스크롤포트가 이미 안전영역 위에서 끝나면 하단은 0이다', () => {
    const fade = resolveSafeAreaFade(화면(false, 'android', 48))

    expect(fade.bottomPx).toBe(0)
  })

  // ****. 제스처 기기(인셋 15)의 하위 페이지에서는 그 **겹치는 것이 없다** 가
  // 더 이상 참이 아니다. 하한이 더한 19 는 `contentBottomPx` 로 나가 **콘텐츠가 지나가는 자리**가
  // 되므로, 그만큼은 깎아야 한다. 스크롤포트가 먹은 15 는 여전히 뺀다.
  it('안드로이드 제스처 하위 페이지는 하한이 더한 몫만큼 깎는다 (0 → 19)', () => {
    const fade = resolveSafeAreaFade(화면(false, 'android', 45 / 3))

    expect(fade.bottomPx).toBe(34 - 45 / 3)
  })

  // 스크롤포트가 이미 비운 몫은 깎지 않는다는 계약. 판정을 두 벌로 두면
  // 한쪽만 고쳐도 페이드가 빈 자리를 깎거나 겹치는 자리를 놓친다.
  it('안전영역 몫은 `bottom-inset.ts` 가 비운 만큼을 뺀 값이다', () => {
    for (const [hasTabBar, platform, insetBottomPx] of [
      [true, 'ios', 인셋.bottom],
      [true, 'android', 48],
      [true, 'android', 45 / 3],
      [false, 'ios', 인셋.bottom],
      [false, 'android', 48],
      [false, 'android', 45 / 3],
    ] as const) {
      const args = 화면(hasTabBar, platform, insetBottomPx)
      const fade = resolveSafeAreaFade(args)

      expect(fade.bottomPx).toBe(
        Math.max(0, args.bottomSafeAreaPx - args.portBottomPx) + (hasTabBar ? 바_페이드 : 0),
      )
    }
  })

  // 바가 있으면 그 몫(72)은 안전영역과 무관하게 남는다. 인셋 0인 기기에서도 콘텐츠는 바 밑을
  // 지나간다. 상단만 0이 된다.
  //
  // **안드로이드로는 물을 수 없는 성질이 됐다**. 그쪽은 인셋이 0이어도
  // 안전영역이 하한 34 라 **안전영역이 없는 기기** 자체가 없다.
  it('안전영역이 없는 기기에서도 바가 있으면 그 몫만큼은 깎는다', () => {
    const fade = resolveSafeAreaFade({ ...화면(true, 'ios', 0), topSafeAreaPx: 0 })

    expect(fade).toEqual({ topPx: 0, bottomPx: 바_페이드 })
  })

  it('안전영역도 바도 없으면 둘 다 0이다', () => {
    const fade = resolveSafeAreaFade({
      ...화면(false, 'ios', 0),
      hasHeader: false,
      topSafeAreaPx: 0,
    })

    expect(fade).toEqual({ topPx: 0, bottomPx: 0 })
  })
})

describe('마스크 곡선은 smoothstep² 이다', () => {
  /** 세지기 전 곡선. 지금은 이것을 제곱해 쓴다. */
  const smoothstep = (t: number): number => t * t * (3 - 2 * t)

  it('정지점과 알파가 짝을 이룬다', () => {
    expect(FADE_MASK_ALPHAS).toHaveLength(FADE_MASK_LOCATIONS.length)
  })

  // 끝점이 어긋나면 둘 다 **선** 으로 보인다. 시작이 0이 아니면 화면 끝에 콘텐츠 자국이 남고,
  // 끝이 1이 아니면 페이드가 끝나는 자리에 밝기 단차가 생긴다.
  it('끝점은 정확히 0과 1이다', () => {
    expect(FADE_MASK_LOCATIONS[0]).toBe(0)
    expect(FADE_MASK_LOCATIONS[FADE_MASK_LOCATIONS.length - 1]).toBe(1)
    expect(FADE_MASK_ALPHAS[0]).toBe(0)
    expect(FADE_MASK_ALPHAS[FADE_MASK_ALPHAS.length - 1]).toBe(1)
  })

  it('단조 증가한다', () => {
    const 증가량 = FADE_MASK_ALPHAS.slice(1).map((alpha, i) => alpha - FADE_MASK_ALPHAS[i])

    expect(증가량.every((step) => step > 0)).toBe(true)
  })

  it('(3t²−2t³)² 의 값이다', () => {
    expect(FADE_MASK_ALPHAS).toEqual(FADE_MASK_LOCATIONS.map((t) => smoothstep(t) ** 2))
  })

  // 효과를 더 강하게 가 이 한 숫자다. 구간 한가운데에서 콘텐츠가 4분의 1만 남는다(제곱 전에는
  // 절반이었다).
  it('구간 한가운데 알파가 0.25 다. 옛 곡선의 절반', () => {
    const 한가운데 = FADE_MASK_ALPHAS[(FADE_MASK_ALPHAS.length - 1) / 2]

    expect(한가운데).toBeCloseTo(0.25, 10)
    expect(한가운데).toBeCloseTo(smoothstep(0.5) ** 2, 10)
  })

  // 정지점은 취향이 아니라 곡선에 딸린 값이다. 곡선을 더 가파르게 바꾸면서 개수를 그대로 두면
  // 그라디언트가 곡선을 못 따라가고(구간 선형 근사) 그 오차가 눈에는 띠로 보인다. 다섯 →
  // 아홉으로 늘린 이유가 이것이라 그 관계를 숫자로 못 박는다.
  it('정지점이 곡선을 2% 안으로 따라간다. 곡선을 세게 하면 개수도 함께 늘려야 한다', () => {
    const 참값 = (t: number): number => smoothstep(t) ** 2
    const 근사 = (t: number): number => {
      const i = FADE_MASK_LOCATIONS.findIndex((stop, index) => index > 0 && t <= stop)
      if (i <= 0) return FADE_MASK_ALPHAS[i === 0 ? 0 : FADE_MASK_ALPHAS.length - 1]
      const width = FADE_MASK_LOCATIONS[i] - FADE_MASK_LOCATIONS[i - 1]
      const f = (t - FADE_MASK_LOCATIONS[i - 1]) / width
      return FADE_MASK_ALPHAS[i - 1] + (FADE_MASK_ALPHAS[i] - FADE_MASK_ALPHAS[i - 1]) * f
    }

    let 최대오차 = 0
    for (let k = 0; k <= 1000; k += 1) {
      const t = k / 1000
      최대오차 = Math.max(최대오차, Math.abs(근사(t) - 참값(t)))
    }

    expect(최대오차).toBeLessThan(0.025)
  })

  // 이 성질이 곡선을 고른 이유다. 양 끝의 기울기가 0에 가까워 **페이드가 시작·끝나는 선** 이 안
  // 보인다. 선형이면 모든 구간의 증가량이 같아 이 단언이 깨진다.
  it('양 끝 구간이 가운데 구간보다 완만하다. 선형이 아니다', () => {
    const 증가량 = FADE_MASK_ALPHAS.slice(1).map((alpha, i) => alpha - FADE_MASK_ALPHAS[i])
    const 가운데 = 증가량[Math.floor(증가량.length / 2)]

    expect(증가량[0]).toBeLessThan(가운데)
    expect(증가량[증가량.length - 1]).toBeLessThan(가운데)
  })
})

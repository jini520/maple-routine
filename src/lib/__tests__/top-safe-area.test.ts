// 상단 안전영역의 **하한**.
//
// 이 값이 순수 함수라서 여기서 전부 볼 수 있다(`bottom-inset.test.ts`·`bottom-bar-metrics.test.ts`
// 와 같은 자리). **컴포넌트 테스트로는 이 결정을 못 지킨다**. jest-expo 는 iOS 로 돌고, iOS 는
// 하한을 아예 보지 않기 때문에 렌더 트리에서는 이 정정이 한 픽셀도 안 보인다.

import { resolveTopSafeAreaPx } from '../safe-area'
import { resolveScreenLayout } from '../screen-layout'

/** 안드로이드 실기기 값. 상태바 94px @ density 3.0 (1080×2640). */
const 안드로이드_인셋 = 94 / 3

/** iPhone 계열(`render-atom.tsx` 의 테스트 안전영역과 같은 값). */
const iOS_인셋 = 59

describe('안드로이드 상단 안전영역에는 하한이 있다', () => {
  // 이 정정을 낳은 관측. 실기기에서 **여백이 부족** 했고, 그 자리의 인셋이 31.3 이었다.
  it('안드로이드에서 인셋이 하한보다 얇으면 하한을 쓴다 (31.3 → 48)', () => {
    expect(resolveTopSafeAreaPx({ insetTopPx: 안드로이드_인셋, platform: 'android' })).toBe(48)
  })

  // **`Math.max` 이지 `+` 가 아니다.** 상수를 더하면 컷아웃이 큰 기기에서 제목이 화면 한참
  // 아래에서 시작하고, 그것은 이 없앤 상태보다 나쁘다.
  it('안드로이드라도 인셋이 하한보다 두꺼우면 그대로다. 더하는 것이 아니라 바닥이다', () => {
    for (const insetTopPx of [48, 59, 72]) {
      expect(resolveTopSafeAreaPx({ insetTopPx, platform: 'android' })).toBe(insetTopPx)
    }
  })

  // 실기기 보고의 나머지 절반이 iOS 는 괜찮다 였다. iOS 에서는 그대로 옳았으므로 그쪽은
  // 건드리지 않는다. 플랫폼으로 가르지 값의 크기로 가르지 않는다.
  it('iOS 는 인셋 그대로다. 하한을 보지 않는다', () => {
    expect(resolveTopSafeAreaPx({ insetTopPx: iOS_인셋, platform: 'ios' })).toBe(iOS_인셋)
    // 하한보다 얇은 iOS 기기(옛 SE 계열)도 마찬가지다. 값이 작아서 하한을 타는 것이 아니다.
    expect(resolveTopSafeAreaPx({ insetTopPx: 20, platform: 'ios' })).toBe(20)
  })
})

// 아이폰 듀오 외부 화면은 위쪽 안전영역이 0 이라 그대로 두면 헤더가 화면 위 끝에 붙는다.
describe('오른쪽 레일 화면은 위쪽 안전영역에 위아래 여백을 더한다', () => {
  const 듀오_외부 = resolveScreenLayout({ platform: 'ios', windowWidthPx: 466, windowHeightPx: 678, insetRightPx: 84 })
  const 바형_폰 = resolveScreenLayout({ platform: 'ios', windowWidthPx: 402, windowHeightPx: 874, insetRightPx: 0 })

  it('side-rail 이면 인셋 0 에 24 를 더한다', () => {
    expect(resolveTopSafeAreaPx({ insetTopPx: 0, platform: 'ios', edgeGapPx: 듀오_외부.edgeGapPx })).toBe(24)
  })

  it('phone 이면 지금 값 그대로다', () => {
    expect(resolveTopSafeAreaPx({ insetTopPx: iOS_인셋, platform: 'ios', edgeGapPx: 바형_폰.edgeGapPx })).toBe(iOS_인셋)
    expect(resolveTopSafeAreaPx({ insetTopPx: 안드로이드_인셋, platform: 'android', edgeGapPx: 바형_폰.edgeGapPx })).toBe(48)
  })

  // 안드로이드 하한은 인셋의 바닥이고, 여백은 그 위에 더하는 몫이다.
  it('안드로이드에서는 하한을 먼저 깔고 그 위에 더한다', () => {
    expect(resolveTopSafeAreaPx({ insetTopPx: 0, platform: 'android', edgeGapPx: 24 })).toBe(48 + 24)
  })
})

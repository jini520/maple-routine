// 하단 안전영역의 **하한**.
//
// `top-safe-area.test.ts` 와 **같은 자리에 같은 이유로** 있다: 값이 순수 함수라 여기서 전부 볼 수
// 있고, **컴포넌트 테스트로는 이 결정을 못 지킨다**. jest-expo 는 iOS 로 돌고 iOS 인셋(34)이 곧
// 하한이라 렌더 트리에서는 이 정정이 한 픽셀도 안 보인다.

import { ANDROID_BOTTOM_SAFE_AREA_MIN_PX, resolveBottomSafeAreaPx } from '../safe-area'

/** 안드로이드 실기기 값. `navigationBars` 45px @ density 3.0, 제스처 내비. */
const 안드로이드_제스처 = 45 / 3

/** 같은 계열의 3버튼 내비. 하한 위라 이 정정이 안 닿는 쪽. */
const 안드로이드_3버튼 = 48

/** iOS 홈 인디케이터(`render-atom.tsx` 의 테스트 안전영역과 같은 값). */
const iOS_인셋 = 34

describe('안드로이드 하단 안전영역에는 하한이 있다', () => {
  // 값 자체가 결정이라 못 박는다. **iOS 인셋과 같은 수라는 것이 이 값의 전부다**. `안드로이드를
  // 더 띄우는 값`이 아니라 `iOS 와 같아지는 값`이라, iOS 가 정확히 하한에 앉는다.
  it('하한은 34 이고, 그것은 iOS 홈 인디케이터와 같은 값이다', () => {
    expect(ANDROID_BOTTOM_SAFE_AREA_MIN_PX).toBe(34)
    expect(ANDROID_BOTTOM_SAFE_AREA_MIN_PX).toBe(iOS_인셋)
  })

  // 이 정정을 낳은 관측. 상단과 **같은 비율**로 얇았다(31.3 대 59 / 15 대 34).
  it('안드로이드 제스처 내비는 하한을 쓴다 (15 → 34)', () => {
    expect(resolveBottomSafeAreaPx({ insetBottomPx: 안드로이드_제스처, platform: 'android' })).toBe(
      34,
    )
  })

  // **`Math.max` 이지 `+` 가 아니다.** 상수를 더하면 3버튼 기기에서 캡슐이 화면 한참 위에 뜬다.
  it('안드로이드라도 인셋이 하한보다 두꺼우면 그대로다. 더하는 것이 아니라 바닥이다', () => {
    for (const insetBottomPx of [34, 안드로이드_3버튼, 60]) {
      expect(resolveBottomSafeAreaPx({ insetBottomPx, platform: 'android' })).toBe(insetBottomPx)
    }
  })

  // 실기기 보고의 나머지 절반이 *"iOS 는 괜찮다"* 였다. 하한이 iOS 인셋과 같은 값이라 그쪽은
  // **회귀가 구조적으로 불가능**하지만, 그것을 **값이 같아서** 가 아니라 **플랫폼으로** 지킨다.
  // 인셋이 하한보다 얇은 iOS 기기가 나와도 하한을 타면 안 된다.
  it('iOS 는 인셋 그대로다. 하한을 보지 않는다', () => {
    expect(resolveBottomSafeAreaPx({ insetBottomPx: iOS_인셋, platform: 'ios' })).toBe(iOS_인셋)
    expect(resolveBottomSafeAreaPx({ insetBottomPx: 21, platform: 'ios' })).toBe(21)
  })

  it('그 밖의 플랫폼도 인셋 그대로다', () => {
    for (const platform of ['web', 'macos', 'windows']) {
      expect(resolveBottomSafeAreaPx({ insetBottomPx: 0, platform })).toBe(0)
    }
  })

  // 안전영역이 0인 기기(안드로이드 태블릿·에뮬레이터)에서도 캡슐은 하한만큼 뜬다.
  it('인셋이 0이어도 안드로이드는 하한만큼 갖는다', () => {
    expect(resolveBottomSafeAreaPx({ insetBottomPx: 0, platform: 'android' })).toBe(34)
    expect(resolveBottomSafeAreaPx({ insetBottomPx: 0, platform: 'ios' })).toBe(0)
  })

  // 하위 페이지의 두 조각이 이 차이를 나눠 갖는다(`bottom-inset.ts`). 그 뺄셈이 음수가 되지
  // 않는다는 것이 그쪽 계약의 전제다. 하한은 **인셋 아래로 내려가지 않는다.**
  it('결과는 인셋보다 작아지지 않는다. 하위 페이지의 뺄셈이 이 성질에 기댄다', () => {
    for (const platform of ['ios', 'android']) {
      for (const insetBottomPx of [0, 안드로이드_제스처, 34, 안드로이드_3버튼]) {
        expect(
          resolveBottomSafeAreaPx({ insetBottomPx, platform }),
        ).toBeGreaterThanOrEqual(insetBottomPx)
      }
    }
  })
})

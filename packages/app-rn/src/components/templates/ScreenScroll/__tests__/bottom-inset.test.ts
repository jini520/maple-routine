// 하단 인셋의 두 조각([[ADR-120]] 결정 16·19). 컴포넌트에서 떼어낸 이유는 둘이다 — 판정이 플랫폼에
// 걸려 있어 렌더로 검사하려면 `Platform.OS` 를 조작해야 하고(그러면 무엇을 지키는 테스트인지가
// 흐려진다), 무엇보다 **RN 이 웹뷰만큼 못 가르는 자리**라 그 대가가 이름을 갖고 드러나야 한다.

import { resolveScreenBottomInset } from '../bottom-inset'

const 홈인디케이터 = 34
const 안드로이드_3버튼 = 48

describe('탭바가 있으면 둘 다 0 이다', () => {
  // 웹은 `--tab-bar-h` 를 실측해 스크롤포트를 줄였다([[ADR-099]] 결정 7 — `4rem` 가정과 실제 높이가
  // 어긋나 띠가 생겼다). RN 에서는 탭 내비게이터가 **이미 탭바를 뺀 상자**를 화면에 주므로 잴 것도,
  // 어긋날 것도 없다. 여기서 값을 더하면 그만큼 두 번 빼는 셈이다.
  it.each([홈인디케이터, 안드로이드_3버튼])('바닥 인셋 %ipx 를 무시한다', (bottomInsetPx) => {
    for (const platform of ['ios', 'android']) {
      expect(resolveScreenBottomInset({ hasTabBar: true, bottomInsetPx, platform })).toEqual({
        portBottomPx: 0,
        contentBottomPx: 0,
      })
    }
  })
})

describe('탭바가 없으면(하위 페이지) 플랫폼이 가른다', () => {
  // [[ADR-120]] 결정 16 — 홈 인디케이터는 **지나가도 된다**. 콘텐츠 여백으로 넣어야 스크롤 가능한
  // 높이가 그만큼 늘어 "끝에 여백"이 되고, 스크롤포트를 줄이면 그냥 화면이 작아진다.
  it('iOS 는 전부 통과시킨다 — 콘텐츠 끝 여백', () => {
    expect(
      resolveScreenBottomInset({
        hasTabBar: false,
        bottomInsetPx: 홈인디케이터,
        platform: 'ios',
      }),
    ).toEqual({ portBottomPx: 0, contentBottomPx: 홈인디케이터 })
  })

  // [[ADR-120]] 결정 19 — 3버튼 내비 뒤로 콘텐츠가 지나가면 안 된다. 웹뷰는 `tappableElement` 인셋으로
  // 3버튼과 제스처를 갈랐지만 `react-native-safe-area-context` 는 그 구분을 주지 않는다. 높이로
  // 어림잡는 것은 그 결정이 명시적으로 금지했으므로(*"높이로 어림잡지 않는다"*) **보수적인 쪽**으로
  // 고정한다. 대가는 제스처 내비 기기에서 지나가도 될 자리를 안 쓰는 것이다.
  it('안드로이드는 전부 막는다 — 3버튼인지 제스처인지 모르므로 보수적으로', () => {
    expect(
      resolveScreenBottomInset({
        hasTabBar: false,
        bottomInsetPx: 안드로이드_3버튼,
        platform: 'android',
      }),
    ).toEqual({ portBottomPx: 안드로이드_3버튼, contentBottomPx: 0 })
  })

  // 두 조각 중 **하나만** 쓴다는 것이 이 함수의 계약이다. 둘 다 채우면 같은 인셋을 두 번 비운다.
  it.each(['ios', 'android'])('%s — 두 조각의 합이 바닥 인셋과 같다', (platform) => {
    const inset = resolveScreenBottomInset({
      hasTabBar: false,
      bottomInsetPx: 홈인디케이터,
      platform,
    })

    expect(inset.portBottomPx + inset.contentBottomPx).toBe(홈인디케이터)
  })
})

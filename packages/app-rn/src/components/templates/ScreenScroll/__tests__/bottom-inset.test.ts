// 하단 인셋의 두 조각([[ADR-120]] 결정 16·19). 컴포넌트에서 떼어낸 이유는 둘이다 — 판정이 플랫폼에
// 걸려 있어 렌더로 검사하려면 `Platform.OS` 를 조작해야 하고(그러면 무엇을 지키는 테스트인지가
// 흐려진다), 무엇보다 **RN 이 웹뷰만큼 못 가르는 자리**라 그 대가가 이름을 갖고 드러나야 한다.

import { resolveScreenBottomInset } from '../bottom-inset'

const 홈인디케이터 = 34
const 안드로이드_3버튼 = 48
/**
 * 바의 몫은 이제 **인자**다 ([[ADR-132]] 정정 30 — 기기 폭에 따라 64~81 이다). 여기서는 기준
 * 기기(402pt)의 값을 쓴다 — 그 값이 어디서 나오는지는 `lib/__tests__/bottom-bar-metrics.test.ts` 가
 * 지키고, 이 파일이 물을 것은 «받은 몫을 어느 조각에 넣는가» 하나다.
 */
const 바_몫 = 72

describe('떠 있는 바가 있으면 «콘텐츠 끝»에 그 몫을 남긴다 ([[ADR-132]] 결정 11)', () => {
  // **[[ADR-132]] 로 뜻이 바뀐 자리다.** 옛 탭바는 화면 상자 «밖»이라 둘 다 0 이면 됐지만(탭
  // 내비게이터가 탭바를 뺀 상자를 줬다), 새 바는 화면 «위»에 떠 있어 콘텐츠가 그 아래로 지나간다.
  // 스크롤포트를 줄이면 떠 있는 의미가 사라지므로(그냥 화면이 작아진다) 여백은 콘텐츠 쪽이다 —
  // 결정 16 이 홈 인디케이터에 대해 세운 «지나가도 되는 여백» 과 같은 형태다.
  it.each([홈인디케이터, 안드로이드_3버튼])('바닥 인셋 %ipx + 바의 몫을 콘텐츠 끝에 남긴다', (bottomInsetPx) => {
    for (const platform of ['ios', 'android']) {
      expect(
        resolveScreenBottomInset({ hasTabBar: true, bottomInsetPx, barSpacePx: 바_몫, platform }),
      ).toEqual({
        portBottomPx: 0,
        contentBottomPx: bottomInsetPx + 바_몫,
      })
    }
  })

  // **예전에는 이 자리에 `FLOATING_BAR_SPACE_PX === 72` 가 있었다** — 상수 두 벌(여기와
  // `BottomBar.tsx`)이 같은 값이라는 약속을 테스트가 대신 지켰다. 정정 30 으로 몫이 기기마다
  // 달라지면서 그 약속은 **구조**가 됐다(둘 다 `resolveBottomBarMetrics` 를 본다). 그래서 여기서
  // 물을 것은 값이 아니라 «받은 값이 그대로 흐르는가» 다 — 상수를 숨겨 두면 바만 커진다.
  it('바의 몫은 상수가 아니라 받은 값이다 ([[ADR-132]] 정정 30)', () => {
    for (const barSpacePx of [64, 72, 81]) {
      expect(
        resolveScreenBottomInset({
          hasTabBar: true,
          bottomInsetPx: 홈인디케이터,
          barSpacePx,
          platform: 'ios',
        }).contentBottomPx,
      ).toBe(홈인디케이터 + barSpacePx)
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
        barSpacePx: 바_몫,
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
        barSpacePx: 바_몫,
        platform: 'android',
      }),
    ).toEqual({ portBottomPx: 안드로이드_3버튼, contentBottomPx: 0 })
  })

  // 두 조각 중 **하나만** 쓴다는 것이 이 함수의 계약이다. 둘 다 채우면 같은 인셋을 두 번 비운다.
  it.each(['ios', 'android'])('%s — 두 조각의 합이 바닥 인셋과 같다', (platform) => {
    const inset = resolveScreenBottomInset({
      hasTabBar: false,
      bottomInsetPx: 홈인디케이터,
      barSpacePx: 바_몫,
      platform,
    })

    // 바가 없으면 그 몫은 **한 조각에도 안 들어간다** — 하위 페이지에는 바가 없으므로
    // ([[ADR-120]] 결정 4) 비켜 줄 것도 없다.
    expect(inset.portBottomPx + inset.contentBottomPx).toBe(홈인디케이터)
  })
})

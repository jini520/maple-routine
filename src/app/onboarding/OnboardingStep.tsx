/**
 * 온보딩 단계 하나가 놓이는 자리. 웹 `OnboardingScreen` 의 컨테이너 `<div>` 세 모양을 하나로 합친 것.
 *
 * `center` 가 곧 웹의 `items-center justify-center` 이고(전체 대기 두 자리), 아닌 자리는 `pt-8 pb-4`
 * 로 위에서부터 그린다. 두 모양 모두 `flexGrow: 1` 을 갖는 이유는 아래 ②.
 *
 * **화면이 아니라 이 파일에 있다**. 캐릭터 선택 단계가 자기 CTA 를 고정 바로
 * 넘기려면(아래) 그 단계 자신이 이 셸을 둘러야 하고, 셸이 `OnboardingScreen.tsx` 안에 있으면 화면과
 * 단계가 서로를 import 하는 **순환**이 된다.
 *
 * ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
 *
 * ① **컨테이너가 `<div>` 가 아니라 `ScrollView` 다.** 웹은 문서 스크롤을 썼고(이전의
 *    전제) RN 에는 문서가 없다. `ScreenScroll` 을 쓰지 않는 이유는 그 셸이 **탭 화면 + `PageHeader`**
 *    를 위한 것이라서다. 온보딩은 헤더가 없고 탭바도 없으며, 무엇보다 아래 ②의 `flexGrow` 를
 *    요구한다(그 셸에는 없는 축이다). 웹에서도 온보딩만 공용 셸 밖에 있었다.
 * ② **`min-h-[calc(100dvh-…)]` → 콘텐츠 컨테이너의 `flexGrow: 1`.** 웹이 그 min-height 로 노린 것은
 *    "남는 세로 공간을 만들어 자동 여백·`justify-center` 가 작동하게" 하는 것이었고, RN 스크롤에서
 *    같은 뜻을 내는 것이 `flexGrow` 다. 그 공간을 쓰는 자리는 `seedingTracking` 의 `justify-center` 다.
 * ③ **상단 안전영역을 이 셸이 먹는다.** 웹에서는 `TabLayer` 루트의 `pt-[var(--sa-top)]` 가 앱 전체에
 *    깔려 온보딩도 그 값을 받았는데, RN 에는 그 공통 래퍼가 없다(탭 화면은 `PageHeader` 가,
 *    헤더 없는 화면은 `ScreenScroll` 이 각자 먹는다). **콘텐츠 패딩이 아니라 상자의 마진**이어야
 *  한다. 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려진다.
 * ④ **인디케이터 색을 알려 준다**. 웹은 `:root` 의 `color-scheme` 가 문서
 *    스크롤바까지 칠했지만, RN 은 `ScrollView` 마다 프롭으로 줘야 하고 기본값(`'default'`)은 테마가
 *    아니라 OS 설정을 따라간다. 그것이 웹에서 겪은 실패다.
 *
 * ── 고정 액션 바. `footer` 를 준 단계에만 (사용자 지정 2026-08-18) ──────
 *
 * 설정 하위 페이지(`SettingsCharactersScreen`)의 `저장` 바와 **같은 것 한 벌**이다: 스크롤 뷰의
 * **형제**이자 절대 배치라 굴러가지 않고, 콘텐츠가 그 아래를 지나가므로 불투명해야 하며(색은 카드가
 * 아니라 **페이지 바닥** 이라 `bg-bg`), **안전영역을 이 바가 먹는다.**
 *
 * **바 높이를 상수로 적지 않는다**. `onLayout` 으로 재서 그만큼 콘텐츠 아래를 비운다. 손으로 적으면
 * 글자 크기·안전영역이 다른 기기에서 마지막 행이 바 뒤로 숨는다. 그 잰 값 **안에 안전영역이 이미
 * 들어 있어** 콘텐츠 몫이 **안전영역** 에서 **바 높이** 로 바뀐다(둘을 더하면 목록 끝에 빈 띠가 한 겹
 * 더 남는다).
 */
import { useState } from 'react'
import { Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBottomSafeAreaPx } from '../../lib/safe-area'
import { useScrollIndicatorStyle } from '../../theme/context'

// `props` 를 통째로 받지 않고 **구조 분해**하는 것이 계약이다. `react-hooks/refs` 는 ref 를 품은
// 객체를 렌더 중에 읽는 것을 통째로 막으므로, `props.center` 처럼 다른 필드를 읽는 자리까지 전부
// 걸린다(`ScreenScroll`·`CharacterManageBody` 도 같은 이유로 구조 분해한다).
export function OnboardingStep({
  center,
  scrollRef,
  onScroll,
  footer,
  children,
}: {
  center?: boolean
  /** 끌기 자동 스크롤 배선. 캐릭터 선택 단계에서만 온다. */
  scrollRef?: React.Ref<ScrollView>
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll']
  /** 하단에 고정되는 액션 바의 내용(파일 머리). 안 주면 바 자체가 없다. */
  footer?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  // **위아래가 갈린다.** 상단은 대로 인셋 그대로다. 단계에 제목 줄이 없어 그
  // `marginTop` 은 헤더 여백이 아니라 콘텐츠 여백이라 축이 다르다. 하단은 반대로 **탭바 없는 화면의
  // 규칙**(아래) 그 자체라, 하한이 깔린 값을 본다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const indicatorStyle = useScrollIndicatorStyle()
  // 고정 바가 덮는 높이. 잰 값이 오기 전에는 0이라 마지막 행이 한 프레임 가려질 수 있지만, 그
  // 프레임은 바가 그려지는 바로 그 프레임이라 사용자가 스크롤을 시작하기 전이다.
  const [actionBarHeightPx, setActionBarHeightPx] = useState(0)

  const scroller = (
    <ScrollView
      testID="onboarding-scroll"
      ref={scrollRef}
      indicatorStyle={indicatorStyle}
      className="flex-1"
      // 파일 머리 ③. 마진이지 패딩이 아니다. 하단은 홈 인디케이터 자리라 콘텐츠 여백으로 남긴다
      // (탭바가 없는 화면의 규칙. `ScreenScroll` 의 `bottom-inset.ts` 와 같은 갈래다).
      style={{ marginTop: insets.top }}
      contentContainerClassName={
        center === true ? 'items-center justify-center px-4' : 'px-4 pt-8 pb-4'
      }
      contentContainerStyle={{
        flexGrow: 1,
        // 바가 있으면 그 바가 안전영역을 먹는다(파일 머리). 비울 것은 잰 바 높이 하나다.
        paddingBottom: footer === undefined ? bottomSafeAreaPx : actionBarHeightPx,
      }}
      // 키보드가 떠 있는 동안에도 첫 탭이 버튼에 닿는다. 없으면 그 탭이 키보드를 내리는 데만 쓰인다
      // (`ApiKeyForm` 의 확인 버튼이 그 자리다). 웹에서는 없던 문제라 짝이 없는 프롭이다.
      keyboardShouldPersistTaps="handled"
      // iOS 는 키보드가 떠도 스크롤 뷰 크기가 그대로라 확인 버튼이 가려질 수 있다(안드로이드는 창이
      // `adjustResize` 로 줄어 저절로 해결된다). 그 인셋을 OS 가 넣게 한다. 안드로이드에서는 no-op.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      // 조건부 전개다. 안 쓰는 단계의 스크롤 뷰 프롭을 한 개도 바꾸지 않는다(`ScreenScroll` 과
      // 같은 처리: `onScroll={undefined}` 로 넘기면 iOS 가 기본 주기로 이벤트를 흘린다).
      {...(onScroll === undefined ? null : { onScroll, scrollEventThrottle: 16 })}
    >
      {children}
    </ScrollView>
  )

  // 바가 없는 단계는 상자를 하나도 더 두르지 않는다. 그 단계들의 렌더 트리는 정정 2 전과 같다.
  if (footer === undefined) return scroller

  return (
    <View className="flex-1">
      {scroller}
      <View
        testID="onboarding-action-bar"
        className="absolute inset-x-0 bottom-0 border-t border-border bg-bg px-4 pt-3"
        style={{ paddingBottom: bottomSafeAreaPx + 12 }}
        onLayout={(event) => setActionBarHeightPx(event.nativeEvent.layout.height)}
      >
        {footer}
      </View>
    </View>
  )
}

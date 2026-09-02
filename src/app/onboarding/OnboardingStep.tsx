/**
 * 온보딩 단계 하나가 놓이는 셸. 스크롤 뷰 · 안전영역 · 인디케이터 색과 고정 액션 바를 갖는다.
 *
 * **화면이 아니라 이 파일에 있다.** 캐릭터 선택 단계가 자기 CTA 를 고정 바로 넘기려면 그 단계 자신이
 * 이 셸을 둘러야 하는데, 셸이 화면 파일 안에 있으면 화면과 단계가 서로를 import 하는 순환이 된다.
 *
 * 고정 액션 바는 `footer` 를 준 단계에만 선다. 설정 하위 페이지의 저장 바와 같은 것 한 벌이다.
 * 스크롤 뷰의 형제이자 절대 배치라 안 굴러가고, 콘텐츠가 그 아래를 지나가므로 불투명하다.
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

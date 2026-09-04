/**
 * 앱을 열기 전 화면(로그인 · 캐릭터 설정)이 놓이는 셸. 스크롤 뷰 · 안전영역 · 인디케이터 색과
 * 고정 액션 바를 갖는다.
 *
 * **탭바 없는 화면의 `ScreenScroll`** 이다. 저쪽은 탭바 아래 사는 화면들의 것이라 하단 규칙이
 * 다르다.
 *
 * 화면 파일 옆이 아니라 여기 있는 것은 쓰는 화면 둘이 서로 다른 `app/` 디렉터리에 살아서다.
 *
 * 고정 액션 바는 `footer` 를 준 화면에만 선다. 설정 하위 페이지의 저장 바와 같은 것 한 벌이다.
 * 스크롤 뷰의 형제이자 절대 배치라 안 굴러가고, 콘텐츠가 그 아래를 지나가므로 불투명하다.
 */
import { useState } from 'react'
import { Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBottomSafeAreaPx } from '../../../lib/safe-area'
import { useScrollIndicatorStyle } from '../../../theme/context'

// `props` 를 통째로 받지 않고 **구조 분해**하는 것이 계약이다. `react-hooks/refs` 는 ref 를 품은
// 객체를 렌더 중에 읽는 것을 통째로 막으므로, `props.center` 처럼 다른 필드를 읽는 자리까지 전부
// 걸린다(`ScreenScroll`·`CharacterManageBody` 도 같은 이유로 구조 분해한다).
export function EntryScroll({
  center,
  scrollRef,
  tracksScrollOffset = false,
  footer,
  children,
}: {
  center?: boolean
  /** 끌기 자동 스크롤이 굴릴 스크롤 뷰. 캐릭터 설정 화면에서만 온다. */
  scrollRef?: React.Ref<ScrollView>
  /**
   * 스크롤 이벤트를 매 프레임 흘릴 것인가. 위 `scrollRef` 의 짝이고 `ScreenScroll` 과 같은 규칙이다.
   * ⚠️ 안 켜면 iOS 는 스크롤이 멈출 때 한 번만 보내서 끌기 중 오프셋이 낡는다.
   */
  tracksScrollOffset?: boolean
  /** 하단에 고정되는 액션 바의 내용. 안 주면 바 자체가 없다. */
  footer?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  // **위아래가 갈린다.** 상단은 대로 인셋 그대로다. 화면에 제목 줄이 없어 그
  // `marginTop` 은 헤더 여백이 아니라 콘텐츠 여백이라 축이 다르다. 하단은 반대로 **탭바 없는 화면의
  // 규칙**(아래) 그 자체라, 하한이 깔린 값을 본다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const indicatorStyle = useScrollIndicatorStyle()
  // 고정 바가 덮는 높이. 잰 값이 오기 전에는 0이라 마지막 행이 한 프레임 가려질 수 있지만, 그
  // 프레임은 바가 그려지는 바로 그 프레임이라 사용자가 스크롤을 시작하기 전이다.
  const [actionBarHeightPx, setActionBarHeightPx] = useState(0)

  const scroller = (
    <ScrollView
      testID="entry-scroll"
      ref={scrollRef}
      indicatorStyle={indicatorStyle}
      className="flex-1"
      // 마진이지 패딩이 아니다. 하단은 홈 인디케이터 자리라 콘텐츠 여백으로 남긴다. 탭바가
      // 없는 화면의 규칙이고 `ScreenScroll` 의 `bottom-inset.ts` 와 같은 갈래다.
      style={{ marginTop: insets.top }}
      contentContainerClassName={
        center === true ? 'items-center justify-center px-4' : 'px-4 pt-8 pb-4'
      }
      contentContainerStyle={{
        flexGrow: 1,
        // 바가 있으면 그 바가 안전영역을 먹는다. 비울 것은 잰 바 높이 하나다.
        paddingBottom: footer === undefined ? bottomSafeAreaPx : actionBarHeightPx,
      }}
      // 키보드가 떠 있는 동안에도 첫 탭이 버튼에 닿는다. 없으면 그 탭이 키보드를 내리는 데만 쓰인다
      // (`ApiKeyForm` 의 확인 버튼이 그 자리다).
      keyboardShouldPersistTaps="handled"
      // iOS 는 키보드가 떠도 스크롤 뷰 크기가 그대로라 확인 버튼이 가려질 수 있다(안드로이드는 창이
      // `adjustResize` 로 줄어 저절로 해결된다). 그 인셋을 OS 가 넣게 한다. 안드로이드에서는 no-op.
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      // 조건부 전개다. 안 켠 화면의 스크롤 뷰 프롭을 한 개도 바꾸지 않는다.
      {...(tracksScrollOffset ? { scrollEventThrottle: 16 } : null)}
    >
      {children}
    </ScrollView>
  )

  // 바가 없는 화면은 상자를 하나도 더 두르지 않는다.
  if (footer === undefined) return scroller

  return (
    <View className="flex-1">
      {scroller}
      <View
        testID="entry-action-bar"
        className="absolute inset-x-0 bottom-0 border-t border-border bg-bg px-4 pt-3"
        style={{ paddingBottom: bottomSafeAreaPx + 12 }}
        onLayout={(event) => setActionBarHeightPx(event.nativeEvent.layout.height)}
      >
        {footer}
      </View>
    </View>
  )
}

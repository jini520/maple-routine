// **이 라이브러리는 패치해서 쓴다**(`patches/` + 루트 `postinstall`).
// 안드로이드 구현은 마스크를 `getChildAt(0)` 으로 찾는데, 하위 페이지에서 **뒤로가기**를 하면
// React 가 서브트리를 언마운트해 자식이 `mChildren` 에서 빠지고 `getChildAt(0)` 이 **null** 이
// 된다. 화면은 아직 밀려 나가는 중이라 Android 는 그 자식들을 **disappearing child** 로 계속
// 그린다. `INVISIBLE` 플래그도 무시하고. 마스크를 못 알아보니 아래 불투명 판이 평범한 그림으로
// 깔려 **전환 내내 화면이 검었다**(실기기 2026-08-15. 판 색을 `#f00` 으로 바꾸면 화면이 빨개지는
// 것으로 확정). 패치는 마스크를 **참조로** 기억하고 `drawChild` 에서 막는다.
import MaskedView from '@react-native-masked-view/masked-view'
import { cloneElement } from 'react'
import type { ScrollView as ScrollViewType } from 'react-native'
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { resolveBottomBarMetrics } from '../../../lib/bottom-bar-metrics'
import { useBottomSafeAreaPx, useTopSafeAreaPx } from '../../../lib/safe-area'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { useScrollIndicatorStyle } from '../../../theme/context'
import { resolveScreenBottomInset } from './bottom-inset'
import { resolvePullIndicatorOffset } from './pull-indicator-offset'
import {
  FADE_MASK_LOCATIONS,
  FADE_MASK_OPAQUE,
  fadeMaskColors,
  resolveSafeAreaFade,
} from './safe-area-fade'

// 화면 스크롤 셸. **스크롤의 소유자는 문서가 아니라 화면이다.**
//
// ══ 그 결정이 RN 에서는 기본값이다 ═══════════════════════════════════════════════════
//
//  는 네 탭이 문서 스크롤 하나를 공유하던 것을 뒤집는 결정이었다(그 공유가
//  이동 프레임의 원인 ①이었다. 오프셋이 화면을 넘어 살아남는다). RN 에는 문서가 없고
// 스크롤 상태는 `ScrollView` 라는 뷰에 붙으므로 **화면과 함께 태어나고 함께 죽는다**. 계승할
// 오프셋이 존재하지 않는다. 그 ADR 이 손으로 만든 상태가 여기서는 공짜다.
//
// 대신 **그 결정에 딸려 있던 것들**은 공짜가 아니다. 가 실기기에서 배운 것은 하나로
// 요약된다. *"문서 스크롤에만 브라우저가 공짜로 해주던 처리를 컨테이너에서는 우리가 명시해야
// 한다."* RN 에서도 같은 목록을 다시 지나가고, 셋 중 둘만 우리 몫이다.
//
// | | 웹에서 한 일 | RN |
// |---|---|---|
// | 결정 5 인디케이터 색 | `color-scheme` + `scrollbar-color` | **우리 몫**. `indicatorStyle`(아래) |
// | 결정 6 상단 인셋 | 상자를 내리고 콘텐츠를 음수 마진으로 되돌림 | **헤더가 먹는다**(아래) |
// | 결정 7 탭바 실측(`--tab-bar-h`) | `BottomTabBar` 가 재서 CSS 변수로 | **구조**. 탭 내비게이터가 이미 뺀 상자를 준다 |
//
// ── 상단: 헤더가 있으면 이 셸은 위를 건드리지 않는다 ────────────────────────────────
//
// 웹은 스크롤포트를 `top-[var(--sa-top)]` 으로 내리고 안쪽 래퍼의 `-mt` 로 같은 양을 되돌렸다.
// 그 음수 마진은 **`fixed` 헤더의 spacer 가 그만큼을 흡수해 주기 때문에** 성립하는 트릭이었다.
// RN 에서 헤더는 스크롤 뷰의 **첫 자식**이라 자기 안전영역 패딩으로 노치를 직접
// 먹는다. 되돌릴 것이 없으니 트릭도 없다. 다만 **스크롤포트 자체는 화면 맨 위에서 시작한다**
// (`marginTop: 0`): 노치를 비우는 것이 상자가 아니라 헤더의 패딩이라, 굴리면 그 패딩이 함께
// 올라가 **콘텐츠가 상태바 밑으로 지나간다**(**남는 문제**. 고정을 없앤 대가다).
// 그 **남는 문제** 의 처방이 아래 **안전영역 페이드**다. 지나가는 것을 막지 않고,
// 지나가는 자리에서 **투명해지게** 한다.
//
// 헤더가 없는 화면(설정 계열)에서는 이 셸이 상자를 그만큼 내린다. **콘텐츠 패딩이 아니라 상자**여야
// 한다. 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려지므로, 패딩으로 밀면 글자는
// 내려가도 인디케이터는 노치까지 올라간다(이 실기기에서 잡은 그 회귀다).
//
// ── 하단: 두 조각으로 갈린다 ────────────────────────────────────────────────────────
//
// `hasTabBar` 와 플랫폼에 따라 갈리고, 그 판정은 `bottom-inset.ts` 가 갖는다(RN 이 3버튼과 제스처
// 내비를 구분하지 못해 생긴 대가도 거기 적혀 있다).
//
// ── 안전영역 페이드. **덮지 않고 깎는다** ────────────────────────────
//
// 위아래 모두 콘텐츠가 크롬과 겹치는데(상태바 밑 · 홈 인디케이터 자리) 지금까지는 그 자리에서 **딱
// 끊겼다.** 겹치는 만큼을 마스크로 깎아 알파를 0으로 보낸다. 배경색을 덮는 스크림이 아니다. 덮으면
// 벽지 테마에서 **정지 상태에도 띠**가 보여 이 걷어낸 상태로 돌아간다.
//
// 이 셸이 그 자리인 이유: 마스크 상자는 **스크롤포트를 담는 상자**여야 하고, 위(헤더 유무)와
// 아래(`bottom-inset.ts`)의 갈림을 이미 여기서 알고 있다. 값과 곡선은 `safe-area-fade.ts` 가 갖는다.
//
// ── 옮기지 않은 것 둘 ───────────────────────────────────────────────────────────────
//
// ① **`overscroll-behavior-y: none`.** 그 선언은 두 가지를 했는데 RN 에서는 둘 다 해당이 없다.
//  스크롤 체이닝은 문서가 없어 일어날 수 없고, 러버밴드는 이 실기기에서
//    *"모멘텀·러버밴드가 문서 스크롤과 동등한가"* 로 확인한 **원하는 동작**이다. `bounces={false}`
//    를 걸면 그것을 우리가 없애는 셈이 된다.
// ② **배경색.** 웹과 같은 이유로 칠하지 않는다. 불투명 배경은 테마 배경 이미지를
//    가린다(그 ADR 이 앱 루트에서 `bg-bg` 를 빼야 했던 것과 같은 자리).
//
// ── 당겨서 새로고침은 `RefreshControl` 이다 ────────────────────────────
//
// step 6 이 *"화면이 붙는 단계에서 고른다"* 로 남겨 둔 갈래를 step 4 가 닫았다. 결정적 근거는
// 갈래표에 없던 사실 하나다. **안드로이드에는 당김 거리 신호 자체가 없다**(iOS 는 `bounces` 로
// `contentOffset.y` 가 음수가 되지만 안드로이드 `ScrollView` 는 콘텐츠를 안 움직이고 글로우만
// 그린다). 커스텀 마크를 고르면 그 플랫폼에서는 제스처 계층을 처음부터 새로 만들어야 한다.
//
// 그래서 이 셸은 `refreshControl` 을 그대로 `ScrollView` 에 넘긴다. 커스텀 당김 마크를 폐기한
// 기록이 이다.
//
// **손대는 것은 한 프롭뿐이다. `progressViewOffset`**. 인디케이터가 바로 위
// 안전영역 페이드에 **함께 깎이기** 때문이고(두 플랫폼 다 마스크 **안** 이다. iOS 는 스크롤 뷰의
// 서브뷰, 안드로이드는 `ScrollView` 를 감싸는 `AndroidSwipeRefreshLayout`), 그 높이를 아는 것이
// 화면이 아니라 이 셸이라 여기서 얹는다(화면에 시키면 화면이 셸의 마스크를 알아야 한다).
// **값은 플랫폼마다 다르다**. 안드로이드 원은 기본으로 이미 24dp 내려와 멈추기 때문이고, 그
// 계산은 `pull-indicator-offset.ts` 가 갖는다(정정 1).
//
// ── 리스트 성능은 여기서 앞당기지 않는다 ────────────────────────────────────────────
//
// `FlashList` 로 갈 화면이 있을 수 있지만 **어느 화면이 무거운지는 화면이 붙어야 안다.** 지금
// 바꾸면 근거 없는 복잡도만 남는다.

export interface ScreenScrollProps {
  children: React.ReactNode
  /**
   * 스크롤 내용의 **맨 앞**에 놓이는 헤더. 보통 `PageHeader` 다.
   *
   * **자리를 정하던 프롭이 **누가 안전영역을 먹는가** 를 알리는 프롭이 됐다**.
   * 예전에는 헤더가 스크롤 뷰의 **형제**여야 했고(RN 에 `fixed` 가 없어, *"스크롤과 무관하게 화면
   * 위에 있다"* 를 표현하는 방법이 그것뿐이었다) 둘을 나란히 놓는 일을 셸이 대신했다. 이제는 그냥
   * 첫 자식이라 화면이 `<ScreenScroll><PageHeader/>…</ScreenScroll>` 로 써도 **같은 그림이 나온다.**
   *
   * 그래도 프롭을 남기는 이유는 하나다. **상단 안전영역을 누가 먹는지가 갈린다.** 헤더를 주면
   * 헤더가 자기 `paddingTop` 으로 먹고(굴리면 함께 올라간다), 안 주면 이 셸이 상자를 그만큼 내려
   * 먹는다(설정 계열). 자식으로 받으면 셸이 그 갈림을 알 수 없다.
   */
  header?: React.ReactNode
  /**
   * 스크롤 뷰 자체의 ref. 웹에서는 당김 판정이 이 요소의 `scrollTop` 을 읽었고,
   * RN 에서는 **당김 판정에 쓰이지 않는다**(스크롤 컨테이너가 제스처를 소유한다).
   * 프로그램적 스크롤이 필요한 화면(보스 수익의 최상단 이동)이 쓸 자리로 남겨 둔다.
   */
  ref?: React.Ref<ScrollViewType>
  /**
   * 당겨서 새로고침. `<RefreshControl … />` 을 그대로 넘긴다.
   *
   * 셸이 **만들지 않고 받는** 이유는 `refreshing` 이 각 화면 스토어의 상태이고 `onRefresh` 가 그
   * 화면의 재조회이기 때문이다(당김과 헤더 버튼은 같은 재조회를 부른다).
   * 안 주면 당김이 없는 화면이다(설정 계열·하위 페이지).
   */
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl']
  /**
   * 스크롤 오프셋 통보. **끌어서 순서 바꾸기의 자동 스크롤만** 쓴다.
   *
   * 그 화면은 목록이 화면보다 길 때 페이지째 굴려야 하는데(고정 영역이 없다) 굴린
   * 만큼을 끌기 좌표에 되더해야 행이 손가락 밑에 남는다. 즉 필요한 것은 **지금 오프셋**이고, 그것을
   * 아는 길이 이 이벤트뿐이다.
   *
   * **안 주면 프롭 자체를 안 넘긴다**(`scrollEventThrottle` 도 함께). 이 셸은 화면 열여섯 곳이
   * 쓰므로, 안 쓰는 화면까지 매 프레임 이벤트를 보내게 두지 않는다.
   */
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll']
  /**
   * 아래에 탭바가 있는가. 하단 인셋 처리만 가른다(`bottom-inset.ts`).
   *
   * **하위 페이지는 `false` 다.** 스택 위로 올라간 화면에는 탭바가 없다(
   * 탭바는 아래 화면과 한 덩어리로 밀려 나간다).
   */
  hasTabBar?: boolean
}

/** 위는 화면 끝에서 드러나고, 아래는 그 반대다. 색을 만드는 규칙은 `safe-area-fade.ts` 가 갖는다. */
const FADE_IN_COLORS = fadeMaskColors('in')
const FADE_OUT_COLORS = fadeMaskColors('out')

export function ScreenScroll({
  children,
  header,
  ref,
  refreshControl,
  onScroll,
  hasTabBar = true,
}: ScreenScrollProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  // 위아래 **둘 다 인셋이 아니라 하한이 깔린 값**이다.
  // 위는 헤더(`PageHeader`)와 페이드가 같은 값을 봐야 제목 윗변과 페이드 끝선이 한 선에 있고,
  // 아래는 떠 있는 바(`BottomBar`)와 같은 값을 봐야 마지막 카드가 캡슐 뒤로 안 들어간다.
  //
  // 인셋 자체도 여전히 필요하다. 하위 페이지에서 스크롤포트가 비우는 몫은 **내비바가 실제로
  // 차지하는 자리** 라 하한이 아니라 인셋이다(그 갈림은 `bottom-inset.ts` 가 갖는다).
  const topSafeAreaPx = useTopSafeAreaPx()
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const indicatorStyle = useScrollIndicatorStyle()
  // 바가 먹는 세로는 **기기 폭의 함수**다. 바와 여기가 같은 함수를 봐야
  // 콘텐츠가 바 뒤로 들어가거나 바닥에 빈 띠를 남기지 않는다. `100dvh` 짝을 안전영역 프레임에서
  // 받는 자리들과 달리 여기는 **창 폭**이 맞다: 바 자신이 그 폭으로 자리를 잡는다.
  const { width: windowWidthPx } = useWindowDimensions()
  const barSpacePx = resolveBottomBarMetrics(windowWidthPx).spacePx
  const bottom = resolveScreenBottomInset({
    hasTabBar,
    insetBottomPx: insets.bottom,
    bottomSafeAreaPx,
    barSpacePx,
    platform: Platform.OS,
  })
  const fade = resolveSafeAreaFade({
    hasHeader: header !== undefined,
    hasTabBar,
    topSafeAreaPx,
    bottomSafeAreaPx,
    barSpacePx,
    portBottomPx: bottom.portBottomPx,
  })
  const indicatorOffsetPx = resolvePullIndicatorOffset({
    fadeTopPx: fade.topPx,
    platform: Platform.OS,
  })

  // 스크롤포트를 "실제로 보이는 영역"에 맞추는 두 값. **콘텐츠 패딩이 아니라
  // 상자의 마진**이어야 한다. 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려진다.
  const port = {
    marginTop: header === undefined ? topSafeAreaPx : 0,
    marginBottom: bottom.portBottomPx,
  }

  const scroller = (
    <ScrollView
      ref={ref}
      testID="screen-scroll"
      // 우리가 그리지 않는 크롬의 색은 **알려 줘야** 한다. 웹에서 안 걸었을
      // 때 라이트 테마에 흰 인디케이터가 나왔고(실기기 2026-08-06), RN 의 기본값 `'default'` 도
      // 같은 종류의 실패다: 그 값은 OS 설정을 따라가지 우리 테마를 따라가지 않는다.
      indicatorStyle={indicatorStyle}
      // **인디케이터는 아래 마스크 안 에 있다**. iOS 는 스크롤 뷰의
      // 서브뷰이고, 안드로이드는 `ScrollView` 를 감싸는 `AndroidSwipeRefreshLayout` 이라 어느
      // 쪽이든 마스크를 지난다(뷰 트리로 걸리지, 콘텐츠가 당겨지는지로 걸리지 않는다). 상단 페이드
      // 구간은 알파가 0에서 시작하므로 그대로 두면 당김 자리에 열리는 것이 **인디케이터** 가 아니라
      // **빈 띠** 다. 얼마나 내릴지는 플랫폼마다 다르고(정정 1) 그 계산은 옆 파일이 갖는다.
      refreshControl={
        refreshControl === undefined || indicatorOffsetPx === 0
          ? refreshControl
          : cloneElement(refreshControl, { progressViewOffset: indicatorOffsetPx })
      }
      // 조건부 전개다. `onScroll={undefined}` 로 넘기면 iOS 가 기본 주기(스크롤이 멈출 때 1회)로
      // 이벤트를 켜고, 안 쓰는 화면의 렌더 트리에도 프롭이 남는다.
      {...(onScroll === undefined ? null : { onScroll, scrollEventThrottle: 16 })}
      className="flex-1"
      style={port}
      // 웹 안쪽 래퍼의 `space-y-4` 짝. RN 에 `space-y-*` 가 없어 `gap-*` 이고, 그래서 래퍼 뷰가
      // 따로 필요 없다. 콘텐츠 컨테이너가 그 역할을 겸한다.
      contentContainerClassName="gap-4"
      contentContainerStyle={{ paddingBottom: bottom.contentBottomPx }}
    >
      {/* **헤더가 스크롤 뷰 안에 있다**(후속). 첫 자식이라 목록과 함께 흘러
          올라간다. 예전에는 스크롤 뷰의 **형제**라 영원히 화면에 붙어 있었는데, 정책이
          **최상단 헤더만 고정** 에서 **고정을 푼다** 로 다시 바뀌었다(사용자 판정 2026-08-13.
          *"지금 페이지에 고정된 영역을 풀라는 거야. 스크롤 가능하도록"*).

          안전영역은 여전히 헤더가 먹는다(자기 `paddingTop`). 스크롤 0 에서 노치를 비우고,
          굴리면 그 패딩째 올라간다. */}
      {header}
      {children}
    </ScrollView>
  )

  // 겹치는 것이 없으면 마스크를 아예 걸지 않는다. 마스킹은 오프스크린 합성이라
  // 공짜가 아니고, 이 조건이 곧 **페이드가 보이는 화면** 이다.
  if (fade.topPx === 0 && fade.bottomPx === 0) return <View className="flex-1">{scroller}</View>

  return (
    // 마스크 상자가 **스크롤포트를 담는 상자**다. 페이드 구간은 화면 끝을 기준으로 잡히는데
    // (안전영역이 그렇게 정의된다) 스크롤포트가 그보다 안쪽에서 끝나는 경우는 `resolveSafeAreaFade`
    // 가 이미 0으로 만들어 두므로, 둘을 맞추려고 좌표를 옮길 일이 없다.
    <MaskedView
      testID="screen-fade"
      style={{ flex: 1 }}
      maskElement={
        <View className="flex-1">
          {fade.topPx > 0 && (
            <LinearGradient
              testID="screen-fade-top"
              colors={FADE_IN_COLORS}
              locations={FADE_MASK_LOCATIONS}
              // 방향을 기본값에 기대지 않는다. 뒤집히면 화면 끝이 불투명해지고 목록 한가운데가
              // 사라진다(그림이 조용히 정반대가 된다).
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ height: fade.topPx }}
            />
          )}
          <View className="flex-1" style={{ backgroundColor: FADE_MASK_OPAQUE }} />
          {fade.bottomPx > 0 && (
            <LinearGradient
              testID="screen-fade-bottom"
              colors={FADE_OUT_COLORS}
              locations={FADE_MASK_LOCATIONS}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ height: fade.bottomPx }}
            />
          )}
        </View>
      }
    >
      {scroller}
    </MaskedView>
  )
}

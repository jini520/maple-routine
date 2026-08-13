import type { ScrollView as ScrollViewType } from 'react-native'
import { Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useScrollIndicatorStyle } from '../../../theme/context'
import { resolveScreenBottomInset } from './bottom-inset'

// 화면 스크롤 셸([[ADR-099]]) — **스크롤의 소유자는 문서가 아니라 화면이다.**
//
// ══ 그 결정이 RN 에서는 기본값이다 ═══════════════════════════════════════════════════
//
// [[ADR-099]] 는 네 탭이 문서 스크롤 하나를 공유하던 것을 뒤집는 결정이었다(그 공유가
// [[ADR-098]] 이동 프레임의 원인 ①이었다 — 오프셋이 화면을 넘어 살아남는다). RN 에는 문서가 없고
// 스크롤 상태는 `ScrollView` 라는 뷰에 붙으므로 **화면과 함께 태어나고 함께 죽는다** — 계승할
// 오프셋이 존재하지 않는다. 그 ADR 이 손으로 만든 상태가 여기서는 공짜다.
//
// 대신 **그 결정에 딸려 있던 것들**은 공짜가 아니다. [[ADR-099]] 가 실기기에서 배운 것은 하나로
// 요약된다 — *"문서 스크롤에만 브라우저가 공짜로 해주던 처리를 컨테이너에서는 우리가 명시해야
// 한다."* RN 에서도 같은 목록을 다시 지나가고, 셋 중 둘만 우리 몫이다.
//
// | [[ADR-099]] | 웹에서 한 일 | RN |
// |---|---|---|
// | 결정 5 인디케이터 색 | `color-scheme` + `scrollbar-color` | **우리 몫** — `indicatorStyle`(아래) |
// | 결정 6 상단 인셋 | 상자를 내리고 콘텐츠를 음수 마진으로 되돌림 | **헤더가 먹는다**(아래) |
// | 결정 7 탭바 실측(`--tab-bar-h`) | `BottomTabBar` 가 재서 CSS 변수로 | **구조** — 탭 내비게이터가 이미 뺀 상자를 준다 |
//
// ── 상단: 헤더가 있으면 이 셸은 위를 건드리지 않는다 ────────────────────────────────
//
// 웹은 스크롤포트를 `top-[var(--sa-top)]` 으로 내리고 안쪽 래퍼의 `-mt` 로 같은 양을 되돌렸다.
// 그 음수 마진은 **`fixed` 헤더의 spacer 가 그만큼을 흡수해 주기 때문에** 성립하는 트릭이었다.
// RN 에서 헤더는 스크롤 뷰의 **첫 자식**이라([[ADR-131]] 후속) 자기 안전영역 패딩으로 노치를
// 직접 먹고, 스크롤포트는 그 아래에서 시작한다 — 되돌릴 것이 없으니 트릭도 없다.
//
// 헤더가 없는 화면(설정 계열)에서는 이 셸이 상자를 그만큼 내린다. **콘텐츠 패딩이 아니라 상자**여야
// 한다 — 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려지므로, 패딩으로 밀면 글자는
// 내려가도 인디케이터는 노치까지 올라간다([[ADR-099]] 결정 6 이 실기기에서 잡은 그 회귀다).
//
// ── 하단: 두 조각으로 갈린다 ────────────────────────────────────────────────────────
//
// `hasTabBar` 와 플랫폼에 따라 갈리고, 그 판정은 `bottom-inset.ts` 가 갖는다(RN 이 3버튼과 제스처
// 내비를 구분하지 못해 생긴 대가도 거기 적혀 있다).
//
// ── 옮기지 않은 것 둘 ───────────────────────────────────────────────────────────────
//
// ① **`overscroll-behavior-y: none`.** 그 선언은 두 가지를 했는데 RN 에서는 둘 다 해당이 없다 —
//    스크롤 체이닝은 문서가 없어 일어날 수 없고, 러버밴드는 [[ADR-099]] 결정 3 이 실기기에서
//    *"모멘텀·러버밴드가 문서 스크롤과 동등한가"* 로 확인한 **원하는 동작**이다. `bounces={false}`
//    를 걸면 그것을 우리가 없애는 셈이 된다.
// ② **배경색.** 웹과 같은 이유로 칠하지 않는다 — 불투명 배경은 [[ADR-088]] 테마 배경 이미지를
//    가린다(그 ADR 이 앱 루트에서 `bg-bg` 를 빼야 했던 것과 같은 자리).
//
// ── 당겨서 새로고침은 `RefreshControl` 이다 ([[ADR-130]]) ────────────────────────────
//
// step 6 이 *"화면이 붙는 단계에서 고른다"* 로 남겨 둔 갈래를 step 4 가 닫았다. 결정적 근거는
// 갈래표에 없던 사실 하나다 — **안드로이드에는 당김 거리 신호 자체가 없다**(iOS 는 `bounces` 로
// `contentOffset.y` 가 음수가 되지만 안드로이드 `ScrollView` 는 콘텐츠를 안 움직이고 글로우만
// 그린다). 커스텀 마크를 고르면 그 플랫폼에서는 제스처 계층을 처음부터 새로 만들어야 한다.
//
// 그래서 이 셸은 `refreshControl` 을 그대로 `ScrollView` 에 넘기기만 한다. [[ADR-074]] 의 마크
// 결정 넷이 폐기되는 자리이고, 그 폐기의 기록이 [[ADR-130]] 이다.
//
// ── 리스트 성능은 여기서 앞당기지 않는다 ────────────────────────────────────────────
//
// `FlashList` 로 갈 화면이 있을 수 있지만 **어느 화면이 무거운지는 화면이 붙어야 안다.** 지금
// 바꾸면 근거 없는 복잡도만 남는다.

export interface ScreenScrollProps {
  children: React.ReactNode
  /**
   * 스크롤 영역 **위**에 그대로 놓이는 헤더 — 보통 `PageHeader` 다.
   *
   * **웹에 없던 프롭이고, 없앨 수 없는 것이다.** 웹에서 헤더는 `position: fixed` 라 DOM 어디에
   * 있든 뷰포트에 붙었고 그래서 화면이 `<ScreenScroll><PageHeader/>…</ScreenScroll>` 로 쓸 수
   * 있었다. RN 에는 `fixed` 가 없어 *"스크롤과 무관하게 화면 위에 있다"* 를 표현하려면 스크롤 뷰의
   * **형제**여야 하고, 그러면 둘을 나란히 놓는 일을 누군가 해야 한다. 화면마다 하면
   * [[ADR-094]] 가 `PageHeader` 로 없앤 복붙이 그 한 겹 위에서 되살아나므로 셸이 맡는다.
   *
   * 준 경우 상단 안전영역은 **헤더가** 먹는다(`PageHeader` 의 `paddingTop`). 안 주면 이 셸이 먹는다.
   */
  header?: React.ReactNode
  /**
   * 스크롤 뷰 자체의 ref. 웹에서는 당김 판정이 이 요소의 `scrollTop` 을 읽었고([[ADR-099]] 결정 2),
   * RN 에서는 **당김 판정에 쓰이지 않는다**([[ADR-130]] 결정 1 — 스크롤 컨테이너가 제스처를 소유한다).
   * 프로그램적 스크롤이 필요한 화면(보스 수익의 [[ADR-080]] 최상단 이동)이 쓸 자리로 남겨 둔다.
   */
  ref?: React.Ref<ScrollViewType>
  /**
   * 당겨서 새로고침 ([[ADR-130]] 결정 1) — `<RefreshControl … />` 을 그대로 넘긴다.
   *
   * 셸이 **만들지 않고 받는** 이유는 `refreshing` 이 각 화면 스토어의 상태이고 `onRefresh` 가 그
   * 화면의 재조회이기 때문이다([[ADR-072]] 결정 2 — 당김과 헤더 버튼은 같은 재조회를 부른다).
   * 안 주면 당김이 없는 화면이다(설정 계열·하위 페이지).
   */
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl']
  /**
   * 아래에 탭바가 있는가 — 하단 인셋 처리만 가른다(`bottom-inset.ts`).
   *
   * **하위 페이지는 `false` 다.** 스택 위로 올라간 화면에는 탭바가 없다([[ADR-120]] 결정 4 —
   * 탭바는 아래 화면과 한 덩어리로 밀려 나간다).
   */
  hasTabBar?: boolean
}

export function ScreenScroll({
  children,
  header,
  ref,
  refreshControl,
  hasTabBar = true,
}: ScreenScrollProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const indicatorStyle = useScrollIndicatorStyle()
  const bottom = resolveScreenBottomInset({
    hasTabBar,
    bottomInsetPx: insets.bottom,
    platform: Platform.OS,
  })

  // 스크롤포트를 "실제로 보이는 영역"에 맞추는 두 값([[ADR-099]] 결정 6). **콘텐츠 패딩이 아니라
  // 상자의 마진**이어야 한다 — 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려진다.
  const port = {
    marginTop: header === undefined ? insets.top : 0,
    marginBottom: bottom.portBottomPx,
  }

  return (
    <View className="flex-1">
      <ScrollView
        ref={ref}
        testID="screen-scroll"
        // [[ADR-099]] 결정 5 — 우리가 그리지 않는 크롬의 색은 **알려 줘야** 한다. 웹에서 안 걸었을
        // 때 라이트 테마에 흰 인디케이터가 나왔고(실기기 2026-08-06), RN 의 기본값 `'default'` 도
        // 같은 종류의 실패다: 그 값은 OS 설정을 따라가지 우리 테마를 따라가지 않는다.
        indicatorStyle={indicatorStyle}
        refreshControl={refreshControl}
        className="flex-1"
        style={port}
        // 웹 안쪽 래퍼의 `space-y-4` 짝. RN 에 `space-y-*` 가 없어 `gap-*` 이고, 그래서 래퍼 뷰가
        // 따로 필요 없다 — 콘텐츠 컨테이너가 그 역할을 겸한다.
        contentContainerClassName="gap-4"
        contentContainerStyle={{ paddingBottom: bottom.contentBottomPx }}
      >
        {/* **헤더가 스크롤 뷰 «안»에 있다**([[ADR-131]] 후속) — 첫 자식이라 목록과 함께 흘러
            올라간다. 예전에는 스크롤 뷰의 **형제**라 영원히 화면에 붙어 있었는데, 정책이
            «최상단 헤더만 고정» 에서 **«고정을 푼다»** 로 다시 바뀌었다(사용자 판정 2026-08-13 —
            *"지금 페이지에 고정된 영역을 풀라는 거야. 스크롤 가능하도록"*).

            안전영역은 여전히 헤더가 먹는다(자기 `paddingTop`) — 스크롤 0 에서 노치를 비우고,
            굴리면 그 패딩째 올라간다. */}
        {header}
        {children}
      </ScrollView>
    </View>
  )
}

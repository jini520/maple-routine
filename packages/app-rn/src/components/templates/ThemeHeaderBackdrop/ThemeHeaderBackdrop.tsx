import { Image, View, useWindowDimensions } from 'react-native'

import { getThemeBackgroundUrl } from '@core/lib/theme-backgrounds'

import { useThemeAppearance } from '../../../theme/context'
import { resolveThemeBackdropLayout } from '../ThemeBackdrop/theme-backdrop-layout'

/**
 * 페이지 상단 헤더가 덮는 자리에 **테마 배경 이미지 조각**을 그린다([[ADR-088]] 결정 5-1).
 *
 * 헤더는 불투명해야 한다 — 반투명하게 열면 배경만이 아니라 **그 밑으로 스크롤된 카드까지** 비친다
 * (사용자 반려). 그래서 헤더를 여는 대신, 헤더가 자기 자리에 해당하는 그림을 직접 그려 백드롭과
 * 이어 붙인다. 정렬은 조각을 **뷰포트 크기**로 그리고 부모가 잘라내는 방식으로 보장한다(`cover` 는
 * 그리는 상자 기준이라 헤더 상자에 주면 배율이 어긋난다).
 *
 * ## 정합은 **같은 기하**로 보장한다 — 크기를 헤더에 맞추면 안 된다
 *
 * 조각은 **뷰포트 크기**로 그리고 부모가 헤더 높이만큼 잘라낸다. `cover` 는 그리는 상자를 기준으로
 * 계산되므로 헤더 상자(예: 390×120)에 주면 배율이 달라져 백드롭과 어긋난다([[ADR-088]] 결정 5-1).
 *
 * 그래서 좌표 계산을 백드롭과 **한 함수에서** 가져온다(`ThemeBackdrop/theme-backdrop-layout.ts`).
 * 값을 두 벌로 두면 한쪽만 고쳐도 이음매가 생기고, 그 이음매는 이 컴포넌트가 존재하는 이유다.
 *
 * 헤더는 화면 최상단 요소라 좌상단이 백드롭의 좌상단과 같은 점이다 — RN 에서는 헤더가 스크롤 뷰의
 * **형제**라 스크롤과 무관하게 늘 거기 있다(웹은 `sticky`/`fixed` 로 그것을 만들어야 했다).
 *
 * ## 순서만으로 충분하다 — `z-index: -1` 이 필요 없다
 *
 * 웹은 조각을 헤더 **자신의 배경 위, 콘텐츠 아래**에 두려고 `z-index: -1` 을 썼다. RN 에서는 형제
 * 순서가 곧 그리는 순서라, 헤더의 **첫 자식**으로 두면 같은 결과가 나온다(웹 주석의 *"형제보다 먼저
 * 놓는다"* 가 여기서는 관례가 아니라 메커니즘이다).
 */
export function ThemeHeaderBackdrop(): React.JSX.Element | null {
  const { definition } = useThemeAppearance()
  const viewport = useWindowDimensions()

  const background = definition.background
  // 배경을 선언하지 않은 테마 — 웹과 같은 이유로 아무것도 그리지 않는다(뷰가 늘지 않는다).
  if (background === undefined) return null

  const source = getThemeBackgroundUrl(background.image)
  if (source === null) return null

  const resolved = Image.resolveAssetSource(source)
  const layout = resolveThemeBackdropLayout(
    viewport,
    resolved === null || resolved === undefined
      ? null
      : { width: resolved.width, height: resolved.height },
    background.position,
  )
  if (layout === null) return null

  return (
    <View
      testID="theme-header-backdrop"
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
    >
      <Image
        source={source}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', ...layout }}
      />
      <View
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${background.dim})` }}
      />
    </View>
  )
}

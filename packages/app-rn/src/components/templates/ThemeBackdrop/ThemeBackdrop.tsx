// 테마 배경 벽지 — 화면 전체에 깔리는 한 장([[ADR-088]] 결정 4).
//
// 웹은 `position: fixed` 요소 한 장을 앱 루트 첫 자식으로 두고 `z-index: -1` 을 줬다. 그 결정이
// `background-attachment: fixed` 를 피한 이유(iOS WKWebView 에서 불안정 — 이 저장소가 [[ADR-077]]·
// [[ADR-079]]·[[ADR-085]] 로 이미 겪은 계열)는 RN 에 없지만, **한 장으로 깐다**는 형태는 그대로다.
//
// ## RN 에서 갈린 것
//
// - **`z-index: -1` 이 필요 없다.** 형제 순서가 곧 그리는 순서라 셸의 **첫 자식**이면 뒤에 깔린다.
//   웹이 음수 z-index 를 쓰느라 겪은 함정(*"루트의 `bg-bg` 를 빼야 이미지가 보인다"* — 결정 4 의
//   실측)도 함께 사라진다. 부모가 스태킹 컨텍스트인지 따질 일이 없다.
// - **`background-size/position` 이 없다.** `cover` + 위치를 좌표로 계산한다
//   (`theme-backdrop-layout.ts`) — 그 계산을 **헤더 조각과 공유**하는 것이 이음매를 없애는 조건이다
//   (결정 5-1).
// - **`dim` 은 그림 위에 덮는 검정 한 겹**이다. 웹과 같은 값·같은 자리.
import { Image, View, useWindowDimensions } from 'react-native'

import { getThemeBackgroundUrl } from '@core/lib/theme-backgrounds'

import { useThemeAppearance } from '../../../theme/context'
import { resolveThemeBackdropLayout } from './theme-backdrop-layout'

/**
 * 배경을 선언한 테마에서만 그린다. 나머지는 `null` — 웹에서 `--theme-bg-image` 가 없으면 백드롭이
 * 아무것도 안 그리던 것과 같다(뷰가 늘지 않는다).
 */
export function ThemeBackdrop(): React.JSX.Element | null {
  const { definition } = useThemeAppearance()
  const viewport = useWindowDimensions()

  const background = definition.background
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
    <View testID="theme-backdrop" pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <Image
        testID="theme-backdrop-image"
        source={source}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', ...layout }}
      />
      {/* 그림 위 검정 한 겹 — 글자가 읽히게 한다([[ADR-088]] 결정 3 의 `dim`). */}
      <View
        testID="theme-backdrop-dim"
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${background.dim})` }}
      />
    </View>
  )
}

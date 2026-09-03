/**
 * 테마 배경 벽지. 화면 전체에 깔리는 한 장.
 *
 * 벽지 한 장을 앱 루트 첫 자식으로 둔다.
 *
 * - `z-index: -1` 이 필요 없다. 형제 순서가 곧 그리는 순서라 셸의 첫 자식이면 뒤에 깔린다.
 *   부모가 스태킹 컨텍스트인지 따질 일이 없다.
 * - `background-size/position` 이 없다. `cover` + 위치를 좌표로 계산한다
 *   (`theme-backdrop-layout.ts`). 그 계산을 헤더 조각과 공유하는 것이 이음매를 없애는 조건이다.
 * - `dim` 은 그림 위에 덮는 검정 한 겹이다.
 */
import { Image, View, useWindowDimensions } from 'react-native'

import { getThemeBackgroundUrl } from '../../../lib/assets/asset-lookup'

import { useThemeAppearance } from '../../../theme/context'
import { resolveThemeBackdropLayout } from './theme-backdrop-layout'

/** `#RRGGBB` + 알파 → `#RRGGBBAA`. 이 파일에서만 쓰므로 여기 둔다. */
function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${value}`
}

/**
 * 배경을 선언한 테마에서만 그린다. 나머지는 `null` 이라 백드롭이
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
    // **어두운 바탕을 먼저 깐다**. 그림은 `cover` 지만 **알파를 크게 쓴다**
    // (투명 50% / 36% 가 하늘을 비워 두게 한 결과다). 그 뚫린 자리 뒤에는
    // 지금까지 아무 색도 없었다. 배경 있는 테마에서는 내비게이션 테마가 화면을 `transparent` 로
    // 두기 때문이다(`navigation-theme.ts`). 그래서 **어둡게** 를 `dim` 혼자 지고 있었고, 올릴수록
    // 그림이 회색으로 죽었다.
    //
    // 바탕이 있으면 `dim` 은 **검게 덮는 양** 이 아니라 **그림을 바탕 쪽으로 당기는 양** 이 된다.
    <View
      testID="theme-backdrop"
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: definition.bg }}
    >
      <Image
        testID="theme-backdrop-image"
        source={source}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', ...layout }}
      />
      {/* 덮는 색도 **검정이 아니라 테마의 바탕색**이다. 검정으로 덮으면 어느 테마든 같은 회색으로
          수렴하지만, 자기 바탕색으로 덮으면 그 테마의 색조가 남는다. */}
      <View
        testID="theme-backdrop-dim"
        className="absolute inset-0"
        style={{ backgroundColor: withAlpha(definition.bg, background.dim) }}
      />
    </View>
  )
}

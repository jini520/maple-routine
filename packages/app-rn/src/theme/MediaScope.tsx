import type { ReactNode } from 'react'
import { vars } from 'nativewind'
import { View } from 'react-native'

import { useThemeAppearance } from './context'
import { buildMediaScopeVariables } from './theme-vars'

/**
 * 일러스트 카드 스코프 — 웹 `.media-scope` 클래스의 짝([[ADR-064]] 결정 5).
 *
 * 카드 안은 바탕이 `surface` 가 아니라 `mediaSurface` 라서 표면·텍스트·완료 배지 기준이 바뀐다.
 * **같은 이름을 서브트리에서 다시 선언**하면 그 안쪽만 새 기준을 쓰는데(웹의 커스텀 프로퍼티 상속과
 * 같은 성질, `vars()` 도 렌더 트리를 따라 상속된다) 그 재선언을 이 컴포넌트가 소유한다.
 *
 * 덕분에 카드 안 컴포넌트는 앱 전역과 **똑같은 레시피**(`bg-primary-tint text-primary-ink`)를 쓰면서
 * 자동으로 어두운 기준을 따른다 — 웹에서 얻던 이득이 그대로다.
 *
 * 카드 자신의 스타일은 `className` 으로 받는다. 웹에서 `.media-scope` 가 카드 루트에 **함께** 붙던
 * 것과 같은 모양이라, 감싸는 View 가 하나 더 늘지 않는다.
 */
export function MediaScope(props: { children: ReactNode; className?: string }): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <View className={props.className} style={vars(buildMediaScopeVariables(definition))}>
      {props.children}
    </View>
  )
}

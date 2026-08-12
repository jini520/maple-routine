import { Text, View } from 'react-native'

import type { RootStackParamList, TabParamList } from './routes'

/**
 * **자리표시자다. 화면이 아니다.**
 *
 * `app/` 15개 화면의 재작성은 4단계이고, 그 단계는 파일마다 걸린 ADR 계약 체크리스트를 소진하며
 * 진행해야 한다(`docs/migration/README.md` 원칙 2). 여기서 화면 비슷한 것을 그려 두면 그 규율이
 * 시작도 전에 무너진다 — 이미 그려진 것을 보면 체크리스트를 다시 읽지 않게 된다.
 *
 * 그래서 이 컴포넌트가 하는 일은 **자기 라우트 이름을 찍는 것** 하나다. 그것만으로 내비게이션
 * 골격이 검사된다: 어느 화면이 떠 있는지, push·pop 이 어디로 갔는지.
 */
export function PlaceholderScreen({
  route,
}: {
  route: { name: keyof RootStackParamList | keyof TabParamList }
}): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center" testID={`screen-${route.name}`}>
      <Text className="text-base text-text">{route.name}</Text>
    </View>
  )
}

/**
 * 기능 안내 상세의 자리표시자 — **두 라우트가 이것 하나를 함께 쓴다**([[ADR-125]] 결정 3).
 *
 * 따로 두는 이유는 파라미터가 있기 때문이다. 그냥 `PlaceholderScreen` 을 두 자리에 꽂으면 "같은
 * 화면인가"가 자동으로 참이 되어(전부 같은 컴포넌트다) 계약을 검사하지 못한다. `guideId` 를 찍으면
 * 두 경로가 **같은 화면에 같은 데이터를 실어 보내는지**를 실제로 물을 수 있다.
 */
export function FeatureGuidePlaceholderScreen({
  route,
}: {
  route: {
    name: 'SettingsFeatureGuide' | 'SettingsReleaseNoteGuide'
    params: { guideId: string; section?: string }
  }
}): React.JSX.Element {
  return (
    <View className="flex-1 items-center justify-center" testID={`screen-${route.name}`}>
      <Text className="text-base text-text" testID="feature-guide-id">
        {route.params.guideId}
      </Text>
      <Text className="text-sm text-text-muted" testID="feature-guide-section">
        {route.params.section ?? ''}
      </Text>
    </View>
  )
}

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

// 기능 안내 상세에는 파라미터를 찍는 전용 자리표시자가 따로 있었다 — **step 3 에서 지웠다.**
// 그 자리를 진짜 화면(`SettingsFeatureGuideScreen`)이 맡았고, 그 화면이 자기 라우트 이름을
// 그대로 찍으므로([[ADR-125]] 결정 3 을 테스트가 물을 수 있는 형태) 대역이 할 일이 남지 않았다.

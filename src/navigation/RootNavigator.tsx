import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useOnboardingStore } from '../features/onboarding/store'

import { DropHistoryScreen } from '../app/boss-profit/DropHistoryScreen'
import { DropPriceScreen } from '../app/boss-profit/DropPriceScreen'
import { ContentManageScreen } from '../app/content-scheduler/ContentManageScreen'
import { OnboardingScreen } from '../app/onboarding/OnboardingScreen'
import { SettingsAboutScreen } from '../app/settings/SettingsAboutScreen'
import { SettingsAccountDataScreen } from '../app/settings/SettingsAccountDataScreen'
import { SettingsCharactersScreen } from '../app/settings/SettingsCharactersScreen'
import { SettingsFeatureGuideListScreen } from '../app/settings/SettingsFeatureGuideListScreen'
import { SettingsFeatureGuideScreen } from '../app/settings/SettingsFeatureGuideScreen'
import { SettingsPrivacyScreen } from '../app/settings/SettingsPrivacyScreen'
import { SettingsReleaseNotesScreen } from '../app/settings/SettingsReleaseNotesScreen'
import { ItemSplitScreen } from '../app/utility/ItemSplitScreen'
import { ScreenBackdrop } from '../components/templates/ThemeBackdrop/ScreenBackdrop'
import { LayerStack } from './LayerStack'
import { PUSH_SCREEN_OPTIONS } from './push-screen-options'
import { STACK_ROUTE_NAMES, type RootStackParamList, type StackRouteName } from './routes'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * 하위 페이지 열둘.
 *
 * 표가 `Partial` 이 아니라 `Record<StackRouteName, …>` 인 것이 계약이다. 열둘을 다 적지 않으면
 * 컴파일이 안 된다. 자리표시자로 조용히 떨어지는 길이 실제로 설정 탭을 통째로 삼킨 적이 있다.
 *
 * 안내 상세 둘이 같은 컴포넌트를 가리키는 것도 계약이다. 기능 설명 목록에서도 개발 노트
 * 항목에서도 같은 상세가 열린다. 사본을 두면 같은 글이 두 벌이 된다.
 */
const STACK_SCREENS = {
  ContentManage: ContentManageScreen,
  DropHistory: DropHistoryScreen,
  DropPrice: DropPriceScreen,
  SettingsFeatureGuideList: SettingsFeatureGuideListScreen,
  SettingsFeatureGuide: SettingsFeatureGuideScreen,
  SettingsReleaseNotes: SettingsReleaseNotesScreen,
  SettingsReleaseNoteGuide: SettingsFeatureGuideScreen,
  SettingsAccountData: SettingsAccountDataScreen,
  SettingsAbout: SettingsAboutScreen,
  SettingsPrivacy: SettingsPrivacyScreen,
  SettingsCharacters: SettingsCharactersScreen,
  UtilityItemSplit: ItemSplitScreen,
} as const satisfies Record<StackRouteName, React.ComponentType>

/**
 * 라우트 이름 → 화면. 자리표시자 폴백이 없다.
 *
 * `Partial` + 폴백은 화면 하나를 빠뜨려도 타입도 테스트도 통과한 채 그 탭만 자리표시자로 뜬다.
 * `Record<StackRouteName, …>` 는 열둘을 다 적지 않으면 컴파일이 안 된다.
 *
 * 반환 타입을 넓게 두는 것은 화면 목록을 데이터에서 돌리기 위한 대가다. `<Stack.Screen>` 의
 * `component` 타입은 그 자리의 `name` 리터럴에 묶이는데 여기서는 이름이 유니온이라 하나로
 * 안 좁혀진다. 열둘을 손으로 적으면 타입은 맞지만 화면 목록이 두 벌이 된다. 진짜 화면이 받는
 * 프롭은 `route`·`navigation` 뿐이고 그것들은 훅으로 읽는다.
 */
function screenFor(name: StackRouteName): React.ComponentType<Record<string, never>> {
  return STACK_SCREENS[name] as React.ComponentType<Record<string, never>>
}

/**
 * 루트 스택. `LayerStack` 하나 + 그 위에 쌓이는 하위 페이지 열둘.
 *
 * 하위 페이지가 `LayerStack` 안이 아니라 위인 것은 밀려나는 덩어리가 `LayerStack` 전체이기 때문이다. 층
 * 스택과 바가 그 안에 함께 살아, 이 스택에 쌓으면 밀려나는 것이 층 화면 + 바가 된다.
 *
 * 층(그룹 행 ↔ 하위 행)은 `LayerStack` 안쪽 스택이 진다. 두 스택이 같은 `animation`·`gestureEnabled`
 * 를 쓰므로 **하위 페이지처럼 열린다** 가 값이 아니라 구조로 성립한다.
 *
 * 온보딩은 리다이렉트가 아니라 화면 목록 자체가 갈린다. 딥링크가 없어 주소로 들어올 경로가
 * 없으므로 라우트마다 문을 잠글 이유가 없다. 미완료면 스택에 온보딩 하나뿐이고 완료되면 탭과
 * 하위 페이지로 통째로 바뀐다. 도달할 화면이 존재하지 않으므로 되돌아갈 히스토리도 없다.
 */
export function RootNavigator(): React.JSX.Element {
  const status = useOnboardingStore((state) => state.status)
  const isCompleted = status === 'completed'

  return (
    <Stack.Navigator
      // 모든 화면이 자기 벽지를 들고 다닌다. 안드로이드에서 화면이 불투명해야 전환 중 두 화면이
      // 서로 비치지 않고, 그러면 벽지를 화면이 들어야 한다. iOS 에서는 이 래퍼가 자식을 그대로
      // 통과시킨다(`ScreenBackdrop`).
      screenLayout={({ children }) => <ScreenBackdrop>{children}</ScreenBackdrop>}
      screenOptions={PUSH_SCREEN_OPTIONS}
    >
      {isCompleted ? (
        <Stack.Group>
          <Stack.Screen name="Main" component={LayerStack} />
          {STACK_ROUTE_NAMES.map((name) => (
            <Stack.Screen key={name} name={name} component={screenFor(name)} />
          ))}
        </Stack.Group>
      ) : (
        // 온보딩 분기 테스트가 쓰는 `screen-Onboarding` testID 는 `OnboardingScreen` 루트가 든다.
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
    </Stack.Navigator>
  )
}

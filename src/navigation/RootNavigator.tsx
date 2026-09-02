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
import { Main } from './Main'
import { PUSH_SCREEN_OPTIONS } from './stack-presentation'
import { STACK_ROUTE_NAMES, type RootStackParamList, type StackRouteName } from './routes'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * 진짜 화면이 들어온 하위 페이지 열둘. **step 8 로 전부 찼고**(4단계) 그 뒤
 * 캐릭터 관리가 하나 늘었다가
 * 보스 관리가 **탭으로 빠져나갔고** 유틸리티의 첫 도구가 들어왔다
 * (도구는 유틸리티 화면 안의 카드가 아니라 하위 페이지다).
 *
 * 표가 `Partial` 이 아니라 **`Record<StackRouteName, …>`** 인 것이 계약이다. 열둘을 다 적지
 * 않으면 컴파일이 안 된다. 자리표시자로 조용히 떨어지는 길을 없앴다(그 길이 `TabNavigator` 에서
 * 실제로 설정 탭을 통째로 삼켰다, 2026-08-13).
 *
 * **안내 상세 둘이 같은 컴포넌트를 가리키는 것이 계약이다**. 기능 설명
 * 목록에서도, 개발 노트 항목에서도 같은 상세가 열린다. 사본을 두면 같은 글이 두 벌이 된다.
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
 * 라우트 이름 → 화면. **자리표시자 폴백이 없다.**
 *
 * 예전에는 `Partial` + 폴백이었다. 그 형태가 `TabNavigator` 에서 실제로 사고를 냈다. `Settings`
 * 를 빠뜨렸는데 **타입도 테스트도 통과한 채 설정 탭만 자리표시자**로 떴고, 기기에서 열어 보고서야
 * 알았다(2026-08-13). 여기도 같은 형태였으므로 같이 고친다: `Record<StackRouteName, …>` 는 열둘을
 * 다 적지 않으면 **컴파일이 안 된다.**
 *
 * 반환 타입을 넓게 두는 것은 화면 목록을 **데이터에서 돌리기 위한 대가**다. `<Stack.Screen>` 의
 * `component` 타입은 그 자리의 `name` 리터럴에 묶이는데 여기서는 이름이 유니온이라 하나로 좁혀지지
 * 않는다. 열둘을 손으로 적으면 타입이 맞지만, 그러면 계획서 §1 과 화면 목록이 다시 두 벌이 된다
 * (`routes.ts` 가 데이터인 이유). 진짜 화면이 받는 프롭은 내비게이터가 주는 `route`·`navigation`
 * 뿐이고 그것들은 훅으로 읽으므로(`use-settings-navigation.ts`) 실제 위험은 없다.
 */
function screenFor(name: StackRouteName): React.ComponentType<Record<string, never>> {
  return STACK_SCREENS[name] as React.ComponentType<Record<string, never>>
}

/**
 * 루트 스택. `Main` 하나 + 그 위에 쌓이는 하위 페이지 열둘.
 *
 * ## 왜 하위 페이지가 `Main` **안**이 아니라 **위**인가
 *
 *  가 정한 것은 *"탭바가 아래 화면과 한 덩어리로 밀려 나간다"* 이고, 그 덩어리가
 * 곧 `Main` 전체다. 층 스택과 바가 그 안에 함께 산다. 하위 페이지를 이 스택에
 * 쌓으면 밀려나는 것이 층 화면 + 바가 되어 그 결정이 **구조로** 성립한다.
 *
 * 층(그룹 행 ↔ 하위 행)은 `Main` **안쪽** 스택이 진다. 두 스택이 같은 `animation`·`gestureEnabled`
 * 를 쓰므로 하위 페이지처럼 열린다 가 값이 아니라 구조로 성립한다(#240).
 * `transform` 이 containing block 을 만든다)도 여기서는 존재하지 않는다: 층을 겹치는 일을 OS 가 한다.
 *
 * 그래서 계획서 표의 *"탭 N 위 push"* 는 **루트 스택 push** 로 읽는다. 실제로 어느 탭에서 열리는지는
 * 그 화면을 미는 버튼이 정하고, 돌아오면 떠날 때 보던 탭이 그대로 있다.
 *
 * ## 온보딩 분기. 리다이렉트가 아니라 **화면 목록 자체가 갈린다**
 *
 * 온보딩 분기를 라우트마다 걸지 않는다.
 * URL 이 있는 세계에서는 사용자가 주소로 아무 데나 들어올 수 있으니 라우트마다 문을 잠가야 했다.
 * RN 에는 그 진입 경로가 없으므로(딥링크 미설정, `routes.ts`) **아예 다른 화면 목록을 그린다**.
 * 온보딩 미완료면 스택에 온보딩 하나뿐이고, 완료되면 탭과 하위 페이지로 통째로 바뀐다.
 *
 * 계약은 그대로다. *"온보딩 미완료면 모든 탭이 온보딩으로 `replace`"* 가 요구하는 두 가지.
 * ① 미완료 상태에서 탭에 도달할 수 없다 ② 되돌아갈 히스토리가 남지 않는다. 를 둘 다,
 * 그리고 더 강하게 만족한다(도달할 화면이 **존재하지 않는다**). react-navigation 이 목록 변화에
 * 맞춰 상태를 스스로 정리하므로 리다이렉트 코드가 필요 없다.
 */
export function RootNavigator(): React.JSX.Element {
  const status = useOnboardingStore((state) => state.status)
  const isCompleted = status === 'completed'

  return (
    <Stack.Navigator
      // 모든 화면이 자기 벽지를 들고 다닌다. 안드로이드에서 화면이
      // 불투명해야 전환 중 두 화면이 서로 비치지 않고, 그러면 벽지를 화면이 들어야 한다.
      // iOS 에서는 이 래퍼가 자식을 그대로 통과시킨다(`ScreenBackdrop`).
      screenLayout={({ children }) => <ScreenBackdrop>{children}</ScreenBackdrop>}
      screenOptions={PUSH_SCREEN_OPTIONS}
    >
      {isCompleted ? (
        <Stack.Group>
          <Stack.Screen name="Main" component={Main} />
          {STACK_ROUTE_NAMES.map((name) => (
            <Stack.Screen key={name} name={name} component={screenFor(name)} />
          ))}
        </Stack.Group>
      ) : (
        // 4단계 첫 화면. 자리표시자를 진짜 화면으로 갈아 끼웠다. 온보딩 분기 테스트가 쓰는
        // `screen-Onboarding` testID 는 `OnboardingScreen` 루트가 그대로 이어받는다.
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
    </Stack.Navigator>
  )
}

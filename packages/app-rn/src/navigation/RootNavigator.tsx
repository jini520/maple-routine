import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useOnboardingStore } from '@core/features/onboarding/store'

import { ContentManageScreen } from '../app/content-scheduler/ContentManageScreen'
import { OnboardingScreen } from '../app/onboarding/OnboardingScreen'
import { SettingsAboutScreen } from '../app/settings/SettingsAboutScreen'
import { SettingsAccountDataScreen } from '../app/settings/SettingsAccountDataScreen'
import { SettingsFeatureGuideListScreen } from '../app/settings/SettingsFeatureGuideListScreen'
import { SettingsFeatureGuideScreen } from '../app/settings/SettingsFeatureGuideScreen'
import { SettingsPrivacyScreen } from '../app/settings/SettingsPrivacyScreen'
import { SettingsReleaseNotesScreen } from '../app/settings/SettingsReleaseNotesScreen'
import { PlaceholderScreen } from './PlaceholderScreen'
import { TabNavigator } from './TabNavigator'
import { STACK_ROUTE_NAMES, type RootStackParamList, type StackRouteName } from './routes'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * 진짜 화면이 들어온 하위 페이지. **여기 없는 이름은 아직 자리표시자다** — 4단계가 step 마다 이
 * 표를 채우고, 비어 있는 자리가 곧 남은 일이다.
 *
 * **안내 상세 둘이 같은 컴포넌트를 가리키는 것이 계약이다**([[ADR-125]] 결정 3) — 기능 설명
 * 목록에서도, 개발 노트 항목에서도 같은 상세가 열린다. 사본을 두면 같은 글이 두 벌이 된다.
 */
const STACK_SCREENS = {
  ContentManage: ContentManageScreen,
  SettingsFeatureGuideList: SettingsFeatureGuideListScreen,
  SettingsFeatureGuide: SettingsFeatureGuideScreen,
  SettingsReleaseNotes: SettingsReleaseNotesScreen,
  SettingsReleaseNoteGuide: SettingsFeatureGuideScreen,
  SettingsAccountData: SettingsAccountDataScreen,
  SettingsAbout: SettingsAboutScreen,
  SettingsPrivacy: SettingsPrivacyScreen,
} as const satisfies Partial<Record<StackRouteName, React.ComponentType>>

/**
 * 라우트 이름 → 화면. 아직 안 옮긴 자리는 자리표시자다.
 *
 * 반환 타입을 넓게 두는 것은 화면 목록을 **데이터에서 돌리기 위한 대가**다. `<Stack.Screen>` 의
 * `component` 타입은 그 자리의 `name` 리터럴에 묶이는데 여기서는 이름이 유니온이라 하나로 좁혀지지
 * 않는다. 열하나를 손으로 적으면 타입이 맞지만, 그러면 계획서 §1 과 화면 목록이 다시 두 벌이 된다
 * (`routes.ts` 가 데이터인 이유). 진짜 화면이 받는 프롭은 내비게이터가 주는 `route`·`navigation`
 * 뿐이고 그것들은 훅으로 읽으므로(`use-settings-navigation.ts`) 실제 위험은 없다.
 */
function screenFor(name: StackRouteName): React.ComponentType<Record<string, never>> {
  const screen: React.ComponentType =
    name in STACK_SCREENS
      ? STACK_SCREENS[name as keyof typeof STACK_SCREENS]
      : (PlaceholderScreen as React.ComponentType)

  return screen as React.ComponentType<Record<string, never>>
}

/**
 * 루트 스택 — 탭 레이어 하나 + 그 위에 쌓이는 하위 페이지 열하나([[ADR-120]] 결정 1·2·4).
 *
 * ## 왜 하위 페이지가 탭 **안**이 아니라 **위**인가
 *
 * [[ADR-120]] 결정 4 가 정한 것은 *"탭바가 아래 화면과 한 덩어리로 밀려 나간다"* 이고, 그 덩어리가
 * 곧 `TabNavigator` 전체다. 하위 페이지를 이 스택에 쌓으면 밀려나는 것이 탭 화면 + 탭바가 되어
 * 그 결정이 **구조로** 성립한다. 웹에서 오버레이를 포털로 탭 레이어 밖에 그려야 했던 이유(결정 3 —
 * `transform` 이 containing block 을 만든다)도 여기서는 존재하지 않는다: 층을 겹치는 일을 OS 가 한다.
 *
 * 그래서 계획서 표의 *"탭 N 위 push"* 는 **루트 스택 push** 로 읽는다 — 실제로 어느 탭에서 열리는지는
 * 그 화면을 미는 버튼이 정하고, 돌아오면 떠날 때 보던 탭이 그대로 있다.
 *
 * ## 온보딩 분기 — 리다이렉트가 아니라 **화면 목록 자체가 갈린다**
 *
 * 웹은 라우트마다 `isCompleted ? <Screen /> : <Navigate to="/onboarding" replace />` 를 걸었다.
 * URL 이 있는 세계에서는 사용자가 주소로 아무 데나 들어올 수 있으니 라우트마다 문을 잠가야 했다.
 * RN 에는 그 진입 경로가 없으므로(딥링크 미설정, `routes.ts`) **아예 다른 화면 목록을 그린다** —
 * 온보딩 미완료면 스택에 온보딩 하나뿐이고, 완료되면 탭과 하위 페이지로 통째로 바뀐다.
 *
 * 계약은 그대로다. *"온보딩 미완료면 모든 탭이 온보딩으로 `replace`"* 가 요구하는 두 가지 —
 * ① 미완료 상태에서 탭에 도달할 수 없다 ② 되돌아갈 히스토리가 남지 않는다 — 를 둘 다,
 * 그리고 더 강하게 만족한다(도달할 화면이 **존재하지 않는다**). react-navigation 이 목록 변화에
 * 맞춰 상태를 스스로 정리하므로 리다이렉트 코드가 필요 없다.
 */
export function RootNavigator(): React.JSX.Element {
  const status = useOnboardingStore((state) => state.status)
  const isCompleted = status === 'completed'

  return (
    <Stack.Navigator
      screenOptions={{
        // 페이지 헤더는 앱이 직접 그린다 — `TabNavigator` 와 같은 이유.
        headerShown: false,

        // [[ADR-120]] 결정 5. iOS 에서는 `default`(UIKit push)로 해석되는데, 그 결정의 값 네 줄
        // (`translateX(100% → 0)` · 아래 화면 `-30%` · 스크림 `0.12` · 왼쪽 그림자)이 애초에 그
        // 전환을 흉내 낸 것이라 원본으로 돌아가는 셈이다. 안드로이드에서는 이 값이 **플랫폼 기본
        // 대신 iOS 식 슬라이드**를 그린다 — 웹뷰 앱이 두 플랫폼에 같은 전환을 그렸으므로
        // (`stack-transition.ts` 는 플랫폼을 묻지 않는다) 여기서 기본값을 택하면 안드로이드 사용자에게
        // 전환 후 앱이 **다르게 보인다**(`docs/migration/README.md` 의 한 문장).
        //
        // 340ms·0.12·-30% 같은 개별 수치는 이제 OS/`react-native-screens` 가 갖고 있어 우리가 못
        // 돌린다. 결정 12 가 요구하는 실기기 프레임 확인은 그래서 **값 확정이 아니라 채택 판정**이 된다.
        animation: 'ios_from_right',

        // [[ADR-120]] 결정 6 — iOS 가장자리 스와이프 백. `gestureResponseDistance` 는 **주지
        // 않는다**: 기본값이 UIKit 의 화면 가장자리 인식기이고, 결정 6 의 28px·35%·0.4px/ms 가
        // 바로 그것을 손으로 흉내 낸 값이었다. 숫자를 다시 얹으면 흉내가 원본을 덮는다.
        // (`fullScreenGestureEnabled` 도 켜지 않는다 — 화면 전체 드래그는 "가장자리 28px" 규정과
        // 다른 동작이다.)
        gestureEnabled: true,
      }}
    >
      {isCompleted ? (
        <Stack.Group>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          {STACK_ROUTE_NAMES.map((name) => (
            <Stack.Screen key={name} name={name} component={screenFor(name)} />
          ))}
        </Stack.Group>
      ) : (
        // 4단계 첫 화면 — 자리표시자를 진짜 화면으로 갈아 끼웠다. 온보딩 분기 테스트가 쓰는
        // `screen-Onboarding` testID 는 `OnboardingScreen` 루트가 그대로 이어받는다.
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
    </Stack.Navigator>
  )
}

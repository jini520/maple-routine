// 설정 하위 페이지 「앱 정보」([[ADR-118]] 결정 2) — 현재 버전·상태·업데이트 확인 + 개인정보 처리방침.
//
// 골격은 새로 만들지 않고 다른 하위 페이지와 같은 것을 쓴다([[ADR-035]] 결정 18): `ScreenScroll` +
// `PageHeader` + 좌측 `ArrowLeft`.
//
// ── RN 으로 옮기며 갈린 것 셋 ────────────────────────────────────────────────────────
//
// ① **`StackScreen` 이 없다.** 웹에서 그 셸이 하던 셋(포털로 탭 레이어 밖에 그리기 · 푸시/팝 전환 ·
//    가장자리 스와이프 백)을 여기서는 루트 스택이 한다([[ADR-120]] 결정 1~6 을 구조로 만족 —
//    `RootNavigator` 의 `animation`·`gestureEnabled`). 남는 것은 화면 내용뿐이다.
// ② **`<Outlet />` 이 사라진다.** 처방침은 이 화면의 자식 라우트가 아니라 루트 스택 위로 push 된다.
//    그래도 **부모-자식 관계는 그대로 산다** — 이 화면이 밀고, 뒤로가면 이 화면으로 돌아온다
//    (이 앱에서 유일한 2단 스택인 것도 그대로다).
// ③ **`ScreenScroll` 이 명시적으로 필요하다.** 웹은 `StackScreen` 이 스크롤 상자를 겸했다.
//    `hasTabBar={false}` 인 이유는 스택 위로 올라간 화면에는 탭바가 없기 때문이다([[ADR-120]] 결정 4).
//
// ══ 「앱 업데이트」의 어느 상태가 지금 도달 불가인가 ═══════════════════════════════════
//
// `AppUpdateSection` 이 문구를 갖는 상태는 **열넷**이고([[ADR-026]]·[[ADR-027]]·[[ADR-126]] 계약),
// 그중 **지금 도달하는 것은 `unsupported` 하나**다. `LiveUpdatePort` 가 던지는 데다 core 의 스토어는
// **값으로 import 하는 것만으로 죽어**(`features/live-update/store.ts` 가 모듈 최상위에서
// `import.meta.env` 를 읽는다 — [[ADR-024]]) 상태를 만들 주체 자체가 없다([[ADR-128]] 결정 7).
//
// | 상태 | 지금 |
// |---|---|
// | `unsupported` | **도달** — 이 화면이 심는 유일한 값 |
// | `idle` `checking` `up-to-date` `check-error` | 미도달 — `check()` 가 없다 |
// | `update-available` `store-required` `confirm-cellular` | 미도달 — 매니페스트 조회가 없다 |
// | `downloading` `ready-to-apply` `download-error` | 미도달 — 다운로드 경로가 없다 |
// | `applying` `apply-error` | 미도달 — 적용 경로가 없다 |
// | `updated` | 미도달 — 「마지막으로 실행된 번들 버전」을 쓰는 주체가 없다([[ADR-126]] 결정 4) |
//
// **문구를 하나도 지우지 않은 것이 요점**이다 — 그 표가 곧 계약이고, OTA 가 붙는 날 배선은
// `state={useLiveUpdateStore()}` 한 줄이다. 여기서 상태를 지우면 그날 다시 정해야 한다.
//
// `currentVersion` 을 `null` 로 넘기는 것도 값을 지어내지 않기 위해서다 — 그러면 그 카드가 웹에도
// 이미 있던 폴백(`fallbackVersion`)을 쓴다. **빌드 시점 `package.json` 버전이지 실행 중인 OTA 번들
// 버전이 아니다**(`SettingsScreen` 과 같은 자리).
// ── 뒤로가기 줄을 다섯 화면이 복붙하는 것도 웹 그대로다 ──────────────────────────────
//
// [[ADR-094]] 결정 2 의 기준("호출부 2곳 이상")만 보면 뽑을 만하지만, 웹이 뽑지 않은 것을 이식하며
// 뽑으면 **경로 변경 diff 에 구조 변경이 섞인다**([[ADR-128]] 결정 4 가 어댑터 시그니처에 대해
// 정한 것과 같은 판단 — *"이왕 하는 김에"* 손대면 이식이 재작성이 된다). 두 앱을 나란히 놓고
// 대조하는 일이 전환 기간 내내 필요하므로(`migration/README.md`) 지금은 같은 모양으로 둔다.
import { Pressable, Text, View } from 'react-native'

import packageJson from '../../../package.json'
import { Card } from '../../components/atoms/Card/Card'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowLeftIcon } from '../../lib/icons'
import {
  AppUpdateSection,
  type AppUpdateSectionActions,
  type AppUpdateSectionState,
} from './AppUpdateSection'
import { SettingsRow } from './SettingsRow'
import { useSettingsNavigation } from './use-settings-navigation'

/** OTA 미연결 상태([[ADR-128]] 결정 7) — 위 표의 유일한 도달 가능 값. */
const OTA_UNAVAILABLE_STATE: AppUpdateSectionState = {
  currentVersion: null,
  status: 'unsupported',
  availableVersion: null,
  downloadProgress: 0,
  channel: 'production',
}

/**
 * `unsupported` 에서는 카드가 확인 버튼을 그리지 않으므로 이 함수는 **불리지 않는다.** 그래도 던지지
 * 않고 조용히 끝내는 이유는, 만약 불린다면 그것은 사용자의 문제가 아니라 우리의 배선 실수이고
 * 그 자리에서 앱을 죽일 일이 아니기 때문이다.
 */
const OTA_UNAVAILABLE_ACTIONS: AppUpdateSectionActions = {
  check: () => Promise.resolve(),
}

export function SettingsAboutScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <View className="flex-row items-center gap-2">
            <Pressable
              role="button"
              aria-label="뒤로"
              onPress={() => navigation.goBack()}
              className="-ml-1 p-1"
            >
              <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
            <Text className="text-lg font-semibold text-text">앱 정보</Text>
          </View>
        </PageHeader>
      }
    >
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 그대로 물려받은 계약이다 — 내비게이션 테스트가
          "그 라우트로 밀면 그 화면이 열리는가"를 이 이름으로 묻는다(step 2 가 `screen-Onboarding`
          에서 같은 판단을 했다). 진짜 화면이 들어와도 그 질문은 그대로 유효하다. */}
      <View className="gap-4 px-4 pb-4" testID="screen-SettingsAbout">
        <AppUpdateSection
          state={OTA_UNAVAILABLE_STATE}
          actions={OTA_UNAVAILABLE_ACTIONS}
          fallbackVersion={packageJson.version}
        />

        {/*
          Play 사용자 데이터 정책은 스토어 등록정보와 앱 안 양쪽에 개인정보 처리방침 링크를
          요구한다 — 콘솔에 URL을 넣는 것만으로는 충족되지 않는다(docs/foundation/release.md).
          다만 요구하는 것은 "앱 안에 링크"이지 "첫 화면에 링크"가 아니라, 설정 고지 문구
          사이에서 이 화면의 행으로 내려왔다([[ADR-118]] 결정 7).

          **앱을 벗어나지 않는다**([[ADR-120]] 결정 11) — 사본을 만드는 것이 아니라 같은 사이트를
          싣을 뿐이라 "법적 문서를 두 벌로 만들지 않는다"는 원칙은 그대로다. 그래서 외부 링크
          행(`SettingsLinkRow`)이 아니라 **하위 페이지로 미는 행**이고, 이 앱에서 유일하게 2단이
          되는 스택이다.
        */}
        <Card className="px-6">
          <SettingsRow
            label="개인정보 처리방침"
            onPress={() => navigation.navigate('SettingsPrivacy')}
          />
        </Card>
      </View>
    </ScreenScroll>
  )
}

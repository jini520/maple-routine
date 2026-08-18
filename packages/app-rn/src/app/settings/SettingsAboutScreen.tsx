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
// ══ 「앱 업데이트」 — 상태 열넷이 전부 도달 가능해졌다 ═══════════════════════════════
//
// 여기 있던 «도달 불가» 표를 지웠다([[ADR-137]]). 그 표는 열넷 중 `unsupported` 하나만 도달한다고
// 적었고 근거는 둘이었다 — `LiveUpdatePort` 가 던진다는 것과, core 스토어를 **값으로 import 하는
// 것만으로 죽는다**는 것(모듈 최상위의 `import.meta.env`). **둘 다 사라졌다**: 포트는
// `rn-live-update.ts` 로 채워졌고, `import.meta.env` 는 채널이 폐기되며 그 줄째 없어졌다
// ([[ADR-137]] 결정 6·7).
//
// 그래서 이 화면은 이제 상태를 **심지 않고** 스토어를 그대로 넘긴다. 표를 남겨 두면 «지금» 을
// 말하는 문서가 거짓이 되므로 지웠지, 그 상태들이 없어진 것이 아니다 — 문구 열넷은
// `AppUpdateSection` 이 그대로 들고 있고 그것이 [[ADR-026]]·[[ADR-027]]·[[ADR-126]] 의 계약이다.
//
// `fallbackVersion` 은 남는다 — 내장 번들로 돌 때(아직 OTA 를 한 번도 안 받았을 때) 어댑터가
// `package.json` 버전을 돌려주므로 값이 겹치지만, 스토어가 아직 `loadCurrentVersion()` 을 끝내기
// 전 첫 렌더에는 `currentVersion` 이 `null` 이다.
//
// ── 뒤로가기 줄을 다섯 화면이 복붙하는 것도 웹 그대로다 ──────────────────────────────
//
// [[ADR-094]] 결정 2 의 기준("호출부 2곳 이상")만 보면 뽑을 만하지만, 웹이 뽑지 않은 것을 이식하며
// 뽑으면 **경로 변경 diff 에 구조 변경이 섞인다**([[ADR-128]] 결정 4 가 어댑터 시그니처에 대해
// 정한 것과 같은 판단 — *"이왕 하는 김에"* 손대면 이식이 재작성이 된다). 두 앱을 나란히 놓고
// 대조하는 일이 전환 기간 내내 필요하므로(`migration/README.md`) 지금은 같은 모양으로 둔다.
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'

import { useLiveUpdateStore } from '@core/features/live-update/store'

import packageJson from '../../../package.json'
import { Card } from '../../components/atoms/Card/Card'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowLeftIcon } from '../../lib/icons'
import { AppUpdateSection } from './AppUpdateSection'
import { SettingsRow } from './SettingsRow'
import { useSettingsNavigation } from './use-settings-navigation'

export function SettingsAboutScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()

  // [[ADR-137]] 이 예고된 그 한 줄을 놓았다 — 상태 열넷이 **전부 도달 가능**해졌고, 위 표의
  // «도달 불가» 열은 이제 사실이 아니다(그 표는 그 파일 머리에서 함께 걷어냈다).
  const liveUpdate = useLiveUpdateStore()
  const { loadCurrentVersion } = liveUpdate

  // 이 화면이 열릴 때 실행 중인 번들 버전을 싣는다. 웹의 `AppUpdateSection` 이 마운트에서 하던
  // 일이고(그 파일 주석 ③), RN 에서는 포트가 던져 지웠던 자리다 — 이제 되살린다.
  useEffect(() => {
    void loadCurrentVersion()
  }, [loadCurrentVersion])

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <Pressable
              role="button"
              aria-label="뒤로"
              onPress={() => navigation.goBack()}
              className="-ml-1 p-1"
            >
              <ArrowLeftIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
            </Pressable>
            <Text className="text-lg font-semibold text-text">앱 정보</Text>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 그대로 물려받은 계약이다 — 내비게이션 테스트가
          "그 라우트로 밀면 그 화면이 열리는가"를 이 이름으로 묻는다(step 2 가 `screen-Onboarding`
          에서 같은 판단을 했다). 진짜 화면이 들어와도 그 질문은 그대로 유효하다. */}
      <View className="gap-4 px-4 pb-4" testID="screen-SettingsAbout">
        <AppUpdateSection
          state={liveUpdate}
          actions={liveUpdate}
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

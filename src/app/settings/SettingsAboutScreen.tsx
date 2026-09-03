/**
 * 설정 하위 페이지 `앱 정보`. 현재 버전·상태·업데이트 확인과 개인정보 처리방침으로 가는 줄.
 *
 * 골격은 다른 하위 페이지와 같다(`ScreenScroll` + `PageHeader` + 좌측 `ArrowLeft`).
 *
 * 상태를 여기서 심지 않고 스토어를 그대로 넘긴다. 문구 열넷은 `AppUpdateSection` 이 들고 있다.
 *
 * `fallbackVersion` 이 남는 것은 스토어가 `loadCurrentVersion()` 을 끝내기 전 첫 렌더에
 * `currentVersion` 이 `null` 이기 때문이다.
 *
 * @see docs/features/live-update.md 업데이트 상태 정책
 */
import { useEffect } from 'react'
import { Pressable, View } from 'react-native'

import { useLiveUpdateStore } from '../../features/live-update/store'

import packageJson from '../../../package.json'
import { ArrowLeftIcon, Card, Text } from '../../components/atoms'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { AppUpdateSection } from './AppUpdateSection'
import { SettingsRow } from './SettingsRow'
import { useSettingsNavigation } from './use-settings-navigation'

export function SettingsAboutScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()

  const liveUpdate = useLiveUpdateStore()
  const { loadCurrentVersion } = liveUpdate

  // 이 화면이 열릴 때 실행 중인 번들 버전을 싣는다.
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
      {/* `screen-<라우트 이름>` 은 자리표시자에게서 그대로 물려받은 계약이다. 내비게이션 테스트가
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
          요구한다. 콘솔에 URL을 넣는 것만으로는 충족되지 않는다(docs/foundation/release.md).
          다만 요구하는 것은 "앱 안에 링크"이지 "첫 화면에 링크"가 아니라, 설정 고지 문구
          사이에서 이 화면의 행으로 내려왔다.

          **앱을 벗어나지 않는다**. 사본을 만드는 것이 아니라 같은 사이트를
          싣을 뿐이라 "법적 문서를 두 벌로 만들지 않는다"는 원칙은 그대로다. 그래서 외부 링크
          행(`SettingsLinkRow`)이 아니라 **하위 페이지로 미는 행**이고, 이 앱에서 스택이 2단이
          되는 자리가 여기뿐이다.
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

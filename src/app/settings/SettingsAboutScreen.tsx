/**
 * 설정 하위 페이지 `앱 정보 및 계정`. 위는 `앱 정보` 묶음(현재 버전·상태·업데이트 확인·개인정보 처리방침),
 * 아래는 `계정` 묶음(넥슨 로그아웃·데이터 삭제·연결 해제).
 *
 * 묶음 제목을 다는 것은 계정 행이 정보 행 아래에 있어서다. 제목이 없으면 끝까지 읽어야 계정 행이 있는 줄 안다.
 *
 * 업데이트 상태를 여기서 심지 않고 스토어를 그대로 넘긴다. 문구 열넷은 `AppUpdateSection` 이 들고 있다.
 * `fallbackVersion` 이 남는 것은 스토어가 `loadCurrentVersion()` 을 끝내기 전 첫 렌더에
 * `currentVersion` 이 `null` 이기 때문이다.
 *
 * **데이터 삭제 범위는 이 파일에 없다.** 화면은 그룹마다 고른 여부를 넘길 뿐이고 어떤 키와 어떤 테이블이
 * 지워지는지는 `storage/cache-data.ts` 가 혼자 정한다.
 *
 * @see docs/features/settings.md 정책
 * @see docs/features/live-update.md 업데이트 상태 정책
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { reloadAppAsync } from 'expo'

import type { CacheDataCounts } from '../../features/settings/cache-data'
import { clearCacheDataAndReload, loadCacheDataCounts } from '../../features/settings/cache-data'
import { useSettingsStore } from '../../features/settings/store'
import { useAuthStore } from '../../features/auth/store'
import { hasNexonLogin } from '../../features/auth/saved-key'
import { useLiveUpdateStore } from '../../features/live-update/store'
import { openInAppBrowser } from '../../native/browser'
import type { CacheDataSelection } from '../../storage/cache-data'

import packageJson from '../../../package.json'
import { Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { AppUpdateSection } from './AppUpdateSection'
import { CacheClearConfirm } from './CacheClearConfirm'
import { DisconnectConfirm } from './DisconnectConfirm'
import { SectionTitle } from './SectionTitle'
import { SignOutConfirm } from './SignOutConfirm'
import { SETTINGS_CARD_CLASS } from './row-class'
import { SettingsRow } from './SettingsRow'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'

/** 개인정보 처리방침 원본. 저장소 루트의 `PRIVACY.md` 를 사이트가 그린 것이다. */
export const PRIVACY_URL = 'https://mapleroutine.store/privacy'

export interface SettingsAboutScreenProps {
  /** 테스트 주입용. 기본은 지금 도는 번들의 재실행. */
  reload?: () => void
}

export function SettingsAboutScreen(props: SettingsAboutScreenProps = {}): React.JSX.Element {
  const navigation = useSettingsNavigation()

  const liveUpdate = useLiveUpdateStore()
  const { loadCurrentVersion } = liveUpdate

  const { disconnect } = useSettingsStore()

  const [isCacheClearOpen, setIsCacheClearOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [counts, setCounts] = useState<CacheDataCounts | null>(null)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  // 로그인이 없으면 뗄 것이 없다. 모르는 동안에도 안 세운다 - 세웠다 지우면 행이 하나 튄다.
  const [showSignOut, setShowSignOut] = useState(false)
  const [isSignOutOpen, setIsSignOutOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const signOutNexonLogin = useAuthStore((state) => state.signOutNexonLogin)

  // 이 화면이 열릴 때 실행 중인 번들 버전을 싣는다.
  useEffect(() => {
    void loadCurrentVersion()
  }, [loadCurrentVersion])

  useEffect(() => {
    loadCacheDataCounts()
      .then(setCounts)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    void hasNexonLogin().then((has) => {
      if (alive) setShowSignOut(has)
    })
    return () => {
      alive = false
    }
  }, [])

  async function handleClear(selection: CacheDataSelection): Promise<void> {
    setIsClearing(true)
    await clearCacheDataAndReload(
      selection,
      props.reload ?? (() => void reloadAppAsync('데이터 삭제')),
    )
  }

  async function handleDisconnectConfirm(): Promise<void> {
    setIsDisconnecting(true)
    await disconnect()
  }

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <Text className="text-lg font-semibold text-text">앱 정보 및 계정</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* `screen-<라우트 이름>` 은 자리표시자에게서 그대로 물려받은 계약이다. 내비게이션 테스트가
            "그 라우트로 밀면 그 화면이 열리는가"를 이 이름으로 묻는다. */}
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsAbout">
          {/* 묶음 안의 카드 사이는 화면의 카드 사이와 같은 간격이고, 제목만 카드에 붙는다. */}
          <View className="gap-2">
            <SectionTitle>앱 정보</SectionTitle>
            <View className="gap-4">
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

                **앱을 벗어나지 않는다**. 사본을 두지 않고 사이트 원본을 인앱 브라우저로 열 뿐이라
                "법적 문서를 두 벌로 만들지 않는다"는 원칙은 그대로다. 창을 닫으면 이 화면으로 돌아오므로
                외부 링크 행(`SettingsLinkRow`)이 아니라 chevron 행이다.
              */}
              <Card className={SETTINGS_CARD_CLASS}>
                <SettingsRow label="개인정보 처리방침" onPress={() => openInAppBrowser(PRIVACY_URL)} />
              </Card>
            </View>
          </View>

          <View className="gap-2 pt-2">
            <SectionTitle>계정</SectionTitle>
            <View className="gap-4">
              {/*
                로그아웃은 **연결 해제와 다른 카드**다. 파괴적 행은 별도 카드로 내린다는 규칙이
                이 화면에 이미 있고, 로그아웃은 되돌릴 수 있어 그 무리에 안 든다.

                확인을 한 번 받는다(사용자 지정). 되돌릴 수 있는 동작이지만 다시 로그인하는 것이
                창을 열고 넥슨을 거치는 일이라 실수로 눌렀을 때 치르는 값이 작지 않다.
                지우는 것은 넥슨 로그인 하나이고 API 키와 내부 데이터는 남는다.
              */}
              {showSignOut && (
                <Card className={SETTINGS_CARD_CLASS}>
                  <SettingsRow
                    label="넥슨 로그아웃"
                    onPress={() => setIsSignOutOpen(true)}
                    showChevron={false}
                  />
                </Card>
              )}

              <Card className={SETTINGS_CARD_CLASS} testID="settings-card">
                <SettingsRow
                  label="데이터 삭제"
                  onPress={() => setIsCacheClearOpen(true)}
                  danger
                  showChevron={false}
                />
                <SettingsRow
                  label="연결 해제"
                  onPress={() => setIsDisconnectOpen(true)}
                  danger
                  showChevron={false}
                />
              </Card>
            </View>
          </View>
        </View>
      </ScreenScroll>

      {/* 모달은 카드 밖이자 스크롤 상자 밖의 형제다. 화면 위에 뜨는 것이라 어느 카드에도 속하지 않는다. */}
      <SignOutConfirm
        isOpen={isSignOutOpen}
        isSigningOut={isSigningOut}
        onCancel={() => setIsSignOutOpen(false)}
        onConfirm={() => {
          setIsSigningOut(true)
          void signOutNexonLogin()
        }}
      />
      <CacheClearConfirm
        isOpen={isCacheClearOpen}
        isClearing={isClearing}
        counts={counts}
        onConfirm={(selection) => {
          void handleClear(selection)
        }}
        onCancel={() => setIsCacheClearOpen(false)}
      />

      <DisconnectConfirm
        isOpen={isDisconnectOpen}
        isDisconnecting={isDisconnecting}
        onConfirm={() => {
          void handleDisconnectConfirm()
        }}
        onCancel={() => setIsDisconnectOpen(false)}
      />
    </>
  )
}

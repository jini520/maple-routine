/**
 * 설정 하위 페이지 `계정 및 데이터`. 데이터 삭제와 연결 해제 둘을 담는 화면.
 *
 * 카드가 하나다. 계정을 바꾸는 일이 캐릭터 관리의 드롭다운 안으로 들어가 이 화면에 계정 변경이
 * 없다. 카드 경계를 남기는 것은 위험 색 라벨 둘을 담는 그릇이 계속 필요해서다.
 *
 * **데이터 삭제 범위는 이 파일에 없다.** 화면은 그룹마다 고른 여부를 넘길 뿐이고 어떤 키와 어떤 테이블이
 * 지워지는지는 `storage/cache-data.ts` 가 혼자 정한다.
 *
 * @see docs/features/settings.md 정책
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { reloadAppAsync } from 'expo'

import type { CacheDataCounts } from '../../features/settings/cache-data'
import { clearCacheDataAndReload, loadCacheDataCounts } from '../../features/settings/cache-data'
import { useSettingsStore } from '../../features/settings/store'
import { useAuthStore } from '../../features/auth/store'
import { hasNexonLogin } from '../../features/auth/saved-key'
import type { CacheDataSelection } from '../../storage/cache-data'

import { Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { CacheClearConfirm } from './CacheClearConfirm'
import { DisconnectConfirm } from './DisconnectConfirm'
import { SignOutConfirm } from './SignOutConfirm'
import { SETTINGS_CARD_CLASS } from './row-class'
import { SettingsRow } from './SettingsRow'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'

export interface SettingsAccountDataScreenProps {
  /** 테스트 주입용. 기본은 지금 도는 번들의 재실행. */
  reload?: () => void
}

export function SettingsAccountDataScreen(
  props: SettingsAccountDataScreenProps = {},
): React.JSX.Element {
  const { disconnect } = useSettingsStore()
  const navigation = useSettingsNavigation()

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
              <Text className="text-lg font-semibold text-text">계정 및 데이터</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* `screen-<라우트 이름>` 은 자리표시자에게서 물려받은 계약이다(`SettingsAboutScreen` 주석). */}
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsAccountData">
          {/* `settings-card` 는 본화면과 같은 이름이다. 같은 프리미티브라 같은 표식을 쓴다.
              웹 테스트가 카드 경계를 `Card` atom 의 라운딩 클래스로 잡던 자리이고, RN 에는 그
              클래스가 스타일로 컴파일돼 사라져 표식이 필요하다. */}
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

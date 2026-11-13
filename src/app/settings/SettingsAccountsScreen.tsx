/**
 * 계정 관리 목록. 넥슨 계정마다 `… 계정 설정` 행 하나와 그 아래 메이플 ID 이름이 선다.
 *
 * 넥슨 로그인 사용자는 넥슨 ID 계정 카드, `API 키 추가` 글자 버튼, API 키 계정 카드 차례다. 로그인하지 않은 사용자는 넥슨 로그인
 * 블록과 키 계정 카드다. 부계정은 넥슨 로그인 사용자만 넣는다.
 *
 * @see docs/features/auth.md 계정 관리
 */
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Card, KeyRoundIcon, PlusIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { NexonLoginButton } from '../../components/molecules/NexonLoginButton/NexonLoginButton'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import type { ManagedAccount } from '../../features/account-manage/accounts'
import { useAccountManageStore } from '../../features/account-manage/store'
import type { KeyRejection } from '../../features/account-manage/validate-key'
import { NEXON_LOGIN_ENABLED } from '../../features/auth/nexon-login-enabled'
import { useAuthStore } from '../../features/auth/store'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useMapleIdNameOf } from '../../features/maple-id/names'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { ApiKeySheet } from '../auth/ApiKeySheet'
import { UnregistrableKeyModal } from '../auth/UnregistrableKeyModal'
import { SETTINGS_CARD_CLASS } from './row-class'
import { SettingsRow } from './SettingsRow'

export function SettingsAccountsScreen(): React.JSX.Element {
  // 계정 관리는 앱 설정의 하위 페이지라 그 묶음을 함께 쓴다.
  const faq = useFaqSheet('app-settings')
  const navigation = useSettingsNavigation()
  const view = useAccountManageStore((state) => state.view)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [rejection, setRejection] = useState<KeyRejection | null>(null)
  const [limitOpen, setLimitOpen] = useState(false)
  // 추가한 키가 등록된 부계정의 키면 그 계정의 키를 바꿀지 묻는다. 시트는 그 뒤에 그대로 있다.
  const [replacing, setReplacing] = useState<{ accountKey: string; label: string; apiKey: string } | null>(null)
  const [replaceBusy, setReplaceBusy] = useState(false)

  useFocusEffect(
    useCallback(() => {
      void useAccountManageStore.getState().load()
    }, []),
  )

  const openAccount = (account: ManagedAccount): void => {
    navigation.navigate('SettingsAccountDetail', { accountKey: account.key })
  }

  const startAdding = (): void => {
    if (view?.canAdd === true) setAdding(true)
    else setLimitOpen(true)
  }

  const submitKey = async (apiKey: string): Promise<void> => {
    setSubmitting(true)
    const result = await useAccountManageStore.getState().addKey(apiKey)
    setSubmitting(false)
    if (result.outcome === 'saved') setAdding(false)
    else if (result.outcome === 'rejected') setRejection(result.reason)
    else if (result.outcome === 'existing') setReplacing({ accountKey: result.accountKey, label: result.label, apiKey })
    else if (result.outcome === 'limit') {
      setAdding(false)
      setLimitOpen(true)
    }
  }

  const confirmReplace = async (): Promise<void> => {
    if (replacing === null) return
    setReplaceBusy(true)
    const result = await useAccountManageStore.getState().replaceWithKey(replacing.accountKey, replacing.apiKey)
    setReplaceBusy(false)
    setReplacing(null)
    if (result.outcome === 'saved') setAdding(false)
    else if (result.outcome === 'rejected') setRejection(result.reason)
  }

  const linkNexon = async (): Promise<void> => {
    // 로그인 화면의 새 로그인이 아니라 today 의 `넥슨 ID 연동하기` 와 같은 연동이다. 추적 목록을 비우지 않는다.
    if (await useAuthStore.getState().signInWithNexonAccount()) void useAccountManageStore.getState().load()
  }

  const [main, ...subs] = view?.accounts ?? []

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-text">계정 관리</Text>
                <FaqButton sheet={faq} />
              </View>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsAccounts">
          {view === null && <LoadingState size="page" message="불러오고 있어요" />}

          {view !== null && !view.hasLogin && (
            <>
              {NEXON_LOGIN_ENABLED && (
                <Card className={SETTINGS_CARD_CLASS} testID="account-login-block">
                  <Text className="px-2 pb-1.5 pt-2 text-xs text-text-muted">부계정을 추가하려면 넥슨 로그인이 필요해요.</Text>
                  {/* 카드 모서리(14)와 버튼 그림의 모서리(6)가 붙으면 어긋나 보여 좌우를 줄이고 아래를 띄운다. */}
                  <View className="mx-1 mb-2">
                    <NexonLoginButton onPress={() => void linkNexon()} />
                  </View>
                </Card>
              )}
              {main !== undefined && (
                <Card className={SETTINGS_CARD_CLASS}>
                  <AccountRows account={main} last onOpen={openAccount} />
                </Card>
              )}
            </>
          )}

          {view !== null && view.hasLogin && main !== undefined && (
            <>
              <Card className={SETTINGS_CARD_CLASS}>
                <AccountRows account={main} last onOpen={openAccount} />
              </Card>

              <View className="gap-2">
                <Pressable
                  role="button"
                  onPress={startAdding}
                  hitSlop={8}
                  className="flex-row items-center gap-0.5 self-end px-1 active:opacity-60"
                >
                  <PlusIcon className="h-3.5 w-3.5 text-primary-ink" strokeWidth={2} aria-hidden />
                  <Text className="text-xs font-semibold text-primary-ink">API 키 추가</Text>
                </Pressable>
                {subs.length === 0 ? (
                  <EmptyState
                    icon={KeyRoundIcon}
                    title="등록한 API 키가 없어요"
                    description="다른 넥슨 계정의 API 키를 추가하면 그 계정의 캐릭터도 함께 관리할 수 있어요."
                  />
                ) : (
                  <Card className={SETTINGS_CARD_CLASS}>
                    {subs.map((account, index) => (
                      <AccountRows key={account.key} account={account} last={index === subs.length - 1} onOpen={openAccount} />
                    ))}
                  </Card>
                )}
              </View>
            </>
          )}
        </View>
      </ScreenScroll>

      {adding && (
        <ApiKeySheet
          purpose="add"
          isSubmitting={submitting}
          onSubmit={(apiKey) => void submitKey(apiKey)}
          onClose={() => setAdding(false)}
        />
      )}
      {rejection !== null && <UnregistrableKeyModal reason={rejection} onClose={() => setRejection(null)} />}
      {replacing !== null && (
        <NoticeModal
          icon={KeyRoundIcon}
          tone="primary"
          title="이미 등록된 계정의 API 키예요"
          description={`${replacing.label}의 키를 새로 입력한 키로 바꿀까요?`}
          action={{ label: '바꾸기', onPress: () => void confirmReplace(), busy: replaceBusy, disabled: replaceBusy }}
          secondaryAction={{ label: '취소', onPress: () => setReplacing(null), disabled: replaceBusy }}
          onClose={() => {
            if (!replaceBusy) setReplacing(null)
          }}
          testId="replace-existing-key"
        />
      )}
      {limitOpen && (
        <NoticeModal
          icon={KeyRoundIcon}
          tone="primary"
          title="더 추가할 수 없어요"
          description="넥슨 계정은 넥슨 ID 를 포함해 5개까지 등록할 수 있어요."
          action={{ label: '확인', onPress: () => setLimitOpen(false) }}
          onClose={() => setLimitOpen(false)}
          testId="account-limit"
        />
      )}
    </>
  )
}

/** 계정 하나. 누르는 `… 계정 설정` 행과 그 아래 메이플 ID 이름 · 대표 캐릭터 글자. */
function AccountRows(props: { account: ManagedAccount; last: boolean; onOpen: (account: ManagedAccount) => void }): React.JSX.Element {
  const { account } = props
  const nameOf = useMapleIdNameOf()
  return (
    <>
      <SettingsRow
        label={`${account.label} 설정`}
        onPress={() => props.onOpen(account)}
        rightContent={account.invalid ? <Text className="text-xs font-semibold text-error-ink">유효하지 않은 키</Text> : undefined}
      />
      {account.mapleIds.length > 0 && (
        <View className={`gap-2.5 px-3.5 pt-2 ${props.last ? 'pb-2.5' : 'pb-3.5'}`}>
          {account.mapleIds.map((mapleId) => (
            <View key={mapleId.accountId} className="gap-0.5" testID={`account-maple-id-${mapleId.accountId}`}>
              <Text className="text-sm font-semibold text-text">{nameOf(mapleId.accountId)}</Text>
              {mapleId.representative !== null && <Text className="text-xs text-text-muted">{mapleId.representative}</Text>}
            </View>
          ))}
        </View>
      )}
    </>
  )
}

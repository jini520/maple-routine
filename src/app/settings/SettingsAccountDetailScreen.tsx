/**
 * 넥슨 계정 하나의 상세. 위에 `메이플 ID 이름` 카드, 아래에 `API 키` 카드다.
 *
 * 이름은 메이플 ID 마다 칸에서 고치고 카드 맨 아래 `저장` 으로 저장한다. `저장` 을 누르지 않고 나가면 고친 이름을 버린다.
 * 키 변경 · 삭제는 계정 단위다. 키 하나가 넥슨 계정 하나라서다. 넥슨 ID 계정에는 `API 키` 카드가 없다.
 *
 * @see docs/features/auth.md 계정 관리
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { AlertTriangleIcon, Button, Card, PencilIcon, Text, TextInput } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { InsetNote } from '../../components/molecules/InsetRow/InsetRow'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import type { ManagedAccount } from '../../features/account-manage/accounts'
import { useAccountManageStore } from '../../features/account-manage/store'
import type { KeyRejection } from '../../features/account-manage/validate-key'
import { useAuthStore } from '../../features/auth/store'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { MAPLE_ID_NAME_MAX_LENGTH, useMapleIdNamesStore } from '../../features/maple-id/names'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { mapleIdNameOf } from '../../lib/maple-id-name'
import type { AccountDetailParams } from '../../navigation/routes'
import { ApiKeySheet } from '../auth/ApiKeySheet'
import { DevelopmentStageKeyModal } from '../auth/DevelopmentStageKeyModal'
import { UnregistrableKeyModal } from '../auth/UnregistrableKeyModal'
import { SETTINGS_CARD_CLASS } from './row-class'
import { SectionTitle } from './SectionTitle'
import { SettingsRow } from './SettingsRow'

export function SettingsAccountDetailScreen(props: { route?: { params?: Partial<AccountDetailParams> } }): React.JSX.Element {
  // 계정 관리는 앱 설정의 하위 페이지라 그 묶음을 함께 쓴다.
  const faq = useFaqSheet('app-settings')
  const navigation = useSettingsNavigation()
  const accountKey = props.route?.params?.accountKey
  const view = useAccountManageStore((state) => state.view)
  const account = view?.accounts.find((one) => one.key === accountKey)
  const [keySheetOpen, setKeySheetOpen] = useState(props.route?.params?.openKeySheet === true)
  const [submitting, setSubmitting] = useState(false)
  const [rejection, setRejection] = useState<KeyRejection | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 429 모달에서 곧장 들어오면 목록을 거치지 않아 스토어가 비어 있을 수 있다.
  useEffect(() => {
    if (useAccountManageStore.getState().view === null) void useAccountManageStore.getState().load()
  }, [])

  const submitKey = async (apiKey: string): Promise<void> => {
    if (account === undefined) return
    setSubmitting(true)
    if (account.kind === 'mainKey') {
      // 로그인하지 않은 사용자의 키는 메인 키다. 429 모달의 메인 키 바꾸기와 같다.
      const result = await useAuthStore.getState().replaceMainApiKey(apiKey)
      setSubmitting(false)
      if (result === 'replaced') {
        setKeySheetOpen(false)
        void useAccountManageStore.getState().load()
      }
      return
    }
    const result = await useAccountManageStore.getState().changeKey(account.key, apiKey)
    setSubmitting(false)
    if (result.outcome === 'saved') {
      setKeySheetOpen(false)
      // 서버에만 있던 계정에 키를 넣으면 그 키의 넥슨 계정 id 가 새 `key` 다. 옛 `key` 로는 상세를 다시 찾지 못한다.
      if (account.apiKey === null) navigation.goBack()
    } else if (result.outcome === 'rejected') setRejection(result.reason)
  }

  const removeAccount = async (): Promise<void> => {
    if (account === undefined) return
    setDeleting(true)
    const result = await useAccountManageStore.getState().removeAccount(account.key)
    setDeleting(false)
    setConfirmingDelete(false)
    if (result === 'removed') navigation.goBack()
  }

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-text">{account === undefined ? '계정 설정' : `${account.label} 설정`}</Text>
                <FaqButton sheet={faq} />
              </View>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsAccountDetail">
          {account === undefined ? (
            <LoadingState size="page" message="불러오고 있어요" />
          ) : (
            <>
              {account.mapleIds.length > 0 && <NameFields account={account} />}
              {account.kind !== 'login' && (
                <KeyRows
                  account={account}
                  onOpenKeySheet={() => setKeySheetOpen(true)}
                  onDelete={() => setConfirmingDelete(true)}
                />
              )}
            </>
          )}
        </View>
      </ScreenScroll>

      {keySheetOpen && account !== undefined && (
        <ApiKeySheet
          purpose={account.kind === 'subKey' && account.apiKey === null ? 'enter' : 'change'}
          isSubmitting={submitting}
          onSubmit={(apiKey) => void submitKey(apiKey)}
          onClose={() => setKeySheetOpen(false)}
        />
      )}
      {/* 메인 키 바꾸기의 개발 단계 키는 그 흐름의 모달이 알린다. 부계정은 아래 모달이 알린다. */}
      {keySheetOpen && account?.kind === 'mainKey' && <DevelopmentStageKeyModal />}
      {rejection !== null && <UnregistrableKeyModal reason={rejection} onClose={() => setRejection(null)} />}
      {confirmingDelete && (
        <NoticeModal
          icon={AlertTriangleIcon}
          tone="error"
          title="API 키를 삭제할까요?"
          content={
            <InsetNote>이 기기에서 키를 지우고, 이 계정의 캐릭터를 추적에서 빼요. 보스 수익 · 가계부 기록은 그대로 남아요.</InsetNote>
          }
          action={{ label: '취소', onPress: () => setConfirmingDelete(false), disabled: deleting }}
          secondaryAction={{
            label: 'API 키 삭제',
            onPress: () => void removeAccount(),
            danger: true,
            busy: deleting,
            disabled: deleting,
          }}
          onClose={() => setConfirmingDelete(false)}
          testId="delete-api-key-confirm"
        />
      )}
    </>
  )
}

/**
 * 메이플 ID 이름 칸들. 칸 위에 대표 캐릭터 라벨, 칸 오른쪽에 연필 아이콘, 카드 맨 아래 `저장` 이다.
 *
 * 칸은 지금 이름에서 시작한다. 이 컴포넌트가 고친 값을 들고 있어, 페이지를 나가면 저장하지 않은 값이 함께 사라진다.
 */
function NameFields(props: { account: ManagedAccount }): React.JSX.Element {
  const names = useMapleIdNamesStore((state) => state.names)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const changes: Record<string, string> = {}
  for (const { accountId } of props.account.mapleIds) {
    const draft = drafts[accountId]
    if (draft === undefined || draft.trim() === mapleIdNameOf(accountId, names)) continue
    // 기본 이름을 그대로 적으면 저장한 이름을 지운다. 기본 이름은 저장하지 않고 그릴 때 짓는다.
    changes[accountId] = draft.trim() === mapleIdNameOf(accountId) ? '' : draft
  }
  const changed = Object.keys(changes).length > 0

  const save = async (): Promise<void> => {
    setSaving(true)
    await useMapleIdNamesStore.getState().save(changes).catch(() => undefined)
    setSaving(false)
    setDrafts({})
  }

  return (
    <View className="gap-2">
      <SectionTitle>메이플 ID 이름</SectionTitle>
      <Card className="gap-3 p-3">
        {props.account.mapleIds.map((mapleId) => (
          <View key={mapleId.accountId} className="gap-1.5">
            {mapleId.representative !== null && (
              <Text className="px-0.5 text-xs text-text-muted">대표 캐릭터 {mapleId.representative}</Text>
            )}
            <View className="relative flex-row items-center">
              <TextInput
                aria-label={`${mapleId.representative ?? mapleIdNameOf(mapleId.accountId)} 메이플 ID 이름`}
                testID={`maple-id-name-${mapleId.accountId}`}
                value={drafts[mapleId.accountId] ?? mapleIdNameOf(mapleId.accountId, names)}
                onChangeText={(text) => setDrafts((current) => ({ ...current, [mapleId.accountId]: text }))}
                maxLength={MAPLE_ID_NAME_MAX_LENGTH}
                autoCorrect={false}
                spellCheck={false}
                className="h-12 w-full rounded-[10px] bg-card-inset px-3.5 pr-11 text-base text-text"
              />
              <View className="absolute right-3.5" pointerEvents="none">
                <PencilIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
              </View>
            </View>
          </View>
        ))}
        <Button
          variant="primary"
          onPress={() => void save()}
          busy={saving}
          disabled={!changed || saving}
          className={`mt-2 w-full items-center${changed ? '' : ' opacity-50'}`}
        >
          저장
        </Button>
      </Card>
    </View>
  )
}

/** `API 키` 카드. 이 기기에 키가 없으면 안내 글자와 `API 키 입력`, 있으면 `API 키 변경` 이다. 부계정만 `API 키 삭제` 가 있다. */
function KeyRows(props: { account: ManagedAccount; onOpenKeySheet: () => void; onDelete: () => void }): React.JSX.Element {
  const missingKey = props.account.apiKey === null
  return (
    <View className="gap-2">
      <SectionTitle>API 키</SectionTitle>
      <Card className={SETTINGS_CARD_CLASS}>
        {missingKey && (
          <Text className="px-2 pb-1.5 pt-2 text-xs text-text-muted">
            이 기기에는 이 계정의 API 키가 없어요. 키를 넣어야 이 계정의 캐릭터를 불러올 수 있어요.
          </Text>
        )}
        <SettingsRow label={missingKey ? 'API 키 입력' : 'API 키 변경'} onPress={props.onOpenKeySheet} />
        {/* 로그인하지 않은 사용자의 키는 유일한 수단이라 지우면 로그아웃과 같다. 그 일은 `앱 정보 및 계정` 의 로그아웃이 맡는다. */}
        {props.account.kind === 'subKey' && (
          <SettingsRow label="API 키 삭제" danger showChevron={false} onPress={props.onDelete} />
        )}
      </Card>
    </View>
  )
}

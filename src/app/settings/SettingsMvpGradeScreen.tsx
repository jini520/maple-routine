/**
 * MVP 등급 목록. 메이플 ID 마다 카드 하나에 ID 표시 · `변경` · 지금 등급 한 줄 · `이력 N건 보기` 가 서고, 맨 아래가
 * `매주 등급 확인` 스위치다. 이력을 다 펼치지 않는 것은 이력이 쌓이면 페이지가 끝없이 길어져서다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Card, ChevronRightIcon, Switch, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { AccountRow } from '../../components/organisms/AccountSelect/AccountSelect'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useMvpGradeSettingsStore, type MvpGradeAccountView } from '../../features/mvp-grade/settings-store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { GradeChangeSheet } from '../mvp-grade/MvpGradeSheets'
import { GradeTimelineRow } from '../mvp-grade/GradeTimelineRow'

export function SettingsMvpGradeScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const status = useMvpGradeSettingsStore((state) => state.status)
  const accounts = useMvpGradeSettingsStore((state) => state.accounts)
  const weeklyOff = useMvpGradeSettingsStore((state) => state.weeklyOff)
  const [changing, setChanging] = useState<MvpGradeAccountView | null>(null)

  useEffect(() => {
    void useMvpGradeSettingsStore.getState().load()
  }, [])

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <Text className="text-lg font-semibold text-text">MVP 등급</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsMvpGrade">
          {(status === 'idle' || status === 'loading') && <LoadingState size="page" message="불러오고 있어요" />}
          {status === 'failed' && (
            <ErrorState
              title="MVP 등급을 불러오지 못했습니다"
              description="저장된 기록을 읽지 못했습니다. 다시 시도해주세요."
              action={{ label: '다시 시도', onClick: () => void useMvpGradeSettingsStore.getState().load() }}
            />
          )}
          {status === 'ready' &&
            accounts.map((account) => (
              <AccountCard
                key={account.accountId}
                account={account}
                onChange={() => setChanging(account)}
                onOpenHistory={() => navigation.navigate('SettingsMvpGradeHistory', { accountId: account.accountId })}
              />
            ))}

          <View className="gap-1.5">
            <Card className="px-6">
              <View className="flex-row items-center py-4">
                <Text className="shrink text-sm text-text">매주 등급 확인</Text>
                <Switch
                  on={!weeklyOff}
                  label="매주 등급 확인"
                  size="lg"
                  className="ml-auto"
                  onToggle={() => void useMvpGradeSettingsStore.getState().setWeeklyCheck(weeklyOff)}
                />
              </View>
            </Card>
            <Text className="px-2 text-xs text-text-muted">
              주가 바뀌면 등급이 맞는지 물어요. 끄면 등급은 이 화면에서만 바뀌어요.
            </Text>
          </View>
        </View>
      </ScreenScroll>

      {changing !== null && (
        <GradeChangeSheet
          history={changing.history}
          todayDateKey={getCurrentKstDateKey(new Date())}
          onSave={(history) => useMvpGradeSettingsStore.getState().saveHistory(changing.accountId, history, new Date())}
          onClose={() => setChanging(null)}
        />
      )}
    </>
  )
}

/** ID 카드 하나. 목록을 못 받은 ID 는 표시 없이 선다. */
function AccountCard(props: {
  account: MvpGradeAccountView
  onChange: () => void
  onOpenHistory: () => void
}): React.JSX.Element {
  const { account } = props
  const current = account.history[account.history.length - 1]
  const change = (
    <Pressable role="button" aria-label="변경" onPress={props.onChange} hitSlop={8} className="shrink-0 py-1">
      <Text className="text-xs font-bold text-primary-ink">변경</Text>
    </Pressable>
  )

  return (
    <Card className="px-5 py-4" testID={`mvp-grade-account-${account.accountId}`}>
      <View className="gap-2.5">
        {account.summary === null ? (
          <View className="flex-row items-center justify-between gap-2.5">
            <Text className="text-sm text-text">메이플 ID</Text>
            {change}
          </View>
        ) : (
          <AccountRow summary={account.summary} portraitUrl={account.portraitUrl} trailing={change} />
        )}
        {current !== undefined && (
          <View className="border-t border-border pt-1">
            <GradeTimelineRow entry={current} isNow connector={false} />
          </View>
        )}
        <Pressable
          role="button"
          onPress={props.onOpenHistory}
          className="flex-row items-center justify-between border-t border-border pb-0.5 pt-2.5"
        >
          <Text className="text-xs font-semibold text-text-muted">이력 {account.history.length}건 보기</Text>
          <ChevronRightIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
        </Pressable>
      </View>
    </Card>
  )
}

/**
 * 메이플 ID 하나의 MVP 등급 이력. 위 카드가 지금 등급과 `등급 변경` 이고, 아래가 이력 전체의 타임라인이다.
 * 해가 바뀌는 자리에 연도 줄이 서서 길어져도 어디쯤인지 읽힌다. 줄을 누르면 그 기록을 고친다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { Fragment, useState } from 'react'
import { Pressable, View } from 'react-native'

import { AlertTriangleIcon, Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { MvpPlate } from '../../components/molecules/MvpPlate/MvpPlate'
import { AccountRow } from '../../components/organisms/AccountSelect/AccountSelect'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useMvpGradeSettingsStore } from '../../features/mvp-grade/settings-store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { formatDayLabel } from '../../lib/calendar'
import { findMvpGrade, mvpBenefitText } from '../../lib/mvp/grades'
import { removeGradeEntry, type MvpGradeEntry } from '../../lib/mvp/history'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { GradeChangeSheet, GradeEditSheet, GradeInsertSheet } from '../mvp-grade/MvpGradeSheets'
import { GradeTimelineRow } from '../mvp-grade/GradeTimelineRow'

type Sheet = { kind: 'change' } | { kind: 'insert' } | { kind: 'edit'; startDate: string }

export function SettingsMvpGradeHistoryScreen(props: {
  route?: { params?: { accountId?: string } }
}): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const accountId = props.route?.params?.accountId
  const account = useMvpGradeSettingsStore((state) => state.accounts.find((entry) => entry.accountId === accountId))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [deleting, setDeleting] = useState<MvpGradeEntry | null>(null)

  const history = account?.history ?? []
  const current = history[history.length - 1]
  const newestFirst = [...history].reverse()
  const today = getCurrentKstDateKey(new Date())

  function save(next: MvpGradeEntry[]): Promise<void> {
    return useMvpGradeSettingsStore.getState().saveHistory(accountId as string, next, new Date())
  }

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <Text className="text-lg font-semibold text-text">MVP 등급 이력</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsMvpGradeHistory">
          {account !== undefined && (
            <>
              <Card className="px-5 py-4">
                <View className="gap-3">
                  {account.summary === null ? (
                    <Text className="text-sm text-text">메이플 ID</Text>
                  ) : (
                    <AccountRow summary={account.summary} portraitUrl={account.portraitUrl} />
                  )}
                  {current !== undefined && (
                    <View testID="mvp-grade-now" className="gap-1.5 border-t border-border pt-3">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="text-xs text-text-muted">지금 등급</Text>
                        {current.grade === null ? (
                          <Text className="text-xs text-text-muted">등급 없음</Text>
                        ) : (
                          <MvpPlate grade={current.grade} height={24} />
                        )}
                      </View>
                      {current.grade !== null && (
                        <Text className="self-end text-xs text-text-muted">{mvpBenefitText(current.grade)}</Text>
                      )}
                      <Text className="self-end text-11 text-text-muted">{formatDayLabel(current.startDate)}부터</Text>
                    </View>
                  )}
                  <Pressable
                    role="button"
                    onPress={() => setSheet({ kind: 'change' })}
                    className="items-center rounded-full border border-border px-4 py-2"
                  >
                    <Text className="text-13 font-semibold text-text">등급 변경</Text>
                  </Pressable>
                </View>
              </Card>

              <View className="gap-2">
                <View className="flex-row items-center justify-between px-1">
                  <Text className="text-sm font-semibold text-text">이력 {history.length}건</Text>
                  <Pressable role="button" onPress={() => setSheet({ kind: 'insert' })} hitSlop={8} className="py-1">
                    <Text className="text-xs font-bold text-primary-ink">+ 추가</Text>
                  </Pressable>
                </View>
                <Card className="px-5" testID="mvp-grade-timeline">
                  <View className="py-1.5">
                    {newestFirst.map((entry, index) => {
                      const year = entry.startDate.slice(0, 4)
                      const newYear = index === 0 || newestFirst[index - 1]?.startDate.slice(0, 4) !== year
                      return (
                        <Fragment key={entry.startDate}>
                          {newYear && (
                            <Text
                              className={`pl-[22px] text-11 font-bold text-text-muted ${index === 0 ? 'pb-0.5 pt-1' : 'pb-0.5 pt-3'}`}
                            >
                              {year}
                            </Text>
                          )}
                          <GradeTimelineRow
                            entry={entry}
                            isNow={index === 0}
                            connector={index < newestFirst.length - 1}
                            onPress={() => setSheet({ kind: 'edit', startDate: entry.startDate })}
                          />
                        </Fragment>
                      )
                    })}
                  </View>
                </Card>
              </View>
            </>
          )}
        </View>
      </ScreenScroll>

      {sheet?.kind === 'change' && (
        <GradeChangeSheet history={history} todayDateKey={today} onSave={save} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'insert' && (
        <GradeInsertSheet history={history} todayDateKey={today} onSave={save} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'edit' && (
        <GradeEditSheet
          history={history}
          startDate={sheet.startDate}
          todayDateKey={today}
          onSave={save}
          onDelete={() => {
            // 시트를 먼저 닫는다. 확인 창이 시트 위에 서면 두 겹이 되고 되돌릴 수 없는 일을 묻는 자리가 가린다.
            setDeleting(history.find((entry) => entry.startDate === sheet.startDate) ?? null)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {deleting !== null && (
        <NoticeModal
          testId="mvp-grade-delete"
          icon={AlertTriangleIcon}
          tone="error"
          title="등급 기록을 지울까요?"
          description={`${formatDayLabel(deleting.startDate)}부터의 ${findMvpGrade(deleting.grade)?.name ?? '등급 없음'} 기록을 지워요. 되돌릴 수 없어요.`}
          action={{ label: '그대로 두기', onPress: () => setDeleting(null) }}
          secondaryAction={{
            label: '기록 지우기',
            danger: true,
            onPress: () => {
              setDeleting(null)
              void save(removeGradeEntry(history, deleting.startDate))
            },
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

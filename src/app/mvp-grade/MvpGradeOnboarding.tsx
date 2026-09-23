/**
 * 온보딩의 MVP 등급 화면 둘. 캐릭터 설정 다음에 고르기(`다음`) → 확인(`시작하기`)으로 선다. 확인에 `수정` 이 없고 고르기로
 * 돌아가는 길은 뒤로가기(기기 · 머리 줄 버튼)다. 카드와 문구는 today 위 모달과 같다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { Button, Text } from '../../components/atoms'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { EntryScroll } from '../../components/templates/EntryScroll/EntryScroll'
import { useAppEntryStore } from '../../features/app-entry/store'
import { historyFloorDateKey } from '../../features/cashbook/range'
import { useMvpAskStore } from '../../features/mvp-grade/flow-store'
import { useMvpOnboardingDraft } from '../../features/mvp-grade/onboarding-draft'
import { useToastStore } from '../../features/toast/store'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { resetWeekStartOf } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { MvpConfirmCard, MvpPickCard, MvpWeeklyOffRow } from './MvpGradeCards'

const START_LABEL = '적용 시작 주'

function Heading(props: { title: string; description: string }): React.JSX.Element {
  return (
    <View className="gap-1">
      <Text className="text-lg font-semibold text-text">{props.title}</Text>
      <Text className="text-sm text-text-muted">{props.description}</Text>
    </View>
  )
}

export function MvpGradePickScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const ask = useMvpAskStore((state) => state.ask)
  const accounts = useMvpAskStore((state) => state.accounts)
  const savedWeeklyOff = useMvpAskStore((state) => state.weeklyOff)
  const grades = useMvpOnboardingDraft((state) => state.grades)
  const starts = useMvpOnboardingDraft((state) => state.starts)
  const today = getCurrentKstDateKey(new Date())
  const thisWeek = resetWeekStartOf(today)

  // 캐릭터 설정이 막 끝났거나 앱을 다시 켰으면 물을 것을 잰다. 물을 ID 가 없으면 온보딩을 끝낸다.
  useEffect(() => {
    if (useMvpAskStore.getState().ask !== null) return
    const finishIfNothing = (): void => {
      const next = useMvpAskStore.getState().ask
      if (next === null || next.kind === 'weekly') void useAppEntryStore.getState().finishMvpOnboarding()
    }
    void useMvpAskStore.getState().evaluate(new Date()).then(finishIfNothing, finishIfNothing)
  }, [])

  const accountIds = accounts.map((account) => account.accountId)
  useEffect(() => {
    if (accountIds.length > 0) useMvpOnboardingDraft.getState().seed(accountIds, thisWeek, savedWeeklyOff)
    // 같은 ID 들이면 draft 가 다시 안 채운다. 배열 참조가 아니라 ID 로 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds.join(','), thisWeek, savedWeeklyOff])

  const ready = ask !== null && ask.kind !== 'weekly' && accounts.length > 0

  return (
    <View testID="screen-MvpGradePick" className="flex-1">
      <EntryScroll
        onBack={() => navigation.goBack()}
        footer={
          <Button
            variant="primary"
            disabled={!ready}
            onPress={() => navigation.navigate('MvpGradeConfirm')}
            className={`w-full flex-row items-center justify-center${ready ? '' : ' opacity-50'}`}
          >
            다음
          </Button>
        }
      >
        <View className="w-full gap-4">
          <Heading title="MVP 등급을 알려주세요" description="고른 캐릭터의 메이플 ID마다 골라 주세요. 고르지 않으면 일반으로 계산해요." />
          {!ready ? (
            <LoadingState size="page" message="불러오고 있어요" />
          ) : (
            accounts.map((account) => (
              <MvpPickCard
                key={account.accountId}
                account={account}
                grade={grades[account.accountId] ?? 'normal'}
                onGrade={(grade) => useMvpOnboardingDraft.getState().setGrade(account.accountId, grade)}
                start={starts[account.accountId] ?? thisWeek}
                startLabel={START_LABEL}
                floorWeek={historyFloorDateKey(today)}
                thisWeek={thisWeek}
                onStart={(week) => useMvpOnboardingDraft.getState().setStart(account.accountId, week)}
              />
            ))
          )}
        </View>
      </EntryScroll>
    </View>
  )
}

export function MvpGradeConfirmScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  /**
   * **들어올 때의 목록을 들고 있는다.** 스토어를 구독하지 않는다.
   *
   * `complete()` 는 이력을 다 적은 뒤 모달을 닫으려고 스토어를 비우는데, 화면 전환은 그보다
   * 뒤에 `afterGradeChange` 가 끝나야 일어난다. 구독하면 그 사이에 카드만 사라지고 체크박스
   * 줄(다른 스토어)만 남은 화면이 보인다.
   *
   * 이 화면이 그리는 것은 **방금 고른 것**이라 그 뒤의 스토어 변화를 따라갈 이유도 없다.
   */
  const [accounts] = useState(() => useMvpAskStore.getState().accounts)
  const grades = useMvpOnboardingDraft((state) => state.grades)
  const starts = useMvpOnboardingDraft((state) => state.starts)
  const weeklyOff = useMvpOnboardingDraft((state) => state.weeklyOff)
  const [busy, setBusy] = useState(false)
  const thisWeek = resetWeekStartOf(getCurrentKstDateKey(new Date()))

  async function start(): Promise<void> {
    setBusy(true)
    try {
      await useMvpAskStore.getState().complete(
        {
          choices: accounts.map((account) => ({
            accountId: account.accountId,
            grade: grades[account.accountId] ?? 'normal',
            startWeek: starts[account.accountId] ?? thisWeek,
            changed: true,
          })),
          weeklyOff,
          bulkApply: false,
        },
        new Date(),
      )
      await useAppEntryStore.getState().finishMvpOnboarding()
    } catch {
      useToastStore.getState().showError('저장하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View testID="screen-MvpGradeConfirm" className="flex-1">
      <EntryScroll
        onBack={() => navigation.goBack()}
        footer={
          <Button
            variant="primary"
            busy={busy}
            onPress={() => void start()}
            className="w-full flex-row items-center justify-center"
          >
            시작하기
          </Button>
        }
      >
        <View className="w-full gap-4">
          <Heading title="이 등급이 맞나요?" description="경매장 수수료와 스타포스 비용을 이 등급으로 계산해요." />
          {accounts.map((account) => (
            <MvpConfirmCard
              key={account.accountId}
              account={account}
              grade={grades[account.accountId] ?? 'normal'}
              start={starts[account.accountId] ?? thisWeek}
              startLabel={START_LABEL}
            />
          ))}
          <MvpWeeklyOffRow
            checked={weeklyOff}
            onChange={(next) => useMvpOnboardingDraft.getState().setWeeklyOff(next)}
          />
        </View>
      </EntryScroll>
    </View>
  )
}

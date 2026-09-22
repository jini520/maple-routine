/**
 * MVP 등급을 묻는 모달. 고르기와 확인 두 화면을 오가고, 주간 확인은 확인 화면부터 선다.
 *
 * 머리는 `NoticeModal` 과 같은 규격(배지 56 · 제목 · 설명)이지만 폭이 `max-w-sm` 이다. `NoticeModal` 의
 * `max-w-xs` 에는 등급 일곱과 ID 표시가 함께 안 들어간다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native'

import { Button, CheckBox, CrownIcon, Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { MvpGradeGrid } from '../../components/molecules/MvpGradeGrid/MvpGradeGrid'
import { MvpPlate } from '../../components/molecules/MvpPlate/MvpPlate'
import { AccountRow } from '../../components/organisms/AccountSelect/AccountSelect'
import { Modal } from '../../components/organisms/Modal/Modal'
import { WeekCalendarPopover } from '../../components/organisms/WeekCalendarPopover/WeekCalendarPopover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { historyFloorDateKey } from '../../features/cashbook/range'
import type { MvpAsk } from '../../features/mvp-grade/ask'
import type { MvpAskAccount, MvpAskResult } from '../../features/mvp-grade/flow-store'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { formatDayLabel, monthKeyOf, resetWeekStartOf } from '../../lib/calendar'
import { mvpBenefitText, type MvpGradeKey } from '../../lib/mvp/grades'

export interface MvpGradeModalProps {
  ask: MvpAsk
  accounts: MvpAskAccount[]
  /** 저장된 `앞으로 등급은 직접 바꿀게요`. 새 ID 흐름이 켜 둔 값을 끄지 않게 그 값으로 선다 */
  weeklyOff: boolean
  /** 오늘(KST `YYYY-MM-DD`) */
  todayDateKey: string
  /** 답을 적는 중. `맞아요` 가 대기로 선다 */
  busy: boolean
  onDone: (result: MvpAskResult) => void
}

type Screen = 'pick' | 'confirm'

const COPY = {
  select: { title: 'MVP 등급을 알려주세요', description: '고른 캐릭터의 메이플 ID마다 골라 주세요. 고르지 않으면 일반으로 계산해요.' },
  newId: {
    title: '새 메이플 ID의 MVP 등급을 알려주세요',
    description: '방금 등록한 캐릭터가 이 메이플 ID에 있어요. 고르지 않으면 일반으로 계산해요.',
  },
  weeklyPick: { title: '바뀐 등급을 골라 주세요', description: '바꾼 메이플 ID는 그 등급이 시작된 주를 함께 받아요.' },
  confirm: { title: '이 등급이 맞나요?', description: '경매장 수수료와 스타포스 비용을 이 등급으로 계산해요.' },
  weeklyConfirm: { title: '이번 주 MVP 등급이 맞나요?', description: '등급이 바뀌었으면 수정을 눌러 주세요.' },
} as const

function initialGradeOf(account: MvpAskAccount): MvpGradeKey {
  return account.currentGrade ?? 'normal'
}

export function MvpGradeModal(props: MvpGradeModalProps): React.JSX.Element {
  const { ask, accounts } = props
  const weekly = ask.kind === 'weekly'
  const thisWeek = resetWeekStartOf(props.todayDateKey)
  const floorWeek = historyFloorDateKey(props.todayDateKey)
  const { height: windowHeight } = useWindowDimensions()

  const [screen, setScreen] = useState<Screen>(weekly ? 'confirm' : 'pick')
  const [grades, setGrades] = useState<Record<string, MvpGradeKey>>(() =>
    Object.fromEntries(accounts.map((account) => [account.accountId, initialGradeOf(account)])),
  )
  const [starts, setStarts] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((account) => [account.accountId, thisWeek])),
  )
  const [weeklyOff, setWeeklyOff] = useState(props.weeklyOff)
  const [bulkApply, setBulkApply] = useState(false)

  const gradeOf = (account: MvpAskAccount): MvpGradeKey => grades[account.accountId] ?? initialGradeOf(account)
  const startOf = (account: MvpAskAccount): string => starts[account.accountId] ?? thisWeek
  // 주간 확인은 바꾼 ID 만 시작 주를 받는다. 처음 고르는 흐름은 모든 ID 가 새 기록이다.
  const changedOf = (account: MvpAskAccount): boolean => !weekly || gradeOf(account) !== initialGradeOf(account)
  const startLabel = weekly ? '바뀐 등급 적용 시작 주' : '적용 시작 주'

  const copy =
    screen === 'confirm'
      ? weekly
        ? COPY.weeklyConfirm
        : COPY.confirm
      : weekly
        ? COPY.weeklyPick
        : ask.kind === 'newId'
          ? COPY.newId
          : COPY.select

  function done(): void {
    props.onDone({
      choices: accounts.map((account) => ({
        accountId: account.accountId,
        grade: gradeOf(account),
        startWeek: startOf(account),
        changed: changedOf(account),
      })),
      weeklyOff,
      bulkApply,
    })
  }

  return (
    // 답을 받아야 끝나는 흐름이라 바깥 탭 · 뒤로가기로 안 닫힌다. 고르지 않은 ID 는 `일반` 으로 이미 서 있다.
    <Modal onClose={() => {}} testId="mvp-grade" align="center">
      <Modal.Card tight={screen === 'confirm'}>
        <View className="gap-5">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-tint">
              <CrownIcon className="h-7 w-7 text-primary-ink" strokeWidth={1.75} aria-hidden />
            </View>
            <View className="w-full gap-2">
              <Text className="text-center text-base font-semibold leading-snug text-text">{copy.title}</Text>
              <Text className="text-center text-xs text-text-muted">{copy.description}</Text>
            </View>
          </View>

          {/* 머리 · 체크박스 · 버튼을 뺀 높이만 쓴다. ID 가 여럿이면 카드끼리 스크롤한다. */}
          <ScrollView style={{ maxHeight: Math.max(windowHeight - 440, 180) }} contentContainerClassName="gap-2">
            {accounts.map((account) =>
              screen === 'pick' ? (
                <View
                  key={account.accountId}
                  testID={`mvp-grade-card-${account.accountId}`}
                  className="gap-3 rounded-[12px] border border-border p-3"
                >
                  <Identity account={account} />
                  <MvpGradeGrid
                    selected={gradeOf(account)}
                    onSelect={(grade) => setGrades({ ...grades, [account.accountId]: grade })}
                  />
                  <Text className="text-xs text-text-muted">{mvpBenefitText(gradeOf(account))}</Text>
                  {changedOf(account) && (
                    <StartWeekRow
                      testID={`mvp-grade-start-${account.accountId}`}
                      label={startLabel}
                      week={startOf(account)}
                      min={floorWeek}
                      max={thisWeek}
                      onChange={(week) => setStarts({ ...starts, [account.accountId]: week })}
                    />
                  )}
                </View>
              ) : (
                <View
                  key={account.accountId}
                  testID={`mvp-grade-card-${account.accountId}`}
                  className="gap-2.5 rounded-[12px] border border-border p-3"
                >
                  <Identity account={account} />
                  <View className="gap-2 border-t border-border pt-2.5">
                    <ConfirmRow label="등급">
                      <MvpPlate grade={gradeOf(account)} height={20} />
                    </ConfirmRow>
                    <ConfirmRow label="혜택">
                      <Text className="text-xs text-text-muted">{mvpBenefitText(gradeOf(account))}</Text>
                    </ConfirmRow>
                    {changedOf(account) && (
                      <ConfirmRow label={startLabel}>
                        <Text className="text-xs text-text" style={TABULAR_NUMS}>
                          {formatDayLabel(startOf(account))}
                        </Text>
                      </ConfirmRow>
                    )}
                  </View>
                </View>
              ),
            )}
          </ScrollView>

          {screen === 'confirm' && (
            <View className="gap-3">
              <CheckRow
                label="앞으로 등급은 직접 바꿀게요"
                hint="매주 등급 변경 여부를 확인하지 않아요. 설정에서 바꿀 수 있어요."
                checked={weeklyOff}
                onChange={setWeeklyOff}
              />
              {ask.kind !== 'weekly' && ask.bulk && (
                <CheckRow
                  label="지난 기록에도 수수료 적용하기"
                  hint="적용 시작 주부터의 판매 기록에 수수료를 반영해요. 직거래 기록은 나중에 없음으로 고칠 수 있어요."
                  checked={bulkApply}
                  onChange={setBulkApply}
                />
              )}
            </View>
          )}

          <View className="items-center gap-1">
            <Button
              variant="primary"
              onPress={screen === 'pick' ? () => setScreen('confirm') : done}
              busy={screen === 'confirm' && props.busy}
              className="w-full items-center"
              textClassName="text-sm"
            >
              {screen === 'pick' ? '다음' : '맞아요'}
            </Button>
            {screen === 'confirm' && (
              <Button
                variant="text"
                onPress={() => setScreen('pick')}
                disabled={props.busy}
                className="w-full items-center px-4 py-1.5"
                textClassName="text-xs"
              >
                수정
              </Button>
            )}
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}

/** ID 카드의 머리. 목록을 못 받은 ID 는 표시 없이 선다. */
function Identity(props: { account: MvpAskAccount }): React.JSX.Element {
  if (props.account.summary === null) return <Text className="text-sm text-text">메이플 ID</Text>
  return <AccountRow summary={props.account.summary} portraitUrl={props.account.portraitUrl} />
}

/** 확인 카드의 라벨–값 한 줄. */
function ConfirmRow(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="min-h-5 flex-row items-center justify-between gap-3">
      <Text className="shrink-0 text-xs text-text-muted">{props.label}</Text>
      <View className="min-w-0 flex-row justify-end">{props.children}</View>
    </View>
  )
}

/** 적용 시작 주 한 줄. 누르면 주 고르기 달력이 열린다. */
function StartWeekRow(props: {
  testID: string
  label: string
  week: string
  min: string
  max: string
  onChange: (week: string) => void
}): React.JSX.Element {
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(monthKeyOf(props.week))

  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-xs text-text-muted">{props.label}</Text>
      <DateSelect
        ref={ref}
        dateKey={props.week}
        label={props.label}
        onPress={toggle}
        testID={props.testID}
      />
      {isOpen && (
        <WeekCalendarPopover
          selection={{ start: props.week, end: props.week }}
          isSelectable={(week) => week >= props.min && week <= props.max}
          min={props.min}
          max={props.max}
          monthKey={monthKey}
          onChangeMonth={setMonthKey}
          onSelect={(week) => {
            props.onChange(week)
            close()
          }}
          caption="선택한 주"
          anchor={anchor}
          onClose={close}
        />
      )}
    </View>
  )
}

/** 설명이 딸린 체크박스 한 줄. */
function CheckRow(props: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <Pressable
      role="checkbox"
      aria-label={props.label}
      aria-checked={props.checked}
      onPress={() => props.onChange(!props.checked)}
      className="flex-row items-start gap-2"
    >
      <CheckBox checked={props.checked} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-xs text-text">{props.label}</Text>
        <Text className="text-11 text-text-muted">{props.hint}</Text>
      </View>
    </Pressable>
  )
}

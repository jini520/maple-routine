/**
 * MVP 등급을 묻는 두 자리(today 위 모달 · 온보딩 화면)가 함께 쓰는 카드와 체크박스. 메이플 ID 하나가 카드 하나다.
 *
 * @see docs/features/mvp-grade.md 모달 모양
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { CheckBox, Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { MvpGradeGrid } from '../../components/molecules/MvpGradeGrid/MvpGradeGrid'
import { MvpPlate } from '../../components/molecules/MvpPlate/MvpPlate'
import { AccountRow } from '../../components/organisms/AccountSelect/AccountSelect'
import { WeekCalendarPopover } from '../../components/organisms/WeekCalendarPopover/WeekCalendarPopover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { MvpAskAccount } from '../../features/mvp-grade/flow-store'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { formatDayLabel, monthKeyOf } from '../../lib/calendar'
import { mvpBenefitText, type MvpGradeKey } from '../../lib/mvp/grades'

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
      <DateSelect ref={ref} dateKey={props.week} label={props.label} onPress={toggle} testID={props.testID} />
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

/**
 * 고르기 카드. ID 표시 · 7칸 격자 · 혜택 한 줄 · 적용 시작 주.
 *
 * @example <MvpPickCard account={account} grade={grade} onGrade={setGrade} start={week} ... />
 */
export function MvpPickCard(props: {
  account: MvpAskAccount
  grade: MvpGradeKey
  onGrade: (grade: MvpGradeKey) => void
  /** 적용 시작 주. `null` 이면 그 줄이 안 선다(주간 확인에서 안 바꾼 ID) */
  start: string | null
  startLabel: string
  /** 고를 수 있는 가장 이른 주와 이번 주 */
  floorWeek: string
  thisWeek: string
  onStart: (week: string) => void
}): React.JSX.Element {
  const { account } = props
  return (
    <View testID={`mvp-grade-card-${account.accountId}`} className="gap-3 rounded-[12px] border border-border p-3">
      <Identity account={account} />
      <MvpGradeGrid selected={props.grade} onSelect={props.onGrade} />
      <Text className="text-xs text-text-muted">{mvpBenefitText(props.grade)}</Text>
      {props.start !== null && (
        <StartWeekRow
          testID={`mvp-grade-start-${account.accountId}`}
          label={props.startLabel}
          week={props.start}
          min={props.floorWeek}
          max={props.thisWeek}
          onChange={props.onStart}
        />
      )}
    </View>
  )
}

/** 확인 카드. ID 표시 아래 라벨과 값 세 줄(등급 · 혜택 · 적용 시작 주). */
export function MvpConfirmCard(props: {
  account: MvpAskAccount
  grade: MvpGradeKey
  /** 적용 시작 주. `null` 이면 그 줄이 안 선다 */
  start: string | null
  startLabel: string
}): React.JSX.Element {
  return (
    <View testID={`mvp-grade-card-${props.account.accountId}`} className="gap-2.5 rounded-[12px] border border-border p-3">
      <Identity account={props.account} />
      <View className="gap-2 border-t border-border pt-2.5">
        <ConfirmRow label="등급">
          <MvpPlate grade={props.grade} height={20} />
        </ConfirmRow>
        <ConfirmRow label="혜택">
          <Text className="text-xs text-text-muted">{mvpBenefitText(props.grade)}</Text>
        </ConfirmRow>
        {props.start !== null && (
          <ConfirmRow label={props.startLabel}>
            <Text className="text-xs text-text" style={TABULAR_NUMS}>
              {formatDayLabel(props.start)}
            </Text>
          </ConfirmRow>
        )}
      </View>
    </View>
  )
}

/** 설명이 딸린 체크박스 한 줄. */
export function MvpCheckRow(props: {
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

/** 확인 자리의 `앞으로 등급은 직접 바꿀게요` 체크박스. 모달과 온보딩 확인 화면이 함께 쓴다. */
export function MvpWeeklyOffRow(props: { checked: boolean; onChange: (checked: boolean) => void }): React.JSX.Element {
  return (
    <MvpCheckRow
      label="앞으로 등급은 직접 바꿀게요"
      hint="매주 등급 변경 여부를 확인하지 않아요. 설정에서 바꿀 수 있어요."
      checked={props.checked}
      onChange={props.onChange}
    />
  )
}

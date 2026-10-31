/**
 * MVP 등급을 묻는 두 자리(today 위 모달 · 온보딩 화면)가 함께 쓰는 카드와 체크박스. 메이플 ID 하나가 카드 하나다.
 *
 * 카드에는 테두리가 없다. 온보딩에서는 화면 위의 카드(`bg-surface`)이고, 모달에서는 패널이 이미 카드라 `card-inset` 칸이다.
 * 칸 안의 칸은 그 반대 색으로 칠한다(`inModal`).
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
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { MvpAskAccount } from '../../features/mvp-grade/flow-store'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { formatDayLabel, monthKeyOf } from '../../lib/calendar'
import { mvpBenefitText, type MvpGradeKey } from '../../lib/mvp/grades'

/** ID 카드의 머리. 목록을 못 받은 ID 는 표시 없이 선다. */
function Identity(props: { account: MvpAskAccount }): React.JSX.Element {
  if (props.account.summary === null) return <Text className="text-sm font-semibold text-text">메이플 ID</Text>
  return <AccountRow summary={props.account.summary} portraitUrl={props.account.portraitUrl} />
}

/** 카드 바탕과 그 안의 칸 바탕. 모달 안에서는 바깥이 칸이라 안쪽을 카드 색으로 뒤집는다. */
function tonesOf(inModal: boolean | undefined): { card: string; inner: string } {
  return inModal === true ? { card: 'bg-card-inset', inner: 'bg-surface' } : { card: 'bg-surface', inner: 'bg-card-inset' }
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

/** 적용 시작일 한 줄. 누르면 날짜 달력이 열린다. */
function StartDateRow(props: {
  testID: string
  label: string
  dateKey: string
  min: string
  max: string
  onChange: (dateKey: string) => void
}): React.JSX.Element {
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(monthKeyOf(props.dateKey))

  return (
    <View className="flex-row items-center justify-between gap-2 px-1">
      <Text className="text-xs text-text-muted">{props.label}</Text>
      <DateSelect
        ref={ref}
        dateKey={props.dateKey}
        label={props.label}
        onPress={() => {
          setMonthKey(monthKeyOf(props.dateKey))
          toggle()
        }}
        testID={props.testID}
      />
      {isOpen && (
        <CalendarPopover
          selected={props.dateKey}
          min={props.min}
          max={props.max}
          monthKey={monthKey}
          onChangeMonth={setMonthKey}
          onConfirm={(next) => {
            props.onChange(next)
            close()
          }}
          anchor={anchor}
          onClose={close}
        />
      )}
    </View>
  )
}

/**
 * 고르기 카드. ID 표시 · 7칸 격자 · 혜택 한 줄 · 적용 시작일. 화면 위에서는 ID 표시를 칸에 담고, 모달에서는 바깥이 이미
 * 칸이라 칸 없이 둔다.
 *
 * @example <MvpPickCard account={account} grade={grade} onGrade={setGrade} start={startDate} ... />
 */
export function MvpPickCard(props: {
  account: MvpAskAccount
  grade: MvpGradeKey
  onGrade: (grade: MvpGradeKey) => void
  /** 적용 시작일. `null` 이면 그 줄이 안 선다(주간 확인에서 안 바꾼 ID) */
  start: string | null
  startLabel: string
  /** 고를 수 있는 가장 이른 날과 오늘 */
  floorDate: string
  today: string
  onStart: (dateKey: string) => void
  /** today 위 모달 안에 놓인다 */
  inModal?: boolean
}): React.JSX.Element {
  const { account } = props
  const tones = tonesOf(props.inModal)
  return (
    <View testID={`mvp-grade-card-${account.accountId}`} className={`gap-2.5 rounded-[14px] p-3 ${tones.card}`}>
      <View className={props.inModal === true ? 'px-0.5' : `rounded-[10px] px-2.5 py-2 ${tones.inner}`}>
        <Identity account={account} />
      </View>
      <MvpGradeGrid selected={props.grade} onSelect={props.onGrade} />
      <Text className="px-1 text-xs text-text-muted">{mvpBenefitText(props.grade)}</Text>
      {props.start !== null && (
        <StartDateRow
          testID={`mvp-grade-start-${account.accountId}`}
          label={props.startLabel}
          dateKey={props.start}
          min={props.floorDate}
          max={props.today}
          onChange={props.onStart}
        />
      )}
    </View>
  )
}

/** 확인 카드. 칸 없는 ID 표시 아래, 칸 하나에 라벨과 값 세 줄(등급 · 혜택 · 적용 시작일). */
export function MvpConfirmCard(props: {
  account: MvpAskAccount
  grade: MvpGradeKey
  /** 적용 시작일. `null` 이면 그 줄이 안 선다 */
  start: string | null
  startLabel: string
  /** today 위 모달 안에 놓인다 */
  inModal?: boolean
}): React.JSX.Element {
  const tones = tonesOf(props.inModal)
  return (
    <View testID={`mvp-grade-card-${props.account.accountId}`} className={`gap-3 rounded-[14px] p-3 ${tones.card}`}>
      <View className="px-0.5">
        <Identity account={props.account} />
      </View>
      <View className={`gap-2 rounded-[10px] px-3 py-2.5 ${tones.inner}`}>
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

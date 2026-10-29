/**
 * 설정 ID 이력 상세의 바텀시트 둘. 등급 변경 · 기록 고치기.
 *
 * 둘 다 머리가 제목과 시작일 고르개이고, 본문이 7칸 격자 · 혜택 한 줄 · 고른 날의 뜻 한 줄, 바닥이 `저장` 이다.
 * ID 표시가 없는 것은 이미 그 ID 의 페이지라서이고, 확인 단계가 없는 것은 저장하면 뒤의 타임라인이 결과를 보여서다.
 *
 * @see docs/features/mvp-grade.md 설정
 */
import { SheetActionButton } from '../../components/organisms/BottomSheet/SheetActionButton'
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { MvpGradeGrid } from '../../components/molecules/MvpGradeGrid/MvpGradeGrid'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { historyFloorDateKey } from '../../features/cashbook/range'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { monthKeyOf } from '../../lib/calendar'
import { mvpBenefitText, type MvpGradeKey } from '../../lib/mvp/grades'
import { editDateBounds, moveGradeEntry, setGradeFrom, type MvpGradeEntry } from '../../lib/mvp/history'

interface SheetBaseProps {
  history: MvpGradeEntry[]
  /** 오늘(KST `YYYY-MM-DD`) */
  todayDateKey: string
  /** 새 이력. 끝나면 시트가 닫힌다 */
  onSave: (history: MvpGradeEntry[]) => Promise<void>
  onClose: () => void
}

/** 시트 하나의 틀. 머리 오른쪽에 시작일 고르개가 선다. */
function GradeSheet(props: {
  title: string
  /** 머리의 시작일 고르개. 달력은 고르개가 스스로 연다 */
  dateSelect: React.ReactNode
  grade: MvpGradeKey
  onGrade: (grade: MvpGradeKey) => void
  description: string
  canSave: boolean
  onSave: () => Promise<void>
  onDelete?: () => void
  onClose: () => void
}): React.JSX.Element {
  const [saving, setSaving] = useState(false)
  const disabled = !props.canSave || saving

  async function save(): Promise<void> {
    setSaving(true)
    try {
      await props.onSave()
      props.onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      testId="mvp-grade-sheet"
      label={props.title}
      onClose={props.onClose}
      header={
        <View className="min-h-[26px] flex-row items-center justify-between gap-2">
          <Text className="shrink text-base font-bold text-text">{props.title}</Text>
          {props.dateSelect}
        </View>
      }
      footer={
        <>
          <SheetActionButton label="저장" disabled={disabled} onPress={() => void save()} />
          {props.onDelete !== undefined && (
            <Pressable role="button" aria-label="이 기록 지우기" onPress={props.onDelete} className="items-center py-2">
              <Text className="text-xs font-semibold text-error-ink">이 기록 지우기</Text>
            </Pressable>
          )}
        </>
      }
    >
      <View className="gap-3 px-4">
        <MvpGradeGrid selected={props.grade} onSelect={props.onGrade} />
        <Text className="text-xs text-text-muted">{mvpBenefitText(props.grade)}</Text>
        <Text className="text-xs text-text-muted">{props.description}</Text>
      </View>
    </BottomSheet>
  )
}

/** 시작일 알약. 누르면 날짜 달력이 열리고, `확인` 하면 닫힌다. */
function StartDateField(props: {
  dateKey: string
  min: string
  max: string
  onChange: (dateKey: string) => void
}): React.JSX.Element {
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(monthKeyOf(props.dateKey))

  return (
    <>
      <DateSelect
        ref={ref}
        dateKey={props.dateKey}
        label="시작일"
        onPress={() => {
          setMonthKey(monthKeyOf(props.dateKey))
          toggle()
        }}
        testID="mvp-grade-sheet-date"
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
    </>
  )
}

function currentGradeOf(history: readonly MvpGradeEntry[]): MvpGradeKey | null {
  return history[history.length - 1]?.grade ?? null
}

/**
 * 등급을 바꾸는 시트. 가장 이른 날부터 오늘까지 고르고, 같은 날이면 그 기록을 바꾼다. 지난 기간을 적는 것도 이 시트다.
 *
 * @example {changing && <GradeChangeSheet history={history} todayDateKey={today} onSave={save} onClose={close} />}
 */
export function GradeChangeSheet(props: SheetBaseProps): React.JSX.Element {
  const [date, setDate] = useState(props.todayDateKey)
  const [grade, setGrade] = useState<MvpGradeKey>(currentGradeOf(props.history) ?? 'normal')

  return (
    <GradeSheet
      title="등급 변경"
      dateSelect={
        <StartDateField
          dateKey={date}
          min={historyFloorDateKey(props.todayDateKey)}
          max={props.todayDateKey}
          onChange={setDate}
        />
      }
      grade={grade}
      onGrade={setGrade}
      description="선택한 날부터 새 등급으로 계산해요."
      canSave
      onSave={() => props.onSave(setGradeFrom(props.history, date, grade))}
      onClose={props.onClose}
    />
  )
}

/**
 * 이력 한 줄을 고치는 시트. 앞 기록 다음 날부터 다음 기록 전날까지 날을 옮기고 등급을 바꾼다.
 *
 * @example <GradeEditSheet history={history} startDate="2026-07-30" ... onDelete={askDelete} />
 */
export function GradeEditSheet(
  props: SheetBaseProps & {
    /** 고칠 줄의 시작일 */
    startDate: string
    onDelete: () => void
  },
): React.JSX.Element {
  const bounds = editDateBounds(props.history, props.startDate, historyFloorDateKey(props.todayDateKey), props.todayDateKey)
  const [date, setDate] = useState(props.startDate)
  const [grade, setGrade] = useState<MvpGradeKey>(
    props.history.find((entry) => entry.startDate === props.startDate)?.grade ?? 'normal',
  )

  return (
    <GradeSheet
      title="등급 기록 고치기"
      dateSelect={<StartDateField dateKey={date} min={bounds.min} max={bounds.max} onChange={setDate} />}
      grade={grade}
      onGrade={setGrade}
      description="이 날부터 다음 기록 전까지 이 등급으로 계산해요."
      canSave
      onSave={() => props.onSave(moveGradeEntry(props.history, props.startDate, date, grade))}
      onDelete={props.onDelete}
      onClose={props.onClose}
    />
  )
}

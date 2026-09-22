/**
 * 설정 ID 이력 상세의 바텀시트 셋. 등급 변경 · 기록 고치기 · 기록 추가.
 *
 * 셋 다 머리가 제목과 주 고르개이고, 본문이 7칸 격자 · 혜택 한 줄 · 고른 주의 뜻 한 줄, 바닥이 `저장` 이다.
 * ID 표시가 없는 것은 이미 그 ID 의 페이지라서이고, 확인 단계가 없는 것은 저장하면 뒤의 타임라인이 결과를 보여서다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { MvpGradeGrid } from '../../components/molecules/MvpGradeGrid/MvpGradeGrid'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import {
  WeekCalendarPopover,
  type WeekCalendarTab,
} from '../../components/organisms/WeekCalendarPopover/WeekCalendarPopover'
import { historyFloorDateKey } from '../../features/cashbook/range'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { formatMonthDay, monthKeyOf, resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { mvpBenefitText, type MvpGradeKey } from '../../lib/mvp/grades'
import {
  changeWeekMin,
  editWeekBounds,
  insertEndLimit,
  insertPeriod,
  insertPeriodText,
  insertStartSelectable,
  moveGradeEntry,
  setGradeFrom,
  type MvpGradeEntry,
} from '../../lib/mvp/history'

interface SheetBaseProps {
  history: MvpGradeEntry[]
  /** 오늘(KST `YYYY-MM-DD`) */
  todayDateKey: string
  /** 새 이력. 끝나면 시트가 닫힌다 */
  onSave: (history: MvpGradeEntry[]) => Promise<void>
  onClose: () => void
}

/** 시트 하나의 틀. 머리 오른쪽에 주 고르개가 선다. */
function GradeSheet(props: {
  title: string
  /** 머리의 주 고르개. 달력은 고르개가 스스로 연다 */
  weekSelect: React.ReactNode
  grade: MvpGradeKey | null
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
          {props.weekSelect}
        </View>
      }
      footer={
        <>
          <Pressable
            role="button"
            aria-label="저장"
            disabled={disabled}
            onPress={() => void save()}
            className={`items-center rounded-xl bg-primary py-3${disabled ? ' opacity-50' : ''}`}
          >
            <Text className="text-sm font-bold text-on-primary">저장</Text>
          </Pressable>
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
        {props.grade !== null && <Text className="text-xs text-text-muted">{mvpBenefitText(props.grade)}</Text>}
        <Text className="text-xs text-text-muted">{props.description}</Text>
      </View>
    </BottomSheet>
  )
}

/** 주 하나를 고르는 알약. 누르면 주 고르기 달력이 열리고, 고르면 닫힌다. */
function WeekSelectField(props: {
  week: string
  min: string
  max: string
  onChange: (week: string) => void
}): React.JSX.Element {
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(monthKeyOf(props.week))

  return (
    <>
      <DateSelect
        ref={ref}
        dateKey={props.week}
        label="시작 주"
        onPress={toggle}
        testID="mvp-grade-sheet-week"
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
    </>
  )
}

/**
 * 기간 알약. 달력 위 `시작 주 | 종료 주` 탭이 어느 끝을 고를지 정하고, 시작 주를 고르면 종료 주 탭으로 넘어간다.
 * 시작 주는 기록이 없는 지난 주, 종료 주는 시작 주부터 다음 기록의 앞 주까지다.
 */
function PeriodSelectField(props: {
  history: readonly MvpGradeEntry[]
  start: string | null
  end: string | null
  floorWeek: string
  thisWeek: string
  onChange: (start: string | null, end: string | null) => void
}): React.JSX.Element {
  const { history, start, end, floorWeek, thisWeek } = props
  const lastWeek = shiftDateKey(thisWeek, -7)
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [tab, setTab] = useState<WeekCalendarTab>('start')
  const [monthKey, setMonthKey] = useState(monthKeyOf(lastWeek))

  function select(week: string): void {
    if (tab === 'end') {
      props.onChange(start, week)
      close()
      return
    }
    // 새 시작 주로는 닿지 않는 종료 주는 버린다.
    const keepEnd = end !== null && end >= week && end <= insertEndLimit(history, week, thisWeek)
    props.onChange(week, keepEnd ? end : null)
    setTab('end')
  }

  const text =
    start === null
      ? '기간 선택'
      : end === null
        ? `${formatMonthDay(start)} ~`
        : `${formatMonthDay(start)} ~ ${formatMonthDay(shiftDateKey(end, 6))}`

  return (
    <>
      <DateSelect
        ref={ref}
        dateKey={lastWeek}
        label="기간"
        text={text}
        placeholder={start === null}
        onPress={toggle}
        testID="mvp-grade-sheet-week"
      />
      {isOpen && (
        <WeekCalendarPopover
          selection={{ start, end }}
          isSelectable={(week) =>
            tab === 'start'
              ? insertStartSelectable(history, week, floorWeek, thisWeek)
              : start !== null && week >= start && week <= insertEndLimit(history, start, thisWeek)
          }
          min={floorWeek}
          max={lastWeek}
          monthKey={monthKey}
          onChangeMonth={setMonthKey}
          onSelect={select}
          caption="선택한 기간"
          tabs={{
            active: tab,
            // 시작 주를 고르기 전에는 종료 주를 고를 기준이 없다.
            onChange: (next) => {
              if (next === 'end' && start === null) return
              setTab(next)
            },
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
 * 지금 등급을 바꾸는 시트. 지금 기록이 시작된 주부터 이번 주까지 고르고, 같은 주면 그 기록을 바꾼다.
 *
 * @example {changing && <GradeChangeSheet history={history} todayDateKey={today} onSave={save} onClose={close} />}
 */
export function GradeChangeSheet(props: SheetBaseProps): React.JSX.Element {
  const thisWeek = resetWeekStartOf(props.todayDateKey)
  const [week, setWeek] = useState(thisWeek)
  const [grade, setGrade] = useState<MvpGradeKey>(currentGradeOf(props.history) ?? 'normal')

  return (
    <GradeSheet
      title="등급 변경"
      weekSelect={
        <WeekSelectField
          week={week}
          min={changeWeekMin(props.history, historyFloorDateKey(props.todayDateKey))}
          max={thisWeek}
          onChange={setWeek}
        />
      }
      grade={grade}
      onGrade={setGrade}
      description="선택한 주부터 새 등급으로 계산해요."
      canSave
      onSave={() => props.onSave(setGradeFrom(props.history, week, grade))}
      onClose={props.onClose}
    />
  )
}

/**
 * 이력 한 줄을 고치는 시트. 앞뒤 기록 사이에서 주를 옮기고 등급을 바꾼다. 등급 없음 줄은 격자가 빈 채로 열린다.
 *
 * @example <GradeEditSheet history={history} startDate="2026-07-30" ... onDelete={askDelete} />
 */
export function GradeEditSheet(
  props: SheetBaseProps & {
    /** 고칠 줄의 시작 주 */
    startDate: string
    onDelete: () => void
  },
): React.JSX.Element {
  const bounds = editWeekBounds(
    props.history,
    props.startDate,
    historyFloorDateKey(props.todayDateKey),
    resetWeekStartOf(props.todayDateKey),
  )
  const [week, setWeek] = useState(props.startDate)
  const [grade, setGrade] = useState<MvpGradeKey | null>(
    props.history.find((entry) => entry.startDate === props.startDate)?.grade ?? null,
  )

  return (
    <GradeSheet
      title="등급 기록 고치기"
      weekSelect={<WeekSelectField week={week} min={bounds.min} max={bounds.max} onChange={setWeek} />}
      grade={grade}
      onGrade={setGrade}
      description="이 주부터 다음 기록 전까지 이 등급으로 계산해요."
      canSave
      onSave={() => props.onSave(moveGradeEntry(props.history, props.startDate, week, grade))}
      onDelete={props.onDelete}
      onClose={props.onClose}
    />
  )
}

/**
 * 지난 기간 하나를 끼워 넣는 시트. 시작 주와 종료 주를 고르고, 종료 주 다음 주부터는 감싸던 등급이 다시 이어진다.
 * 둘 다 고르기 전에는 저장이 꺼진다. 끼워 넣을 자리는 사용자만 알아서 앱이 기본값을 넣지 않는다.
 *
 * @example {inserting && <GradeInsertSheet history={history} todayDateKey={today} onSave={save} onClose={close} />}
 */
export function GradeInsertSheet(props: SheetBaseProps): React.JSX.Element {
  const [period, setPeriod] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const [grade, setGrade] = useState<MvpGradeKey>(currentGradeOf(props.history) ?? 'normal')
  const { start, end } = period

  return (
    <GradeSheet
      title="기록 추가"
      weekSelect={
        <PeriodSelectField
          history={props.history}
          start={start}
          end={end}
          floorWeek={historyFloorDateKey(props.todayDateKey)}
          thisWeek={resetWeekStartOf(props.todayDateKey)}
          onChange={(nextStart, nextEnd) => setPeriod({ start: nextStart, end: nextEnd })}
        />
      }
      grade={grade}
      onGrade={setGrade}
      description={
        start !== null && end !== null
          ? insertPeriodText(props.history, start, end, grade)
          : '시작 주와 종료 주를 골라 주세요. 지난주까지 고를 수 있어요.'
      }
      canSave={start !== null && end !== null}
      onSave={() => props.onSave(insertPeriod(props.history, start as string, end as string, grade))}
      onClose={props.onClose}
    />
  )
}

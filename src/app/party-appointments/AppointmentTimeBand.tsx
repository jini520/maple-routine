/**
 * 등록 시트 맨 위의 날짜 · 시작 · 종료 타일 셋. 상세의 알림 · 반복 타일과 같은 모양이다.
 *
 * 종료는 시각만 받고 시작보다 이르면 다음 날이다. 그때 날짜 칸이 `10/2 (금) ~ 10/3 (토)` 로 이틀을 적는다.
 * 반복 약속을 요일로 고를 때(`onChangeWeekday`)는 날짜 타일 대신 요일 타일이 서고 날짜를 어디에도 적지 않는다.
 *
 * 추가 · 수정에서는 바꿀 수 있는 값을 주황과 `⌄` 로 쓰고, 고르개가 열린 타일은 주황 바탕이다.
 * 읽기 모드는 검은 값에 `⌄` 가 없다. 그래야 두 화면이 갈린다.
 */
import { forwardRef, useState } from 'react'
import { Pressable, View } from 'react-native'

import { CalendarIcon, ClockIcon, FlagIcon, Text } from '../../components/atoms'
import { SelectChevron } from '../../components/organisms/SelectField/SelectField'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { TimePopover } from '../../components/organisms/TimePopover/TimePopover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { MINUTE_STEP, formatClock, weekdayOf } from '../../features/party-appointments/draft'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { WEEKDAY_LABELS, monthKeyOf, shiftDateKey } from '../../lib/calendar'
import { AppointmentWeekdayTile } from './AppointmentWeekdayTile'

/** 날짜 달력이 열어 두는 가장 먼 날. 약속은 길어야 몇 주 앞이다 */
const MAX_DAYS_AHEAD = 365

export interface AppointmentTimeBandProps {
  todayKey: string
  startDateKey: string
  startMinutes: number
  /** 시작보다 이르면 다음 날 */
  endMinutes: number
  /** 종료가 시작과 같다. 종료 값을 빨갛게 쓴다 */
  endInvalid: boolean
  onChangeStart: (dateKey: string, minutes: number) => void
  onChangeEnd: (minutes: number) => void
  /** 상세의 읽기 모드. 칸을 눌러도 고르개가 안 열린다 */
  readOnly?: boolean
  /** 지난 주 약속. 값을 흐리게 쓴다 */
  muted?: boolean
  /** 있으면 날짜 대신 요일을 고른다(반복 약속). 요일은 `startDateKey` 의 요일이다 */
  onChangeWeekday?: (weekday: number) => void
}

interface ValueTone {
  invalid: boolean
  muted: boolean
  readOnly: boolean
}

/** 값 글자색. 틀린 종료의 빨강과 지난 주의 흐림이 바꿀 수 있음의 주황보다 앞선다 */
function valueColor(tone: ValueTone): string {
  if (tone.invalid) return 'text-error-ink'
  if (tone.muted) return 'text-text-disabled'
  return tone.readOnly ? 'text-text' : 'text-primary-ink'
}

/** `10/3 (토)` */
function dayLabelOf(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`)
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()} (${WEEKDAY_LABELS[date.getUTCDay()]})`
}

/** 날짜 하나. `toDateKey` 가 있으면 `~ 그 날` 까지 같은 색으로 이어 적는다 */
function DateText(props: { dateKey: string; toDateKey?: string } & ValueTone): React.JSX.Element {
  const weekdayColor = props.invalid || props.muted || !props.readOnly ? valueColor(props) : 'text-text-muted'
  const day = (dateKey: string): React.JSX.Element => {
    const date = new Date(`${dateKey}T00:00:00Z`)
    return (
      <>
        {date.getUTCMonth() + 1}/{date.getUTCDate()}
        <Text className={`text-xs font-medium ${weekdayColor}`}> ({WEEKDAY_LABELS[date.getUTCDay()]})</Text>
      </>
    )
  }
  return (
    <Text className={`text-sm font-bold ${valueColor(props)}`} style={TABULAR_NUMS}>
      {day(props.dateKey)}
      {props.toDateKey !== undefined && (
        <>
          {' ~ '}
          {day(props.toDateKey)}
        </>
      )}
    </Text>
  )
}

interface TileProps extends ValueTone {
  label: string
  /** 읽어 주는 이름(`시작 시각 고르기`) */
  name: string
  icon: typeof CalendarIcon
  isOpen: boolean
  onPress: () => void
  children: React.ReactNode
}

/** 타일 하나. 팝오버가 이 타일을 재서 아래에 앉는다 */
const Tile = forwardRef<View, TileProps>(function Tile(props, ref) {
  const Icon = props.icon
  return (
    <Pressable
      ref={ref}
      role="button"
      aria-label={props.name}
      aria-expanded={props.readOnly ? undefined : props.isOpen}
      disabled={props.readOnly}
      onPress={props.onPress}
      className={`flex-1 flex-row items-center gap-2.5 rounded-xl px-3 py-2.5 active:opacity-60 ${props.isOpen ? 'bg-primary-tint' : 'bg-surface'}`}
    >
      <View
        className={`h-[30px] w-[30px] items-center justify-center rounded-full ${props.muted ? 'bg-surface-2' : 'bg-primary-tint'}`}
      >
        <Icon
          className={`h-[15px] w-[15px] ${props.muted ? 'text-text-disabled' : 'text-primary-ink'}`}
          strokeWidth={2}
          aria-hidden
        />
      </View>
      <View className="shrink">
        <Text className="text-11 text-text-muted">{props.label}</Text>
        <View className="flex-row items-center gap-0.5">
          {props.children}
          {!props.readOnly && <SelectChevron open={props.isOpen} className={valueColor(props)} />}
        </View>
      </View>
    </Pressable>
  )
})

export function AppointmentTimeBand(props: AppointmentTimeBandProps): React.JSX.Element {
  const { ref: sdRef, isOpen: sdOpen, anchor: sdAnchor, toggle: sdToggle, close: sdClose } =
    useAnchoredPopover()
  const { ref: stRef, isOpen: stOpen, anchor: stAnchor, toggle: stToggle, close: stClose } =
    useAnchoredPopover()
  const { ref: etRef, isOpen: etOpen, anchor: etAnchor, toggle: etToggle, close: etClose } =
    useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(props.startDateKey))
  const maxDateKey = shiftDateKey(props.todayKey, MAX_DAYS_AHEAD)
  const nextDateKey = shiftDateKey(props.startDateKey, 1)
  const endsNextDay = props.endMinutes < props.startMinutes
  const startHour = Math.floor(props.startMinutes / 60)
  const byWeekday = props.onChangeWeekday !== undefined
  const weekday = weekdayOf(props.startDateKey)
  // 요일로 고를 때는 종료 휠의 날짜 열도 날짜 대신 요일을 적는다.
  const endDayLabels = byWeekday
    ? { today: `${WEEKDAY_LABELS[weekday]}요일`, next: `${WEEKDAY_LABELS[(weekday + 1) % 7]}요일` }
    : { today: dayLabelOf(props.startDateKey), next: dayLabelOf(nextDateKey) }

  // 종료 휠은 시작 시부터 선다. 그 시의 시작 이하 분은 같은 시각이거나 하루 가까이 뒤라 막는다.
  const endTimeDisabled = (minutes: number): boolean =>
    Math.floor(minutes / 60) === startHour && minutes <= props.startMinutes

  const readOnly = props.readOnly === true
  const muted = props.muted === true
  const startTone: ValueTone = { invalid: false, muted, readOnly }
  const endTone: ValueTone = { invalid: props.endInvalid, muted, readOnly }

  return (
    <View className="gap-2 px-4">
      {/* 타일이 가로로 늘어나는 \`flex-1\` 이라 세로 줄에 바로 두면 높이가 0 으로 접힌다. */}
      <View className="flex-row">
        {props.onChangeWeekday !== undefined ? (
          <AppointmentWeekdayTile weekday={weekday} endsNextDay={endsNextDay} onChange={props.onChangeWeekday} />
        ) : (
          <Tile
            ref={sdRef}
            {...startTone}
            label="날짜"
            name="날짜 고르기"
            icon={CalendarIcon}
            isOpen={sdOpen}
            onPress={() => {
              setMonthKey(monthKeyOf(props.startDateKey))
              sdToggle()
            }}
          >
            <DateText dateKey={props.startDateKey} toDateKey={endsNextDay ? nextDateKey : undefined} {...startTone} />
          </Tile>
        )}
      </View>
      <View className="flex-row gap-2">
        <Tile
          ref={stRef}
          {...startTone}
          label="시작"
          name="시작 시각 고르기"
          icon={ClockIcon}
          isOpen={stOpen}
          onPress={stToggle}
        >
          <Text className={`text-sm font-bold ${valueColor(startTone)}`} style={TABULAR_NUMS}>
            {formatClock(props.startMinutes)}
          </Text>
        </Tile>
        <Tile
          ref={etRef}
          {...endTone}
          label="종료"
          name="종료 시각 고르기"
          icon={FlagIcon}
          isOpen={etOpen}
          onPress={etToggle}
        >
          <Text className={`text-sm font-bold ${valueColor(endTone)}`} style={TABULAR_NUMS}>
            {formatClock(props.endMinutes)}
          </Text>
        </Tile>
      </View>

      {sdOpen && (
        <CalendarPopover
          selected={props.startDateKey}
          min={props.todayKey}
          max={maxDateKey}
          monthKey={monthKey}
          anchor={sdAnchor}
          onChangeMonth={setMonthKey}
          onConfirm={(dateKey) => {
            props.onChangeStart(dateKey, props.startMinutes)
            sdClose()
          }}
          onClose={sdClose}
        />
      )}
      {stOpen && (
        <TimePopover
          minutes={props.startMinutes}
          step={MINUTE_STEP}
          anchor={stAnchor}
          onConfirm={(minutes) => {
            props.onChangeStart(props.startDateKey, minutes)
            stClose()
          }}
          onClose={stClose}
        />
      )}
      {etOpen && (
        <TimePopover
          minutes={props.endMinutes}
          step={MINUTE_STEP}
          firstHour={startHour}
          dayLabels={endDayLabels}
          isDisabled={endTimeDisabled}
          anchor={etAnchor}
          onConfirm={(minutes) => {
            props.onChangeEnd(minutes)
            etClose()
          }}
          onClose={etClose}
        />
      )}
    </View>
  )
}

/**
 * 등록 시트 맨 위의 시작 · 종료 타일 넷(2 × 2). 상세의 알림 · 반복 타일과 같은 모양이다.
 *
 * 추가 · 수정에서는 바꿀 수 있는 값을 주황과 `⌄` 로 쓰고, 고르개가 열린 타일은 주황 바탕이다.
 * 읽기 모드는 검은 값에 `⌄` 가 없다. 그래야 두 화면이 갈린다.
 */
import { forwardRef, useState } from 'react'
import { Pressable, View } from 'react-native'

import { CalendarIcon, ClockIcon, Text } from '../../components/atoms'
import { SelectChevron } from '../../components/organisms/SelectField/SelectField'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { TimePopover } from '../../components/organisms/TimePopover/TimePopover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { MINUTE_STEP, formatClock } from '../../features/party-appointments/draft'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { WEEKDAY_LABELS, monthKeyOf, shiftDateKey } from '../../lib/calendar'

/** 날짜 달력이 열어 두는 가장 먼 날. 약속은 길어야 몇 주 앞이다 */
const MAX_DAYS_AHEAD = 365

export interface AppointmentTimeBandProps {
  todayKey: string
  startDateKey: string
  startMinutes: number
  endDateKey: string
  endMinutes: number
  /** 종료가 시작보다 이르거나 같다. 종료 값을 빨갛게 쓴다 */
  endInvalid: boolean
  onChangeStart: (dateKey: string, minutes: number) => void
  onChangeEnd: (dateKey: string, minutes: number) => void
  /** 상세의 읽기 모드. 칸을 눌러도 고르개가 안 열린다 */
  readOnly?: boolean
  /** 지난 주 약속. 값을 흐리게 쓴다 */
  muted?: boolean
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

function DateText(props: { dateKey: string } & ValueTone): React.JSX.Element {
  const date = new Date(`${props.dateKey}T00:00:00Z`)
  const weekdayColor = props.invalid || props.muted || !props.readOnly ? valueColor(props) : 'text-text-muted'
  return (
    <Text className={`text-sm font-bold ${valueColor(props)}`} style={TABULAR_NUMS}>
      {date.getUTCMonth() + 1}/{date.getUTCDate()}
      <Text className={`text-xs font-medium ${weekdayColor}`}> ({WEEKDAY_LABELS[date.getUTCDay()]})</Text>
    </Text>
  )
}

interface TileProps extends ValueTone {
  label: string
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
      aria-label={`${props.label} 고르기`}
      aria-expanded={props.readOnly ? undefined : props.isOpen}
      disabled={props.readOnly}
      onPress={props.onPress}
      className={`flex-1 flex-row items-center gap-2.5 rounded-xl px-3 py-2.5 active:opacity-60 ${props.isOpen ? 'bg-primary-tint' : 'bg-card-body'}`}
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
  const { ref: edRef, isOpen: edOpen, anchor: edAnchor, toggle: edToggle, close: edClose } =
    useAnchoredPopover()
  const { ref: etRef, isOpen: etOpen, anchor: etAnchor, toggle: etToggle, close: etClose } =
    useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(props.startDateKey))
  const maxDateKey = shiftDateKey(props.todayKey, MAX_DAYS_AHEAD)

  function openDate(toggle: () => void, dateKey: string): void {
    setMonthKey(monthKeyOf(dateKey))
    toggle()
  }

  // 종료가 시작과 같은 날이면 시작 이하의 시각을 막는다. 다음 날 이후면 막을 것이 없다.
  const endTimeDisabled = (minutes: number): boolean =>
    props.endDateKey < props.startDateKey ||
    (props.endDateKey === props.startDateKey && minutes <= props.startMinutes)

  const readOnly = props.readOnly === true
  const muted = props.muted === true
  const startTone: ValueTone = { invalid: false, muted, readOnly }
  const endTone: ValueTone = { invalid: props.endInvalid, muted, readOnly }

  return (
    <View className="gap-2 px-4">
      <View className="flex-row gap-2">
        <Tile
          ref={sdRef}
          {...startTone}
          label="시작 날짜"
          icon={CalendarIcon}
          isOpen={sdOpen}
          onPress={() => openDate(sdToggle, props.startDateKey)}
        >
          <DateText dateKey={props.startDateKey} {...startTone} />
        </Tile>
        <Tile ref={stRef} {...startTone} label="시작 시각" icon={ClockIcon} isOpen={stOpen} onPress={stToggle}>
          <Text className={`text-sm font-bold ${valueColor(startTone)}`} style={TABULAR_NUMS}>
            {formatClock(props.startMinutes)}
          </Text>
        </Tile>
      </View>
      <View className="flex-row gap-2">
        <Tile
          ref={edRef}
          {...endTone}
          label="종료 날짜"
          icon={CalendarIcon}
          isOpen={edOpen}
          onPress={() => openDate(edToggle, props.endDateKey)}
        >
          <DateText dateKey={props.endDateKey} {...endTone} />
        </Tile>
        <Tile ref={etRef} {...endTone} label="종료 시각" icon={ClockIcon} isOpen={etOpen} onPress={etToggle}>
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
      {edOpen && (
        <CalendarPopover
          selected={props.endDateKey}
          min={props.startDateKey}
          max={maxDateKey}
          monthKey={monthKey}
          anchor={edAnchor}
          onChangeMonth={setMonthKey}
          onConfirm={(dateKey) => {
            props.onChangeEnd(dateKey, props.endMinutes)
            edClose()
          }}
          onClose={edClose}
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
          isDisabled={endTimeDisabled}
          anchor={etAnchor}
          onConfirm={(minutes) => {
            props.onChangeEnd(props.endDateKey, minutes)
            etClose()
          }}
          onClose={etClose}
        />
      )}
    </View>
  )
}

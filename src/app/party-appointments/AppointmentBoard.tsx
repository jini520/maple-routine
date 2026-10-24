/**
 * 파티 스케줄의 보드 보기. 요일 일곱 열(목 → 수)을 가로로 넘긴다.
 *
 * 열 폭은 260 이다. 일곱 열을 한 화면에 넣으면 세로 간트처럼 글자가 안 읽히고, 260 이면 두 열 가까이 보여 이웃한 날과 견줄 수 있다.
 * 이번 주면 오늘 열이 왼쪽에 오고 앞 열이 조금 비쳐 왼쪽에도 열이 있다는 것을 보인다.
 *
 * 열 머리 아래 얇은 줄은 목록 보기 시간표와 같은 0 ~ 24시 줄이다. 카드는 목록 보기와 같은 `OccurrenceCard` 다.
 */
import { ScrollView, View } from 'react-native'

import { CalendarClockIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { TimelineDay, TimelineTone } from '../../features/party-appointments/timeline'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { OccurrenceCard } from './OccurrenceCard'

export interface AppointmentBoardProps {
  /** 보는 주의 일곱 줄(목 → 수). 카드는 시작한 날 열에만 선다 */
  days: readonly TimelineDay[]
  todayKey: string
  /** 보는 주의 이름(`이번 주` · `9월 1주차`). 빈 상태 제목에 쓴다 */
  weekLabel: string
  nowMs: number
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  onPressOccurrence: (occurrence: PartyAppointmentOccurrence) => void
}

const LANE_WIDTH = 260
const LANE_GAP = 8
const SIDE_PADDING = 16
/** 오늘 열로 열 때 앞 열이 비치는 폭 */
const LEFT_PEEK = 20

const STRIP_TONE_CLASS: Record<TimelineTone, string> = {
  next: 'bg-primary',
  normal: 'bg-border-strong',
  ended: 'bg-border-strong opacity-50',
}

function percent(fraction: number): `${number}%` {
  return `${fraction * 100}%`
}

/** 그 날 시작한 회차. 자정을 넘어 이어진 부분은 막대로만 서고 카드는 시작한 날에만 있다 */
function startedOn(day: TimelineDay): PartyAppointmentOccurrence[] {
  return day.segments.filter((segment) => segment.occurrence.dateKey === day.dateKey).map((segment) => segment.occurrence)
}

function LaneStrip(props: { day: TimelineDay }): React.JSX.Element {
  return (
    <View className="relative mx-1.5 mb-0.5 h-3 rounded bg-control-track">
      {props.day.segments.map((segment) => (
        <View
          key={`${segment.key}:${segment.from}`}
          testID="board-strip-bar"
          // 30분짜리 회차는 260 폭에서 5px 남짓이다. 그보다 짧아도 보이게 바닥 폭을 둔다.
          style={{ left: percent(segment.from), width: percent(segment.to - segment.from), minWidth: 3 }}
          className={`absolute bottom-0.5 top-0.5 rounded-sm ${STRIP_TONE_CLASS[segment.tone]}`}
        />
      ))}
      {props.day.nowAt !== null && (
        <View
          testID="board-strip-now"
          style={{ left: percent(props.day.nowAt) }}
          className="absolute -bottom-0.5 -top-0.5 -ml-px w-0.5 rounded-full bg-primary"
        />
      )}
    </View>
  )
}

function Lane(props: AppointmentBoardProps & { day: TimelineDay }): React.JSX.Element {
  const { day } = props
  const today = day.dateKey === props.todayKey
  const occurrences = startedOn(day)
  const date = new Date(`${day.dateKey}T00:00:00Z`)
  return (
    <View
      testID="board-lane"
      style={{ width: LANE_WIDTH }}
      className={`gap-1.5 rounded-2xl p-1.5 ${today ? 'bg-primary-tint' : 'bg-control-track'}`}
    >
      <View className="flex-row items-center gap-1 px-1.5 pb-0.5 pt-1">
        <Text className="text-sm font-bold text-text">{WEEKDAY_LABELS[date.getUTCDay()]}</Text>
        <Text className="text-13 text-text-muted" style={TABULAR_NUMS}>
          {date.getUTCMonth() + 1}/{date.getUTCDate()}
        </Text>
        {today && (
          <View className="ml-0.5 rounded-full bg-primary px-1.5">
            <Text className="text-10 font-bold text-on-primary">오늘</Text>
          </View>
        )}
        {occurrences.length > 0 && (
          <Text className="ml-auto text-11 text-text-muted" style={TABULAR_NUMS}>
            {occurrences.length}개
          </Text>
        )}
      </View>
      <LaneStrip day={day} />
      {occurrences.length === 0 ? (
        <Text className="py-5 text-center text-xs text-text-muted">스케줄 없음</Text>
      ) : (
        occurrences.map((occurrence) => (
          <OccurrenceCard
            key={`${occurrence.appointment.id}:${occurrence.dateKey}`}
            occurrence={occurrence}
            names={props.names}
            nowMs={props.nowMs}
            todayKey={props.todayKey}
            onPress={() => props.onPressOccurrence(occurrence)}
          />
        ))
      )}
    </View>
  )
}

export function AppointmentBoard(props: AppointmentBoardProps): React.JSX.Element {
  if (props.days.every((day) => startedOn(day).length === 0)) {
    return (
      <View className="px-4">
        <EmptyState
          icon={CalendarClockIcon}
          title={`${props.weekLabel} 파티 스케줄이 없어요`}
          // 버튼이 없다. ＋ 가 같은 화면에 있다.
          description="파티 보스 스케줄을 적어 두면 시작 전에 알려 드려요"
        />
      </View>
    )
  }
  const todayIndex = props.days.findIndex((day) => day.dateKey === props.todayKey)
  const startX = todayIndex <= 0 ? 0 : todayIndex * (LANE_WIDTH + LANE_GAP) - LEFT_PEEK
  return (
    <ScrollView
      // 주를 옮기면 새로 세워 그 주의 처음 자리(오늘 열 또는 목요일)에서 연다. `contentOffset` 은 처음에만 읽힌다.
      key={props.days[0]?.dateKey}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: startX, y: 0 }}
      contentContainerStyle={{ paddingHorizontal: SIDE_PADDING, gap: LANE_GAP, alignItems: 'flex-start' }}
    >
      {props.days.map((day) => (
        <Lane key={day.dateKey} {...props} day={day} />
      ))}
    </ScrollView>
  )
}

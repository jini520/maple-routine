/**
 * 목록 보기의 요일별 목록. 스케줄이 있는 날만 요일 머리를 세우고 그 아래에 회차 카드를 시작 순으로 쌓는다.
 *
 * 카드는 보드 보기와 같은 `OccurrenceCard` 다. 시간표 막대를 누르면 화면이 그 카드로 스크롤하도록, 카드마다 이 목록 안의
 * 세로 자리를 알려 준다. 그 주에 스케줄이 없으면 빈 상태를 둔다.
 */
import { useRef } from 'react'
import { View } from 'react-native'

import { CalendarClockIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { AgendaDay } from '../../features/party-appointments/agenda'
import { occurrenceKeyOf } from '../../features/party-appointments/timeline'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { OccurrenceCard } from './OccurrenceCard'

export interface AppointmentAgendaProps {
  days: AgendaDay[]
  todayKey: string
  /** 보는 주의 이름(`이번 주` · `9월 1주차`). 빈 상태 제목에 쓴다 */
  weekLabel: string
  /** 끝난 약속을 흐리게 가르는 지금 */
  nowMs: number
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  /** 시간표 막대를 눌러 온 회차. 그 카드만 잠깐 강조한다 */
  highlightedKey?: string | null
  /** 카드의 세로 자리(이 목록 맨 위부터). 막대를 누르면 화면이 이 자리로 스크롤한다 */
  onMeasureCard?: (key: string, y: number) => void
  onPressOccurrence: (occurrence: PartyAppointmentOccurrence) => void
}

function DayHeader(props: { dateKey: string; today: boolean }): React.JSX.Element {
  const date = new Date(`${props.dateKey}T00:00:00Z`)
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-sm font-bold text-text">{WEEKDAY_LABELS[date.getUTCDay()]}</Text>
      <Text className="text-13 text-text-muted" style={TABULAR_NUMS}>
        {date.getUTCMonth() + 1}/{date.getUTCDate()}
      </Text>
      {props.today && (
        <View className="ml-0.5 rounded-full bg-primary px-1.5">
          <Text className="text-10 font-bold text-on-primary">오늘</Text>
        </View>
      )}
    </View>
  )
}

export function AppointmentAgenda(props: AppointmentAgendaProps): React.JSX.Element {
  // 카드의 `onLayout` 은 자기 날 상자 안의 자리라, 날 상자의 자리를 더해야 목록 안의 자리가 된다. 어느 쪽이 먼저 올지 몰라 둘 다 든다.
  const dayY = useRef(new Map<string, number>())
  const cardY = useRef(new Map<string, { dateKey: string; y: number }>())

  function report(key: string): void {
    const card = cardY.current.get(key)
    const day = card === undefined ? undefined : dayY.current.get(card.dateKey)
    if (card !== undefined && day !== undefined) props.onMeasureCard?.(key, day + card.y)
  }

  if (props.days.length === 0) {
    return (
      <EmptyState
        icon={CalendarClockIcon}
        title={`${props.weekLabel} 파티 스케줄이 없어요`}
        // 버튼이 없다. ＋ 가 같은 화면에 있다.
        description="파티 보스 스케줄을 적어 두면 시작 전에 알려 드려요"
      />
    )
  }
  return (
    <View className="gap-4">
      {props.days.map((day) => (
        <View
          key={day.dateKey}
          className="gap-2"
          onLayout={(event) => {
            dayY.current.set(day.dateKey, event.nativeEvent.layout.y)
            day.occurrences.forEach((occurrence) => report(occurrenceKeyOf(occurrence)))
          }}
        >
          <DayHeader dateKey={day.dateKey} today={day.dateKey === props.todayKey} />
          {day.occurrences.map((occurrence) => {
            const key = occurrenceKeyOf(occurrence)
            return (
              <View
                key={key}
                onLayout={(event) => {
                  cardY.current.set(key, { dateKey: day.dateKey, y: event.nativeEvent.layout.y })
                  report(key)
                }}
              >
                <OccurrenceCard
                  occurrence={occurrence}
                  names={props.names}
                  nowMs={props.nowMs}
                  todayKey={props.todayKey}
                  highlighted={props.highlightedKey === key}
                  onPress={() => props.onPressOccurrence(occurrence)}
                />
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

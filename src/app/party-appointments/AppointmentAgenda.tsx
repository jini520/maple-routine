/**
 * 파티 약속 보드의 요일별 목록. 약속이 있는 날만 요일 머리를 세우고 그 아래에 약속을 시작 순으로 쌓는다.
 *
 * 약속 하나는 카드 위 시각 한 줄과 그 아래 보스 카드다. 카드 안의 보스는 캐릭터별로 묶고, 캐릭터 얼굴 · 이름은 묶음 왼쪽 열에 한 번만 적는다.
 * 그 주에 약속이 없으면 빈 상태를 둔다.
 */
import { Pressable, View } from 'react-native'

import { CalendarClockIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { endClockOf, type AgendaDay } from '../../features/party-appointments/agenda'
import { groupBossesByCharacter } from '../../features/party-appointments/boss-groups'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { OccurrenceBossGroups } from './OccurrenceBossGroups'

export interface AppointmentAgendaProps {
  days: AgendaDay[]
  todayKey: string
  /** 보는 주의 이름(`이번 주` · `9월 1주차`). 빈 상태 제목에 쓴다 */
  weekLabel: string
  /** 끝난 약속을 흐리게 가르는 지금 */
  nowMs: number
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  /** 캐릭터 `ocid → 얼굴 그림 URL` */
  faces: ReadonlyMap<string, string | null>
  onPressOccurrence: (occurrence: PartyAppointmentOccurrence) => void
}

function OccurrenceRow(props: {
  occurrence: PartyAppointmentOccurrence
  nowMs: number
  names: ReadonlyMap<string, string>
  faces: ReadonlyMap<string, string | null>
  onPress: () => void
}): React.JSX.Element {
  const { occurrence } = props
  const ended = occurrence.endsAt.getTime() <= props.nowMs
  const repeats = occurrence.appointment.schedule.type === 'weekly'
  return (
    <Pressable
      role="button"
      aria-label={`${occurrence.timeKst} 스케줄 상세`}
      onPress={props.onPress}
      className={`gap-1 active:opacity-60 ${ended ? 'opacity-50' : ''}`}
    >
      {/* 시각은 카드 위 한 줄이다. 카드가 화면 폭을 다 써 보스 이름이 덜 잘린다. */}
      <View className="flex-row items-baseline px-0.5">
        <Text className="text-15 font-bold text-text" style={TABULAR_NUMS}>
          {occurrence.timeKst}
        </Text>
        <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
          {` ~ ${endClockOf(occurrence)}`}
        </Text>
      </View>
      <View className="gap-2.5 rounded-[14px] bg-surface px-3 py-2.5">
        <OccurrenceBossGroups
          groups={groupBossesByCharacter(occurrence.bosses).map((group) => ({
            ...group,
            name: props.names.get(group.ocid) ?? '',
            imageUrl: props.faces.get(group.ocid) ?? null,
          }))}
          leadMinutes={occurrence.leadMinutes}
          repeats={repeats}
        />
      </View>
    </Pressable>
  )
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
        <View key={day.dateKey} className="gap-2">
          <DayHeader dateKey={day.dateKey} today={day.dateKey === props.todayKey} />
          {day.occurrences.map((occurrence) => (
            <OccurrenceRow
              key={`${occurrence.appointment.id}:${occurrence.dateKey}`}
              occurrence={occurrence}
              nowMs={props.nowMs}
              names={props.names}
              faces={props.faces}
              onPress={() => props.onPressOccurrence(occurrence)}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

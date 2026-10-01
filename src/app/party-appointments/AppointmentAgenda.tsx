/**
 * 파티 약속 보드의 요일별 목록. 약속이 있는 날만 요일 머리를 세우고 그 아래에 약속을 시작 순으로 쌓는다.
 *
 * 약속 한 줄은 왼쪽 시각 열과 오른쪽 보스 줄 카드다. 그 주에 약속이 없으면 빈 상태를 둔다.
 */
import { Pressable, View } from 'react-native'

import { Badge, BellIcon, CalendarClockIcon, RepeatIcon, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { endClockOf, type AgendaDay } from '../../features/party-appointments/agenda'
import { formatLead } from '../../features/party-appointments/draft'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss, PartyAppointmentOccurrence } from '../../types/party-appointment'

export interface AppointmentAgendaProps {
  days: AgendaDay[]
  todayKey: string
  /** 보는 주의 이름(`이번 주` · `9월 1주차`). 빈 상태 제목에 쓴다 */
  weekLabel: string
  /** 끝난 약속을 흐리게 가르는 지금 */
  nowMs: number
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  colorOf: (ocid: string) => string
  onPressOccurrence: (occurrence: PartyAppointmentOccurrence) => void
  onAdd: () => void
}

function BossLine(props: {
  boss: PartyAppointmentBoss
  names: ReadonlyMap<string, string>
  colorOf: (ocid: string) => string
}): React.JSX.Element {
  const { boss } = props
  const name = bossAliasOf(boss.bossKey, boss.bossKey)
  return (
    <View className="min-h-[34px] flex-row items-center gap-2">
      <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={28} />
      <Text className="shrink text-13 font-semibold text-text" numberOfLines={1}>
        {name}
      </Text>
      <Badge variant={boss.difficulty as BossDifficulty} size="mini">
        {DIFFICULTY_NAME[boss.difficulty as BossDifficulty] ?? boss.difficulty}
      </Badge>
      <View className="ml-auto flex-row items-center gap-1">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: props.colorOf(boss.ocid) }} />
        <Text className="text-11 text-text-muted" numberOfLines={1}>
          {props.names.get(boss.ocid) ?? ''}
        </Text>
      </View>
    </View>
  )
}

function OccurrenceRow(props: {
  occurrence: PartyAppointmentOccurrence
  nowMs: number
  names: ReadonlyMap<string, string>
  colorOf: (ocid: string) => string
  onPress: () => void
}): React.JSX.Element {
  const { occurrence } = props
  const ended = occurrence.endsAt.getTime() <= props.nowMs
  const repeats = occurrence.appointment.schedule.type === 'weekly'
  const hasAlarm = occurrence.leadMinutes !== null
  return (
    <Pressable
      role="button"
      aria-label={`${occurrence.timeKst} 약속 상세`}
      onPress={props.onPress}
      className={`flex-row gap-2.5 active:opacity-60 ${ended ? 'opacity-50' : ''}`}
    >
      <View className="w-12 pt-1.5">
        <Text className="text-sm font-bold text-text" style={TABULAR_NUMS} numberOfLines={1}>
          {occurrence.timeKst}
        </Text>
        <Text className="text-11 text-text-muted" style={TABULAR_NUMS} numberOfLines={1}>
          ~{endClockOf(occurrence)}
        </Text>
      </View>
      <View className="flex-1 rounded-[14px] bg-surface px-3 pb-2 pt-1.5">
        {occurrence.bosses.map((boss) => (
          <BossLine key={`${boss.ocid}:${boss.bossKey}`} boss={boss} names={props.names} colorOf={props.colorOf} />
        ))}
        {(hasAlarm || repeats) && (
          <View className="flex-row gap-2.5 pt-0.5">
            {hasAlarm && (
              <View className="flex-row items-center gap-1">
                <BellIcon className="h-3 w-3 text-primary-ink" strokeWidth={2.2} aria-hidden />
                <Text className="text-11 text-primary-ink">{formatLead(occurrence.leadMinutes ?? 0)}</Text>
              </View>
            )}
            {repeats && (
              <View className="flex-row items-center gap-1">
                <RepeatIcon className="h-3 w-3 text-text-muted" strokeWidth={2.2} aria-hidden />
                <Text className="text-11 text-text-muted">매주</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  )
}

function DayHeader(props: { dateKey: string; today: boolean }): React.JSX.Element {
  const date = new Date(`${props.dateKey}T00:00:00Z`)
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-13 font-bold text-text">{WEEKDAY_LABELS[date.getUTCDay()]}</Text>
      <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
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
        title={`${props.weekLabel} 약속이 없어요`}
        description="파티 보스 약속을 적어 두면 시작 전에 알려 드려요"
        action={{ label: '약속 추가', onClick: props.onAdd }}
      />
    )
  }
  return (
    <View className="gap-3">
      {props.days.map((day) => (
        <View key={day.dateKey} className="gap-1.5">
          <DayHeader dateKey={day.dateKey} today={day.dateKey === props.todayKey} />
          {day.occurrences.map((occurrence) => (
            <OccurrenceRow
              key={`${occurrence.appointment.id}:${occurrence.dateKey}`}
              occurrence={occurrence}
              nowMs={props.nowMs}
              names={props.names}
              colorOf={props.colorOf}
              onPress={() => props.onPressOccurrence(occurrence)}
            />
          ))}
        </View>
      ))}
    </View>
  )
}

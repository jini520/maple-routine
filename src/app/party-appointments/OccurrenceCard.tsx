/**
 * 회차 카드. 목록 보기와 보드 보기가 함께 쓴다. today 의 다음 파티 스케줄 위젯과 같은 모양이다.
 *
 * 맨 위 줄이 시각이고, 오늘 아직 시작 전이면 남은 시간을 붙인다. 그 아래에 캐릭터마다 `card-inset` 칸 하나를 두고 칸 머리에
 * 닉네임만 적는다. 초상화를 곁들인 좁은 열에 두면 네 글자가 넘는 닉네임이 잘린다. 메모는 맨 아래에 두 줄까지다.
 */
import { Pressable, View } from 'react-native'

import { StickyNoteIcon, Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { endClockOf, remainingLabelOf } from '../../features/party-appointments/agenda'
import { groupBossesByCharacter } from '../../features/party-appointments/boss-groups'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'
import { OccurrenceBossLine, OccurrenceExtras } from './OccurrenceBossGroups'

export interface OccurrenceCardProps {
  occurrence: PartyAppointmentOccurrence
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  /** 끝난 회차를 흐리게 가르고 남은 시간을 재는 지금 */
  nowMs: number
  todayKey: string
  /** 시간표 막대를 눌러 이 카드로 왔을 때 잠깐 켠다 */
  highlighted?: boolean
  onPress: () => void
}

export function OccurrenceCard(props: OccurrenceCardProps): React.JSX.Element {
  const { occurrence } = props
  const startsAtMs = occurrence.startsAt.getTime()
  const ended = occurrence.endsAt.getTime() <= props.nowMs
  const upcomingToday = occurrence.dateKey === props.todayKey && startsAtMs > props.nowMs
  const memo = occurrence.appointment.memo
  return (
    <Pressable
      testID="occurrence-card"
      role="button"
      aria-label={`${occurrence.timeKst} 스케줄 상세`}
      onPress={props.onPress}
      // 누르는 동안 흐리게 하지 않는다. 카드 하나가 통째로 흐려지면 다른 카드와 따로 논다.
      className={`gap-2 rounded-[14px] p-3 ${props.highlighted === true ? 'bg-primary-tint' : 'bg-surface'} ${
        ended ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-row flex-wrap items-baseline">
        <Text className="text-15 font-bold text-text" style={TABULAR_NUMS}>
          {occurrence.timeKst}
        </Text>
        <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
          {` ~ ${endClockOf(occurrence)} `}
        </Text>
        {upcomingToday && (
          <Text className="text-11 font-bold text-primary-ink" style={TABULAR_NUMS}>
            {remainingLabelOf(startsAtMs - props.nowMs)}
          </Text>
        )}
      </View>
      <View className="gap-1.5">
        {groupBossesByCharacter(occurrence.bosses).map((group) => (
          <View key={group.ocid} testID="occurrence-card-group" className="rounded-[10px] bg-card-inset px-2.5 py-2">
            <Text numberOfLines={1} className="text-xs font-semibold text-text-muted">
              {props.names.get(group.ocid) ?? ''}
            </Text>
            {group.bosses.map((boss) => (
              <OccurrenceBossLine key={`${boss.ocid}:${boss.bossKey}`} boss={boss} />
            ))}
          </View>
        ))}
      </View>
      <OccurrenceExtras leadMinutes={occurrence.leadMinutes} repeats={occurrence.appointment.schedule.type === 'weekly'} />
      {memo !== undefined && (
        <View className="flex-row items-start gap-1.5">
          <StickyNoteIcon className="mt-0.5 h-[13px] w-[13px] text-text-muted" strokeWidth={2} aria-hidden />
          <Text testID="occurrence-card-memo" numberOfLines={2} className="flex-1 text-xs text-text">
            {memo}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

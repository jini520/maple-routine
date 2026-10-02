/**
 * 회차 카드의 몸통. 캐릭터별 묶음(얼굴 · 이름 열 + 보스 줄)과 알림 · 반복 줄. 파티 스케줄 목록 카드와 today 위젯 10 이 함께 쓴다.
 */
import { View } from 'react-native'

import { Badge, BellIcon, RepeatIcon, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { formatLead } from '../../features/party-appointments/draft'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import { CharacterGroupLabel } from './CharacterGroupLabel'

export interface OccurrenceBossGroup {
  ocid: string
  name: string
  imageUrl: string | null
  bosses: readonly PartyAppointmentBoss[]
}

export interface OccurrenceBossGroupsProps {
  groups: readonly OccurrenceBossGroup[]
  leadMinutes: number | null
  repeats: boolean
}

function BossLine(props: { boss: PartyAppointmentBoss }): React.JSX.Element {
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
    </View>
  )
}

export function OccurrenceBossGroups(props: OccurrenceBossGroupsProps): React.JSX.Element {
  const hasAlarm = props.leadMinutes !== null
  return (
    <>
      {props.groups.map((group) => (
        <View key={group.ocid} className="flex-row gap-1.5">
          <View className="pt-[5px]">
            <CharacterGroupLabel name={group.name} imageUrl={group.imageUrl} />
          </View>
          <View className="flex-1">
            {group.bosses.map((boss) => (
              <BossLine key={`${boss.ocid}:${boss.bossKey}`} boss={boss} />
            ))}
          </View>
        </View>
      ))}
      {(hasAlarm || props.repeats) && (
        <View className="flex-row gap-2.5">
          {hasAlarm && (
            <View className="flex-row items-center gap-1">
              <BellIcon className="h-3 w-3 text-primary-ink" strokeWidth={2.2} aria-hidden />
              <Text className="text-11 text-primary-ink">{formatLead(props.leadMinutes ?? 0)}</Text>
            </View>
          )}
          {props.repeats && (
            <View className="flex-row items-center gap-1">
              <RepeatIcon className="h-3 w-3 text-text-muted" strokeWidth={2.2} aria-hidden />
              <Text className="text-11 text-text-muted">매주</Text>
            </View>
          )}
        </View>
      )}
    </>
  )
}

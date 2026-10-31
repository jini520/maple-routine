/**
 * 회차 카드의 보스 줄과 알림 · 반복 줄. 파티 스케줄의 회차 카드와 today 의 다음 파티 스케줄 위젯이 함께 쓴다.
 */
import { View } from 'react-native'

import { Badge, BellIcon, RepeatIcon, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { formatLead } from '../../features/party-appointments/draft'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss } from '../../types/party-appointment'

/** 보스 한 줄. 초상화 · 이름 · 난이도 배지 */
export function OccurrenceBossLine(props: { boss: PartyAppointmentBoss }): React.JSX.Element {
  const { boss } = props
  const name = bossAliasOf(boss.bossKey, boss.bossKey)
  return (
    <View className="min-h-[34px] flex-row items-center gap-2">
      <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={28} />
      <Text className="shrink text-xs font-semibold text-text" numberOfLines={1}>
        {name}
      </Text>
      <Badge variant={boss.difficulty as BossDifficulty} size="xs">
        {DIFFICULTY_NAME[boss.difficulty as BossDifficulty] ?? boss.difficulty}
      </Badge>
    </View>
  )
}

/** 알림 · 반복 줄. 둘 다 없으면 아무것도 안 그린다 */
export function OccurrenceExtras(props: { leadMinutes: number | null; repeats: boolean }): React.JSX.Element | null {
  const hasAlarm = props.leadMinutes !== null
  if (!hasAlarm && !props.repeats) return null
  return (
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
  )
}

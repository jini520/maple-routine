/**
 * 위젯 10. 시작 전인 가장 가까운 파티 스케줄 회차 하나.
 *
 * 캐릭터마다 `card-inset` 칸 하나를 두고 칸 머리 줄에 닉네임만 적는다. 초상화를 곁들인 폭 40 의 열에 두면
 * 네 글자가 넘는 닉네임이 잘린다. 보스 줄과 알림 · 반복 줄은 파티 스케줄 목록 카드와 같은 부품이다.
 *
 * 분마다 스스로 시계를 읽는다. 남은 시간이 갈리고, 시작한 회차는 다음으로 넘어가야 해서다.
 * 누르면 파티 스케줄 탭으로 가서 그 회차의 상세 시트를 연다(알림을 눌렀을 때와 같은 길).
 *
 * @see docs/features/today.md 10. 다음 파티 스케줄
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { CalendarPlusIcon, ChevronRightIcon, RepeatIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { remainingLabelOf } from '../../../features/party-appointments/agenda'
import { usePartyAppointmentOpenStore, type PartyAppointmentCreateKind } from '../../../features/party-appointments/open-request'
import { shiftDateKey, WEEKDAY_LABELS } from '../../../lib/calendar'
import { getCurrentKstDateKey } from '../../../lib/scheduler/reset-clock'
import { OccurrenceBossLine, OccurrenceExtras } from '../../party-appointments/OccurrenceBossGroups'
import type { WidgetProps } from './types'

const TITLE = '다음 파티 스케줄'
const MINUTE_MS = 60_000

/** `오늘` · `내일` · 그 밖은 `일 10/4` */
function dayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return '오늘'
  if (dateKey === shiftDateKey(todayKey, 1)) return '내일'
  const date = new Date(`${dateKey}T00:00:00Z`)
  return `${WEEKDAY_LABELS[date.getUTCDay()]} ${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}

/** 등록 칸 둘. 파티 스케줄 탭 ＋ 메뉴와 같은 이름 · 설명 · 아이콘이다 */
const CREATE_KINDS = [
  { kind: 'weekly', label: '매주 반복', description: '고정 파티 등록', Icon: RepeatIcon },
  { kind: 'once', label: '한 번만', description: '일회성 파티 등록', Icon: CalendarPlusIcon },
] as const satisfies readonly { kind: PartyAppointmentCreateKind; label: string; description: string; Icon: unknown }[]

/**
 * 보여 줄 회차가 없을 때. 격자가 맨 아래 줄로 내리고, 여기서 새 스케줄의 갈래를 바로 고르게 한다. 메뉴를 한 번 더 거치지
 * 않도록 칸을 누르면 파티 스케줄 탭에서 그 갈래의 새 스케줄 시트가 열린다.
 */
function CreateCells(): React.JSX.Element {
  return (
    <View testID="widget-next-party-schedule" className="gap-2 p-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-10 font-bold text-text-muted">{TITLE}</Text>
        <Text className="text-11 text-text-muted">예정된 파티가 없습니다</Text>
      </View>
      <View className="flex-row gap-2">
        {CREATE_KINDS.map(({ kind, label, description, Icon }) => (
          <Pressable
            key={kind}
            role="button"
            aria-label={`${label} 파티 스케줄 등록`}
            onPress={() => usePartyAppointmentOpenStore.getState().openCreate(kind)}
            className="min-w-0 flex-1 flex-row items-center gap-2 rounded-[10px] bg-card-inset p-2.5"
          >
            <View className="h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary-tint">
              <Icon className="h-[15px] w-[15px] text-primary-ink" strokeWidth={2.2} aria-hidden />
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-[12.5px] font-bold text-text">
                {label}
              </Text>
              <Text numberOfLines={1} className="text-[10.5px] text-text-muted">
                {description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export function NextPartyScheduleWidget({ data }: WidgetProps): React.JSX.Element {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  const next = data.nextParty.find((occurrence) => occurrence.startsAtMs > nowMs)
  // 회차가 없거나, 마지막 회차가 화면을 띄워 둔 사이 시작했다. 다음 렌더에서 격자가 맨 아래 줄로 내린다.
  if (next === undefined) return <CreateCells />

  const todayKey = getCurrentKstDateKey(new Date(nowMs))
  return (
    <Pressable
      testID="widget-next-party-schedule"
      role="button"
      aria-label={`${TITLE} 열기`}
      onPress={() => usePartyAppointmentOpenStore.getState().open({ appointmentId: next.appointmentId, dateKey: next.dateKey })}
      // 누르는 동안 흐리게 하지 않는다. 위젯 카드 하나가 통째로 흐려지면 다른 카드와 따로 논다.
      className="gap-2 p-3"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-10 font-bold text-text-muted">
          {TITLE}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-11 text-text-muted">
            파티 스케줄
          </Text>
          <ChevronRightIcon className="h-3 w-3 text-text-muted" strokeWidth={2} aria-hidden />
        </View>
      </View>
      <View className="flex-row items-baseline">
        <Text className="text-15 font-bold text-text" style={TABULAR_NUMS}>
          {next.timeKst}
        </Text>
        <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
          {` ~ ${next.endClock} `}
        </Text>
        <Text className="text-11 font-bold text-primary-ink" style={TABULAR_NUMS}>
          {`${dayLabel(next.dateKey, todayKey)} · ${remainingLabelOf(next.startsAtMs - nowMs)}`}
        </Text>
      </View>
      <View className="gap-1.5">
        {next.groups.map((group) => (
          <View key={group.ocid} testID="next-party-group" className="rounded-[10px] bg-card-inset px-2.5 py-2">
            <Text numberOfLines={1} className="text-xs font-semibold text-text-muted">
              {group.name}
            </Text>
            {group.bosses.map((boss) => (
              <OccurrenceBossLine key={`${boss.ocid}:${boss.bossKey}`} boss={boss} />
            ))}
          </View>
        ))}
      </View>
      <OccurrenceExtras leadMinutes={next.leadMinutes} repeats={next.repeats} />
    </Pressable>
  )
}

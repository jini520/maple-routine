/**
 * 위젯 10. 시작 전인 가장 가까운 파티 스케줄 회차 하나. 파티 스케줄 페이지의 목록 카드를 안쪽 바탕 없이 옮긴 모양이다.
 *
 * 분마다 스스로 시계를 읽는다. 남은 시간이 갈리고, 시작한 회차는 다음으로 넘어가야 해서다.
 * 누르면 파티 스케줄 탭으로 가서 그 회차의 상세 시트를 연다(알림을 눌렀을 때와 같은 길).
 *
 * @see docs/features/today.md 10. 다음 파티 스케줄
 */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChevronRightIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { usePartyAppointmentOpenStore } from '../../../features/party-appointments/open-request'
import { shiftDateKey, WEEKDAY_LABELS } from '../../../lib/calendar'
import { getCurrentKstDateKey } from '../../../lib/scheduler/reset-clock'
import { OccurrenceBossGroups } from '../../party-appointments/OccurrenceBossGroups'
import type { WidgetProps } from './types'

const TITLE = '다음 파티 스케줄'
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** `오늘` · `내일` · 그 밖은 `일 10/4` */
function dayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return '오늘'
  if (dateKey === shiftDateKey(todayKey, 1)) return '내일'
  const date = new Date(`${dateKey}T00:00:00Z`)
  return `${WEEKDAY_LABELS[date.getUTCDay()]} ${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}

/** `n일 뒤` · `n시간 m분 뒤` · `n분 뒤` · 1분 미만은 `곧` */
function remainingLabel(remainingMs: number): string {
  if (remainingMs < MINUTE_MS) return '곧'
  if (remainingMs >= DAY_MS) return `${Math.floor(remainingMs / DAY_MS)}일 뒤`
  const hours = Math.floor(remainingMs / HOUR_MS)
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS)
  if (hours === 0) return `${minutes}분 뒤`
  return minutes === 0 ? `${hours}시간 뒤` : `${hours}시간 ${minutes}분 뒤`
}

export function NextPartyScheduleWidget({ data }: WidgetProps): React.JSX.Element | null {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  const next = data.nextParty.find((occurrence) => occurrence.startsAtMs > nowMs)
  // 마지막 회차가 화면을 띄워 둔 사이 시작했다. 다음 렌더에서 격자가 타일을 뺀다.
  if (next === undefined) return null

  const todayKey = getCurrentKstDateKey(new Date(nowMs))
  return (
    <Pressable
      testID="widget-next-party-schedule"
      role="button"
      aria-label={`${TITLE} 열기`}
      onPress={() => usePartyAppointmentOpenStore.getState().open({ appointmentId: next.appointmentId, dateKey: next.dateKey })}
      className="gap-2 p-3 active:opacity-60"
    >
      <View className="flex-row items-center justify-between">
        <Text fixed className="text-10 font-bold text-text-muted">
          {TITLE}
        </Text>
        <View className="flex-row items-center">
          <Text fixed className="text-11 text-text-muted">
            파티 스케줄
          </Text>
          <ChevronRightIcon className="h-3 w-3 text-text-muted" strokeWidth={2} aria-hidden />
        </View>
      </View>
      <View className="flex-row items-baseline">
        <Text fixed className="text-15 font-bold text-text" style={TABULAR_NUMS}>
          {next.timeKst}
        </Text>
        <Text fixed className="text-xs text-text-muted" style={TABULAR_NUMS}>
          {` ~ ${next.endClock} `}
        </Text>
        <Text fixed className="text-11 font-bold text-primary-ink" style={TABULAR_NUMS}>
          {`${dayLabel(next.dateKey, todayKey)} · ${remainingLabel(next.startsAtMs - nowMs)}`}
        </Text>
      </View>
      <View className="gap-2.5">
        <OccurrenceBossGroups groups={next.groups} leadMinutes={next.leadMinutes} repeats={next.repeats} />
      </View>
    </Pressable>
  )
}

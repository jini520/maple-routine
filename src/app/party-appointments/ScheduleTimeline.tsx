/**
 * 목록 보기 위의 시간표 카드. 가로축이 0 ~ 24시인 줄에 회차를 막대로 그린다.
 *
 * 처음에는 오늘 한 줄로 접혀 있고, 펼치면 요일 일곱 줄이다. 접힘은 기기에 적지 않아 열 때마다 접힌 채로 시작한다.
 * 오늘이 없는 다른 주는 접을 줄이 없어 펼친 채로 보인다. 막대를 누르면 그 회차 카드로 가도록 열쇠를 넘긴다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChevronDownIcon, ChevronUpIcon, Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { TimelineDay, TimelineTone } from '../../features/party-appointments/timeline'
import { WEEKDAY_LABELS } from '../../lib/calendar'

export interface ScheduleTimelineProps {
  /** 보는 주의 일곱 줄(목 → 수) */
  days: readonly TimelineDay[]
  todayKey: string
  onPressSegment: (key: string) => void
}

/** 눈금 글자를 적는 시. 그 사이는 3시간마다 바탕을 번갈아 칠한다 */
const HOUR_LABELS = [0, 6, 12, 18] as const
const BANDS = [3, 9, 15, 21] as const

/** 막대가 가늘어 손가락이 빗나간다. 줄 높이만큼 위아래를 넓힌다 */
const BAR_HIT_SLOP = { top: 8, bottom: 8, left: 2, right: 2 }

const BAR_TONE_CLASS: Record<TimelineTone, string> = {
  accent: 'bg-primary',
  normal: 'bg-border-strong',
  ended: 'bg-border-strong opacity-50',
}

function percent(fraction: number): `${number}%` {
  return `${fraction * 100}%`
}

function DayLabel(props: { dateKey: string; today: boolean }): React.JSX.Element {
  const date = new Date(`${props.dateKey}T00:00:00Z`)
  return (
    <View className="h-[30px] flex-row items-center gap-0.5">
      <Text className={`text-xs font-bold ${props.today ? 'text-primary-ink' : 'text-text'}`}>
        {WEEKDAY_LABELS[date.getUTCDay()]}
      </Text>
      <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
        {date.getUTCDate()}
      </Text>
    </View>
  )
}

function TimelineRow(props: {
  day: TimelineDay
  today: boolean
  onPressSegment: (key: string) => void
}): React.JSX.Element {
  return (
    <View
      testID="timeline-row"
      className={`relative h-[30px] rounded-lg ${props.today ? 'bg-primary-tint' : 'bg-control-track'}`}
    >
      {/* 오늘 줄의 바탕은 불투명해서 카드에 깐 띠를 가린다. 그 줄에만 띠를 다시 그린다. 다른 줄은 반투명이라 아래 띠가 비친다. */}
      {props.today &&
        BANDS.map((hour) => (
          <View
            key={hour}
            testID="timeline-row-band"
            pointerEvents="none"
            style={{ left: percent(hour / 24), width: percent(3 / 24) }}
            className="absolute bottom-0 top-0 rounded-md bg-control-track"
          />
        ))}
      {props.day.segments.map((segment) => (
        <Pressable
          key={`${segment.key}:${segment.from}`}
          testID="timeline-bar"
          role="button"
          aria-label={`${segment.occurrence.timeKst} 스케줄로 이동`}
          hitSlop={BAR_HIT_SLOP}
          onPress={() => props.onPressSegment(segment.key)}
          // 30분짜리 회차는 6px 남짓이다. 그보다 짧아도 보이게 바닥 폭을 둔다.
          style={{ left: percent(segment.from), width: percent(segment.to - segment.from), minWidth: 3 }}
          className={`absolute bottom-[5px] top-[5px] rounded-md ${BAR_TONE_CLASS[segment.tone]}`}
        />
      ))}
      {props.day.nowAt !== null && (
        <View
          testID="timeline-now"
          pointerEvents="none"
          style={{ left: percent(props.day.nowAt) }}
          className="absolute -bottom-0.5 -top-0.5 -ml-px w-0.5 rounded-full bg-primary"
        />
      )}
    </View>
  )
}

export function ScheduleTimeline(props: ScheduleTimelineProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const todayDay = props.days.find((day) => day.dateKey === props.todayKey)
  const collapsible = todayDay !== undefined
  const shown = collapsible && !expanded ? [todayDay] : props.days
  const weekly = shown.length > 1

  return (
    <View testID="schedule-timeline" className="gap-1.5 rounded-[14px] bg-surface p-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-text">{weekly ? '주간 시간표' : '오늘 시간표'}</Text>
        {collapsible && (
          <Pressable
            role="button"
            aria-label={expanded ? '주간 시간표 접기' : '주간 시간표 펼치기'}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            onPress={() => setExpanded((open) => !open)}
            className="flex-row items-center gap-0.5 active:opacity-60"
          >
            <Text className="text-xs font-semibold text-text-muted">{expanded ? '오늘만' : '주간'}</Text>
            {expanded ? (
              <ChevronUpIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
            )}
          </Pressable>
        )}
      </View>
      <View className="flex-row">
        <View className="w-10 gap-1 pt-5">
          {shown.map((day) => (
            <DayLabel key={day.dateKey} dateKey={day.dateKey} today={day.dateKey === props.todayKey} />
          ))}
        </View>
        <View className="relative flex-1">
          {BANDS.map((hour) => (
            <View
              key={hour}
              testID="timeline-band"
              pointerEvents="none"
              style={{ left: percent(hour / 24), width: percent(3 / 24) }}
              className="absolute bottom-0 top-0 rounded-md bg-control-track"
            />
          ))}
          <View className="h-5">
            {HOUR_LABELS.map((hour) => (
              <Text
                key={hour}
                style={[TABULAR_NUMS, { left: percent(hour / 24) }]}
                className="absolute top-0 text-10 text-text-muted"
              >
                {hour}
              </Text>
            ))}
          </View>
          <View className="gap-1">
            {shown.map((day) => (
              <TimelineRow
                key={day.dateKey}
                day={day}
                today={day.dateKey === props.todayKey}
                onPressSegment={props.onPressSegment}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

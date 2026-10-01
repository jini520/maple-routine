/**
 * 파티 약속 화면. 날짜가 열, 시각이 세로인 간트이고 블록 하나가 약속 하나(시작부터 종료까지)다.
 *
 * 격자 · 스크롤 · 고정 머리 · 지금 시각 선은 `@howljs/calendar-kit` 이 그린다. 이 화면은 약속을
 * 이벤트로 바꿔 넘기고 블록 안의 글자만 그린다.
 */
import {
  CalendarBody,
  CalendarContainer,
  CalendarHeader,
  DayItem,
  type CalendarKitHandle,
  type EventItem,
  type PackedEvent,
  useCalendar,
} from '@howljs/calendar-kit'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { BellIcon, RepeatIcon, Text } from '../../components/atoms'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import {
  isNextDayPiece,
  toCalendarEvents,
  type AppointmentEventData,
} from '../../features/party-appointments/calendar-events'
import { BUNDLE_BLOCK_COLOR, characterColorsOf } from '../../features/party-appointments/character-colors'
import { monthSegments, stickyLabelLeft, type MonthSegment } from '../../features/party-appointments/month-band'
import { occurrencesInWeek } from '../../features/party-appointments/occurrences'
import { usePartyAppointmentsStore } from '../../features/party-appointments/store'
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { resolveBottomBarMetrics } from '../../lib/bottom-bar-metrics'
import { FAB_SPACE_PX } from '../../lib/fab-metrics'
import { useBottomSafeAreaPx } from '../../lib/safe-area'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { useThemeAppearance } from '../../theme/context'
import { AppointmentFab } from './AppointmentFab'
import { AppointmentSheet, type AppointmentSheetTarget } from './AppointmentSheet'

/** 한 화면에 보이는 날 수. 칸이 좁으면 블록 글자가 안 들어간다 */
const VISIBLE_DAYS = 4
/** 가로 줄은 한 시간마다. 한 시간이 108 이라 20분 블록도 36 이 되어 글자 세 줄이 들어간다 */
const INTERVAL_MINUTES = 60
const INTERVAL_HEIGHT = 108
/** 파티 약속이 몰리는 저녁부터 보이게 */
const INITIAL_HOUR = 19

const KO_LOCALE = {
  ko: {
    weekDayShort: ['일', '월', '화', '수', '목', '금', '토'],
    meridiem: { ante: '오전', post: '오후' },
    more: '더보기',
  },
}

type AppointmentEvent = EventItem &
  AppointmentEventData & {
    /** 블록 바탕. 보스 하나면 캐릭터 색, 묶음이면 묶음 색 */
    blockColor: string
    /** `groups` 와 같은 차례의 캐릭터 색. 묶음 안 캐릭터 줄의 왼쪽 선 */
    groupColors: string[]
    /** 이미 끝난 약속. 흐리게 그린다 */
    past: boolean
  }

/** 지난 약속을 가르는 시계가 한 번씩 도는 간격 */
const NOW_TICK_MS = 60_000

/** 라이브러리 날짜 머리의 기본 높이 */
const DAY_BAR_HEIGHT = 60
/** 날짜 머리 위 달 띠의 높이. 라이브러리 머리 높이에 이만큼 더한다 */
const MONTH_BAND_HEIGHT = 18

/** 달 이름 층. 라이브러리 날짜 머리가 999 로 떠 있어 그보다 위여야 보인다 */
const MONTH_LABELS_Z = 1000

/** 달 이름 상자 폭. 조각 끝에서 이만큼 앞이 이름이 머무는 가장 오른쪽이다(`12월` 이 들어간다) */
const MONTH_LABEL_WIDTH = 34

/** 이웃한 두 달이 다른 색이라야 경계가 보인다. 홀짝으로 가른다 */
function isTintedMonth(month: number): boolean {
  return month % 2 === 0
}

/**
 * 날짜 칸 하나 위에 그 달의 띠 조각을 얹은 머리. 같은 달의 조각이 이어져 달이 걸친 칸만큼 띠가 된다.
 * 달 이름은 칸이 아니라 `MonthLabels` 가 띠 위에 따로 얹는다.
 */
function DayWithMonthBand(props: { dateUnix: number }): React.JSX.Element {
  const dateKey = getCurrentKstDateKey(new Date(props.dateUnix))
  const tinted = isTintedMonth(Number(dateKey.slice(5, 7)))
  // 머리 높이를 다 채운다. 라이브러리가 칸을 세로 가운데에 두어, 내용 높이만 쓰면 띠가 달 이름 자리보다 내려간다.
  return (
    <View style={{ height: DAY_BAR_HEIGHT + MONTH_BAND_HEIGHT }}>
      <View
        className={`${tinted ? 'bg-primary-tint' : 'bg-surface-2'} ${dateKey.endsWith('-01') ? 'border-l border-bg' : ''}`}
        style={{ height: MONTH_BAND_HEIGHT }}
      />
      <View className="flex-1 justify-center">
        <DayItem dateUnix={props.dateUnix} />
      </View>
    </View>
  )
}

function MonthLabel(props: {
  segment: MonthSegment
  columnWidth: number
  offsetX: SharedValue<number>
}): React.JSX.Element {
  const { segment, columnWidth, offsetX } = props
  const moving = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: stickyLabelLeft(
          offsetX.value,
          segment.first * columnWidth,
          (segment.last + 1) * columnWidth,
          MONTH_LABEL_WIDTH,
        ),
      },
    ],
  }))
  const tinted = isTintedMonth(segment.month)
  // 자리는 바깥 View, 움직임만 Animated.View 에 준다. 둘을 한 Animated.View 에 주면 자리가 버려진다.
  return (
    <View className="absolute bottom-0 left-0 top-0 justify-center" style={{ width: MONTH_LABEL_WIDTH }}>
      <Animated.View style={moving}>
        <Text className={`px-1.5 text-11 font-bold ${tinted ? 'text-primary-ink' : 'text-text'}`} numberOfLines={1}>
          {segment.month}월
        </Text>
      </Animated.View>
    </View>
  )
}

/**
 * 달 띠 위의 달 이름들. 라이브러리의 가로 스크롤 값을 읽어 그 달이 보이는 동안 화면 왼쪽 끝에 붙인다.
 * 보이는 날 근처의 달만 그린다.
 */
function MonthLabels(props: { visibleDateKey: string }): React.JSX.Element {
  const { calendarData, columnWidth, hourWidth, offsetX } = useCalendar()
  const dateKeys = useMemo(
    () => calendarData.visibleDatesArray.map((unix) => getCurrentKstDateKey(new Date(unix))),
    [calendarData],
  )
  const segments = useMemo(() => monthSegments(dateKeys), [dateKeys])
  // 보이는 첫 날이 든 달과 그 앞뒤 달. 넘기는 중에도 셋 안에서 바뀐다.
  const at = segments.findIndex((segment) => (dateKeys[segment.last] ?? '') >= props.visibleDateKey)
  const near = at === -1 ? segments : segments.slice(Math.max(0, at - 1), at + 2)
  return (
    <View
      pointerEvents="none"
      className="absolute right-0 top-0 overflow-hidden"
      style={{ left: hourWidth, height: MONTH_BAND_HEIGHT, zIndex: MONTH_LABELS_Z }}
    >
      {near.map((segment) => (
        <MonthLabel key={segment.first} segment={segment} columnWidth={columnWidth} offsetX={offsetX} />
      ))}
    </View>
  )
}

function BlockMarks({ data }: { data: AppointmentEvent }): React.JSX.Element | null {
  if (!data.hasAlarm && !data.repeats) return null
  return (
    <View className="absolute right-1 top-1 flex-row gap-0.5">
      {data.hasAlarm && <BellIcon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} aria-hidden />}
      {data.repeats && <RepeatIcon className="h-2.5 w-2.5 text-white" strokeWidth={2.5} aria-hidden />}
    </View>
  )
}

function blockLabelOf(data: AppointmentEvent): string {
  const bosses = data.groups.flatMap((group) =>
    group.bosses.map((boss) => `${group.characterName} ${boss.name} ${boss.difficultyLabel}`),
  )
  return `${data.timeKst} ${bosses.join(', ')}`
}

function AppointmentBlock({ event }: { event: PackedEvent }): React.JSX.Element {
  const data = event as unknown as AppointmentEvent
  const style = { backgroundColor: data.blockColor, opacity: data.past ? 0.4 : 1 }
  // 자정을 넘은 다음 날 조각은 색만 잇는다. 글자는 첫 조각에 있다.
  if (isNextDayPiece(event._internal.startMinutes, data.timeKst)) {
    return <View className="flex-1" style={style} aria-label={blockLabelOf(data)} />
  }
  if (data.bundle) {
    return (
      <View className="flex-1 gap-1 overflow-hidden px-1 pt-0.5" style={style} aria-label={blockLabelOf(data)}>
        <BlockMarks data={data} />
        <Text className="text-8 leading-[9px] text-white" numberOfLines={1}>
          {data.timeKst}
        </Text>
        {data.groups.map((group, index) => (
          <View key={group.ocid} className="pl-[7px]">
            <View
              className="absolute bottom-px left-0 top-px w-[3px] rounded-sm"
              style={{ backgroundColor: data.groupColors[index] }}
            />
            <Text className="text-11 font-bold leading-[12px] text-white" numberOfLines={1}>
              {group.characterName} ({group.bosses.length})
            </Text>
            {group.bosses.map((boss, bossIndex) => (
              <Text key={bossIndex} className="text-9 font-semibold leading-[11px] text-white" numberOfLines={1}>
                {boss.name} <Text className="text-9 font-normal text-white opacity-85">{boss.difficultyLabel}</Text>
              </Text>
            ))}
          </View>
        ))}
      </View>
    )
  }
  const group = data.groups[0]
  const boss = group?.bosses[0]
  // 글자는 위에 붙인다. 뒤 약속이 아래쪽을 덮어도 보이는 윗부분에 글자가 남는다.
  return (
    <View className="flex-1 px-1 pt-0.5" style={style} aria-label={blockLabelOf(data)}>
      {/* 표식은 오른쪽 위 모서리. 글자 줄에 끼우면 시각과 한 덩어리로 읽힌다. */}
      <BlockMarks data={data} />
      {/* 글자 층위: 캐릭터 이름이 가장 크고, 다음 줄에 보스와 난이도를 붙인다. 묶음 블록과 같은 규칙이다. */}
      <Text className="text-8 leading-[9px] text-white" numberOfLines={1}>
        {data.timeKst}
      </Text>
      <Text className="text-11 font-bold leading-[12px] text-white" numberOfLines={1}>
        {group?.characterName}
      </Text>
      <Text className="text-9 font-semibold leading-[11px] text-white" numberOfLines={1}>
        {boss?.name} <Text className="text-9 font-normal text-white opacity-85">{boss?.difficultyLabel}</Text>
      </Text>
    </View>
  )
}

export function AppointmentsScreen(): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const appointments = usePartyAppointmentsStore((state) => state.appointments)
  const load = usePartyAppointmentsStore((state) => state.load)
  const characters = useBossSchedulerStore((state) => state.characters)
  const trackedOcids = useBossSchedulerStore((state) => state.trackedOcids)
  const calendarRef = useRef<CalendarKitHandle>(null)
  /** 열린 시트. `add` 는 추가, 회차면 그 상세 */
  const [sheet, setSheet] = useState<'add' | AppointmentSheetTarget | null>(null)
  // 보이는 첫 날. 약속을 펼칠 주와 그릴 달 이름을 정한다.
  const [visibleDateKey, setVisibleDateKey] = useState(() => getCurrentKstDateKey(new Date()))

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  // 분마다 다시 그려 방금 끝난 약속도 흐려지게 한다.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const colorOf = useMemo(
    () => characterColorsOf(trackedOcids ?? characters.map((character) => character.ocid)),
    [trackedOcids, characters],
  )

  const names = useMemo(
    () => new Map(characters.map((character) => [character.ocid, character.characterName])),
    [characters],
  )

  // 보이는 날이 두 주에 걸칠 수 있어 앞뒤 한 주씩 함께 펼친다.
  // 블록을 누르면 그 회차의 상세를 연다. 이벤트 id 로 회차와 그 리셋 주를 찾는다.
  const { events, targets } = useMemo(() => {
    const week = resetWeekStartOf(visibleDateKey)
    const weeks = [shiftDateKey(week, -7), week, shiftDateKey(week, 7)]
    const byId = new Map<string, AppointmentSheetTarget>()
    const list = weeks.flatMap((weekStart): AppointmentEvent[] => {
      const occurrences = occurrencesInWeek(appointments, weekStart)
      for (const occurrence of occurrences) {
        byId.set(`${occurrence.appointment.id}:${occurrence.dateKey}`, { occurrence, weekStart })
      }
      return toCalendarEvents(occurrences, names).map((event) => ({
        ...event,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
        blockColor: event.bundle ? BUNDLE_BLOCK_COLOR : colorOf(event.groups[0]?.ocid ?? ''),
        groupColors: event.groups.map((group) => colorOf(group.ocid)),
        past: event.end.getTime() <= nowMs,
      }))
    })
    return { events: list, targets: byId }
  }, [appointments, visibleDateKey, names, colorOf, nowMs])

  // 떠 있는 바와 ＋ 가 먹는 몫. 마지막 시간대가 둘 뒤로 숨지 않게 격자 끝에 그만큼 비운다.
  // 바 몫은 `ScreenScroll` 이 탭 화면 콘텐츠 끝에 남기는 값과 같은 식이고, ＋ 몫은 가계부와 같다.
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { width } = useWindowDimensions()
  const barBottomPx = bottomSafeAreaPx + resolveBottomBarMetrics(width).spacePx + FAB_SPACE_PX

  return (
    <View testID="screen-Appointments" className="flex-1">
      <PageHeader>
        <PageHeaderTitleRow>
          <Text className="text-lg font-semibold text-text">파티 약속</Text>
        </PageHeaderTitleRow>
      </PageHeader>
      <View className="mt-2 flex-1">
        <CalendarContainer
          ref={calendarRef}
          numberOfDays={VISIBLE_DAYS}
          scrollByDay
          firstDay={4}
          timeZone="Asia/Seoul"
          initialLocales={KO_LOCALE}
          locale="ko"
          start={0}
          end={24 * 60}
          timeInterval={INTERVAL_MINUTES}
          initialTimeIntervalHeight={INTERVAL_HEIGHT}
          allowPinchToZoom={false}
          allowDragToCreate={false}
          allowDragToEdit={false}
          // 겹친 약속은 나란히 쪼개지 않고 뒤 약속이 앞 약속을 전체 폭으로 덮는다. 칸을 쪼개면 글자가 안 들어간다.
          overlapType="stack"
          spaceFromBottom={barBottomPx}
          events={events}
          onPressEvent={(event) => {
            const target = targets.get(event.id)
            if (target !== undefined) setSheet(target)
          }}
          onLoad={() => calendarRef.current?.goToHour(INITIAL_HOUR, false)}
          onChange={(date) => setVisibleDateKey(getCurrentKstDateKey(new Date(date)))}
          theme={{
            colors: {
              primary: definition.primary,
              onPrimary: '#FFFFFF',
              background: definition.bg,
              onBackground: definition.text,
              border: definition.border,
              text: definition.text,
              surface: definition.surface,
              onSurface: definition.textMuted,
            },
            hourTextStyle: { color: definition.textMuted, fontSize: 10 },
            nowIndicatorColor: definition.errorInk,
            eventContainerStyle: { borderRadius: 0 },
          }}
        >
          <CalendarHeader
            dayBarHeight={DAY_BAR_HEIGHT + MONTH_BAND_HEIGHT}
            renderDayItem={({ dateUnix }) => <DayWithMonthBand dateUnix={dateUnix} />}
          />
          <CalendarBody
            hourFormat="HH:mm"
            renderEvent={(event) => <AppointmentBlock event={event} />}
            // 라이브러리는 칸 사이(index 가 .5)에도 줄을 긋는다. 정시 줄만 남긴다.
            renderCustomHorizontalLine={({ index, borderColor }) =>
              Number.isInteger(index) ? <View style={{ height: 1, backgroundColor: borderColor }} /> : null
            }
          />
          <MonthLabels visibleDateKey={visibleDateKey} />
        </CalendarContainer>
      </View>
      <AppointmentFab onPress={() => setSheet('add')} />
      {sheet !== null && (
        <AppointmentSheet
          target={sheet === 'add' ? undefined : sheet}
          names={names}
          colorOf={colorOf}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  )
}

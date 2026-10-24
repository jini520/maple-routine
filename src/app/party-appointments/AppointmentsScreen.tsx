/**
 * 파티 스케줄 화면. 헤더 오른쪽 세그먼트로 목록 · 보드 보기를 고르고, 위에 주 스테퍼가 있다.
 *
 * 목록 보기는 24시간 시간표 카드와 요일별 목록이고, 보드 보기는 요일 일곱 열이다. 카드를 누르면 상세 시트,
 * 오른쪽 아래 ＋ 로 추가 시트가 열린다. 시간표 막대를 누르면 목록의 그 카드로 스크롤해 잠깐 강조한다.
 */
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, type ScrollView } from 'react-native'

import {
  CalendarPlusIcon,
  RepeatIcon,
  Text,
} from '../../components/atoms'
import { PeriodStepper } from '../../components/molecules/PeriodStepper/PeriodStepper'
import { Segment } from '../../components/molecules/Segment/Segment'
import { SpeedDial } from '../../components/organisms/SpeedDial/SpeedDial'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { agendaDays, thisWeekJumpOf } from '../../features/party-appointments/agenda'
import { findNotifiedOccurrence, usePartyAppointmentOpenStore } from '../../features/party-appointments/open-request'
import { occurrencesInWeek } from '../../features/party-appointments/occurrences'
import { usePartyAppointmentsStore } from '../../features/party-appointments/store'
import { occurrenceKeyOf, weekTimeline } from '../../features/party-appointments/timeline'
import { upcomingOccurrences } from '../../features/party-appointments/upcoming'
import { usePartyScheduleViewStore, type PartyScheduleView } from '../../features/party-appointments/view-preference'
import { formatBossProfitPeriodLabel } from '../../lib/boss/boss-profit-period'
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { FAB_SPACE_PX } from '../../lib/fab-metrics'
import { useTopSafeAreaPx } from '../../lib/safe-area'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { tapFeedback } from '../../native/haptics'
import { AppointmentAgenda } from './AppointmentAgenda'
import { AppointmentBoard } from './AppointmentBoard'
import { AppointmentSheet, type AppointmentSheetTarget } from './AppointmentSheet'
import { cardScrollY } from './card-scroll-target'
import { ScheduleTimeline } from './ScheduleTimeline'

/** 지난 약속을 가르는 시계가 한 번씩 도는 간격 */
const NOW_TICK_MS = 60_000


const VIEWS: readonly PartyScheduleView[] = ['list', 'board']
const VIEW_LABELS: Record<PartyScheduleView, string> = { list: '목록', board: '보드' }

/** 막대를 눌러 온 카드를 강조하는 시간 */
const HIGHLIGHT_MS = 1200
/** 카드로 스크롤할 때 카드 위에 남기는 여백 */
const SCROLL_TOP_GAP = 12

export function AppointmentsScreen(): React.JSX.Element {
  const appointments = usePartyAppointmentsStore((state) => state.appointments)
  const load = usePartyAppointmentsStore((state) => state.load)
  const characters = useBossSchedulerStore((state) => state.characters)
  /** 열린 시트. `add` 는 추가, 회차면 그 상세 */
  // 추가는 ＋ 에서 고른 갈래(`once` · `weekly`), 상세는 누른 회차다.
  const [sheet, setSheet] = useState<'once' | 'weekly' | AppointmentSheetTarget | null>(null)

  // 분마다 다시 그려 방금 끝난 약속도 흐려지게 한다.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  const todayKey = getCurrentKstDateKey(new Date(nowMs))
  const thisWeek = resetWeekStartOf(todayKey)
  const [weekStart, setWeekStart] = useState(thisWeek)

  /**
   * 목록을 읽고, 알림을 눌러 왔으면 그 회차가 든 주로 가서 상세를 연다. 약속이 없어졌으면 그 주만 연다.
   * 들어올 때와, 이 화면에 있는 채로 알림을 눌렀을 때 부른다.
   */
  const loadAndOpenNotified = useCallback(async () => {
    await load()
    const { request, create } = usePartyAppointmentOpenStore.getState()
    // today 위젯이 고른 갈래의 새 스케줄 시트. ＋ 메뉴에서 고른 것과 같다.
    if (create !== null) {
      usePartyAppointmentOpenStore.getState().clear()
      setSheet(create)
      return
    }
    if (request === null) return
    usePartyAppointmentOpenStore.getState().clear()
    const found = findNotifiedOccurrence(usePartyAppointmentsStore.getState().appointments, request)
    setWeekStart(found.weekStart)
    setSheet(found.occurrence === undefined ? null : { occurrence: found.occurrence, weekStart: found.weekStart })
  }, [load])

  useFocusEffect(
    useCallback(() => {
      void loadAndOpenNotified()
    }, [loadAndOpenNotified]),
  )
  useEffect(
    () =>
      usePartyAppointmentOpenStore.subscribe((state) => {
        if (state.request !== null || state.create !== null) void loadAndOpenNotified()
      }),
    [loadAndOpenNotified],
  )
  const periodLabel = formatBossProfitPeriodLabel('weekly', weekStart, new Date(nowMs))
  const jump = thisWeekJumpOf(weekStart, thisWeek)

  const faces = useMemo(
    () => new Map(characters.map((character) => [character.ocid, character.imageUrl ?? null])),
    [characters],
  )
  const names = useMemo(
    () => new Map(characters.map((character) => [character.ocid, character.characterName])),
    [characters],
  )
  const occurrences = useMemo(() => occurrencesInWeek(appointments, weekStart), [appointments, weekStart])
  const days = useMemo(() => agendaDays(occurrences), [occurrences])
  const nextKey = useMemo(() => {
    const [next] = upcomingOccurrences(appointments, new Date(nowMs), 1)
    return next === undefined ? null : occurrenceKeyOf(next)
  }, [appointments, nowMs])
  const timeline = useMemo(
    () => weekTimeline(occurrences, weekStart, nowMs, nextKey),
    [occurrences, weekStart, nowMs, nextKey],
  )

  const view = usePartyScheduleViewStore((state) => state.view)
  const viewLoaded = usePartyScheduleViewStore((state) => state.loaded)
  useEffect(() => {
    if (!viewLoaded) void usePartyScheduleViewStore.getState().load()
  }, [viewLoaded])

  // 시간표 막대에서 목록 카드로 가는 자리. `onLayout` 은 부모 안의 자리라 겹친 상자 셋의 자리와 카드의 목록 안 자리를 더한다.
  const scroller = useRef<ScrollView>(null)
  const topSafeAreaPx = useTopSafeAreaPx()
  const listY = useRef({ content: 0, block: 0, agenda: 0 })
  const cardYs = useRef(new Map<string, number>())
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  useEffect(() => {
    if (highlightedKey === null) return
    const timer = setTimeout(() => setHighlightedKey(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlightedKey])

  function goToCard(key: string): void {
    const y = cardYs.current.get(key)
    if (y === undefined) return
    tapFeedback()
    const { content, block, agenda } = listY.current
    scroller.current?.scrollTo({
      y: cardScrollY({ cardY: content + block + agenda + y, topSafeAreaPx, gapPx: SCROLL_TOP_GAP }),
      animated: true,
    })
    setHighlightedKey(key)
  }

  function moveWeek(next: string): void {
    setWeekStart(next)
  }

  return (
    <View testID="screen-Appointments" className="flex-1">
      <ScreenScroll
        ref={scroller}
        header={
          <PageHeader>
            <PageHeaderTitleRow
              trailing={
                <Segment
                  size="tab"
                  options={VIEWS}
                  selected={view}
                  onSelect={(next) => usePartyScheduleViewStore.getState().setView(next)}
                  labelOf={(value) => VIEW_LABELS[value]}
                />
              }
            >
              <Text className="text-lg font-semibold text-text">파티 스케줄</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* 바닥 여백은 떠 있는 ＋ 의 몫이다. 하단바의 몫은 `ScreenScroll` 이 남긴다. */}
        <View
          className="gap-1"
          style={{ paddingBottom: FAB_SPACE_PX }}
          onLayout={(event) => (listY.current.content = event.nativeEvent.layout.y)}
        >
          {/* 미래 주로도 갈 수 있어서 이번 주로 돌아오는 겹화살표가 양쪽에 있다. 쓸 수 없는 쪽은 흐리게 막힌다. */}
          <View className="px-4">
            <PeriodStepper
              primary={periodLabel.primary}
              secondary={periodLabel.secondary}
              jumpBack={{ label: '이번 주로 이동', disabled: jump !== 'back', onPress: () => moveWeek(thisWeek) }}
              prev={{ label: '이전 주', onPress: () => moveWeek(shiftDateKey(weekStart, -7)) }}
              next={{ label: '다음 주', onPress: () => moveWeek(shiftDateKey(weekStart, 7)) }}
              jumpForward={{ label: '이번 주로 이동', disabled: jump !== 'forward', onPress: () => moveWeek(thisWeek) }}
            />
          </View>

          {/* 고른 보기를 읽기 전에 그리면 보드를 고른 사용자에게 목록이 한 번 스친다. */}
          {viewLoaded && view === 'list' && (
            <View className="gap-4 px-4" onLayout={(event) => (listY.current.block = event.nativeEvent.layout.y)}>
              <ScheduleTimeline days={timeline} todayKey={todayKey} onPressSegment={goToCard} />
              <View onLayout={(event) => (listY.current.agenda = event.nativeEvent.layout.y)}>
                <AppointmentAgenda
                  days={days}
                  todayKey={todayKey}
                  weekLabel={periodLabel.primary}
                  nowMs={nowMs}
                  names={names}
                  highlightedKey={highlightedKey}
                  onMeasureCard={(key, y) => cardYs.current.set(key, y)}
                  onPressOccurrence={(occurrence) => setSheet({ occurrence, weekStart })}
                />
              </View>
            </View>
          )}
          {viewLoaded && view === 'board' && (
            <AppointmentBoard
              days={timeline}
              todayKey={todayKey}
              weekLabel={periodLabel.primary}
              nowMs={nowMs}
              names={names}
              onPressOccurrence={(occurrence) => setSheet({ occurrence, weekStart })}
            />
          )}
        </View>
      </ScreenScroll>
      {/* 매주 반복이 위, ＋ 에 가까운 아래가 한 번만이다. */}
      <SpeedDial
        label="스케줄 추가"
        actions={[
          {
            key: 'weekly',
            label: '매주 반복',
            description: '고정 파티 등록',
            Icon: RepeatIcon,
            onSelect: () => setSheet('weekly'),
          },
          {
            key: 'once',
            label: '한 번만',
            description: '일회성 파티 등록',
            Icon: CalendarPlusIcon,
            onSelect: () => setSheet('once'),
          },
        ]}
      />
      {sheet !== null && (
        <AppointmentSheet
          target={typeof sheet === 'string' ? undefined : sheet}
          repeats={sheet === 'weekly'}
          names={names}
          faces={faces}
          onClose={() => setSheet(null)}
        />
      )}
    </View>
  )
}

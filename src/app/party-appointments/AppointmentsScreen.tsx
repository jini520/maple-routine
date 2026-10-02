/**
 * 파티 약속 화면. 위에 주 스테퍼, 아래에 그 주의 요일별 목록이다.
 *
 * 약속을 누르면 상세 시트, 오른쪽 아래 ＋ 로 추가 시트가 열린다.
 */
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

import {
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronsLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  RepeatIcon,
  Text,
} from '../../components/atoms'
import { SpeedDial } from '../../components/organisms/SpeedDial/SpeedDial'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { agendaDays, thisWeekJumpOf } from '../../features/party-appointments/agenda'
import { occurrencesInWeek } from '../../features/party-appointments/occurrences'
import { usePartyAppointmentsStore } from '../../features/party-appointments/store'
import { formatBossProfitPeriodLabel } from '../../lib/boss/boss-profit-period'
import { resetWeekStartOf, shiftDateKey } from '../../lib/calendar'
import { FAB_SPACE_PX } from '../../lib/fab-metrics'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { tapFeedback } from '../../native/haptics'
import { AppointmentAgenda } from './AppointmentAgenda'
import { AppointmentSheet, type AppointmentSheetTarget } from './AppointmentSheet'

/** 지난 약속을 가르는 시계가 한 번씩 도는 간격 */
const NOW_TICK_MS = 60_000

const ARROW_CLASS = 'h-7 w-7 items-center justify-center rounded-full border border-border'

export function AppointmentsScreen(): React.JSX.Element {
  const appointments = usePartyAppointmentsStore((state) => state.appointments)
  const load = usePartyAppointmentsStore((state) => state.load)
  const characters = useBossSchedulerStore((state) => state.characters)
  /** 열린 시트. `add` 는 추가, 회차면 그 상세 */
  // 추가는 ＋ 에서 고른 갈래(`once` · `weekly`), 상세는 누른 회차다.
  const [sheet, setSheet] = useState<'once' | 'weekly' | AppointmentSheetTarget | null>(null)

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

  const todayKey = getCurrentKstDateKey(new Date(nowMs))
  const thisWeek = resetWeekStartOf(todayKey)
  const [weekStart, setWeekStart] = useState(thisWeek)
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
  const days = useMemo(() => agendaDays(occurrencesInWeek(appointments, weekStart)), [appointments, weekStart])

  function moveWeek(next: string): void {
    tapFeedback()
    setWeekStart(next)
  }

  return (
    <View testID="screen-Appointments" className="flex-1">
      <ScreenScroll
        header={
          <PageHeader>
            <PageHeaderTitleRow>
              <Text className="text-lg font-semibold text-text">파티 약속</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* 바닥 여백은 떠 있는 ＋ 의 몫이다. 하단바의 몫은 `ScreenScroll` 이 남긴다. */}
        <View className="gap-1 px-4" style={{ paddingBottom: FAB_SPACE_PX }}>
          <View className="flex-row items-center justify-center gap-4 py-3">
            {/* 미래 주에서는 왼쪽 겹화살표로 이번 주에 돌아간다. 늘 서 있고 쓸 수 없으면 흐리게 막힌다. */}
            <Pressable
              role="button"
              aria-label="이번 주로 이동"
              aria-disabled={jump !== 'back'}
              disabled={jump !== 'back'}
              onPress={() => moveWeek(thisWeek)}
              className={`${ARROW_CLASS}${jump !== 'back' ? ' opacity-30' : ''}`}
            >
              <ChevronsLeftIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
            <Pressable
              role="button"
              aria-label="이전 주"
              onPress={() => moveWeek(shiftDateKey(weekStart, -7))}
              className={ARROW_CLASS}
            >
              <ChevronLeftIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
            <View className="items-center">
              <Text className="text-sm font-semibold text-text">{periodLabel.primary}</Text>
              <Text className="mt-0.5 text-xs text-text-muted" style={TABULAR_NUMS}>
                {periodLabel.secondary}
              </Text>
            </View>
            <Pressable
              role="button"
              aria-label="다음 주"
              onPress={() => moveWeek(shiftDateKey(weekStart, 7))}
              className={ARROW_CLASS}
            >
              <ChevronRightIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
            {/* 지난 주에서는 오른쪽 겹화살표로 이번 주에 돌아간다. 늘 서 있고 쓸 수 없으면 흐리게 막힌다. */}
            <Pressable
              role="button"
              aria-label="이번 주로 이동"
              aria-disabled={jump !== 'forward'}
              disabled={jump !== 'forward'}
              onPress={() => moveWeek(thisWeek)}
              className={`${ARROW_CLASS}${jump !== 'forward' ? ' opacity-30' : ''}`}
            >
              <ChevronsRightIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
          </View>

          <AppointmentAgenda
            days={days}
            todayKey={todayKey}
            weekLabel={periodLabel.primary}
            nowMs={nowMs}
            names={names}
            faces={faces}
            onPressOccurrence={(occurrence) => setSheet({ occurrence, weekStart })}
          />
        </View>
      </ScreenScroll>
      {/* 매주 반복이 위, ＋ 에 가까운 아래가 한 번만이다. */}
      <SpeedDial
        label="약속 추가"
        actions={[
          {
            key: 'weekly',
            label: '매주 반복',
            description: '매주 같은 요일 · 시각의 약속',
            Icon: RepeatIcon,
            onSelect: () => setSheet('weekly'),
          },
          {
            key: 'once',
            label: '한 번만',
            description: '그 날 하루만 서는 약속',
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

/**
 * 통계. 수익·지출 그룹의 셋째 하위이고, 보스 수익과 가계부의 기록을 기간 단위로 모아 읽기만 한다.
 *
 * @see docs/features/stats.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Pressable, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, Text } from '../../components/atoms'
import { TabSegment } from '../../components/molecules/TabSegment/TabSegment'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { apiWindowRange, floorMonthKey, floorWeekStartKey } from '../../features/cashbook/range'
import { useLedgerData } from '../../features/ledger/useLedgerData'
import { useDataFreshness } from '../../features/refresh/freshness'
import {
  categoryTotalsBetween,
  characterTotalsBetween,
  totalsBetween,
  type DaysByDate,
} from '../../features/stats/aggregate'
import { loadStatsDays, loadStatsImages, statsDataRevision } from '../../features/stats/load'
import { statsRanges } from '../../features/stats/periods'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
  isLatestPeriod,
} from '../../lib/boss/boss-profit-period'
import { monthKeyOf } from '../../lib/calendar'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { tapFeedback } from '../../native/haptics'
import type { BossCycle } from '../../types'
import { DeltaChip } from '../boss-profit/HeadlineChips'
import { BossSection } from './BossSection'
import { CategorySection } from './CategorySection'
import { CharacterSection } from './CharacterSection'
import { CumulativeSection } from './CumulativeSection'
import { sectionsToReveal } from './reveal'
import { StatsSection } from './StatsSection'
import { TrendSection } from './TrendSection'

const CYCLES = ['weekly', 'monthly'] as const
const CYCLE_LABELS: Record<BossCycle, string> = { weekly: '주간', monthly: '월간' }
const NO_DAYS: DaysByDate = {}
const NO_IMAGES: ReadonlyMap<string, string> = new Map()

/** 기간 줄의 원형 버튼. 가계부 · 보스 수익과 같은 28px 원이다. */
function PeriodArrow(props: {
  label: string
  icon: typeof ChevronLeftIcon
  disabled: boolean
  onPress: () => void
}): React.JSX.Element {
  const Icon = props.icon
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-disabled={props.disabled}
      disabled={props.disabled}
      onPress={() => {
        tapFeedback()
        props.onPress()
      }}
      className={`h-7 w-7 items-center justify-center rounded-full border border-border${props.disabled ? ' opacity-30' : ''}`}
    >
      <Icon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}

function signed(meso: number): string {
  return `${meso > 0 ? '+' : meso < 0 ? '−' : ''}${formatMesoCompact(Math.abs(meso))}`
}

export function StatsScreen(): React.JSX.Element {
  const now = new Date()
  const todayDateKey = getCurrentKstDateKey(now)
  const todayMonthKey = monthKeyOf(todayDateKey)
  const ledger = useLedgerData()
  const fetchedAt = useDataFreshness((state) => state.fetchedAt)

  const [cycle, setCycle] = useState<BossCycle>('weekly')
  const [periodKey, setPeriodKey] = useState(() => getCurrentBossProfitPeriod('weekly', now).periodKey)
  const [days, setDays] = useState<DaysByDate>(NO_DAYS)
  const [images, setImages] = useState<ReadonlyMap<string, string>>(NO_IMAGES)

  const ranges = useMemo(() => statsRanges(cycle, periodKey), [cycle, periodKey])

  /**
   * 층에 알리는 범위는 가계부와 같은 창이다. 고른 기간의 달(주간은 목요일이 든 달)을 가운데 두고 앞뒤
   * 두 달이고 오늘을 안 넘는다. 같은 창이면 층이 회차를 다시 안 열어, 같은 달 안의 주 이동은 조용하다.
   */
  const viewMonthKey = cycle === 'weekly' ? monthKeyOf(periodKey) : periodKey
  const { requestDateRange } = ledger
  useEffect(() => {
    requestDateRange(apiWindowRange(viewMonthKey, todayDateKey))
  }, [requestDateRange, viewMonthKey, todayDateKey])

  /**
   * 읽는 표의 판이 달라졌을 때만 다시 읽는다. 기간 이동은 이미 든 18개월 안의 일이라 안 읽고, 층의 회차가
   * 새로 받은 것 없이 끝나도 안 읽는다. 가계부 시트의 쓰기는 층을 안 거치므로 포커스 때도 본다.
   */
  const loadedRevision = useRef<number | null>(null)
  const [loadToken, setLoadToken] = useState(0)
  useEffect(() => {
    loadedRevision.current = statsDataRevision()
    let alive = true
    void loadStatsDays(todayDateKey).then((loaded) => {
      if (alive) setDays(loaded)
    })
    return () => {
      alive = false
    }
  }, [loadToken, todayDateKey])
  useEffect(() => {
    if (loadedRevision.current !== statsDataRevision()) setLoadToken((token) => token + 1)
  }, [ledger.revision])
  useFocusEffect(
    useCallback(() => {
      if (loadedRevision.current !== statsDataRevision()) setLoadToken((token) => token + 1)
    }, []),
  )

  const { current: currentRange, trend } = ranges
  const characters = useMemo(() => characterTotalsBetween(days, currentRange), [days, currentRange])
  const incomeItems = useMemo(() => categoryTotalsBetween(days, currentRange, 'income'), [days, currentRange])
  const expenseItems = useMemo(() => categoryTotalsBetween(days, currentRange, 'expense'), [days, currentRange])
  // 캐릭터 줄은 메모돼 있어 기간이나 읽은 값이 바뀔 때만 그림을 다시 찾는다.
  useEffect(() => {
    let alive = true
    void loadStatsImages(characters).then((loaded) => {
      if (alive) setImages(loaded)
    })
    return () => {
      alive = false
    }
  }, [characters])

  /**
   * 그래프가 화면에 들어오는 순간. 섹션마다 스크롤 내용 안의 윗변을 기억해 두고, 스크롤과 레이아웃 때
   * 화면 아래 끝을 넘어 들어온 섹션을 한 번씩 보임으로 바꾼다. 보이면 그 섹션의 그래프가 자란다.
   */
  const { height: viewportHeight } = useWindowDimensions()
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set())
  const contentTop = useRef(0)
  const sectionTops = useRef(new Map<string, number>())
  const scrollY = useRef(0)
  const revealVisible = useCallback(() => {
    setRevealed((before) => {
      // 레이아웃은 자식이 먼저 알린다. 섹션 위치는 목록 안의 값으로 두고 목록의 윗변은 판정할 때 더한다.
      const tops = new Map([...sectionTops.current].map(([id, top]) => [id, contentTop.current + top]))
      const next = sectionsToReveal(tops, scrollY.current, viewportHeight, before)
      return next.length === 0 ? before : new Set([...before, ...next])
    })
  }, [viewportHeight])
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y
      revealVisible()
    },
    [revealVisible],
  )
  const onSectionLayout = useCallback(
    (id: string) => (event: LayoutChangeEvent) => {
      sectionTops.current.set(id, event.nativeEvent.layout.y)
      revealVisible()
    },
    [revealVisible],
  )

  const current = totalsBetween(days, ranges.current)
  const previous = totalsBetween(days, ranges.previous)
  const replayKey = `${cycle}-${periodKey}`
  const label = formatBossProfitPeriodLabel(cycle, periodKey, now)
  const isLatest = isLatestPeriod(cycle, periodKey, now)
  const isEarliest =
    cycle === 'weekly' ? periodKey <= floorWeekStartKey(todayMonthKey) : periodKey <= floorMonthKey(todayMonthKey)
  const unit = cycle === 'weekly' ? '주' : '달'

  function selectCycle(next: BossCycle): void {
    setCycle(next)
    setPeriodKey(getCurrentBossProfitPeriod(next, now).periodKey)
  }

  return (
    <View testID="screen-Stats" className="flex-1">
      <ScreenScroll
        onRefresh={() => ledger.reload(['live', 'window', 'enhancement'])}
        onScroll={onScroll}
        header={
          <PageHeader>
            <PageHeaderTitleRow
              fetchedAt={fetchedAt}
              trailing={
                <TabSegment
                  options={CYCLES}
                  selected={cycle}
                  onSelect={selectCycle}
                  labelOf={(value) => CYCLE_LABELS[value]}
                />
              }
            >
              <Text className="text-lg font-semibold text-text">통계</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View
          testID="stats-content"
          className="gap-2 px-4 pb-4"
          onLayout={(event: LayoutChangeEvent) => {
            contentTop.current = event.nativeEvent.layout.y
            revealVisible()
          }}
        >
          <View testID="stats-period-nav" className="flex-row items-center justify-center gap-4 py-3">
            <View className="h-7 w-7" />
            <PeriodArrow
              label={`이전 ${unit}`}
              icon={ChevronLeftIcon}
              disabled={isEarliest}
              onPress={() => setPeriodKey(getAdjacentPeriodKey(cycle, periodKey, 'prev'))}
            />
            <View className="items-center">
              <Text testID="stats-period-label" className="text-sm font-semibold text-text">
                {label.primary}
              </Text>
              <Text className="mt-0.5 text-xs text-text-muted" style={TABULAR_NUMS}>
                {label.secondary}
              </Text>
            </View>
            <PeriodArrow
              label={`다음 ${unit}`}
              icon={ChevronRightIcon}
              disabled={isLatest}
              onPress={() => setPeriodKey(getAdjacentPeriodKey(cycle, periodKey, 'next'))}
            />
            <PeriodArrow
              label={cycle === 'weekly' ? '이번 주로 이동' : '이번 달로 이동'}
              icon={ChevronsRightIcon}
              disabled={isLatest}
              onPress={() => setPeriodKey(getCurrentBossProfitPeriod(cycle, now).periodKey)}
            />
          </View>

          <StatsSection title="순 수익" testID="stats-summary">
            <View className="flex-row items-end justify-between gap-3">
              <View className="shrink">
                <View className="flex-row items-center">
                  <Text
                    testID="stats-summary-net"
                    numberOfLines={1}
                    className={`text-xl font-bold ${current.netMeso > 0 ? 'text-rise-ink' : current.netMeso < 0 ? 'text-fall-ink' : 'text-text'}`}
                    style={TABULAR_NUMS}
                  >
                    {signed(current.netMeso)}{' '}
                    <Text className="text-11 font-bold text-text-muted">메소</Text>
                  </Text>
                  <DeltaChip totalMeso={current.netMeso} previousMeso={previous.netMeso} tab={cycle} periodKey={periodKey} now={now} />
                </View>
              </View>
              <View className="shrink-0 items-end gap-1">
                <View className="flex-row items-baseline gap-1.5">
                  <Text className="text-11 text-text-muted">수입</Text>
                  <Text className="w-16 text-right text-11 font-medium text-rise-ink" style={TABULAR_NUMS}>
                    +{formatMesoCompact(current.incomeMeso)}
                  </Text>
                </View>
                <View className="flex-row items-baseline gap-1.5">
                  <Text className="text-11 text-text-muted">지출</Text>
                  <Text className="w-16 text-right text-11 font-medium text-fall-ink" style={TABULAR_NUMS}>
                    −{formatMesoCompact(current.expenseMeso)}
                  </Text>
                </View>
              </View>
            </View>
          </StatsSection>

          <View onLayout={onSectionLayout('trend')}>
            <TrendSection days={days} cycle={cycle} trend={trend} revealed={revealed.has('trend')} />
          </View>

          <View onLayout={onSectionLayout('characters')}>
            <CharacterSection rows={characters} images={images} revealed={revealed.has('characters')} replayKey={replayKey} />
          </View>

          <View onLayout={onSectionLayout('income')}>
            <CategorySection
              title="수입 내역"
              side="income"
              items={incomeItems}
              revealed={revealed.has('income')}
              replayKey={replayKey}
            />
          </View>
          <View onLayout={onSectionLayout('expense')}>
            <CategorySection
              title="지출 내역"
              side="expense"
              items={expenseItems}
              revealed={revealed.has('expense')}
              replayKey={replayKey}
            />
          </View>

          <BossSection days={days} range={currentRange} />

          <View onLayout={onSectionLayout('cumulative')}>
            <CumulativeSection days={days} cycle={cycle} periodKey={periodKey} revealed={revealed.has('cumulative')} />
          </View>
        </View>
      </ScreenScroll>
    </View>
  )
}

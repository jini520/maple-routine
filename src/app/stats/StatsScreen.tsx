/**
 * 통계. 수익·지출 그룹의 셋째 하위이고, 보스 수익과 가계부의 기록을 기간 단위로 모아 읽기만 한다.
 *
 * @see docs/features/stats.md
 */
import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, Text } from '../../components/atoms'
import { TabSegment } from '../../components/molecules/TabSegment/TabSegment'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { floorMonthKey, floorWeekStartKey } from '../../features/cashbook/range'
import { useLedgerData } from '../../features/ledger/useLedgerData'
import { useDataFreshness } from '../../features/refresh/freshness'
import {
  categoryTotalsBetween,
  characterTotalsBetween,
  totalsBetween,
  type DaysByDate,
} from '../../features/stats/aggregate'
import { loadStatsDays, loadStatsImages } from '../../features/stats/load'
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

  // 강화 내역은 날마다 API 를 부르므로 층에는 고른 기간만 요청한다. 지난 기간은 받아 둔 것을 쓴다.
  const { requestDateRange } = ledger
  useEffect(() => {
    requestDateRange({ from: ranges.current.from, to: ranges.current.to })
  }, [requestDateRange, ranges])

  useEffect(() => {
    let alive = true
    void loadStatsDays(todayDateKey).then((loaded) => {
      if (alive) setDays(loaded)
    })
    return () => {
      alive = false
    }
  }, [ledger.revision, todayDateKey])

  const characters = characterTotalsBetween(days, ranges.current)
  const characterOcids = characters.flatMap((row) => (row.ocid === null ? [] : [row.ocid])).join(',')
  useEffect(() => {
    let alive = true
    void loadStatsImages(characterOcids === '' ? [] : characterOcids.split(',')).then((loaded) => {
      if (alive) setImages(loaded)
    })
    return () => {
      alive = false
    }
  }, [characterOcids])

  const current = totalsBetween(days, ranges.current)
  const previous = totalsBetween(days, ranges.previous)
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
        <View testID="stats-content" className="gap-2 px-4 pb-4">
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

          <TrendSection key={`${cycle}-${periodKey}`} days={days} cycle={cycle} trend={ranges.trend} />

          <CharacterSection rows={characters} images={images} />

          <CategorySection
            key={`income-${cycle}-${periodKey}`}
            title="수입 내역"
            side="income"
            items={categoryTotalsBetween(days, ranges.current, 'income')}
          />
          <CategorySection
            key={`expense-${cycle}-${periodKey}`}
            title="지출 내역"
            side="expense"
            items={categoryTotalsBetween(days, ranges.current, 'expense')}
          />

          <BossSection days={days} range={ranges.current} />

          <CumulativeSection key={`cumulative-${cycle}-${periodKey}`} days={days} cycle={cycle} periodKey={periodKey} />
        </View>
      </ScreenScroll>
    </View>
  )
}

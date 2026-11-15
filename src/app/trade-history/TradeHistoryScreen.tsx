/**
 * 거래 내역. 아이템을 사고판 기록을 날짜 제목 아래 최신 순으로 모으고, 판매 · 구매 · 기간 · 캐릭터 · 아이템 이름으로 좁힌다.
 * 줄을 누르면 읽기 전용 상세 시트가 열리고, `거래로 이동` 이 가계부에서 그 기록을 연다.
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import {
  CalendarIcon,
  ChevronRightIcon,
  ProfitIcon,
  ShoppingCartIcon,
  StickyNoteIcon,
  Text,
} from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { DateSelect } from '../../components/molecules/DateSelect/DateSelect'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { SearchField } from '../../components/molecules/SearchField/SearchField'
import { Segment } from '../../components/molecules/Segment/Segment'
import { CalendarPopover } from '../../components/organisms/CalendarPopover/CalendarPopover'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { loadTrackedCharacters } from '../../features/cashbook/records'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useRealtimeFetchedAt } from '../../features/refresh/freshness'
import { useTradeHistory } from '../../features/trade-history/query'
import {
  defaultTradePeriod,
  filterTradeRows,
  tradeDateLabel,
  tradeSectionsOf,
  type TradeFilter,
  type TradeRow,
} from '../../features/trade-history/rows'
import { tradeTargetOf } from '../../features/trade-history/target'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { useOpenTab } from '../../hooks/useOpenTab'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { monthKeyOf } from '../../lib/calendar'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { characterDecorOf } from '../cashbook/character-options'
import { SelectRow } from '../cashbook/sheet-fields'
import { TradeDetailSheet } from './TradeDetailSheet'

type Side = TradeFilter['side']

const SIDES: readonly Side[] = ['all', 'sale', 'purchase']
const SIDE_LABELS: Record<Side, string> = { all: '전체', sale: '판매', purchase: '구매' }

/** 캐릭터 칸의 `전체` 값. 보기 값은 `ownerKeyOf` 의 모양이라 겹치지 않는다. */
const ALL_OWNERS = 'all'

/** 기간 칸의 날짜 알약 하나. 누르면 그 날짜를 고르는 달력이 열린다. */
function PeriodDate(props: {
  dateKey: string
  todayDateKey: string
  min: string
  max: string
  label: string
  testID: string
  onChange: (next: string) => void
}): React.JSX.Element {
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  const [monthKey, setMonthKey] = useState(monthKeyOf(props.dateKey))
  return (
    <>
      <DateSelect
        ref={ref}
        dateKey={props.dateKey}
        label={props.label}
        text={tradeDateLabel(props.dateKey, props.todayDateKey, false)}
        testID={props.testID}
        onPress={() => {
          // 달력은 언제나 지금 고른 날이 든 달로 열린다.
          setMonthKey(monthKeyOf(props.dateKey))
          toggle()
        }}
      />
      {isOpen && (
        <CalendarPopover
          selected={props.dateKey}
          min={props.min}
          max={props.max}
          monthKey={monthKey}
          anchor={anchor}
          onChangeMonth={setMonthKey}
          onConfirm={(next) => {
            props.onChange(next)
            close()
          }}
          onClose={close}
        />
      )}
    </>
  )
}

/** 목록의 한 줄. 판매 · 구매 글자가 맨 왼쪽, 그림은 이름 바로 앞, 캐릭터와 금액은 둘째 줄, 메모는 그 아래 칸이다. */
function TradeRowCard(props: { row: TradeRow; onPress: () => void }): React.JSX.Element {
  const { row } = props
  const sale = row.side === 'sale'
  const ink = sale ? 'text-rise-ink' : 'text-fall-ink'
  const Fallback = sale ? ProfitIcon : ShoppingCartIcon
  return (
    <Pressable
      testID={`trade-row-${row.key}`}
      role="button"
      aria-label={`${SIDE_LABELS[row.side]} ${row.name}${row.quantity === null ? '' : ` ${row.quantity}`} ${row.ownerName} ${row.amountText}${row.memo === null ? '' : ' 메모 있음'}`}
      onPress={props.onPress}
      className="flex-row items-start gap-2.5 rounded-[14px] bg-surface py-3 pl-3 pr-2.5 active:opacity-60"
    >
      {/* 윗줄 높이(그림 24)의 가운데에 글자를 맞춘다. */}
      <Text testID={`trade-row-side-${row.key}`} className={`mt-[3.5px] shrink-0 text-xs font-semibold ${ink}`}>
        {SIDE_LABELS[row.side]}
      </Text>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center">
          {row.icon === null ? (
            <View className={`mr-1.5 h-6 w-6 items-center justify-center rounded-full ${sale ? 'bg-rise-tint' : 'bg-fall-tint'}`}>
              <Fallback className={`h-3.5 w-3.5 ${ink}`} strokeWidth={2} aria-hidden />
            </View>
          ) : (
            <Image source={row.icon} className="mr-1.5 h-6 w-6" resizeMode="contain" aria-hidden />
          )}
          {/* 이름이 길면 이름만 줄고 개수는 남는다. 개수가 잘리면 같은 아이템의 기록끼리 가를 수 없다. */}
          <Text numberOfLines={1} testID={`trade-row-name-${row.key}`} className="shrink text-sm font-semibold text-text">
            {row.name}
          </Text>
          {row.quantity !== null && (
            <Text testID={`trade-row-quantity-${row.key}`} className="ml-1 shrink-0 text-sm font-semibold text-text" style={TABULAR_NUMS}>
              {row.quantity}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="flex-1 text-xs text-text-muted">
            {row.ownerName}
          </Text>
          <Text className={`shrink-0 text-sm font-bold ${ink}`} style={TABULAR_NUMS}>
            {row.amountText}
          </Text>
        </View>
        {row.memo !== null && (
          <View testID={`trade-row-memo-${row.key}`} className="mt-2 flex-row items-start gap-2 rounded-[10px] bg-card-inset px-2.5 py-2">
            <StickyNoteIcon className="mt-[3px] h-[11px] w-[11px] text-text-muted" strokeWidth={2} aria-hidden />
            <Text className="flex-1 text-xs text-text">{row.memo}</Text>
          </View>
        )}
      </View>
      <ChevronRightIcon className="mt-1 h-4 w-4 text-text-disabled" strokeWidth={2} aria-hidden />
    </Pressable>
  )
}

export function TradeHistoryScreen(): React.JSX.Element {
  const faq = useFaqSheet('trade-history')
  const navigation = useScreenNavigation()
  const openTab = useOpenTab()
  const fetchedAt = useRealtimeFetchedAt()
  // 페이지를 열 때의 오늘. 열 때마다 처음 값으로 서므로 자정을 넘겨도 기간을 옮기지 않는다.
  const [todayDateKey] = useState(() => getCurrentKstDateKey(new Date()))
  const data = useTradeHistory(todayDateKey)
  const [filter, setFilter] = useState<TradeFilter>(() => ({
    ...defaultTradePeriod(todayDateKey),
    side: 'all',
    owner: null,
    query: '',
  }))
  const [opened, setOpened] = useState<TradeRow | null>(null)
  /** 캐릭터 칸의 월드 엠블럼을 찾을 캐릭터. 가계부 시트와 같은 목록이다. */
  const [characters, setCharacters] = useState<ReadonlyArray<{ ocid: string; worldKey: string | null }>>([])

  useEffect(() => {
    void loadTrackedCharacters().then(setCharacters, () => undefined)
  }, [])

  const floorDateKey = data?.floorDateKey ?? filter.from
  const sections = data === null ? [] : tradeSectionsOf(filterTradeRows(data.rows, filter), todayDateKey)
  const decorOfCharacter = characterDecorOf(characters)
  const ownerOptions = [{ value: ALL_OWNERS, label: '전체' }, ...(data?.owners ?? [])]

  function goToTrade(row: TradeRow): void {
    setOpened(null)
    // 가계부 탭으로 간다. 거래 내역은 스택에서 빠지고, 고친 뒤에도 가계부에 남는다.
    openTab('Cashbook', { trade: tradeTargetOf(row) })
  }

  return (
    <View testID="screen-TradeHistory" className="flex-1">
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow
              fetchedAt={fetchedAt}
              className="gap-2"
              trailing={
                <Segment
                  size="lg"
                  className="self-start"
                  options={SIDES}
                  selected={filter.side}
                  onSelect={(side) => setFilter((current) => ({ ...current, side }))}
                  labelOf={(side) => SIDE_LABELS[side]}
                />
              }
            >
              <BackButton onPress={() => navigation.goBack()} />
              <View className="flex-row items-center">
                <Text className="text-lg font-bold text-text">거래 내역</Text>
                <FaqButton sheet={faq} />
              </View>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4">
          <View testID="trade-history-filters" className="gap-1 rounded-[14px] bg-surface p-1.5">
            <View className="min-h-11 flex-row items-center gap-3 rounded-[10px] bg-card-inset px-3 py-2">
              <Text className="shrink-0 text-xs text-text-muted">기간</Text>
              <View className="flex-1 flex-row items-center justify-end gap-1.5">
                <PeriodDate
                  dateKey={filter.from}
                  todayDateKey={todayDateKey}
                  min={floorDateKey}
                  max={filter.to}
                  label="시작일"
                  testID="trade-history-from"
                  onChange={(from) => setFilter((current) => ({ ...current, from }))}
                />
                <Text className="text-xs text-text-muted">~</Text>
                <PeriodDate
                  dateKey={filter.to}
                  todayDateKey={todayDateKey}
                  min={filter.from}
                  max={todayDateKey}
                  label="끝일"
                  testID="trade-history-to"
                  onChange={(to) => setFilter((current) => ({ ...current, to }))}
                />
              </View>
            </View>
            <SelectRow
              testID="trade-history-owner"
              label="캐릭터"
              placeholder="전체"
              options={ownerOptions}
              selected={filter.owner ?? ALL_OWNERS}
              onSelect={(value) =>
                setFilter((current) => ({ ...current, owner: value === null || value === ALL_OWNERS ? null : value }))
              }
              decorOf={(value) => (value.startsWith('character:') ? decorOfCharacter(value.slice('character:'.length)) : null)}
            />
            <SearchField
              testID="trade-history-search"
              placeholder="아이템 검색"
              value={filter.query}
              onChange={(query) => setFilter((current) => ({ ...current, query }))}
            />
          </View>

          {data === null && <LoadingState size="page" message="불러오고 있어요" />}
          {/* 기록이 아예 없을 때와 필터에 맞는 기록이 없을 때 같은 문구다(사용자 지정). 가계부의 빈 목록과 같은 글자다. */}
          {data !== null && sections.length === 0 && (
            <EmptyState icon={CalendarIcon} title="아직 기록이 없어요" />
          )}

          {sections.map((section) => (
            <View key={section.dateKey} testID={`trade-history-day-${section.dateKey}`} className="gap-2">
              <Text className="px-1 text-sm font-bold text-text">{section.title}</Text>
              <View className="gap-1.5">
                {section.rows.map((row) => (
                  <TradeRowCard key={row.key} row={row} onPress={() => setOpened(row)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScreenScroll>

      {opened !== null && (
        <TradeDetailSheet
          row={opened}
          todayDateKey={todayDateKey}
          onGoToTrade={() => goToTrade(opened)}
          onClose={() => setOpened(null)}
        />
      )}
    </View>
  )
}

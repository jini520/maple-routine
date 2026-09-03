/**
 * 보스 수익. 처치 보스 수익·기간 네비게이터·캐릭터별 아코디언.
 *
 * 이 저장소에서 밀도가 가장 높은 화면이라 동작 명세를 따로 뽑아 뒀다
 * (`BossProfitScreen.contract.md`). 그 표가 이 파일의 계약이고, 아래 주석은 그중 코드가 실제로
 * 갈린 자리만 짚는다.
 *
 * 구조가 대신 지키는 것 여섯.
 *
 * - 하위 페이지가 루트 스택 push 라 이 화면이 트리에 남는다.
 * - 헤더가 흐름 안이라 뺄 자리가 없어 spacer 도 실측도 없다.
 * - `ScrollView` 가 기본값이라 문서 스크롤을 옮길 일이 없다.
 * - 헤더가 `ScreenScroll` 의 `header` 다.
 * - 당겨서 새로고침은 `RefreshControl` 이 진다.
 * - 하위 페이지가 덮어 아래 화면의 당김에 손가락이 안 닿는다.
 *
 * @see docs/features/boss-profit.md 정책
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ScrollView } from 'react-native'
import { Pressable, RefreshControl, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { useBossProfitStore } from '../../features/boss-profit/store'
import { usePeriodLoadErrorToast } from '../../features/boss-profit/use-period-error-toast'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import {
  useScheduleSyncErrorToast,
  useStaleCharactersToast,
} from '../../features/schedule-sync/use-sync-error-toast'
import {
  formatBossProfitPeriodLabel,
  isLatestPeriod,
  isPeriodQueryable,
  isPeriodRefreshable,
} from '../../lib/boss/boss-profit-period'
import { sumDropPayout } from '../../lib/drop/drop-price'

import {
  AnimatedNumber,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ProfitIcon,
  RefreshCwIcon,
  Text,
} from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { UnavailableNotice } from '../../components/molecules/EmptyState/UnavailableNotice'
import { ValuableDropBadge } from '../../components/molecules/ValuableDropBadge/ValuableDropBadge'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../constants/style/animation'
import { AnimatedView } from '../../lib/nativewind-interop'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useTopSafeAreaPx } from '../../lib/safe-area'
import { orderByTracked } from '../../lib/scheduler/tracked-order'
import { useThemeAppearance } from '../../theme/context'
import { useOpenTab } from '../use-open-tab'
import { useScreenNavigation } from '../use-screen-navigation'
import { usePullRefresh } from '../use-pull-refresh'
import type { BossProfitContextValue } from './boss-profit-context'
import { BossProfitContextProvider } from './boss-profit-context'
import { CharacterAccordion } from './CharacterAccordion'
import {
  buildCharacterGroups,
  collectAllValuableDrops,
  collectGroupDrops,
  groupTotalMeso,
} from './character-groups'
// `DeltaChip` 은 증감 표시를 통계 기능으로 옮길 때까지 쓰이지 않는다. 컴포넌트와 테스트는
// 그대로 두고 여기서 부르지만 않는다.
import { CrystalSummaryChip } from './HeadlineChips'
import { ItemRevenuePopover, useAnchoredPopover } from './ItemRevenuePopover'

export function BossProfitScreen(): React.JSX.Element {
  const {
    status,
    tab,
    periodKey,
    loadedTab,
    loadedPeriodKey,
    rows,
    weeklySubtotals,
    isPeriodLoading,
    periodState,
    canGoPreviousPeriod,
    error,
    staleCharacterNames,
    characterIssues,
    trackedOcids,
    lastSyncedAt,
    loadTrackedOcids,
    refresh,
    setTab,
    goToPreviousPeriod,
    goToNextPeriod,
    retryPeriod,
    setPartySize,
    setBossDrops,
    dropsByRowKey,
  } = useBossProfitStore()
  // 당김이 시작한 회차에만 인디케이터가 돈다. 헤더 버튼·자동 조회는 같은 재조회를 부르지만
  // 인디케이터는 안 연다. 버튼은 자기 스피너와 조회 중… 을 이미 갖고 있고 자동 조회는 원래
  // 조용해야 하는 것이다.
  const pull = usePullRefresh(() => refresh(trackedOcids ?? []))

  const navigation = useScreenNavigation()
  const openTab = useOpenTab()
  const topSafeAreaPx = useTopSafeAreaPx()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()

  // 동기화 전체 실패는 토스트로 알린다. 기간 라벨·"n분 전" 표기가 남아 맥락은 화면에 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })
  // 일부 캐릭터만 실패한 경우도 토스트다. 본문이 한 줄이라 이름을 나열하면 잘리므로 인원 수만
  // 싣는다.
  useStaleCharactersToast(staleCharacterNames, () => refresh(trackedOcids ?? []))

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `null` 은 0명이 아니라 저장소를 아직 안 읽었다 다. 둘을 묶으면 콜드 스타트 첫 페인트가
  // 아직 모르는 사실을 단정한다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // `now` 는 렌더당 한 번만 만든다. 두 번 호출하면 두 시각이 기간 경계를 사이에 두고 갈려
  // "현재 기간 판정"과 "기간 라벨"이 서로 다른 기간을 가리킬 수 있다.
  const now = new Date()
  const isCurrentPeriod = isLatestPeriod(tab, periodKey, now)
  // 동기화 상태 영역·당겨서 새로고침의 공통 게이트. 이 기간이 최신인가 가 아니라 지금
  // 재조회하면 이 화면의 숫자가 달라질 수 있는가 다. 갈라 두면 버튼은 없는데 당기면 도는
  // 상태가 생긴다.
  const canRefreshPeriod = isPeriodRefreshable(tab, periodKey, now)

  // 최상단 이동이 쓰는 스크롤 주체.
  const scrollRef = useRef<ScrollView | null>(null)
  // 총 수익 내역 상자. 카드·보스 행과 같은 상자를 쓴다. 훅은 아래 빈 상태 조기 반환보다 위에
  // 있어야 한다. 렌더마다 호출 순서가 같아야 한다.
  const {
    ref: periodChipRef,
    isOpen: isPeriodPopoverOpen,
    anchor: periodAnchor,
    toggle: togglePeriodPopover,
    close: closePeriodPopover,
  } = useAnchoredPopover()

  // 기간·탭이 바뀌면 최상단으로. 헤더가 sticky 가 아니라 그냥 콘텐츠라 오프셋과 어긋날 두
  // 값이 없다. 목적지는 0 이다.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [tab, periodKey])

  // 아래 `usePeriodLoadErrorToast` 가 이 값을 읽으므로 조기 반환보다 위에서 계산한다. 순수
  // 함수라 위치를 올려도 결과가 같고, 토스트 조건과 화면 조건이 같은 값을 보게 된다.
  //
  // 그룹의 순서는 행의 순서(= 스토어의 레벨 내림차순)가 아니라 사용자가 캐릭터 관리에서 정한
  // 저장 배열 순서다. 캐릭터 안쪽 보스 순서는 안 건드린다. 바뀌는 것은 카드가 서는 차례뿐이다.
  const characterGroups = orderByTracked(buildCharacterGroups(rows, weeklySubtotals), trackedOcids ?? [])

  // 기간 로드 실패는 카드가 있을 때만 토스트다. 카드가 없으면 문구가 사라진 자리에 빈 칸이
  // 남으므로 아래에서 `ErrorState` 를 그린다.
  usePeriodLoadErrorToast({
    isFailed: periodState === 'failed' && characterGroups.length > 0,
    isLoading: isPeriodLoading,
    periodKey,
    onRetry: () => void retryPeriod(),
  })

  const totalMeso = characterGroups.reduce(
    (sum, group) => sum + groupTotalMeso(group, dropsByRowKey),
    0,
  )

  if (isEmpty) {
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다.
    // 높이는 `flex-1` 이다. 탭 상자가 이미 탭바를 뺀 크기다.
    return (
      <View testID="screen-Profit" className="flex-1 p-4" style={{ paddingTop: topSafeAreaPx }}>
        {/* 헤더 셸을 안 쓰는 가지에서도 제목 줄은 같은 프리미티브다. */}
        <PageHeaderTitleRow>
          <Text className="text-lg font-semibold text-text">보스 수익</Text>
        </PageHeaderTitleRow>

        <View className="flex-1 items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="추적 중인 캐릭터가 없습니다"
            description="설정에서 캐릭터를 선택하면 수익 현황을 확인할 수 있습니다"
            action={{
              label: '캐릭터 선택하러 가기',
              // 피커를 열어 둔 채로 설정 탭에 보낸다.
              onClick: () => openTab('Settings', { openPicker: true }),
            }}
          />
        </View>
      </View>
    )
  }

  const periodLabel = formatBossProfitPeriodLabel(tab, periodKey, now)
  // 이전 이동 가능 여부는 스토어가 매 기간 로드 시 계산해 둔 값으로 판단한다. 조회 불가능하고
  // 캐시 기록도 없는 기간에 착지하지 않도록 막는다.
  const isPrevDisabled = !canGoPreviousPeriod
  // 현재 기간은 백필 가능성을 묻지 않는다. 조회일이 미래라 `isPeriodQueryable` 이 false 지만
  // 그건 조회 불가가 아니라 실시간 동기화가 원천이라는 뜻이다.
  const periodQueryable = isCurrentPeriod || isPeriodQueryable(tab, periodKey, now)
  // 이 기간의 아이템 몫. 월간 탭은 주간 수익이 소계로만 들어오므로 그쪽 몫도 더해야 결정석과
  // 정확히 갈린다.
  const periodItemMeso = characterGroups.reduce(
    (sum, group) =>
      sum +
      sumDropPayout(collectGroupDrops(group, dropsByRowKey)) +
      group.weeklySubtotals.reduce((weekSum, subtotal) => weekSum + sumDropPayout(subtotal.drops), 0),
    0,
  )
  const crystalTotalMeso = totalMeso - periodItemMeso
  // 총 수익 헤드라인 우측 뱃지용. 이 기간 전체 고가 드롭.
  const periodValuableDrops = collectAllValuableDrops(characterGroups, dropsByRowKey)

  // 기간·탭 맥락과 스토어 바인딩을 자손에게 내린다. 이 열 개는 4단계를 타고 내려가며 51지점을
  // 만들고 있었다. 참조 동일성을 위한 메모이제이션은 하지 않는다.
  const bossProfitContext: BossProfitContextValue = {
    tab,
    periodKey,
    loadedTab,
    loadedPeriodKey,
    now,
    dropsByRowKey,
    setPartySize,
    setBossDrops,
    isMonthlyBossQueryable: periodQueryable,
    onRetryPeriod: () => void retryPeriod(),
  }

  const header = (
    // 공용 `PageHeader` 를 쓰지 않는다. 그 셸의 하단 페이드를 이 화면은 금지한다. 나머지 값은
    // 그 컴포넌트와 같고 상단 여백을 더하지 않는 것도 함께다. 그 안전영역은 `useTopSafeAreaPx()`
    // 다. 셸을 복제한 화면이 인셋을 직접 읽으면 이 화면만 안드로이드에서 16.7px 위에 선다.
    <View testID="page-header" className="z-10 px-4 pb-2" style={{ paddingTop: topSafeAreaPx }}>

      <View className="gap-4">
        {/* 히스토리 진입점은 탭 줄이 아니라 제목 줄 우측이고 아이콘이 아니라 글자다. 진입점
            둘은 같은 어휘를 쓰고 `아이템 가격`(쓰기)이 `히스토리`(읽기) 왼쪽이다. 값을 매기는
            쪽이 주마다 들르는 자리다. */}
        <PageHeaderTitleRow className="justify-between">
          <Text className="text-lg font-semibold text-text">보스 수익</Text>
          <View className="flex-row items-center gap-3">
            <Pressable role="button" onPress={() => navigation.navigate('DropPrice')}>
              <Text className="text-sm font-medium text-text-muted">아이템 가격</Text>
            </Pressable>
            <Pressable role="button" onPress={() => navigation.navigate('DropHistory')}>
              <Text className="text-sm font-medium text-text-muted">히스토리</Text>
            </Pressable>
          </View>
        </PageHeaderTitleRow>

        <View className="flex-row items-center gap-4">
          <Pressable role="button" aria-selected={tab === 'weekly'} onPress={() => setTab('weekly')}>
            <Text
              className={
                tab === 'weekly'
                  ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                  : 'px-3 text-sm font-medium text-text-muted'
              }
            >
              주간
            </Text>
          </Pressable>
          <Pressable role="button" aria-selected={tab === 'monthly'} onPress={() => setTab('monthly')}>
            <Text
              className={
                tab === 'monthly'
                  ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                  : 'px-3 text-sm font-medium text-text-muted'
              }
            >
              월간
            </Text>
          </Pressable>

          {/* 동기화 상태 영역은 새로고침이 의미 있는 기간에서만 노출한다. 완전히 닫힌 과거
              기간은 조회 중… 도 재조회 버튼도 뜻이 없다. 제목 줄이 아니라 탭과 같은 줄이다. */}
          {canRefreshPeriod && (
            <View className="ml-auto shrink-0 flex-row items-center gap-2">
              <Text className="text-sm text-text-muted">
                {status === 'loading' ? '조회 중...' : formatSyncedAt(lastSyncedAt)}
              </Text>
              {/* 이 줄의 높이는 활성 탭 pill(30px)이 정한다. 기본 `p-2`(32px)면 새로고침이 없는
                  과거 기간과 2px 어긋난다. */}
              <Pressable
                role="button"
                aria-label="새로고침"
                onPress={() => refresh(trackedOcids ?? [])}
                className="h-[30px] w-[30px] items-center justify-center"
              >
                <AnimatedView
                  testID="refresh-icon"
                  style={status === 'loading' && !reduceMotion ? SPIN_ANIMATION : undefined}
                >
                  <RefreshCwIcon className="h-4 w-4 text-primary-ink" strokeWidth={2} aria-hidden />
                </AnimatedView>
              </Pressable>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-center gap-4">
          <Pressable
            role="button"
            aria-label="이전 기간"
            aria-disabled={isPrevDisabled}
            disabled={isPrevDisabled}
            onPress={() => goToPreviousPeriod()}
            className={
              isPrevDisabled
                ? 'h-7 w-7 items-center justify-center rounded-full border border-border opacity-30'
                : 'h-7 w-7 items-center justify-center rounded-full border border-border'
            }
          >
            <ChevronLeftIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
          </Pressable>

          <View className="items-center">
            <Text className="text-sm font-semibold text-text">{periodLabel.primary}</Text>
            <Text className="mt-0.5 text-xs text-text-muted" style={TABULAR_NUMS}>
              {periodLabel.secondary}
            </Text>
          </View>

          {/* 최신 기간에선 다음 이동을 막는다. */}
          <Pressable
            role="button"
            aria-label="다음 기간"
            aria-disabled={isCurrentPeriod}
            disabled={isCurrentPeriod}
            onPress={() => goToNextPeriod()}
            className={
              isCurrentPeriod
                ? 'h-7 w-7 items-center justify-center rounded-full border border-border opacity-30'
                : 'h-7 w-7 items-center justify-center rounded-full border border-border'
            }
          >
            <ChevronRightIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
          </Pressable>
        </View>

        {/* 보여줄 데이터가 아예 없을 때만 셸 승계 카드를 그린다. */}
        {!isPeriodLoading &&
          (status === 'idle' || status === 'loading') &&
          characterGroups.length === 0 && <LoadingState size="page" message="불러오고 있어요" />}

        {/* 상태마다 얼굴이 다르다. 기록이 있으면 아무것도 띄우지 않는다. 목요일 새벽처럼 백필만
            막힌 경우 기록은 정확하고 사용자가 할 일도 없다. `failed` 는 액션이 필요해 토스트로
            옮겼다. */}
        {!isPeriodLoading && characterGroups.length > 0 && periodState === 'notCollected' && (
          <View className="flex-row items-center gap-1.5">
            <ClockIcon className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
            <Text className="text-sm text-text-muted">
              아직 집계되지 않았습니다. 준비되면 자동으로 채워집니다
            </Text>
          </View>
        )}

        {/* 총 수익 요약은 **카드가 아니라 헤드라인**이다. 아래 캐릭터 카드가 전부 같은
            카드 셸이라 요약도 카드면 "동일한 흰 카드의 반복"으로 묻힌다. */}
        {!isPeriodLoading && characterGroups.length > 0 && (
          <View>
            {/* 라벨행 높이를 `h-6`(24px)으로 명시 고정한다. 라벨(16px)이 우연히 정하는 값이면
                그보다 큰 요소를 흐름에 넣는 순간 줄이 커진다. 그것이 24px 고가 드롭 배지를
                흐름 밖으로 빼낸 이유다. */}
            <View className="relative h-6 flex-row items-center">
              <Text className="text-xs font-semibold tracking-wide text-text-muted">
                {periodLabel.primary} 총 수익
              </Text>
              {/* 결정석 판매 현황은 라벨 텍스트 바로 옆이다. 우측 끝은 고가 드롭 배지의
                  절대배치 자리라 침범하지 않는다. */}
              <CrystalSummaryChip tab={tab} groups={characterGroups} />
              {periodValuableDrops.length > 0 && (
                <ValuableDropBadge
                  drops={periodValuableDrops}
                  label="이 기간 고가 드롭"
                  className="absolute right-0"
                />
              )}
            </View>

            <View className="mt-1.5 flex-row items-center gap-2.5">
              <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint">
                <ProfitIcon className="h-[18px] w-[18px] text-primary-ink" strokeWidth={2} aria-hidden />
              </View>
              {/* 단위는 별도 `Text` 로 격하하되 숫자와 사이에 **실제 공백 문자**를 남긴다. 마진만
                  으로 띄우면 읽는 문자열이 "N메소"로 붙어 스크린리더가 이어 읽는다. */}
              <Text
                className="text-xl font-extrabold leading-none text-primary-ink"
                style={TABULAR_NUMS}
              >
                {/* 이 키에만 기간이 없다. 기간이 바뀌어도 같은 자리의 같은 뜻을 가진 하나의
                    숫자로 보고 굴린다. */}
                <AnimatedNumber identity={`total|${loadedTab}`} value={totalMeso} />{' '}
                <Text className="text-xs font-bold text-text-muted">메소</Text>
              </Text>
              {/* 증감 칩은 뺀 채로 둔다. 총 수익에서는 뜻이 퇴색한다고 봤고 통계 기능이 생기면
                  그쪽으로 옮긴다. `DeltaChip` 과 스토어의 `previousPeriodTotalMeso` 는 지우지
                  않는다. 그 자리를 자세히 보기가 받는다. */}
              <Pressable
                ref={periodChipRef}
                role="button"
                aria-label="총 수익 자세히 보기"
                aria-expanded={isPeriodPopoverOpen}
                onPress={togglePeriodPopover}
                className="ml-auto h-6 shrink-0 flex-row items-center gap-0.5 rounded-full border border-border px-2.5"
              >
                <Text className="text-11 font-semibold text-text-muted">자세히 보기</Text>
                <ChevronDownIcon
                  className="h-3 w-3 shrink-0 text-text-muted"
                  strokeWidth={2.5}
                  aria-hidden
                />
              </Pressable>
            </View>

            {/* 헤더 바닥 경계 = 카드 테두리 대체. 이 화면에 페이드가 없는 이유가 이 한 줄이다. */}
            <View className="mt-3 h-px bg-border" aria-hidden />
          </View>
        )}
      </View>
    </View>
  )

  return (
    <BossProfitContextProvider value={bossProfitContext}>
      <View testID="screen-Profit" className="flex-1">
        <ScreenScroll
          ref={scrollRef}
          header={header}
          // 당김은 헤더 버튼과 같은 재조회를 부르고 색만 테마에서 넘긴다. 빈 상태는 이 가지에
          // 오지 않고, 새로고침이 의미 없는 기간에서는 컨트롤 자체를 달지 않는다.
          refreshControl={
            canRefreshPeriod ? (
              <RefreshControl
                refreshing={pull.refreshing}
                onRefresh={pull.onRefresh}
                tintColor={definition.primaryInk}
                colors={[definition.primaryInk]}
                progressBackgroundColor={definition.surface}
              />
            ) : undefined
          }
        >
          <View testID="pull-content" className="gap-2 px-4 pb-4">
            {/* 점선 박스(빈 상태의 어법)와 비-브랜드 링을 쓰지 않고 셸 승계 카드를 쓴다. 백필이
                끝나면 같은 자리·같은 껍데기에 캐릭터 카드가 들어온다. */}
            {isPeriodLoading && (
              <LoadingState message={`${periodLabel.primary} 기록을 불러오고 있어요`} />
            )}

            {/* 확정된 빈 상태와 확인 자체를 못 함은 디자인을 공유하지 않는다. 어느 쪽인지는
                스토어가 계산한 `periodState` 가 답한다. 화면이 따로 판정하면 백필과 어긋난다. */}
            {!isPeriodLoading &&
              status === 'loaded' &&
              characterGroups.length === 0 &&
              (periodState === 'confirmedEmpty' ? (
                <EmptyState
                  icon={ProfitIcon}
                  title="아직 처치한 보스가 없습니다"
                  description="보스를 처치하면 수익이 자동으로 집계됩니다"
                />
              ) : periodState === 'notCollected' ? (
                <UnavailableNotice variant="notCollected" />
              ) : periodState === 'failed' ? (
                <ErrorState
                  title="이 기간을 불러오지 못했습니다"
                  description="네트워크 상태를 확인해주세요"
                  action={{ label: '다시 시도', onClick: () => void retryPeriod() }}
                />
              ) : (
                <UnavailableNotice />
              ))}

            {!isPeriodLoading &&
              characterGroups.map((group) => (
                // key 에 탭·기간을 포함해 이동 시 아코디언을 remount 시킨다. 펼침 상태는
                // `CharacterAccordion` 로컬 state 라, key 가 그대로면 인스턴스가 재사용돼 한
                // 탭·기간에서 펼친 상태가 다른 탭·기간으로 그대로 이어진다.
                <CharacterAccordion
                  key={`${tab}-${periodKey}-${group.ocid}`}
                  group={group}
                  issue={characterIssues[group.ocid]}
                />
              ))}
          </View>
        </ScreenScroll>

        {/* 총 수익 내역. 카드·보스 행과 같은 상자다. 셸 바깥에 두는 것은 별도 네이티브
            윈도우라 트리 위치가 겹침에 영향을 주지 않기 때문이다. */}
        {isPeriodPopoverOpen && (
          <ItemRevenuePopover
            drops={characterGroups.flatMap((group) => collectGroupDrops(group, dropsByRowKey))}
            crystalMeso={crystalTotalMeso}
            itemMeso={periodItemMeso}
            anchor={periodAnchor}
            onClose={closePeriodPopover}
          />
        )}
      </View>
    </BossProfitContextProvider>
  )
}

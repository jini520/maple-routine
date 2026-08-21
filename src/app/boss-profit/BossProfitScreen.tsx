// 보스 수익 — 처치 보스 수익·기간 네비게이터·캐릭터별 아코디언(`docs/features/boss-profit.md`).
//
// **이 화면에 걸린 ADR 이 서른둘이다** — 저장소에서 가장 밀도 높은 파일이고, 그래서 옮기기 전에
// 동작 명세를 따로 뽑았다: **`BossProfitScreen.contract.md`**. 그 표가 이 파일의 계약이고, 아래
// 주석은 그중 코드가 실제로 갈린 자리만 짚는다.
//
// ══ 못 옮긴 것 둘 — 먼저 적는다 ═════════════════════════════════════════════════════
//
// ① **중첩 sticky**([[ADR-047]])와 그에 딸린 셋(배지 sticky 레일 · stuck 헤더 하단 페이드 ·
//    페이지 헤더 실측 `stickyTop`). 근거는 `CharacterAccordion` 파일 머리와 명세 문서에 있다 —
//    요약하면 RN 의 sticky 는 스크롤 뷰의 직계 자식만 붙일 수 있어 카드를 두 조각으로 펴야 하는데
//    그러면 [[ADR-045]] 의 카드 링과 [[ADR-049]] 의 셸 클리핑이 함께 깨지고, 손수 만드는 길은
//    공용 셸을 바꿔야 하는 데다 jest 가 한 줄도 검증하지 못한다.
//    **육안 대조 1순위다** — [[ADR-047]] 후속 3 이 소계 footer 를 지운 근거가 sticky 였으므로,
//    없으면 보스 행을 스크롤하는 동안 그 캐릭터의 합계가 화면에서 사라진다.
// ② **테마 배경 조각은 없앴다**([[ADR-133]]). 한때 [[ADR-088]] 결정 5-1 을 따라 헤더 첫 자식으로
//    조각을 그렸는데, 그 구조가 서 있던 전제(«헤더가 불투명하고 화면에 고정») 를 [[ADR-131]] 이
//    없앴다. 지금은 벽지 한 장(`ThemeBackdrop`)만 있고 헤더는 아무것도 안 칠한다.
//
// ══ 구조가 대신 지키는 것 여섯 ═════════════════════════════════════════════════════
//
// | ADR | 웹이 손으로 한 일 | RN |
// |---|---|---|
// | 077 | 히스토리를 중첩 라우트 + `<Outlet />` 으로 얹어 언마운트를 막았다 | 하위 페이지가 **루트 스택 push** 라 이 화면이 트리에 남는다 |
// | 085·112 | `fixed` 헤더 + 실측 spacer + 매 커밋 layout effect | 헤더가 스크롤 뷰의 **형제**라 spacer 도 실측도 없다(`PageHeader` 파일 머리) |
// | 099 | 문서 스크롤을 화면 컨테이너로 옮겼다 | `ScrollView` 가 기본값 |
// | 100 결정 2 | 헤더 + spacer 를 래퍼로 묶어 셸 안에 | 헤더가 `ScreenScroll` 의 `header` 다 |
// | 073 | 목록을 `transform` 으로 내리고 인디케이터를 얹었다 | `RefreshControl` ([[ADR-130]]) |
// | 120 결정 10 | 스택 깊이로 아래 화면의 당김을 껐다 | 하위 페이지가 **덮어** 손가락이 안 닿는다 |
//
// ══ 코드로 갈린 것 다섯 ═══════════════════════════════════════════════════════════
//
// ① **공용 `PageHeader` 를 쓰지 않는다** — 그 셸은 하단 경계 페이드를 항상 그리는데 이 화면은
//    [[ADR-047]] 결정 6 이 **그 페이드를 금지한다**(웹 시절 근거는 stuck 카드 헤더를 가린다는
//    것이었고, 지금은 sticky 가 없어 그 증상이 없지만 **경계 표현의 계약**은 그대로다 — 이 화면의
//    경계는 총 수익 헤드라인 하단 헤어라인이 담당한다). 나머지 셸 값(`z-10 px-4 pb-2` +
//    상단 안전영역 + `gap-4`)은 그 컴포넌트와 글자 그대로 같다 — 배경을 안 칠하는 것도 함께다
//    ([[ADR-133]]).
// ② **[[ADR-080]] 의 최상단 이동은 남기되 이유가 바뀐다.** 웹에서 그것은 *"문서 높이가 붕괴하며
//    sticky 헤더가 화면 밖에 그려지는 프레임"* 을 없애는 처방이었고 RN 에는 그 사슬이 없다. 남는
//    것은 **관찰 가능한 동작**이다 — 기간을 옮기면 최상단에서 시작한다. 그것까지 없애면 웹과
//    다르게 동작하므로 `ScreenScroll` 의 `ref` 로 계속 부른다(`parity-inventory` §2.5 가 step 7
//    의 자리로 지목한 넷 중 하나).
// ③ `navigate('/boss?openPicker=1')` → **`navigate('Tabs', { screen: 'Settings', params: … })`**.
//    [[ADR-068]] 결정 4의 «피커를 열어 둔 채로 보낸다» 는 그대로이고 **받는 화면만 바뀌었다** —
//    피커를 여는 자리가 설정 하나가 됐다([[ADR-140]]).
// ④ **`useScreenStackStore` 깊이 게이트와 `<Outlet />` 이 사라진다**(위 표) — 웹이 이 화면에서
//    당김을 끄던 세 조건 중 둘은 그대로 남는다(빈 상태 · 새로고침이 의미 없는 기간).
// ⑤ `animate-spin` → Reanimated CSS 애니메이션(`lib/animation.ts`, step 4·5 와 같은 값).
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
} from '../../lib/boss-profit-period'
import { sumDropPayout } from '../../lib/drop-price'

import { AnimatedMeso } from '../../components/atoms/AnimatedMeso/AnimatedMeso'
import { ProfitIcon } from '../../components/atoms/ProfitIcon/ProfitIcon'
import { Text } from '../../components/atoms/Text/Text'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { UnavailableNotice } from '../../components/molecules/EmptyState/UnavailableNotice'
import { ValuableDropBadge } from '../../components/molecules/ValuableDropBadge/ValuableDropBadge'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SPIN_ANIMATION } from '../../lib/animation'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  RefreshCwIcon,
} from '../../lib/icons'
import { AnimatedView } from '../../lib/nativewind-interop'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { useTopSafeAreaPx } from '../../lib/top-safe-area'
import { orderByTracked } from '../../lib/tracked-order'
import { useThemeAppearance } from '../../theme/context'
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
// `DeltaChip` 은 증감 표시를 통계 기능으로 옮길 때까지 쓰이지 않는다([[ADR-124]] 결정 7, 2026-08-10)
// — 컴포넌트와 테스트는 그대로 두고 여기서 부르지만 않는다.
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
  // **당김이 시작한 회차에만** 인디케이터가 돈다([[ADR-160]] 결정 1). 헤더 버튼·자동 조회는 같은
  // 재조회를 부르지만 인디케이터는 안 연다 — 버튼은 자기 스피너와 «조회 중...» 을 이미 갖고 있고
  // ([[ADR-141]] 결정 1), 자동 조회는 원래 조용해야 하는 것이다.
  const pull = usePullRefresh(() => refresh(trackedOcids ?? []))

  const navigation = useScreenNavigation()
  const topSafeAreaPx = useTopSafeAreaPx()
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()

  // [[ADR-063]]: 동기화 전체 실패는 토스트로 알린다. 기간 라벨·"n분 전" 표기가 남아 맥락은 화면에 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })
  // [[ADR-063]] 결정 5: 일부 캐릭터만 실패한 경우도 토스트다. 본문이 한 줄이라 이름을 나열하면
  // 잘리므로 **인원 수**만 싣는다.
  useStaleCharactersToast(staleCharacterNames, () => refresh(trackedOcids ?? []))

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // [[ADR-101]] 결정 1: `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다(실기기 2026-08-06).
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // `now` 는 렌더당 한 번만 만든다 — 두 번 호출하면 두 시각이 기간 경계를 사이에 두고 갈려
  // "현재 기간 판정"과 "기간 라벨"이 서로 다른 기간을 가리킬 수 있다.
  const now = new Date()
  const isCurrentPeriod = isLatestPeriod(tab, periodKey, now)
  // [[ADR-076]]: 동기화 상태 영역·당겨서 새로고침의 **공통** 게이트. "이 기간이 최신인가"가 아니라
  // "지금 재조회하면 이 화면의 숫자가 달라질 수 있는가"다. 갈라 두면 "버튼은 없는데 당기면 도는"
  // 상태가 생긴다([[ADR-072]] 결정 9).
  const canRefreshPeriod = isPeriodRefreshable(tab, periodKey, now)

  // [[ADR-080]] 최상단 이동이 쓰는 스크롤 주체 — `parity-inventory` §2.5 가 step 7 의 자리로 지목한 넷 중 하나.
  const scrollRef = useRef<ScrollView | null>(null)
  // 총 수익 내역 상자([[ADR-124]] 결정 7) — 카드·보스 행과 **같은 상자**를 쓴다. 훅은 아래 빈 상태
  // 조기 반환보다 위에 있어야 한다(렌더마다 호출 순서가 같아야 한다).
  const {
    ref: periodChipRef,
    isOpen: isPeriodPopoverOpen,
    anchor: periodAnchor,
    toggle: togglePeriodPopover,
    close: closePeriodPopover,
  } = useAnchoredPopover()

  // [[ADR-080]]: 기간·탭이 바뀌면 최상단으로. RN 에는 그 처방이 웹에서 없애던 깨진 프레임이 없지만
  // (헤더가 스크롤 뷰의 형제라 화면 밖으로 날아갈 수 없다) **관찰 가능한 동작**은 그대로 지킨다 —
  // 기간을 옮기면 목록 처음부터 본다. 목적지가 0 인 것은 웹과 같다([[ADR-082]] 실패로 확인).
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [tab, periodKey])

  // 훅(아래 `usePeriodLoadErrorToast`)이 이 값을 읽으므로 조기 반환보다 위에서 계산한다 — 순수
  // 함수라 위치를 올려도 결과가 같고, 토스트 조건과 화면 조건이 같은 값을 보게 된다.
  // [[ADR-143]] 결정 3: 그룹의 순서는 행의 순서(= 스토어의 레벨 내림차순 — [[ADR-036]]·[[ADR-017]]
  // 결정 2)가 아니라 사용자가 캐릭터 관리에서 정한 저장 배열 순서다. **캐릭터 안쪽 보스 순서는
  // 안 건드린다**([[ADR-036]] 의 `weekly-bosses.json` 정규 순서는 그대로다) — 바뀌는 것은 카드가
  // 서는 차례뿐이다. core 를 안 고치는 이유는 `orderByTracked` 머리에 있다.
  const characterGroups = orderByTracked(buildCharacterGroups(rows, weeklySubtotals), trackedOcids ?? [])

  // [[ADR-083]] 결정 3: 기간 로드 실패는 **카드가 있을 때만** 토스트다. 카드가 없으면 문구가 사라진
  // 자리에 빈 칸이 남으므로 아래에서 `ErrorState` 를 그린다(같은 실패의 두 얼굴, 문구는 통일).
  usePeriodLoadErrorToast({
    isFailed: periodState === 'failed' && characterGroups.length > 0,
    isLoading: isPeriodLoading,
    periodKey,
    onRetry: () => void retryPeriod(),
  })

  if (isEmpty) {
    // 헤더 셸을 쓰지 않는 가지라(제목 줄이 목록 없이 혼자 선다) 상단 안전영역을 여기서 먹는다 —
    // 웹의 `min-h-[calc(100dvh …)]` 자리는 `flex-1` 이다(탭 상자가 이미 탭바를 뺀 크기다).
    // 히스토리·가격 진입점은 두지 않는다([[ADR-071]] 결정 7 · [[ADR-124]] 결정 8).
    return (
      <View testID="screen-Profit" className="flex-1 p-4" style={{ paddingTop: topSafeAreaPx }}>
        {/* 헤더 셸을 안 쓰는 가지에서도 제목 줄은 같은 프리미티브다([[ADR-145]] 정정 1). */}
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
              // [[ADR-068]] 결정 4: 피커를 **열어 둔 채로** 보낸다. 웹의 `?openPicker=1` 자리다.
              // 목적지는 보스 탭에서 **설정 탭**으로 옮겼다([[ADR-140]] 결정 2) — 열어 두고 보낸다는
              // 계약은 그대로이고 받는 화면만 바뀌었다.
              onClick: () =>
                navigation.navigate('Tabs', { screen: 'Settings', params: { openPicker: true } }),
            }}
          />
        </View>
      </View>
    )
  }

  const periodLabel = formatBossProfitPeriodLabel(tab, periodKey, now)
  // 이전 이동 가능 여부는 store 가 매 기간 로드 시 계산해 둔 값으로 판단한다([[ADR-037]]) —
  // 조회 불가능하고 캐시 기록도 없는 기간에 착지하지 않도록 막는다.
  const isPrevDisabled = !canGoPreviousPeriod
  // **현재 기간은 백필 가능성을 묻지 않는다**([[ADR-067]] 결정 2 정정 2) — 조회일이 미래라
  // `isPeriodQueryable` 이 false 지만 그건 "조회 불가"가 아니라 실시간 동기화가 원천이라는 뜻이다.
  const periodQueryable = isCurrentPeriod || isPeriodQueryable(tab, periodKey, now)
  const totalMeso = characterGroups.reduce(
    (sum, group) => sum + groupTotalMeso(group, dropsByRowKey),
    0,
  )
  // 이 기간의 아이템 몫. 월간 탭은 주간 수익이 소계로만 들어오므로 그쪽 몫도 더해야 결정석과
  // 정확히 갈린다([[ADR-124]] 결정 7 정정).
  const periodItemMeso = characterGroups.reduce(
    (sum, group) =>
      sum +
      sumDropPayout(collectGroupDrops(group, dropsByRowKey)) +
      group.weeklySubtotals.reduce((weekSum, subtotal) => weekSum + sumDropPayout(subtotal.drops), 0),
    0,
  )
  const crystalTotalMeso = totalMeso - periodItemMeso
  // 총 수익 헤드라인 우측 뱃지용 — 이 기간 전체 고가 드롭([[ADR-046]]).
  const periodValuableDrops = collectAllValuableDrops(characterGroups, dropsByRowKey)

  // 기간·탭 맥락과 스토어 바인딩을 자손에게 내린다([[ADR-094]] 3단계) — 이 열 개는 4단계를 타고
  // 내려가며 51지점을 만들고 있었다. 참조 동일성을 위한 메모이제이션은 하지 않는다(결정 5).
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
    // 공용 `PageHeader` 를 쓰지 않는 이유는 파일 머리 ① — 그 셸의 하단 페이드를 이 화면은 금지한다
    // ([[ADR-047]] 결정 6). 나머지 값은 그 컴포넌트와 같고, **상단 여백을 더하지 않는 것도 함께다**
    // ([[ADR-139]] — 웹 `pt-[calc(1rem+var(--sa-top))]` 의 상수 몫을 옮기지 않는다). 그 «안전영역»
    // 은 `useTopSafeAreaPx()` 다([[ADR-139]] 정정 1) — 셸을 복제한 화면이 인셋을 직접 읽으면 이
    // 화면만 안드로이드에서 16.7px 위에 선다.
    <View testID="page-header" className="z-10 px-4 pb-2" style={{ paddingTop: topSafeAreaPx }}>

      <View className="gap-4">
        {/* 히스토리 진입점은 탭 줄이 아니라 **제목 줄 우측**이고 아이콘이 아니라 글자다
            ([[ADR-071]] 결정 7). 진입점 둘은 같은 어휘를 쓰고 `아이템 가격`(쓰기)이
            `히스토리`(읽기) **왼쪽**이다([[ADR-124]] 결정 8) — 값을 매기는 쪽이 주마다 들르는 자리다. */}
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

          {/* 동기화 상태 영역은 **새로고침이 의미 있는 기간에서만** 노출한다([[ADR-076]]) — 완전히
              닫힌 과거 기간은 cache-first·checked-once 모델이라 "조회 중..."도 재조회 버튼도 뜻이
              없다. 제목 줄이 아니라 탭과 같은 줄이다([[ADR-049]] 결정 1). */}
          {canRefreshPeriod && (
            <View className="ml-auto shrink-0 flex-row items-center gap-2">
              <Text className="text-sm text-text-muted">
                {status === 'loading' ? '조회 중...' : formatSyncedAt(lastSyncedAt)}
              </Text>
              {/* 이 줄의 높이는 활성 탭 pill(30px)이 정한다 — 기본 `p-2`(32px)면 새로고침이 없는
                  과거 기간과 2px 어긋난다([[ADR-049]] 결정 1). */}
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

        {/* [[ADR-061]] 결정 2: 보여줄 데이터가 아예 없을 때만 셸 승계 카드를 그린다. */}
        {!isPeriodLoading &&
          (status === 'idle' || status === 'loading') &&
          characterGroups.length === 0 && <LoadingState size="page" message="불러오고 있어요" />}

        {/* [[ADR-068]] 결정 1·7: 상태마다 얼굴이 다르다. 기록이 있으면 아무것도 띄우지 않는다 —
            목요일 새벽처럼 백필만 막힌 경우 기록은 정확하고 사용자가 할 일도 없다. `failed` 는
            액션이 필요해 토스트로 옮겼다([[ADR-083]] 결정 3). */}
        {!isPeriodLoading && characterGroups.length > 0 && periodState === 'notCollected' && (
          <View className="flex-row items-center gap-1.5">
            <ClockIcon className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
            <Text className="text-sm text-text-muted">
              아직 집계되지 않았습니다 — 준비되면 자동으로 채워집니다
            </Text>
          </View>
        )}

        {/* 총 수익 요약은 **카드가 아니라 헤드라인**이다([[ADR-046]]) — 아래 캐릭터 카드가 전부 같은
            카드 셸이라 요약도 카드면 "동일한 흰 카드의 반복"으로 묻힌다. */}
        {!isPeriodLoading && characterGroups.length > 0 && (
          <View>
            {/* 라벨행 높이를 `h-6`(24px)으로 **명시** 고정한다([[ADR-054]] 정정 4) — 전에는
                라벨(16px)이 우연히 정하는 값이라 그보다 큰 요소를 흐름에 넣는 순간 줄이 커졌다.
                그것이 24px 고가 드롭 뱃지를 흐름 밖으로 빼낸 이유다([[ADR-049]] 결정 2). */}
            <View className="relative h-6 flex-row items-center">
              <Text className="text-xs font-semibold tracking-wide text-text-muted">
                {periodLabel.primary} 총 수익
              </Text>
              {/* 결정석 판매 현황은 라벨 텍스트 바로 옆이다([[ADR-054]] 정정 3) — 우측 끝은
                  고가 드롭 뱃지의 절대배치 자리라 침범하지 않는다. */}
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
              {/* 단위는 별도 `Text` 로 격하하되 숫자와 사이에 **실제 공백 문자**를 남긴다 — 마진만
                  으로 띄우면 읽는 문자열이 "N메소"로 붙어 스크린리더가 이어 읽는다([[ADR-046]]). */}
              <Text
                className="text-xl font-extrabold leading-none text-primary-ink"
                style={TABULAR_NUMS}
              >
                {/* [[ADR-087]] 정정 1: **이 키에만 기간이 없다** — 기간이 바뀌어도 같은 자리의 같은
                    뜻을 가진 하나의 숫자로 보고 굴린다("기간 이동은 총 수익만", 사용자 결정). */}
                <AnimatedMeso identity={`total|${loadedTab}`} value={totalMeso} />{' '}
                <Text className="text-xs font-bold text-text-muted">메소</Text>
              </Text>
              {/* **증감 칩은 뺀 채로 둔다**([[ADR-124]] 결정 7, 2026-08-10) — 총 수익에서는 뜻이
                  퇴색한다고 봤고 통계 기능이 생기면 그쪽으로 옮긴다. `DeltaChip` 과 스토어의
                  `previousPeriodTotalMeso` 는 지우지 않는다. 그 자리를 자세히 보기가 받는다. */}
              <Pressable
                ref={periodChipRef}
                role="button"
                aria-label="총 수익 자세히 보기"
                aria-expanded={isPeriodPopoverOpen}
                onPress={togglePeriodPopover}
                className="ml-auto h-6 shrink-0 flex-row items-center gap-0.5 rounded-full border border-border px-2.5"
              >
                <Text className="text-[11px] font-semibold text-text-muted">자세히 보기</Text>
                <ChevronDownIcon
                  className="h-3 w-3 shrink-0 text-text-muted"
                  strokeWidth={2.5}
                  aria-hidden
                />
              </Pressable>
            </View>

            {/* sticky 헤더 바닥 경계 = 카드 테두리 대체([[ADR-046]]). 이 화면에 페이드가 없는
                이유가 이 한 줄이다([[ADR-047]] 결정 6). */}
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
          // [[ADR-130]] 결정 1·3: 당김은 헤더 버튼과 **같은 재조회**를 부르고([[ADR-072]] 결정 2)
          // 색만 테마에서 넘긴다. 빈 상태는 이 가지에 오지 않고(위 조기 반환), 새로고침이 의미
          // 없는 기간에서는 컨트롤 자체를 달지 않는다([[ADR-072]] 결정 9 · [[ADR-076]]) —
          // 헤더 버튼과 **같은 플래그**다.
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
            {/* [[ADR-061]] 결정 2·3·4: 점선 박스(빈 상태의 어법)와 비-브랜드 링을 버리고 셸 승계
                카드를 쓴다 — 백필이 끝나면 같은 자리·같은 껍데기에 캐릭터 카드가 들어온다. */}
            {isPeriodLoading && (
              <LoadingState message={`${periodLabel.primary} 기록을 불러오고 있어요`} />
            )}

            {/* [[ADR-060]] + [[ADR-068]] 결정 1: "확정된 빈 상태"와 "확인 자체를 못 함"은 디자인을
                공유하지 않는다. 어느 쪽인지는 store 가 계산한 `periodState` 가 답한다 — 전에는
                화면이 따로 판정해 백필과 어긋났다(이슈 #78 E). */}
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
                // key 에 탭·기간을 포함해 이동 시 아코디언을 remount 시킨다(#27) — 펼침 상태는
                // `CharacterAccordion` 로컬 state 라, key 가 그대로면 인스턴스가 재사용돼 한
                // 탭/기간에서 펼친 상태가 다른 탭/기간으로 그대로 이어졌다([[ADR-037]]).
                <CharacterAccordion
                  key={`${tab}-${periodKey}-${group.ocid}`}
                  group={group}
                  issue={characterIssues[group.ocid]}
                />
              ))}
          </View>
        </ScreenScroll>

        {/* 총 수익 내역 — 카드·보스 행과 같은 상자다([[ADR-124]] 결정 7). 셸 **바깥**에 두는 것은
            웹이 `<Outlet />` 을 그렇게 둔 것과 같은 이유가 아니라, 별도 네이티브 윈도우라 트리
            위치가 겹침에 영향을 주지 않기 때문이다 — 읽기 쉬운 자리에 둔다. */}
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

/**
 * 첫 화면. 위젯 격자를 그리는 탭.
 *
 * 하는 일이 셋뿐이다. 쿼리와 스토어를 **렌더당 한 번** 읽어 `TodayViewModel` 하나를 만들고,
 * 그것을 `WidgetGrid` 에 넘기고, 진입·당김·헤더 버튼의 조회를 건다. 조립은 `view-model.ts` 의 순수 함수가
 * 하고 여기 남는 것은 배선뿐이라 판정이 한 줄도 없다.
 *
 * **위젯은 스토어를 모른다.** 각자 구독하면 트리거가 위젯 수만큼 늘고, 같은 드롭 기록을 보는 셋이
 * 각자의 시점에서 읽는다.
 *
 * 스케줄 · 프로필 · 이번 주 보스 수익 · 드롭 기록 · 이번 주 가계부는 전부 쿼리 캐시에서 온다. 넥슨 쿼리의 자동 조회는
 * 마운트 · 포커스에 만료일 때, 복귀에는 신선해도 한 번이다. 기기 DB 쿼리는 그 표의 판이 오를 때 무효화되어 다른 화면이
 * 기록을 쓰면 여기도 바뀐다. 당김은 `pullRefresh` 로 회차 · 13일 창 · 오늘 강화를 다 받는다.
 *
 * 누가 대표인가는 선택 스토어를 구독한다. 화면 상태로 사본을 들면 이 탭은 다시 마운트되지 않아
 * 캐릭터 관리에서 대표를 바꿔도 옛 캐릭터가 남는다.
 *
 * @see docs/features/today.md 정책
 */

import { TodayLoadingModal } from './TodayLoadingModal'
import { View } from 'react-native'

import { queryKeys } from '../../features/query/keys'
import { useResetBoundaryTick } from '../../features/query/reset-timer'
import { pullRefresh } from '../../features/refresh/pull'
import { useCharacterProfiles } from '../../features/schedule-sync/use-schedule-queries'
import { useRefetchStaleOnFocus } from '../../hooks/useRefetchStaleOnFocus'

import { SETTLEMENT_BANNER_DETAIL_TODAY } from '../../features/settlement/banner-text'
import { useRealtimeFetchedAt } from '../../features/refresh/freshness'
import { usePartyAppointments } from '../../features/party-appointments/query'
import { refreshNoticeKinds } from '../../features/notice/notice-query'
import { useDropHistory } from '../../features/boss-profit/drop-history-query'
import { useBossProfitPeriod } from '../../features/boss-profit/period-query'
import { useBossProfitRound } from '../../features/boss-profit/round-view'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useBossSchedule } from '../../features/boss-scheduler/use-boss-schedule'
import { useLedgerDays } from '../../features/cashbook/ledger-query'
import { useCharacterSelectionStore } from '../../features/character-selection/store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { useContentSchedule } from '../../features/content-scheduler/use-content-schedule'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { statsRanges } from '../../features/stats/periods'
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'

import { Text } from '../../components/atoms'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { CharacterManageButton } from './CharacterManageButton'
import { ManualCompletionBanner } from './ManualCompletionBanner'
import { NoticeBanner } from './NoticeBanner'
import { SettlementBanner } from '../SettlementBanner'
import { useQuickLinksStore } from '../../features/quick-links/store'
import { buildTodayViewModel } from './view-model'
import { WidgetGrid } from './WidgetGrid'
import { NexonMaintenanceBanner } from '../NexonMaintenanceBanner'

const EMPTY_DROPS = {}

export function TodayScreen(): React.JSX.Element {
  // 스케줄은 캐시에서 온다. 두 훅이 같은 회차를 보므로 마운트 · 복귀의 자동 조회는 한 번이다.
  const content = useContentSchedule()
  const boss = useBossSchedule()
  const contentStore = useContentSchedulerStore()
  const bossStore = useBossSchedulerStore()
  const { mode } = useTrackingModeStore()
  // 파티 약속은 기기에만 있다. 저장이 캐시를 덮어 파티 스케줄 탭에서 고친 것이 위젯 10 에 바로 선다.
  const { appointments: partyAppointments } = usePartyAppointments()
  const quickLinks = useQuickLinksStore((state) => state.config)

  // 프로필도 캐시에서 온다. 회차나 캐릭터 관리가 `character/basic` 을 받으면 그 자리에서 바뀐다.
  const profilesByOcid = useCharacterProfiles()
  const representativeOcid = useCharacterSelectionStore((state) => state.representativeOcid)

  // 이 화면은 탭이라 계속 살아 있고 마운트의 자동 조회는 한 번뿐이다. 돌아올 때 만료됐으면 다시 받는다.
  useRefetchStaleOnFocus(queryKeys.scheduleRound())
  // 직접 완료를 열어 둔 보스. 진입할 때마다 서버에 묻는다. 스케줄러 회차에 안 싣는 것은 이 값이 늦게 와서 늘어나는 것이
  // 없어서다. 배너가 늦게 설 뿐이다. 보스 수익과 같은 쿼리라 겹친 호출은 하나로 접힌다.
  useRefetchStaleOnFocus(queryKeys.manualCompletion())
  // 공지 배너가 세울 앱 공지. 들어올 때마다 서버에 묻는다. 배경에서 도착만 하고 안 탭한 공지는 기기에 없어 이 길로만 선다.
  useRefetchStaleOnFocus(queryKeys.notices('app'))

  // 렌더당 한 번만 만든다. 두 번 부르면 두 시각이 기간 경계를 사이에 두고 갈려 카운트다운과 기간 판정이 서로 다른
  // 기간을 가리킬 수 있다(`BossProfitScreen` 과 같은 규칙).
  const now = new Date()
  const weekKey = getCurrentBossProfitPeriod('weekly', now).periodKey

  // 이번 주 보스 수익. 보고 있는 것이 아니라 이번 주다. 보스 수익 화면이 월간 탭으로 옮겨도 여기는 안 바뀐다.
  // 회차의 실패 표식은 회차 쿼리에서 온다.
  const week = useBossProfitPeriod('weekly', weekKey)
  const round = useBossProfitRound()
  // 드롭 기록 셋(최고가 · 미입력 · 가뭄). 가격 입력 화면이 기록을 바꾸면 판이 올라 여기도 바뀐다.
  const dropHistory = useDropHistory()
  // 이번 주 수입은 통계와 같은 가계부 기록을 이번 주만 읽는다. `null` 은 아직 못 읽었다는 뜻이고, 위젯이 그때의 0 을
  // 사실처럼 그리지 않는다. 주가 바뀌면(자정 렌더) 범위가 바뀌어 다른 열쇠를 읽는다.
  const weekRange = statsRanges('weekly', weekKey).current
  const { days: statsDays } = useLedgerDays(weekRange)

  // 화면 순서는 사용자가 캐릭터 관리에서 정한 저장 배열 순서다.
  const orderedOcids = content.trackedOcids ?? []

  const fetchedAt = useRealtimeFetchedAt()

  const viewModel = buildTodayViewModel({
    now,
    orderedOcids,
    representativeOcid,
    profilesByOcid,
    contentCharacters: content.characters,
    bossCharacters: boss.characters,
    trackingMode: mode,
    // 계열마다 주인이 다르다. 컨텐츠 멤버십을 보스 스토어 사본에서 읽으면 수동 컨텐츠를
    // 추가해도 이 화면만 옛 값에 굳는다.
    manualContentByOcid: contentStore.manualTrackedByOcid,
    manualBossByOcid: bossStore.manualTrackedByOcid,
    manualCompletedByOcid: boss.manualCompletedByOcid,
    characterIssues: round.characterIssues,
    // 이번 주 행은 주간 보스 + 그 주에 선 월간 보스다. 자르는 일은 기간 스냅샷이 했다. 뷰모델은 다시 자르지 않는다.
    profitRows: week.snapshot?.rows ?? [],
    profitDropsByRowKey: week.snapshot?.dropsByRowKey ?? EMPTY_DROPS,
    dropGroups: dropHistory.groups,
    statsDays,
    partyAppointments,
    quickLinks,
  })

  // KST 자정을 넘기면 다시 그린다. 초기화 시각과 기간 값은 이 렌더의 `now` 로 정해져서, 다시 렌더되지 않으면
  // 카운트다운이 `0초` 에 멈추고 기간이 지난 기간에 머문다. 타이머는 공용이다(`reset-timer.ts`).
  useResetBoundaryTick()

  /**
   * 헤더 버튼과 당김이 같은 함수를 부른다.
   *
   * `allSettled` 다. 둘이 서로 독립이라 하나가 실패해도 나머지를 기다려야 하고, 둘 다 끝나야
   * 당김 인디케이터를 닫을 수 있다. 회차 · 창 · 오늘 강화가 쓴 기록은 판을 올려 이번 주 수입 · 드롭 위젯이 스스로 바뀐다.
   */
  async function refreshAll(): Promise<void> {
    await Promise.allSettled([pullRefresh(), refreshNoticeKinds(['app'])])
  }

  return (
    <View testID="screen-Today" className="flex-1">
      {/* 불러오는 중은 모달이 말한다. 위젯은 자기 스피너를 갖지 않는다. 서는 자리는 캐릭터
          설정을 마치고 처음 들어오는 회차 하나다. */}
      <TodayLoadingModal />
      <ScreenScroll
        onRefresh={refreshAll}
        header={
          <PageHeader>
            {/* 오른쪽 자리는 캐릭터 관리로 가는 문이다. 다른 탭 화면이 세그먼트를 두는 그 자리이고,
                이 화면에는 가를 목록이 없다. 돌릴 얼굴은 뷰모델이 골라 둔 것을 그대로 넘긴다. */}
            <PageHeaderTitleRow
              fetchedAt={fetchedAt}
              trailing={<CharacterManageButton portraits={viewModel.headerPortraits} />}
            >
              <Text className="shrink-0 text-lg font-semibold text-text">today</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        {/* 배너 둘은 이 래퍼 **밖**이다. 전폭이라 좌우 여백을 자기가 쥔다. 안에 넣고 음수 마진으로
            밀어내면 아래 열 폭 계산이 깨진다. 세울 것이 없으면 둘 다 아무것도 안 그린다.

            결산 줄이 공지 배너 **위**다. 공지는 읽을거리이고 결산 줄은 지금 화면의 값이 왜 안 맞는지를
            말하므로, 그 줄이 값보다 먼저 와야 한다. */}
        <SettlementBanner testID="today-settlement-banner" detail={SETTLEMENT_BANNER_DETAIL_TODAY} />
        <NexonMaintenanceBanner testID="today-maintenance-banner" />
        <ManualCompletionBanner />
        <NoticeBanner />
        {/* 좌우 16 은 앱 공통 `px-4` 라 화면의 래퍼가 준다. 격자가 또 주면 두 겹이 되는데,
            열 폭 계산은 `창폭 − 32` 를 전제로 서 있다.

            위 8 은 셸의 `gap-2` 위에 이 화면만 얹는 값이다. 첫 타일이 전폭 카드라 앞의 것과
            8 만 띄우면 붙어 보인다. 셸의 값을 올리지 않는 것은 그것이 앱 전체를 움직이기
            때문이다(`ab7496ad` 가 사용자 지정으로 좁혀 둔 값이다). */}
        <View className="px-4 pb-4 pt-2">
          <WidgetGrid data={viewModel} />
        </View>
      </ScreenScroll>
    </View>
  )
}

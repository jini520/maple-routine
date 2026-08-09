import type { BossContent, CharacterPickerEntry } from '../../types'
import { RefreshCw, SlidersHorizontal, Swords, Users } from 'lucide-react'
import { useScreenStackStore } from '../../features/screen-stack/store'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import { useScheduleSyncErrorToast } from '../../features/schedule-sync/use-sync-error-toast'
import { useApiKeyNotice } from '../../features/onboarding/use-api-key-notice'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import { partySizeKey, useBossSchedulerStore, type PartyFilter } from '../../features/boss-scheduler/store'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'

import type { BossPortraitCrop } from '../../lib/boss-icons'
import { CharacterSelectDropdown } from '../../components/molecules/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/organisms/CharacterTrackingPicker/CharacterTrackingPicker'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { ProgressModal } from '../../components/organisms/ProgressModal/ProgressModal'
import { PullToRefreshIndicator } from '../../components/molecules/PullToRefreshIndicator/PullToRefreshIndicator'
import { PULL_SETTLE_TRANSITION, resolveContentOffsetPx } from '../../lib/pull-to-refresh'
import { usePullToRefresh } from '../../lib/use-pull-to-refresh'
import { matchBossContent, selectDisplayBosses, type MatchedBoss } from '../../lib/boss-matching'
import { mergeManualBossList } from '../../lib/manual-boss-merge'
import { isChallengersWorld } from '../../lib/world-emblem'
import { getCharacterPickerRoster, toScheduleSyncError } from '../../features/schedule-sync/schedule-sync'
import type { ScheduleSyncError } from '../../features/schedule-sync/schedule-sync'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { MEDIA_TEXT_SHADOW } from '../../lib/media-card'
import { Card } from '../../components/atoms/Card/Card'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { Badge } from '../../components/atoms/Badge/Badge'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'

const PARTY_FILTER_LABELS: Record<PartyFilter, string> = {
  all: '전체',
  solo: '솔로',
  party: '파티',
}


function BossCard(props: {
  boss: MatchedBoss
  crop?: BossPortraitCrop
  partySize?: number
}): React.JSX.Element {
  const { boss, partySize } = props
  const portraitUrl = getBossPortraitUrl(boss.portraitSlug)
  const crop = props.crop ?? getBossPortraitCrop(boss.portraitSlug)
  const bossName = boss.matchedBossName ?? boss.apiName
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

  // 카드 배경/보더/보스명 텍스트는 페이지 표면이 아니라 일러스트 위 배색을 따른다 — bleed·페이드·
  // text-shadow가 어두운 배경을 전제로 튜닝됐기 때문에 라이트 테마에서 페이지 토큰(bg-surface 등)을
  // 쓰면 대비가 깨진다. `media-scope`가 카드 안쪽의 기준 표면을 media-surface로 바꾸므로
  // (ADR-064 결정 5) 안에서는 앱 전역과 같은 레시피(bg-surface·text-text)를 그대로 쓴다.
  // 완료 뱃지는 앱 전체가 공유하는 "완료/성공" 의미 색(secondary)이라 스코프 안에서도 그대로다.
  return (
    <Card className="media-scope relative h-20 overflow-hidden">
      {portraitUrl !== null && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${portraitUrl})`,
            backgroundSize: crop.size,
            backgroundPosition: crop.position,
            backgroundRepeat: 'no-repeat',
            filter: 'saturate(.85) brightness(.8)',
            opacity: 0.65,
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        />
      )}

      <div className="relative flex h-full items-center justify-between" style={{ padding: '0 14px' }}>
        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={boss.difficulty} />
          <span
            className="text-sm font-medium text-text"
            style={{ textShadow: MEDIA_TEXT_SHADOW }}
          >
            {bossName}
          </span>
          {partySize !== undefined && partySize > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text">
              <Users className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {partySize}인
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {boss.isComplete && (
            <span className="rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-bold text-secondary-ink">완료</span>
          )}
        </div>
      </div>
    </Card>
  )
}

export function BossScreen(): React.JSX.Element {
  const {
    status,
    characters,
    error,
    trackedOcids,
    selectedOcid,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    saveTrackedOcids,
    refresh,
    selectCharacter,
    // ADR-096 결정 1: 탭과 두 필터는 스토어 소유다 — 이 화면이 언마운트돼도 살아남고, 관리
    // 페이지가 같은 탭 값을 읽어 보던 탭 그대로 열린다.
    activeTab,
    setActiveTab,
    // ADR-019 결정 6: 주간/월간 탭은 서로 독립된 필터 상태를 갖는다(한 탭의 필터 변경이
    // 다른 탭에 영향을 주지 않음).
    weeklyFilter,
    setWeeklyFilter,
    monthlyFilter,
    setMonthlyFilter,
  } = useBossSchedulerStore()
  const { mode } = useTrackingModeStore()
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  // 화면을 통째로 바꾸는 이동은 이동 전에 스크롤을 최상단으로 옮긴다([[ADR-098]] 결정 1).
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isPickerOpen, setIsPickerOpen] = useState(() => searchParams.get('openPicker') === '1')
  // ADR-053 결정 3: 후보 목록 조회의 로딩·실패는 조회를 소유한 화면이 관리해 피커에 내려준다.
  // 초기값은 "마운트 직후 조회가 시작되는가"(= ?openPicker=1로 이미 열려 있는가)와 같다.
  const [isRosterLoading, setIsRosterLoading] = useState(isPickerOpen)
  const [rosterError, setRosterError] = useState<ScheduleSyncError | null>(null)
  // ADR-062: 재조회 트리거. 피커를 여는 것과 재시도가 같은 초기화(reloadRoster)를 공유하고,
  // 이 값이 바뀌면 아래 조회 effect가 다시 돈다.
  const [rosterReloadNonce, setRosterReloadNonce] = useState(0)
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)
  // ADR-063: 동기화 전체 실패는 인라인 문단이 아니라 토스트로 알린다 — 지속 상태("n분 전")는
  // 새로고침 옆 표기가 이미 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다.
  useScheduleSyncErrorToast(error, { onRetry: () => refresh(trackedOcids ?? []) })

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 보스 수익 화면의 "캐릭터 선택하러 가기" 링크(?openPicker=1)로 진입했을 때만 URL을 정리한다 —
  // 안 그러면 새로고침·뒤로가기마다 피커가 계속 다시 열린다.
  useEffect(() => {
    if (searchParams.get('openPicker') !== '1') return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('openPicker')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ADR-015: 후보 목록에 이미지·access_flag가 필요해져 피커를 열 때만 조회한다
  // (마운트 시 매번 호출하면 화면에 들어오기만 해도 캐릭터 수만큼 병렬 호출이 발생함).
  // ADR-016: 캐시가 있으면 즉시 그 값으로 먼저 그리고, character/basic 응답이 하나씩
  // 도착하는 대로 patch한다(전체를 기다리지 않음).
  // ADR-017 결정 6: character/list 응답을 기다리는 동안에도 character-basic-cache에 이미
  // 있는 캐릭터(추적 여부 무관)는 즉시 먼저 보여줘, 피커를 열 때마다 짧게 비어 보이던 문제를
  // 완화한다.
  // ADR-053 결정 3: 조회 결과(Promise)를 버리지 않고 로딩·실패 상태로 남긴다 — 401/429는 reject로
  // 나오므로 finally에서 반드시 로딩을 해제해야 스피너가 영구히 걸리지 않는다. roster는 재조회
  // 시작 시에도 비우지 않는다(캐시로 보여주던 목록을 지우면 ADR-016 캐시 우선 표시가 무력화된다).
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    })
      .catch((error: unknown) => {
        if (!cancelled) setRosterError(toScheduleSyncError(error))
      })
      .finally(() => {
        if (!cancelled) setIsRosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPickerOpen, rosterReloadNonce])

  // ADR-115 결정 7: 감지 지점은 동기화만이 아니다 — 피커 로스터가 맞는 401도 같은 키 무효화라
  // 같은 진입점을 부른다(동기화 쪽 위임은 useScheduleSyncErrorToast 안에 있다).
  // ADR-116 결정 1: 429도 같은 진입점을 탄다 — 이름만 바뀌었을 뿐 이 자리는 그대로다.
  useApiKeyNotice(rosterError)

  // ADR-101 결정 1: `null` 은 "0명"이 아니라 **"저장소를 아직 안 읽었다"** 다. 둘을 `||` 로 묶으면
  // 콜드 스타트 첫 페인트가 아직 모르는 사실을 단정한다(실기기 2026-08-06 — "표시할 캐릭터가
  // 없습니다"가 목록보다 먼저 한 프레임 스쳤다). 빈 상태는 읽고 0명임을 **확인한 뒤에만** 그린다.
  const isEmpty = trackedOcids !== null && trackedOcids.length === 0

  // ADR-072: 목록 최상단에서 당기면 헤더 새로고침 버튼과 같은 재조회가 돈다(제스처는 추가 수단이다).
  // 빈 상태에서는 당길 목록이 없어 끄고(결정 13), 재조회 중에는 새 당김을 시작하지 않는다(결정 12).
  // 훅 호출은 아래 빈 상태 조기 반환보다 반드시 위여야 한다 — 훅 규칙.
  // ADR-099: 이 화면의 스크롤 주체. 문서가 아니라 이 요소가 스크롤되므로 스크롤 상태가 화면과
  // 함께 태어나고 함께 죽는다 — 다른 탭이 오프셋을 물려받을 길이 없다.
  const scrollRootRef = useRef<HTMLDivElement>(null)

  // 하위 페이지가 열려 있는 동안은 끈다([[ADR-120]] 결정 10). [[ADR-072]] 결정 14 의 조상 사슬
  // 검사는 오버레이의 스크롤 컨테이너가 **실제로 넘칠 때만** 참이라 내용이 짧은 관리 페이지에서
  // 샌다 — 스택 깊이를 아는 지금은 구조로 막는다(그 검사는 모달·바텀시트용으로 남는다).
  const isStackOpen = useScreenStackStore((state) => state.depth > 0)

  const pullToRefresh = usePullToRefresh({
    enabled: !isEmpty && !isStackOpen,
    isRefreshing: status === 'loading',
    onRefresh: () => refresh(trackedOcids ?? []),
    // ADR-099: 이 화면은 문서가 아니라 자기 컨테이너를 스크롤한다 — 최상단 판정도 그 기준이다.
    scrollRoot: scrollRootRef,
  })

  // ADR-073 결정 6: 목록이 내려가는 거리이자 인디케이터가 채우는 틈의 높이다 — 인디케이터와 같은
  // 함수·같은 인자를 쓴다. 두 벌로 계산하면 값이 어긋나는 순간 인디케이터가 카드 위에 겹치거나
  // 반대로 빈 띠가 남는다.
  const pullOffset = resolveContentOffsetPx(pullToRefresh.distance, pullToRefresh.phase)

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // ADR-083 결정 1: 캐릭터별 실패도 인라인 문단이 아니라 토스트다. syncSchedules는 캐릭터 단위
  // 실패를 던지지 않고 결과에 실어 반환하므로(401/429는 나머지 캐릭터까지 같은 에러로 채운다)
  // 실패의 대부분이 위의 전역 error가 아니라 이 값으로 온다 — 두 훅이 동시에 울릴 조합은 없다
  // (전역 error가 채워지는 경로에서는 characters가 캐시 뷰로 교체되고 그 뷰의 error는 null이다).
  useScheduleSyncErrorToast(selected?.error ?? null, { onRetry: () => refresh(trackedOcids ?? []) })

  // ADR-035 결정 3·6·12: 수동 모드에서는 게임 등록 여부가 아니라 사용자가 앱에서 관리하는
  // 멤버십(manualTrackedContent)으로 표시 목록을 결정하고, 완료 여부는 동기화 결과에서 즉석
  // 조회한다(mergeManualBossList). synced는 store의 auto 목록(MatchedBoss)에서 BossContent로
  // 되돌려 넘긴다 — MatchedBoss는 BossContent의 모든 필드를 갖고 있어 손실이 없다.
  const manualBossItems =
    selected !== null
      ? (manualTrackedByOcid?.[selected.ocid] ?? []).filter((item) => item.kind === 'boss')
      : []

  const syncedBossContents: BossContent[] =
    selected === null
      ? []
      : [...selected.weeklyBosses, ...selected.monthlyBosses].map((boss) => ({
          name: boss.apiName,
          difficulty: boss.difficulty,
          cycle: boss.cycle,
          isRegistered: boss.isRegistered,
          isComplete: boss.isComplete,
          ownComplete: boss.ownComplete,
        }))

  const manualBosses =
    mode === 'manual' ? mergeManualBossList(manualBossItems, syncedBossContents).map(matchBossContent) : []

  // 카드로 표시할 목록 — auto 모드는 등록된 보스뿐 아니라 미등록이어도 완료된 보스를 포함하고
  // ([[ADR-031]] 결정 5), manual 모드는 selectDisplayBosses(등록 우선) 대신 추적 멤버십 그대로 보여준다.
  const displayedWeeklyBosses =
    selected === null
      ? []
      : mode === 'manual'
        ? manualBosses.filter((boss) => boss.cycle === 'weekly')
        : selectDisplayBosses(selected.weeklyBosses)
  const displayedMonthlyBosses =
    selected === null
      ? []
      : mode === 'manual'
        ? manualBosses.filter((boss) => boss.cycle === 'monthly')
        : selectDisplayBosses(selected.monthlyBosses)

  // 챌린저스 월드면 registration_flag와 무관하게 시즌 보스 완료 여부를 배지로 보여준다([[ADR-031]] 결정 3).
  const seasonBosses =
    selected !== null && selected.world !== undefined && isChallengersWorld(selected.world)
      ? selected.weeklyBosses.filter((boss) => boss.isSeasonBoss)
      : []
  const isSeasonBossComplete = seasonBosses.some((boss) => boss.isComplete)

  function getPartySize(ocid: string, boss: MatchedBoss): number | undefined {
    const bossName = boss.matchedBossName ?? boss.apiName
    return partySizes[partySizeKey(ocid, bossName, boss.difficulty)]
  }

  // ADR-019 결정 3: boss_party_settings에 없는 조합은 솔로(1인) 취급 — 별도 API 재호출
  // 없이 이미 로드된 partySizes 맵으로만 클라이언트 사이드 필터링한다.
  function filterByPartySize(bosses: MatchedBoss[], ocid: string, filter: PartyFilter): MatchedBoss[] {
    if (filter === 'all') return bosses
    return bosses.filter((boss) => {
      const size = getPartySize(ocid, boss) ?? 1
      return filter === 'party' ? size >= 2 : size <= 1
    })
  }

  const activeFilter = activeTab === 'weekly' ? weeklyFilter : monthlyFilter
  const filteredWeeklyBosses =
    selected !== null ? filterByPartySize(displayedWeeklyBosses, selected.ocid, weeklyFilter) : []
  const filteredMonthlyBosses =
    selected !== null ? filterByPartySize(displayedMonthlyBosses, selected.ocid, monthlyFilter) : []

  // 기존 BossCard를 그대로 재사용한다 — 추적 편집은 관리 페이지 전용(ADR-035 결정 18).
  function renderBossCards(bosses: MatchedBoss[], ocid: string): React.JSX.Element {
    return (
      <div className="space-y-2">
        {bosses.map((boss) => (
          <BossCard
            key={`${boss.apiName}-${boss.difficulty}`}
            boss={boss}
            partySize={getPartySize(ocid, boss)}
          />
        ))}
      </div>
    )
  }

  async function handleSaveTracking(ocids: string[]): Promise<void> {
    setSaveProgress({ completed: 0, total: ocids.length })
    // 저장이 실패해도(스토어가 처리 못한 예외 등) 진행률 모달은 항상 닫는다 — 안 그러면 모달이 멈춘다.
    try {
      await saveTrackedOcids(ocids, (completed, total) => setSaveProgress({ completed, total }))
    } finally {
      setSaveProgress(null)
      setIsPickerOpen(false)
    }
  }

  // ADR-053 결정 3: 피커를 여는 유일한 경로 — 여는 순간 로딩·실패를 초기화한다(닫았다 다시 열면
  // 아래 useEffect가 재조회하므로 직전 실패가 남아 있으면 안 된다). 초기화를 effect 본문이 아니라
  // 이 이벤트 핸들러에 두는 이유는 effect 본문의 동기 setState가 cascading render를 만들기 때문.
  // ADR-062 트레이드오프: 여는 경로와 재시도가 같은 초기화를 쓴다 — 재조회 로직을 한 곳으로 모은다.
  function reloadRoster(): void {
    setIsRosterLoading(true)
    setRosterError(null)
    setRosterReloadNonce((nonce) => nonce + 1)
  }

  function openPicker(): void {
    setIsPickerOpen(true)
    reloadRoster()
  }

  const characterManageButton = (
    <button
      type="button"
      onClick={openPicker}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      캐릭터 관리
    </button>
  )

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      entries={roster}
      trackedOcids={trackedOcids ?? []}
      isLoading={isRosterLoading}
      loadError={rosterError}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
      onRetry={reloadRoster}
    />
  )

  // 저장 중에는 캐릭터 관리 모달 위에 진행률 모달을 띄운다(완료 시 둘 다 닫힌다).
  const trackingModals = (
    <>
      {trackingPicker}
      {saveProgress !== null && (
        <ProgressModal
          message="캐릭터 정보를 저장하고 있어요"
          completed={saveProgress.completed}
          total={saveProgress.total}
        />
      )}
    </>
  )

  // ADR-060: 빈 상태 문구는 탭(주간/월간)과 모드(수동/자동)별로 나눈다. 수동 모드만 CTA를 준다 —
  // 자동 모드가 지시하는 곳("게임에서 등록")은 앱 밖이라 데려다줄 수 없다.
  function bossEmptyProps(tab: 'weekly' | 'monthly'): React.ComponentProps<typeof EmptyState> {
    const label = tab === 'weekly' ? '주간' : '월간'
    if (mode === 'manual') {
      return {
        icon: Swords,
        title: `추적할 ${label} 보스가 없습니다`,
        description: `보스 관리에서 이번 ${tab === 'weekly' ? '주' : '달'}에 잡을 보스를 골라주세요`,
        action: { label: '보스 관리', onClick: () => navigate('/boss/manage') },
      }
    }
    return {
      icon: Swords,
      title: `등록된 ${label} 보스가 없습니다`,
      description: '게임 내 스케줄러에 등록하면 여기에 자동으로 표시됩니다',
    }
  }

  // 보스가 0건인 빈 상태와 달리 "필터가 가린 상태"라 CTA는 필터를 되돌린다(ADR-060 결정 3).
  function filterEmptyProps(tab: 'weekly' | 'monthly'): React.ComponentProps<typeof EmptyState> {
    return {
      icon: SlidersHorizontal,
      title: '이 조건에 해당하는 보스가 없습니다',
      description: '솔로·파티 필터를 해제하면 전체 보스를 볼 수 있습니다',
      action: {
        label: '필터 초기화',
        onClick: () => (tab === 'weekly' ? setWeeklyFilter('all') : setMonthlyFilter('all')),
      },
    }
  }

  // ADR-035 결정 18: 추적 편집(수동)과 파티원 수 설정을 관리 페이지 하나로 통합 — 두 모드 공통
  // 진입점이라 헤더는 항상 [보스 관리 · 캐릭터 관리] 2버튼이다(기존 "파티 관리" 모달 대체).
  const bossManageButton = (
    <button
      type="button"
      onClick={() => navigate('/boss/manage')}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      보스 관리
    </button>
  )

  if (isEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom)-4rem)] flex-col p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">보스 스케줄러</h1>
          {characterManageButton}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="표시할 캐릭터가 없습니다"
            description="캐릭터를 선택하면 주간·월간 보스 스케줄을 확인할 수 있습니다"
            action={{ label: '캐릭터 선택하기', onClick: openPicker }}
          />
        </div>

        {trackingModals}
      </div>
    )
  }

  return (
    // ADR-099: 스크롤의 소유자가 문서가 아니라 이 화면이다 — 공용 셸이 스크롤포트 인셋(안전영역·탭바
    // 실측)과 그 보정을 갖는다. 모달은 셸 **바깥**이다(안에 두면 z-50 이 셸의 스태킹 컨텍스트에 갇혀
    // z-30 탭바 아래로 그려진다).
    <>
      <ScreenScroll ref={scrollRootRef}>
      {/* 필터까지(제목~탭~솔로/파티 필터)는 화면 상단에 고정하고 그 아래 보스 목록만 스크롤되게 한다.
          헤더는 `fixed` 라 이 컨테이너의 스크롤과 무관하게 뷰포트 상단에 붙어 있고([[ADR-098]] 결정 2),
          흐름에서 빠진 자리는 PageHeader 가 내는 실측 높이 spacer 가 채운다. 노치까지 bg-bg 로 덮어야
          스크롤 중에 그 위 카드가 비치지 않으므로 top-0 + 안전영역을 더한 padding-top 조합은 그대로다. */}
      <PageHeader below={<PullToRefreshIndicator distance={pullToRefresh.distance} phase={pullToRefresh.phase} />}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">보스 스케줄러</h1>
          <div className="flex items-center gap-4">
            {selected !== null && bossManageButton}
            {characterManageButton}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {characters.length > 0 && selected !== null && (
              <CharacterSelectDropdown
                characters={characters}
                selectedOcid={selected.ocid}
                onSelect={(ocid) => {
                  void selectCharacter(ocid)
                }}
              />
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <p className="text-sm text-text-muted whitespace-nowrap">
                {status === 'loading' ? '조회 중...' : selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
              </p>
              <button
                type="button"
                onClick={() => refresh(trackedOcids ?? [])}
                aria-label="새로고침"
                className="p-2 text-primary-ink hover:text-primary-hover"
              >
                <RefreshCw
                  className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

        </div>

        {/* ADR-016: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
            셸 승계 카드는 보여줄 데이터가 아예 없을 때만 그린다([[ADR-061]] 결정 2). */}
        {(status === 'idle' || status === 'loading') && characters.length === 0 && (
          <LoadingState size="page" message="불러오고 있어요" />
        )}

        {characters.length > 0 && selected !== null && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('weekly')}
                  className={
                    activeTab === 'weekly'
                      ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                      : 'px-3 text-sm font-medium text-text-muted'
                  }
                >
                  주간
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('monthly')}
                  className={
                    activeTab === 'monthly'
                      ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                      : 'px-3 text-sm font-medium text-text-muted'
                  }
                >
                  월간
                </button>
              </div>

              {activeTab === 'weekly' && (
                <div className="flex items-center gap-2">
                  {seasonBosses.length > 0 && (
                    <span
                      className={
                        isSeasonBossComplete
                          ? 'rounded-full bg-secondary-tint px-2.5 py-1 text-xs font-bold text-secondary-ink'
                          : 'rounded-full bg-primary-tint px-2.5 py-1 text-xs font-semibold text-primary-ink'
                      }
                    >
                      {`season ${isSeasonBossComplete ? '완료' : '미완료'}`}
                    </span>
                  )}
                  {selected.weeklyBossClearCount !== null && selected.weeklyBossClearLimitCount !== null && (
                    <Badge tone="primary">
                      {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(['all', 'solo', 'party'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() =>
                    activeTab === 'weekly' ? setWeeklyFilter(filter) : setMonthlyFilter(filter)
                  }
                  className={
                    activeFilter === filter
                      ? 'rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-primary-ink'
                      : 'px-3 text-xs font-medium text-text-muted'
                  }
                >
                  {PARTY_FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
          </>
        )}
      </PageHeader>

      {/* ADR-073 결정 1·2: 헤더는 sticky로 제자리에 두고 이 목록 블록만 손가락을 따라 내려간다.
          마진·높이가 아니라 transform 이라 터치 프레임마다의 리플로우가 없다. 오프셋이 0이면
          transform 을 아예 걸지 않는다(결정 3) — translateY(0px) 조차 containing block·stacking
          context를 만들어 sticky 후손(ADR-047 중첩 카드 헤더)의 기준을 바꾼다. 반면 transition 은
          어떤 컨텍스트도 만들지 않으므로 항상 걸어둔다. 그래야 오프셋이 0으로 돌아갈 때 복귀
          애니메이션이 살고(붙였다 떼면 마지막 프레임에 전환이 없어 순간이동한다), 드래그 중에만
          'none' 이다(결정 4) — 손가락이 붙어 있는데 전환이 걸리면 목록이 늘 뒤처져 그려진다. */}
      {characters.length > 0 && selected !== null && (
        <div
          data-testid="pull-content"
          className="space-y-4 px-4 pb-4"
          style={{
            transform: pullOffset > 0 ? `translateY(${pullOffset}px)` : undefined,
            transition: pullToRefresh.isDragging ? 'none' : PULL_SETTLE_TRANSITION,
          }}
        >
          {activeTab === 'weekly' && (
            <>
              {displayedWeeklyBosses.length === 0 && (mode === 'manual' || !selected.isStale) && (
                <EmptyState {...bossEmptyProps('weekly')} />
              )}

              {displayedWeeklyBosses.length > 0 && filteredWeeklyBosses.length === 0 && (
                <EmptyState {...filterEmptyProps('weekly')} />
              )}

              {filteredWeeklyBosses.length > 0 && renderBossCards(filteredWeeklyBosses, selected.ocid)}
            </>
          )}

          {activeTab === 'monthly' && (
            <>
              {displayedMonthlyBosses.length === 0 && (mode === 'manual' || !selected.isStale) && (
                <EmptyState {...bossEmptyProps('monthly')} />
              )}

              {displayedMonthlyBosses.length > 0 && filteredMonthlyBosses.length === 0 && (
                <EmptyState {...filterEmptyProps('monthly')} />
              )}

              {filteredMonthlyBosses.length > 0 && renderBossCards(filteredMonthlyBosses, selected.ocid)}
            </>
          )}
        </div>
      )}

      </ScreenScroll>

      {trackingModals}

      {/* 하위 페이지가 이 자리에서 열린다([[ADR-120]] 결정 1) — 실제 DOM 은 `StackScreen` 이
          포털로 탭 레이어 밖에 붙이므로(결정 3) 이 위치가 레이아웃에 얹히지는 않는다. 트리에
          남아 있는 것이 계약이다: 그래야 이 화면이 언마운트되지 않는다([[ADR-077]]). */}
      <Outlet />
    </>
  )
}

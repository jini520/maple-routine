import type { CharacterPickerEntry } from '../../types'
import { RefreshCw, Users } from 'lucide-react'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import { partySizeKey, useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { BossPortraitCrop } from '../../lib/boss-icons'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { MAPLE_LEAF_PATH } from '../../components/mapleLeafPath'
import { ProgressModal } from '../../components/ProgressModal/ProgressModal'
import { selectDisplayBosses, type MatchedBoss } from '../../lib/boss-matching'
import { isChallengersWorld } from '../../lib/world-emblem'
import { PartyManagementModal } from './PartyManagementModal'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'

type BossTab = 'weekly' | 'monthly'
type PartyFilter = 'all' | 'solo' | 'party'

const PARTY_FILTER_LABELS: Record<PartyFilter, string> = {
  all: '전체',
  solo: '솔로',
  party: '파티',
}


export function BossCard(props: {
  boss: MatchedBoss
  crop?: BossPortraitCrop
  partySize?: number
}): React.JSX.Element {
  const { boss, partySize } = props
  const portraitUrl = getBossPortraitUrl(boss.portraitSlug)
  const crop = props.crop ?? getBossPortraitCrop(boss.portraitSlug)
  const bossName = boss.matchedBossName ?? boss.apiName
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

  // 카드 배경/보더/보스명 텍스트는 앱 전역 테마(레테/렌)와 무관하게 항상 레테(다크) 배색을
  // 고정으로 쓴다(사용자 지시, 2026-07-13) — 일러스트 bleed·페이드·text-shadow가 어두운 배경을
  // 전제로 튜닝됐기 때문에 theme 토큰(bg-surface 등)을 쓰면 렌(라이트) 테마에서 대비가 깨진다.
  // 완료 뱃지는 앱 전체에서 공유하는 "완료/성공" 의미 색(secondary)이라 여기서는 고정하지 않고
  // theme 토큰을 그대로 써서 테마에 따라 계속 바뀌게 둔다.
  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-[#37323E] bg-[#1A1720]">
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
            className="text-sm font-medium text-[#E8DFEC]"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)' }}
          >
            {bossName}
          </span>
          {partySize !== undefined && partySize > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-gray-200/20 px-2 py-1 text-xs font-semibold text-[#E8DFEC]">
              <Users className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {partySize}인
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {boss.isComplete && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-bg">완료</span>
          )}
        </div>
      </div>
    </div>
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
    loadTrackedOcids,
    saveTrackedOcids,
    refresh,
    selectCharacter,
    setPartySize,
  } = useBossSchedulerStore()
  const [activeTab, setActiveTab] = useState<BossTab>('weekly')
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [isPickerOpen, setIsPickerOpen] = useState(() => searchParams.get('openPicker') === '1')
  const [saveProgress, setSaveProgress] = useState<{ completed: number; total: number } | null>(null)
  const [isPartyManagementOpen, setIsPartyManagementOpen] = useState(false)
  // ADR-019 결정 6: 주간/월간 탭은 서로 독립된 필터 상태를 갖는다(한 탭의 필터 변경이
  // 다른 탭에 영향을 주지 않음).
  const [weeklyFilter, setWeeklyFilter] = useState<PartyFilter>('all')
  const [monthlyFilter, setMonthlyFilter] = useState<PartyFilter>('all')

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
  useEffect(() => {
    if (!isPickerOpen) return
    let cancelled = false
    getCharacterPickerRoster((entries) => {
      if (!cancelled) setRoster(entries)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isPickerOpen])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  // 파티 관리 모달의 "등록된 난이도 기본 선택"용 — 실제 registration_flag 기준(ADR-019).
  const registeredWeeklyBosses =
    selected !== null ? selected.weeklyBosses.filter((boss) => boss.isRegistered) : []
  const registeredMonthlyBosses =
    selected !== null ? selected.monthlyBosses.filter((boss) => boss.isRegistered) : []

  // 카드로 표시할 목록 — 등록된 보스뿐 아니라 미등록이어도 완료된 보스를 포함한다([[ADR-031]] 결정 5).
  const displayedWeeklyBosses = selected !== null ? selectDisplayBosses(selected.weeklyBosses) : []
  const displayedMonthlyBosses = selected !== null ? selectDisplayBosses(selected.monthlyBosses) : []

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

  const characterManageButton = (
    <button
      type="button"
      onClick={() => setIsPickerOpen(true)}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      캐릭터 관리
    </button>
  )

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      entries={roster}
      trackedOcids={trackedOcids ?? []}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
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

  const partyManageButton = (
    <button
      type="button"
      onClick={() => setIsPartyManagementOpen(true)}
      className="text-sm font-medium text-text-muted hover:text-text"
    >
      파티 관리
    </button>
  )

  const partyManagementModal = isPartyManagementOpen && selected !== null && (
    <PartyManagementModal
      getRegisteredDifficulty={(bossName) =>
        [...registeredWeeklyBosses, ...registeredMonthlyBosses].find(
          (boss) => (boss.matchedBossName ?? boss.apiName) === bossName,
        )?.difficulty ?? null
      }
      getPartySize={(bossName, difficulty) =>
        partySizes[partySizeKey(selected.ocid, bossName, difficulty)] ?? 1
      }
      onSetPartySize={(bossName, difficulty, partySize) =>
        setPartySize(selected.ocid, bossName, difficulty, partySize)
      }
      onClose={() => setIsPartyManagementOpen(false)}
    />
  )

  if (isEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom)-4rem)] flex-col p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">보스 스케줄러</h1>
          {characterManageButton}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary/15">
            <svg width="42" height="43" viewBox="0 0 127 130" className="fill-primary" aria-hidden="true">
              <path d={MAPLE_LEAF_PATH} />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-text">표시할 캐릭터가 없습니다</p>
            <p className="max-w-[220px] text-sm text-text-muted">
              캐릭터를 선택하면 주간·월간 보스 스케줄을 확인할 수 있습니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover"
          >
            캐릭터 선택하기
          </button>
        </div>

        {trackingModals}
      </div>
    )
  }

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 필터까지(제목~탭~솔로/파티 필터)는 화면 상단에 고정하고 그 아래 보스 목록만 스크롤되게
          한다 — sticky는 페이지 스크롤 위에서 동작하므로 App.tsx의 레이아웃(높이 계산)을
          건드릴 필요가 없다. sticky 박스는 top-0으로 화면 맨 위(노치 포함)부터 bg-bg로
          덮어야 스크롤 중에도 그 위 카드가 비치지 않는다 — top을 안전영역만큼 내리면 그 위
          구간은 아무것도 덮지 못해 스크롤되는 카드가 노치 뒤로 비쳐 보인다. 대신
          padding-top에 안전영역을 더해 텍스트만 내려 보이게 하고, 바깥 AppShell의
          padding-top과 중복되지 않도록 위 -mt-[var(--sa-top)]로 상쇄한다.
          z-10으로 항상 위에 그려지게 한다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text">보스 스케줄러</h1>
            <div className="flex items-center gap-4">
              {selected !== null && partyManageButton}
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
                  className="p-2 text-primary-text hover:text-primary-hover"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {selected !== null && selected.isStale && (
              <p className="text-sm text-error">
                {selected.error !== null ? formatScheduleSyncError(selected.error) : ''}
              </p>
            )}
          </div>

          {status === 'error' && (
            <p className="text-sm text-error">
              {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
            </p>
          )}

          {/* ADR-016: 캐시된 characters가 있으면 재검증(status: 'loading') 중에도 계속 보여준다 —
              "불러오는 중"은 보여줄 데이터가 아예 없을 때만 표시한다. */}
          {(status === 'idle' || status === 'loading') && characters.length === 0 && (
            <p className="text-sm text-text-muted">불러오는 중...</p>
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
                        ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
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
                        ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
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
                            ? 'rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-bg'
                            : 'rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary'
                        }
                      >
                        {`season ${isSeasonBossComplete ? '완료' : '미완료'}`}
                      </span>
                    )}
                    {selected.weeklyBossClearCount !== null && selected.weeklyBossClearLimitCount !== null && (
                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                        {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                      </span>
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
                        ? 'rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary'
                        : 'px-3 text-xs font-medium text-text-muted'
                    }
                  >
                    {PARTY_FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 헤더 아래에 살짝 겹쳐 그라데이션+블러로 카드가 잘려 보이지 않고 자연스럽게
            사라지도록 한다 — 배경(bg-bg → transparent)과 블러 강도를 같은 마스크로 함께
            줄여서, 색만 옅어지고 블러는 그대로인 부자연스러운 경계가 생기지 않게 한다. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {characters.length > 0 && selected !== null && (
        <div className="space-y-4 px-4 pb-4">
          {activeTab === 'weekly' && (
            <>
              {displayedWeeklyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {displayedWeeklyBosses.length > 0 && filteredWeeklyBosses.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  이 조건에 해당하는 보스가 없습니다
                </div>
              )}

              {filteredWeeklyBosses.length > 0 && (
                <div className="space-y-2">
                  {filteredWeeklyBosses.map((boss) => (
                    <BossCard
                      key={`${boss.apiName}-${boss.difficulty}`}
                      boss={boss}
                      partySize={getPartySize(selected.ocid, boss)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'monthly' && (
            <>
              {displayedMonthlyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {displayedMonthlyBosses.length > 0 && filteredMonthlyBosses.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  이 조건에 해당하는 보스가 없습니다
                </div>
              )}

              {filteredMonthlyBosses.length > 0 && (
                <div className="space-y-2">
                  {filteredMonthlyBosses.map((boss) => (
                    <BossCard
                      key={`${boss.apiName}-${boss.difficulty}`}
                      boss={boss}
                      partySize={getPartySize(selected.ocid, boss)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {trackingModals}
      {partyManagementModal}
    </div>
  )
}

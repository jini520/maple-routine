import { useEffect, useState } from 'react'
import { RefreshCw, Users } from 'lucide-react'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import { partySizeKey, useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import type { BossPortraitCrop } from '../../lib/boss-icons'
import type { BossDifficulty, CharacterPickerEntry } from '../../types'
import type { MatchedBoss } from '../../lib/boss-matching'
import { PartyManagementModal } from './PartyManagementModal'

type BossTab = 'weekly' | 'monthly'
type PartyFilter = 'all' | 'solo' | 'party'

const PARTY_FILTER_LABELS: Record<PartyFilter, string> = {
  all: '전체',
  solo: '솔로',
  party: '파티',
}

const DIFFICULTY_BADGE_STYLES: Record<BossDifficulty, React.CSSProperties> = {
  이지: {
    background: 'linear-gradient(180deg,#aab4bc,#7d8891)',
    border: '1px solid #67717a',
    color: '#f5f6f7',
    textShadow: '0 1px 1px rgba(0,0,0,.3)',
  },
  노멀: {
    background: 'linear-gradient(180deg,#5cc2dd,#2b93b0)',
    border: '1px solid #1f7690',
    color: '#ffffff',
    textShadow: '0 1px 1px rgba(0,0,0,.25)',
  },
  하드: {
    background: 'linear-gradient(180deg,#e784a6,#c04b74)',
    border: '1px solid #9c3a5c',
    color: '#ffffff',
    textShadow: '0 1px 1px rgba(0,0,0,.25)',
  },
  카오스: {
    background: 'linear-gradient(180deg,#3c3c3c,#221f1f)',
    border: '1px solid #caa87f',
    color: '#f0d8b8',
  },
  익스트림: {
    background: 'linear-gradient(180deg,#3c3c3c,#1c1414)',
    border: '1.5px solid #ef5d78',
    color: '#f4794f',
  },
}

export function DifficultyBadge(props: { difficulty: BossDifficulty }): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center rounded-full text-[10px] font-extrabold tracking-[.03em]"
      style={{ height: '20px', padding: '0 10px', ...DIFFICULTY_BADGE_STYLES[props.difficulty] }}
    >
      {props.difficulty}
    </span>
  )
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
        </div>

        <div className="flex items-center gap-1.5">
          {partySize !== undefined && partySize > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-[#E8DFEC]">
              <Users className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {partySize}인
            </span>
          )}

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
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isPartyManagementOpen, setIsPartyManagementOpen] = useState(false)
  // ADR-019 결정 6: 주간/월간 탭은 서로 독립된 필터 상태를 갖는다(한 탭의 필터 변경이
  // 다른 탭에 영향을 주지 않음).
  const [weeklyFilter, setWeeklyFilter] = useState<PartyFilter>('all')
  const [monthlyFilter, setMonthlyFilter] = useState<PartyFilter>('all')

  useEffect(() => {
    loadTrackedOcids()
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

  const registeredWeeklyBosses =
    selected !== null ? selected.weeklyBosses.filter((boss) => boss.isRegistered) : []
  const registeredMonthlyBosses =
    selected !== null ? selected.monthlyBosses.filter((boss) => boss.isRegistered) : []

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
    selected !== null ? filterByPartySize(registeredWeeklyBosses, selected.ocid, weeklyFilter) : []
  const filteredMonthlyBosses =
    selected !== null ? filterByPartySize(registeredMonthlyBosses, selected.ocid, monthlyFilter) : []

  async function handleSaveTracking(ocids: string[]): Promise<void> {
    await saveTrackedOcids(ocids)
    setIsPickerOpen(false)
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
      bosses={[...registeredWeeklyBosses, ...registeredMonthlyBosses]}
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
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">보스 스케줄러</h1>
          {characterManageButton}
        </div>

        <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
          표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요
        </div>

        {trackingPicker}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
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
              {selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
            </p>
            <button
              type="button"
              onClick={() => refresh(trackedOcids ?? [])}
              aria-label="새로고침"
              className="p-2 text-primary-text hover:text-primary-hover"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
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

            {activeTab === 'weekly' &&
              selected.weeklyBossClearCount !== null &&
              selected.weeklyBossClearLimitCount !== null && (
                <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                  {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                </span>
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

          {activeTab === 'weekly' && (
            <>
              {registeredWeeklyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredWeeklyBosses.length > 0 && filteredWeeklyBosses.length === 0 && (
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
              {registeredMonthlyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredMonthlyBosses.length > 0 && filteredMonthlyBosses.length === 0 && (
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
        </>
      )}

      {trackingPicker}
      {partyManagementModal}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import { getBossPortraitCrop, getBossPortraitUrl } from '../../lib/boss-icons'
import type { BossDifficulty, CharacterPickerEntry } from '../../types'
import type { MatchedBoss } from '../../lib/boss-matching'

type BossTab = 'weekly' | 'monthly'

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

function DifficultyBadge(props: { difficulty: BossDifficulty }): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center rounded-full text-[10px] font-extrabold tracking-[.03em]"
      style={{ height: '20px', padding: '0 10px', ...DIFFICULTY_BADGE_STYLES[props.difficulty] }}
    >
      {props.difficulty}
    </span>
  )
}

function BossCard(props: { boss: MatchedBoss }): React.JSX.Element {
  const { boss } = props
  const portraitUrl = getBossPortraitUrl(boss.portraitSlug)
  const crop = getBossPortraitCrop(boss.portraitSlug)
  const bossName = boss.matchedBossName ?? boss.apiName
  const maskImage = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'

  return (
    <div className="relative h-20 overflow-hidden rounded-[14px] border border-border bg-surface">
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
            className="text-sm font-medium text-text"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)' }}
          >
            {bossName}
          </span>
        </div>

        {boss.isComplete && (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-bg">완료</span>
        )}
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
    loadTrackedOcids,
    saveTrackedOcids,
    refresh,
    selectCharacter,
  } = useBossSchedulerStore()
  const [activeTab, setActiveTab] = useState<BossTab>('weekly')
  const [roster, setRoster] = useState<CharacterPickerEntry[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)

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
        {characterManageButton}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
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
          <CharacterSelectDropdown
            characters={characters}
            selectedOcid={selected.ocid}
            onSelect={(ocid) => {
              void selectCharacter(ocid)
            }}
          />

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

          {activeTab === 'weekly' && (
            <>
              {registeredWeeklyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredWeeklyBosses.length > 0 && (
                <div className="space-y-2">
                  {registeredWeeklyBosses.map((boss) => (
                    <BossCard key={`${boss.apiName}-${boss.difficulty}`} boss={boss} />
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

              {registeredMonthlyBosses.length > 0 && (
                <div className="space-y-2">
                  {registeredMonthlyBosses.map((boss) => (
                    <BossCard key={`${boss.apiName}-${boss.difficulty}`} boss={boss} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {trackingPicker}
    </div>
  )
}

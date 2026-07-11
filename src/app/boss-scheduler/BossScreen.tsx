import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getRegisteredCharacters } from '../../features/schedule-sync/schedule-sync'
import type { MapleCharacter } from '../../types'
import type { MatchedBoss } from '../../lib/boss-matching'

type BossTab = 'weekly' | 'monthly'

function StatusDot(props: { filled: boolean; label: string }): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={props.label}
      className={
        props.filled
          ? 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#15803D] text-[8px] text-white'
          : 'h-4 w-4 shrink-0 rounded-full border border-[#F0DFD1]'
      }
    >
      {props.filled ? '✓' : ''}
    </span>
  )
}

function BossList(props: { bosses: MatchedBoss[] }): React.JSX.Element {
  return (
    <ul className="rounded-[14px] bg-white border border-[#F0DFD1] p-4 space-y-2">
      {props.bosses.map((boss) => (
        <li key={`${boss.apiName}-${boss.difficulty}`} className="flex items-center gap-2">
          <StatusDot filled={boss.isComplete} label={boss.isComplete ? '완료' : '미완료'} />
          <div className="h-5 w-5 shrink-0">
            <BossPortrait
              portraitSlug={boss.portraitSlug}
              difficulty={boss.difficulty}
              label={boss.matchedBossName ?? boss.apiName}
            />
          </div>
          <span className="text-sm text-[#5B4636]">
            {boss.matchedBossName ?? boss.apiName} · {boss.difficulty}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function BossScreen(): React.JSX.Element {
  const { status, characters, error, trackedOcids, loadTrackedOcids, saveTrackedOcids, refresh } =
    useBossSchedulerStore()
  const [activeTab, setActiveTab] = useState<BossTab>('weekly')
  const [selectedOcid, setSelectedOcid] = useState<string | null>(null)
  const [roster, setRoster] = useState<MapleCharacter[]>([])
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    getRegisteredCharacters()
      .then(setRoster)
      .catch(() => {})
  }, [])

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
      className="text-sm font-medium text-[#8A7362] hover:text-[#5B4636]"
    >
      캐릭터 관리
    </button>
  )

  const trackingPicker = isPickerOpen && (
    <CharacterTrackingPicker
      allCharacters={roster.map((character) => ({ ocid: character.ocid, characterName: character.name }))}
      trackedOcids={trackedOcids ?? []}
      onSave={handleSaveTracking}
      onClose={() => setIsPickerOpen(false)}
    />
  )

  if (isEmpty) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#2B1B10]">보스 스케줄러</h1>
          {characterManageButton}
        </div>

        <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
          표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요
        </div>

        {trackingPicker}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#2B1B10]">보스 스케줄러</h1>
        {characterManageButton}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8A7362]">
            {selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
          </p>
          <button
            type="button"
            onClick={() => refresh(trackedOcids ?? [])}
            aria-label="새로고침"
            className="p-2 text-[#C2410C] hover:text-[#E6652E]"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {selected !== null && selected.isStale && (
          <p className="text-sm text-[#B91C1C]">
            {selected.error !== null ? formatScheduleSyncError(selected.error) : ''}
          </p>
        )}
      </div>

      {(status === 'idle' || status === 'loading') && (
        <p className="text-sm text-[#8A7362]">불러오는 중...</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-[#B91C1C]">
          {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
        </p>
      )}

      {status === 'loaded' && selected !== null && (
        <>
          <CharacterSelectDropdown
            characters={characters}
            selectedOcid={selected.ocid}
            onSelect={setSelectedOcid}
          />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('weekly')}
              className={
                activeTab === 'weekly'
                  ? 'text-sm font-semibold text-[#C2410C]'
                  : 'text-sm font-medium text-[#8A7362]'
              }
            >
              주간
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={
                activeTab === 'monthly'
                  ? 'text-sm font-semibold text-[#C2410C]'
                  : 'text-sm font-medium text-[#8A7362]'
              }
            >
              월간
            </button>
          </div>

          {activeTab === 'weekly' && (
            <>
              {registeredWeeklyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {(registeredWeeklyBosses.length > 0 ||
                (selected.weeklyBossClearCount !== null && selected.weeklyBossClearLimitCount !== null)) && (
                <section className="space-y-2">
                  {selected.weeklyBossClearCount !== null && selected.weeklyBossClearLimitCount !== null && (
                    <span className="rounded-full bg-[#FFE9DB] px-2 py-0.5 text-xs font-medium text-[#C2410C]">
                      {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                    </span>
                  )}

                  {registeredWeeklyBosses.length > 0 && <BossList bosses={registeredWeeklyBosses} />}
                </section>
              )}
            </>
          )}

          {activeTab === 'monthly' && (
            <>
              {registeredMonthlyBosses.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredMonthlyBosses.length > 0 && <BossList bosses={registeredMonthlyBosses} />}
            </>
          )}
        </>
      )}

      {trackingPicker}
    </div>
  )
}

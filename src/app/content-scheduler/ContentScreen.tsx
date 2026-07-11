import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getRegisteredCharacters } from '../../features/schedule-sync/schedule-sync'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import type { MapleCharacter } from '../../types'

type ContentTab = 'daily' | 'weekly'

export function ContentScreen(): React.JSX.Element {
  const { status, characters, error, trackedOcids, loadTrackedOcids, saveTrackedOcids, refresh } =
    useContentSchedulerStore()
  const [activeTab, setActiveTab] = useState<ContentTab>('daily')
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

  const registeredDailyContents =
    selected !== null ? selected.dailyContents.filter((content) => content.isRegistered) : []
  const registeredWeeklyContents =
    selected !== null ? selected.weeklyContents.filter((content) => content.isRegistered) : []

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
          <h1 className="text-lg font-semibold text-[#2B1B10]">컨텐츠 스케줄러</h1>
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
        <h1 className="text-lg font-semibold text-[#2B1B10]">컨텐츠 스케줄러</h1>
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
              onClick={() => setActiveTab('daily')}
              className={
                activeTab === 'daily'
                  ? 'text-sm font-semibold text-[#C2410C]'
                  : 'text-sm font-medium text-[#8A7362]'
              }
            >
              일간
            </button>
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
          </div>

          {activeTab === 'daily' && (
            <>
              {registeredDailyContents.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredDailyContents.length > 0 && (
                <ul className="space-y-3">
                  {registeredDailyContents.map((content) => (
                    <li
                      key={content.name}
                      className="rounded-[14px] bg-white border border-[#F0DFD1] p-4 space-y-2"
                    >
                      <p className="text-sm text-[#5B4636]">
                        {content.name} · {content.nowCount}/{content.maxCount}
                      </p>
                      {content.maxCount > 0 && (
                        <div
                          role="progressbar"
                          aria-valuenow={content.nowCount}
                          aria-valuemin={0}
                          aria-valuemax={content.maxCount}
                          className="h-1.5 w-full rounded-full bg-[#F7EDE3] overflow-hidden"
                        >
                          <div
                            className="h-1.5 rounded-full bg-[#FF7033]"
                            style={{ width: `${Math.min((content.nowCount / content.maxCount) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {activeTab === 'weekly' && (
            <>
              {registeredWeeklyContents.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredWeeklyContents.length > 0 && (
                <ul className="rounded-[14px] bg-white border border-[#F0DFD1] p-4 space-y-2">
                  {registeredWeeklyContents.map((content) => (
                    <li key={content.name} className="flex items-center gap-2">
                      <span className="text-sm text-[#5B4636]">
                        {content.name} · {content.nowCount}/{content.maxCount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {trackingPicker}
    </div>
  )
}

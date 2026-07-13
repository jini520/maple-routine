import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { getCharacterPickerRoster } from '../../features/schedule-sync/schedule-sync'
import { CharacterSelectDropdown } from '../../components/CharacterSelectDropdown/CharacterSelectDropdown'
import { CharacterTrackingPicker } from '../../components/CharacterTrackingPicker/CharacterTrackingPicker'
import type { CharacterPickerEntry } from '../../types'

type ContentTab = 'daily' | 'weekly'

export function ContentScreen(): React.JSX.Element {
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
  } = useContentSchedulerStore()
  const [activeTab, setActiveTab] = useState<ContentTab>('daily')
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
          <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
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
    <div className="space-y-4">
      {/* 제목~탭까지는 화면 상단에 고정하고 그 아래 컨텐츠 목록만 스크롤되게 한다 — sticky는
          페이지 스크롤 위에서 동작하므로 App.tsx의 레이아웃(높이 계산)을 건드릴 필요가 없다.
          bg-bg로 뒤에서 스크롤되는 항목이 비치지 않게 막고, z-10으로 항상 위에 그려지게 한다.
          패딩(px-4 pt-4)은 바깥 컨테이너가 아니라 이 sticky 엘리먼트 자신에게 줘야 한다 —
          바깥에 padding-top이 있으면 그만큼 스크롤해야 비로소 완전히 고정되는(그 전까지
          조금씩 따라 움직이는) 문제가 생긴다. */}
      <div className="sticky top-0 z-10 space-y-4 bg-bg px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">컨텐츠 스케줄러</h1>
          {characterManageButton}
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={
                activeTab === 'daily'
                  ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
                  : 'px-3 text-sm font-medium text-text-muted'
              }
            >
              일간
            </button>
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
          </div>
        )}
      </div>

      {characters.length > 0 && selected !== null && (
        <div className="space-y-4 px-4 pb-4">
          {activeTab === 'daily' && (
            <>
              {registeredDailyContents.length === 0 && !selected.isStale && (
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredDailyContents.length > 0 && (
                <ul className="space-y-3">
                  {registeredDailyContents.map((content) => (
                    <li
                      key={content.name}
                      className="rounded-[14px] bg-surface border border-border p-4 space-y-2"
                    >
                      <p className="text-sm text-text">
                        {content.name} · {content.nowCount}/{content.maxCount}
                      </p>
                      {content.maxCount > 0 && (
                        <div
                          role="progressbar"
                          aria-valuenow={content.nowCount}
                          aria-valuemin={0}
                          aria-valuemax={content.maxCount}
                          className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden"
                        >
                          <div
                            className="h-1.5 rounded-full bg-primary"
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
                <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </div>
              )}

              {registeredWeeklyContents.length > 0 && (
                <ul className="rounded-[14px] bg-surface border border-border p-4 space-y-2">
                  {registeredWeeklyContents.map((content) => (
                    <li key={content.name} className="flex items-center gap-2">
                      <span className="text-sm text-text">
                        {content.name} · {content.nowCount}/{content.maxCount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {trackingPicker}
    </div>
  )
}

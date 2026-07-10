import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useDailySchedulerStore } from '../../features/daily-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { CharacterChipTabs } from '../../components/CharacterChipTabs/CharacterChipTabs'

export function DailyScreen(): React.JSX.Element {
  const { status, characters, error, refresh } = useDailySchedulerStore()
  const [selectedOcid, setSelectedOcid] = useState<string | null>(null)

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold text-[#2B1B10]">일간 스케줄러</h1>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8A7362]">
            {selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
          </p>
          <button
            type="button"
            onClick={() => refresh()}
            aria-label="새로고침"
            className="rounded-full bg-[#FF7033] text-[#2B1206] hover:bg-[#E6652E] p-2"
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
          <CharacterChipTabs
            characters={characters}
            selectedOcid={selected.ocid}
            onSelect={setSelectedOcid}
          />

          {selected.dailyContents.length === 0 && !selected.isStale && (
            <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
              표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
            </div>
          )}

          {selected.dailyContents.length > 0 && (
            <ul className="space-y-3">
              {selected.dailyContents.map((content) => (
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
    </div>
  )
}

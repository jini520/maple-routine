import { useEffect } from 'react'
import { useDailySchedulerStore } from '../../features/daily-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'

export function DailyScreen(): React.JSX.Element {
  const { status, characters, error, refresh } = useDailySchedulerStore()

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#2B1B10]">일간 스케줄러</h1>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-full bg-[#FF7033] text-[#2B1206] font-semibold hover:bg-[#E6652E] px-4 py-2 text-sm"
        >
          새로고침
        </button>
      </div>

      {(status === 'idle' || status === 'loading') && (
        <p className="text-sm text-[#8A7362]">불러오는 중...</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-[#B91C1C]">
          {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
        </p>
      )}

      {status === 'loaded' && (
        <ul className="space-y-4">
          {characters.map((character) => (
            <li
              key={character.ocid}
              className="rounded-[14px] bg-white border border-[#F0DFD1] p-4 space-y-2"
            >
              <h2 className="text-sm font-medium text-[#2B1B10]">{character.characterName}</h2>

              {character.isStale && (
                <p className="text-sm text-[#B91C1C]">
                  {character.error !== null ? formatScheduleSyncError(character.error) : ''} ·{' '}
                  {formatSyncedAt(character.syncedAt)}
                </p>
              )}

              {character.dailyContents.length === 0 && !character.isStale && (
                <p className="text-sm text-[#8A7362]">
                  표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                </p>
              )}

              {character.dailyContents.length > 0 && (
                <ul className="space-y-1">
                  {character.dailyContents.map((content) => (
                    <li key={content.name} className="text-sm text-[#5B4636]">
                      {content.name} · {content.isRegistered ? '등록됨' : '미등록'} ·{' '}
                      {content.nowCount}/{content.maxCount}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

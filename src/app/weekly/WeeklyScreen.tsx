import { useEffect } from 'react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { useWeeklySchedulerStore } from '../../features/weekly-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'

export function WeeklyScreen(): React.JSX.Element {
  const { status, characters, error, refresh } = useWeeklySchedulerStore()

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#2B1B10]">주간 스케줄러</h1>
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

              {character.weeklyBossClearCount !== null && character.weeklyBossClearLimitCount !== null && (
                <p className="text-sm text-[#5B4636]">
                  주간 보스 처치 {character.weeklyBossClearCount}/{character.weeklyBossClearLimitCount}
                </p>
              )}

              {character.weeklyContents.length === 0 &&
                character.bosses.length === 0 &&
                !character.isStale && (
                  <p className="text-sm text-[#8A7362]">
                    표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
                  </p>
                )}

              {character.weeklyContents.length > 0 && (
                <ul className="space-y-1">
                  {character.weeklyContents.map((content) => (
                    <li key={content.name} className="text-sm text-[#5B4636]">
                      {content.name} · {content.isRegistered ? '등록됨' : '미등록'} ·{' '}
                      {content.nowCount}/{content.maxCount}
                    </li>
                  ))}
                </ul>
              )}

              {character.bosses.length > 0 && (
                <ul className="space-y-2">
                  {character.bosses.map((boss) => (
                    <li key={`${boss.apiName}-${boss.difficulty}`} className="flex items-center gap-3">
                      <div className="w-16 h-16 shrink-0">
                        <BossPortrait
                          portraitSlug={boss.portraitSlug}
                          difficulty={boss.difficulty}
                          label={boss.matchedBossName ?? boss.apiName}
                        />
                      </div>
                      <p className="text-sm text-[#5B4636]">
                        {boss.matchedBossName ?? boss.apiName} · {boss.difficulty} ·{' '}
                        {boss.isRegistered ? '등록됨' : '미등록'} ·{' '}
                        {boss.isComplete ? '완료' : '미완료'}
                      </p>
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

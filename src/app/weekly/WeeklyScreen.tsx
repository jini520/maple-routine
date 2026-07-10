import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { CharacterChipTabs } from '../../components/CharacterChipTabs/CharacterChipTabs'
import { useWeeklySchedulerStore } from '../../features/weekly-scheduler/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'

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

export function WeeklyScreen(): React.JSX.Element {
  const { status, characters, error, refresh } = useWeeklySchedulerStore()
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

  const showBossSection =
    selected !== null &&
    (selected.bosses.length > 0 ||
      (selected.weeklyBossClearCount !== null && selected.weeklyBossClearLimitCount !== null))

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold text-[#2B1B10]">주간 스케줄러</h1>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8A7362]">
            {selected !== null ? formatSyncedAt(selected.syncedAt) : ''}
          </p>
          <button
            type="button"
            onClick={() => refresh()}
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
          <CharacterChipTabs
            characters={characters}
            selectedOcid={selected.ocid}
            onSelect={setSelectedOcid}
          />

          {selected.weeklyContents.length === 0 && selected.bosses.length === 0 && !selected.isStale && (
            <div className="rounded-[14px] border border-dashed border-[#F0DFD1] p-4 text-sm text-[#8A7362]">
              표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요
            </div>
          )}

          {selected.weeklyContents.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-[#2B1B10]">주간 퀘스트</h2>
              <ul className="rounded-[14px] bg-white border border-[#F0DFD1] p-4 space-y-2">
                {selected.weeklyContents.map((content) => (
                  <li key={content.name} className="flex items-center gap-2">
                    <StatusDot filled={content.isRegistered} label={content.isRegistered ? '등록됨' : '미등록'} />
                    <span
                      className={
                        content.isRegistered ? 'text-sm text-[#5B4636]' : 'text-sm text-[#B7A490]'
                      }
                    >
                      {content.name} · {content.nowCount}/{content.maxCount}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showBossSection && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#2B1B10]">주간 보스</h2>
                {selected.weeklyBossClearCount !== null && selected.weeklyBossClearLimitCount !== null && (
                  <span className="rounded-full bg-[#FFE9DB] px-2 py-0.5 text-xs font-medium text-[#C2410C]">
                    {selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}
                  </span>
                )}
              </div>

              {selected.bosses.length > 0 && (
                <ul className="rounded-[14px] bg-white border border-[#F0DFD1] p-4 space-y-2">
                  {selected.bosses.map((boss) => (
                    <li key={`${boss.apiName}-${boss.difficulty}`} className="flex items-center gap-2">
                      <StatusDot filled={boss.isComplete} label={boss.isComplete ? '완료' : '미완료'} />
                      <div className="h-5 w-5 shrink-0">
                        <BossPortrait
                          portraitSlug={boss.portraitSlug}
                          difficulty={boss.difficulty}
                          label={boss.matchedBossName ?? boss.apiName}
                        />
                      </div>
                      <span
                        className={
                          boss.isRegistered ? 'text-sm text-[#5B4636]' : 'text-sm text-[#B7A490]'
                        }
                      >
                        {boss.matchedBossName ?? boss.apiName} · {boss.difficulty}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

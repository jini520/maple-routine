import { useState } from 'react'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { Modal } from '../../components/Modal/Modal'
import weeklyBossesData from '../../data/weekly-bosses.json'
import type { BossDifficulty } from '../../types'

interface BossReferenceEntry {
  boss: string
  difficulties: string[]
}

// 수동 추적 "추가" 후보는 캐릭터의 게임 내 등록 여부와 무관하게 항상 전체 보스 목록
// (주간+시즌 주간+월간)이다 — 고정 게임 레퍼런스 데이터에서만 고른다(ADR-035 결정 11,
// PartyManagementModal과 동일한 소스).
const ALL_BOSSES: Array<{ boss: string; difficulties: BossDifficulty[] }> = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]),
].map((entry) => ({ boss: entry.boss, difficulties: entry.difficulties as BossDifficulty[] }))

export interface ManualBossPickerModalProps {
  /** 이미 추적 중인 (보스, 난이도) 쌍 — 해당 난이도 뱃지를 비활성화한다. */
  alreadyTracked: Array<{ contentName: string; difficulty: string }>
  onAdd: (contentName: string, difficulty: string) => void
  onClose: () => void
}

// ADR-035 결정 11: 자유 텍스트 입력도, 과거 이력 자동완성도 없다 — 보스 드롭다운 → 난이도 뱃지
// 선택의 2단 폼으로 고정 템플릿에서만 고른다(PartyManagementModal의 인터랙션 패턴 재사용).
export function ManualBossPickerModal(props: ManualBossPickerModalProps): React.JSX.Element {
  const [selectedBoss, setSelectedBoss] = useState(ALL_BOSSES[0]?.boss ?? '')
  const difficulties = ALL_BOSSES.find((entry) => entry.boss === selectedBoss)?.difficulties ?? []

  function isTracked(difficulty: string): boolean {
    return props.alreadyTracked.some(
      (item) => item.contentName === selectedBoss && item.difficulty === difficulty,
    )
  }

  return (
    <Modal onClose={props.onClose} testId="manual-boss-picker-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">보스 추가</h2>
        <p className="text-sm text-text-muted">추적할 보스와 난이도를 선택해주세요.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="manual-boss-picker-boss" className="text-xs font-medium text-text-muted">
            보스
          </label>
          <select
            id="manual-boss-picker-boss"
            value={selectedBoss}
            onChange={(event) => setSelectedBoss(event.target.value)}
            className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-sm text-text"
          >
            {ALL_BOSSES.map((entry) => (
              <option key={entry.boss} value={entry.boss}>
                {entry.boss}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">난이도</p>
          {difficulties.length === 0 ? (
            <p className="text-sm text-text-muted">이 보스는 아직 난이도 정보가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {difficulties.map((difficulty) => {
                const tracked = isTracked(difficulty)
                return (
                  <button
                    key={difficulty}
                    type="button"
                    disabled={tracked}
                    onClick={() => {
                      props.onAdd(selectedBoss, difficulty)
                      props.onClose()
                    }}
                    aria-label={`${selectedBoss} ${difficulty} 추가`}
                    className={
                      tracked
                        ? 'inline-flex rounded-full border-0 p-0 leading-none opacity-40'
                        : 'inline-flex rounded-full border-0 p-0 leading-none hover:opacity-70'
                    }
                  >
                    <DifficultyBadge difficulty={difficulty} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

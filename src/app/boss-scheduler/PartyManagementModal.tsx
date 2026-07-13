import { useState } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { getMaxPartySize } from '../../lib/boss-crystal-prices'
import type { MatchedBoss } from '../../lib/boss-matching'

export interface PartyManagementModalProps {
  bosses: MatchedBoss[] // 주간+월간 통합, 등록된 보스만(호출자가 필터링해서 넘긴다)
  getPartySize: (boss: MatchedBoss) => number // 미설정이면 1(솔로)
  onSetPartySize: (boss: MatchedBoss, partySize: number) => Promise<void>
  onClose: () => void
}

function PartyManagementRow(props: {
  boss: MatchedBoss
  currentPartySize: number
  onSave: (partySize: number) => Promise<void>
}): React.JSX.Element {
  const bossName = props.boss.matchedBossName ?? props.boss.apiName
  const maxPartySize = getMaxPartySize(bossName, props.boss.difficulty)
  const [inputValue, setInputValue] = useState(String(props.currentPartySize))
  const [error, setError] = useState<string | null>(null)

  async function handleBlur(): Promise<void> {
    const trimmed = inputValue.trim()
    const partySize = Number(trimmed)

    if (trimmed === '' || !Number.isInteger(partySize) || partySize < 1 || partySize > maxPartySize) {
      setError(`파티원 수는 1 이상 ${maxPartySize} 이하의 정수여야 합니다`)
      return
    }

    try {
      await props.onSave(partySize)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파티원 수를 확인해주세요')
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">
          {bossName} · {props.boss.difficulty}
        </p>
        {error !== null && <p className="text-xs text-error">{error}</p>}
      </div>
      <input
        type="number"
        min={1}
        max={maxPartySize}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={() => void handleBlur()}
        aria-label={`${bossName} ${props.boss.difficulty} 파티원 수`}
        className="w-16 shrink-0 rounded-[10px] border border-border px-2 py-1 text-sm text-text"
      />
    </li>
  )
}

export function PartyManagementModal(props: PartyManagementModalProps): React.JSX.Element {
  return (
    <Modal onClose={props.onClose} testId="party-management-modal-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">파티 관리</h2>
        <p className="text-sm text-text-muted">
          보스별 파티 인원을 미리 설정해두면 보스 카드에 배지로 표시됩니다.
        </p>
      </div>

      {props.bosses.length === 0 ? (
        <p className="text-sm text-text-muted">표시할 보스가 없습니다.</p>
      ) : (
        <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
          {props.bosses.map((boss) => (
            <PartyManagementRow
              key={`${boss.apiName}-${boss.difficulty}`}
              boss={boss}
              currentPartySize={props.getPartySize(boss)}
              onSave={(partySize) => props.onSetPartySize(boss, partySize)}
            />
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text"
        >
          닫기
        </button>
      </div>
    </Modal>
  )
}

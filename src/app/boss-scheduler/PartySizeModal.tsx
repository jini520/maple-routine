import { useState } from 'react'
import { Modal } from '../../components/Modal/Modal'
import type { BossDifficulty } from '../../types'

export interface PartySizeModalProps {
  bossName: string
  difficulty: BossDifficulty
  currentPartySize: number // 1~maxPartySize. store.partySizes에 값이 없으면 호출자가 1을 넘긴다
  maxPartySize: number
  onSave: (partySize: number) => Promise<void>
  onClose: () => void
}

export function PartySizeModal(props: PartySizeModalProps): React.JSX.Element {
  const [inputValue, setInputValue] = useState(String(props.currentPartySize))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const trimmed = inputValue.trim()
    const partySize = Number(trimmed)

    if (trimmed === '' || !Number.isInteger(partySize) || partySize < 1 || partySize > props.maxPartySize) {
      setError(`파티원 수는 1 이상 ${props.maxPartySize} 이하의 정수여야 합니다`)
      return
    }

    setIsSaving(true)
    try {
      await props.onSave(partySize)
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '파티원 수를 확인해주세요')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal onClose={props.onClose} testId="party-size-modal-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">파티 인원 설정</h2>
        <p className="text-sm text-text-muted">
          {props.bossName} · {props.difficulty}
        </p>
      </div>

      <input
        type="number"
        min={1}
        max={props.maxPartySize}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        aria-label="파티원 수"
        className="w-full rounded-[10px] border border-border px-4 py-3 text-sm text-text"
      />

      {error !== null && <p className="mt-2 text-sm text-error">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text"
        >
          취소
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover disabled:opacity-50"
        >
          저장
        </button>
      </div>
    </Modal>
  )
}

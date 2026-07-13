import { useState } from 'react'
import { Modal } from '../../components/Modal/Modal'
import bossCrystalPricesData from '../../data/boss-crystal-prices.json'
import { getMaxPartySize } from '../../lib/boss-crystal-prices'
import { DifficultyBadge } from './BossScreen'
import type { BossDifficulty } from '../../types'
import type { MatchedBoss } from '../../lib/boss-matching'

interface CrystalPriceEntry {
  boss: string
  difficulty: string
}

const CRYSTAL_PRICES = bossCrystalPricesData.prices as CrystalPriceEntry[]

// 보스가 지원하는 난이도 목록은 새 게임 데이터를 만들지 않고 기존 boss-crystal-prices.json에서
// 그대로 조회한다(ADR-006) — maxPartySize 조회와 동일한 소스.
function getDifficultiesForBoss(bossName: string): BossDifficulty[] {
  return CRYSTAL_PRICES.filter((entry) => entry.boss === bossName).map(
    (entry) => entry.difficulty as BossDifficulty,
  )
}

function uniqueBossNames(bosses: MatchedBoss[]): string[] {
  return Array.from(new Set(bosses.map((boss) => boss.matchedBossName ?? boss.apiName)))
}

// 캐릭터가 실제로 등록해둔 난이도가 있으면 그걸 기본값으로 보여준다(가장 관련도 높은 값).
function defaultDifficultyFor(bosses: MatchedBoss[], bossName: string): BossDifficulty | null {
  const registered = bosses.find((boss) => (boss.matchedBossName ?? boss.apiName) === bossName)
  if (registered !== undefined) return registered.difficulty
  return getDifficultiesForBoss(bossName)[0] ?? null
}

// 보스/난이도 선택이 바뀔 때마다 key로 리마운트시켜, 이전 선택의 입력값·에러가 새 선택에
// 남아있지 않도록 한다(useEffect로 파생 state를 동기화하는 대신 React의 key 리셋 관용구 사용).
function PartySizeEditor(props: {
  maxPartySize: number
  initialValue: number
  onSave: (partySize: number) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [inputValue, setInputValue] = useState(String(props.initialValue))
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
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파티원 수를 확인해주세요')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-1">
        <label htmlFor="party-management-size" className="text-xs font-medium text-text-muted">
          파티원 수
        </label>
        <input
          id="party-management-size"
          type="number"
          min={1}
          max={props.maxPartySize}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="w-full rounded-[10px] border border-border px-4 py-3 text-sm text-text"
        />
        {error !== null && <p className="text-sm text-error">{error}</p>}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text"
        >
          닫기
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
    </>
  )
}

export interface PartyManagementModalProps {
  bosses: MatchedBoss[] // 등록된 보스(주간+월간 통합) — 보스 드롭다운 옵션의 소스
  getPartySize: (bossName: string, difficulty: BossDifficulty) => number // 미설정이면 1(솔로)
  onSetPartySize: (bossName: string, difficulty: BossDifficulty, partySize: number) => Promise<void>
  onClose: () => void
}

export function PartyManagementModal(props: PartyManagementModalProps): React.JSX.Element {
  const bossNames = uniqueBossNames(props.bosses)
  const [selectedBoss, setSelectedBoss] = useState(bossNames[0] ?? '')
  const [selectedDifficulty, setSelectedDifficulty] = useState<BossDifficulty | null>(
    defaultDifficultyFor(props.bosses, bossNames[0] ?? ''),
  )

  const difficulties = selectedBoss !== '' ? getDifficultiesForBoss(selectedBoss) : []
  const maxPartySize = selectedDifficulty !== null ? getMaxPartySize(selectedBoss, selectedDifficulty) : 1

  function handleSelectBoss(bossName: string): void {
    setSelectedBoss(bossName)
    setSelectedDifficulty(defaultDifficultyFor(props.bosses, bossName))
  }

  return (
    <Modal onClose={props.onClose} testId="party-management-modal-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">파티 관리</h2>
        <p className="text-sm text-text-muted">보스별 파티 인원을 미리 설정해두면 보스 카드에 배지로 표시됩니다.</p>
      </div>

      {bossNames.length === 0 ? (
        <>
          <p className="text-sm text-text-muted">표시할 보스가 없습니다.</p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text"
            >
              닫기
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="party-management-boss" className="text-xs font-medium text-text-muted">
              보스
            </label>
            <select
              id="party-management-boss"
              value={selectedBoss}
              onChange={(event) => handleSelectBoss(event.target.value)}
              className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-sm text-text"
            >
              {bossNames.map((bossName) => (
                <option key={bossName} value={bossName}>
                  {bossName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-text-muted">난이도</p>
            <div className="flex flex-wrap gap-2">
              {difficulties.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => setSelectedDifficulty(difficulty)}
                  aria-pressed={selectedDifficulty === difficulty}
                  className={
                    selectedDifficulty === difficulty
                      ? 'inline-flex rounded-full border-0 p-0 leading-none ring-2 ring-primary'
                      : 'inline-flex rounded-full border-0 p-0 leading-none opacity-50 hover:opacity-80'
                  }
                >
                  <DifficultyBadge difficulty={difficulty} />
                </button>
              ))}
            </div>
          </div>

          {selectedDifficulty !== null && (
            <PartySizeEditor
              key={`${selectedBoss}:${selectedDifficulty}`}
              maxPartySize={maxPartySize}
              initialValue={props.getPartySize(selectedBoss, selectedDifficulty)}
              onSave={(partySize) => props.onSetPartySize(selectedBoss, selectedDifficulty, partySize)}
              onClose={props.onClose}
            />
          )}
        </div>
      )}
    </Modal>
  )
}

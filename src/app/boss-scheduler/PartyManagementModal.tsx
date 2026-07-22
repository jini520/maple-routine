import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { Modal } from '../../components/Modal/Modal'
import weeklyBossesData from '../../data/weekly-bosses.json'
import { CRYSTAL_PRICES, getMaxPartySize } from '../../lib/boss-crystal-prices'
import type { BossDifficulty } from '../../types'

interface BossReferenceEntry {
  boss: string
}

// 파티 관리의 보스 목록은 캐릭터가 게임 내 스케줄러에 등록해둔 것과 무관하게 항상 전체
// 보스 목록(주간+시즌 주간+월간)을 보여준다(사용자 요청) — 아직 등록하지 않은 보스도
// 미리 파티 인원을 설정해둘 수 있어야 하기 때문이다.
const ALL_BOSS_NAMES = Array.from(
  new Set(
    [
      ...(weeklyBossesData.weekly as BossReferenceEntry[]),
      ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
      ...(weeklyBossesData.monthly as BossReferenceEntry[]),
    ].map((entry) => entry.boss),
  ),
)

// 보스가 지원하는 난이도 목록은 새 게임 데이터를 만들지 않고 기존 boss-crystal-prices.json에서
// 그대로 조회한다(ADR-006) — maxPartySize 조회와 동일한 소스.
function getDifficultiesForBoss(bossName: string): BossDifficulty[] {
  return CRYSTAL_PRICES.filter((entry) => entry.boss === bossName).map(
    (entry) => entry.difficulty as BossDifficulty,
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// 보스/난이도 선택이 바뀔 때마다 key로 리마운트시켜, 이전 선택의 값이 새 선택에 남아있지
// 않도록 한다(useEffect로 파생 state를 동기화하는 대신 React의 key 리셋 관용구 사용).
// -/+ 버튼이 1~maxPartySize 범위에서만 동작하도록 경계에서 비활성화해, 범위 밖 값 자체를
// 입력할 수 없게 막는다(사용자 요청 — 자유 입력 후 저장 시점 검증 방식에서 변경).
function PartySizeEditor(props: {
  maxPartySize: number
  initialValue: number
  onSave: (partySize: number) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(() => clamp(props.initialValue, 1, props.maxPartySize))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave(): Promise<void> {
    setIsSaving(true)
    try {
      await props.onSave(value)
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
        <p className="text-xs font-medium text-text-muted">파티원 수 (최대 {props.maxPartySize}인)</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setValue((prev) => clamp(prev - 1, 1, props.maxPartySize))}
            disabled={value <= 1}
            aria-label="파티원 수 감소"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text disabled:opacity-40"
          >
            <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <span className="w-8 text-center text-sm font-semibold text-text">{value}</span>
          <button
            type="button"
            onClick={() => setValue((prev) => clamp(prev + 1, 1, props.maxPartySize))}
            disabled={value >= props.maxPartySize}
            aria-label="파티원 수 증가"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
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
  // 보스가 캐릭터의 스케줄러에 등록돼있으면 그 난이도로 기본 선택하기 위한 조회(없으면 null) —
  // 보스 드롭다운 목록 자체는 이 정보와 무관하게 항상 전체 보스다.
  getRegisteredDifficulty: (bossName: string) => BossDifficulty | null
  getPartySize: (bossName: string, difficulty: BossDifficulty) => number // 미설정이면 1(솔로)
  onSetPartySize: (bossName: string, difficulty: BossDifficulty, partySize: number) => Promise<void>
  onClose: () => void
}

export function PartyManagementModal(props: PartyManagementModalProps): React.JSX.Element {
  function defaultDifficultyFor(bossName: string): BossDifficulty | null {
    return props.getRegisteredDifficulty(bossName) ?? getDifficultiesForBoss(bossName)[0] ?? null
  }

  // 스케줄러에 등록된 보스만 보기([[ADR-031]] 결정 4) — 기본 ON. 등록된 보스가 하나도 없으면
  // (신규 캐릭터 등) ON이어도 전체 목록으로 대체해, "아직 등록 안 한 보스도 미리 파티 인원
  // 설정 가능"이라는 이 모달의 원래 목적이 막히지 않게 한다.
  const registeredBossNames = ALL_BOSS_NAMES.filter((bossName) => props.getRegisteredDifficulty(bossName) !== null)
  const [onlyRegistered, setOnlyRegistered] = useState(true)
  const visibleBossNames = onlyRegistered && registeredBossNames.length > 0 ? registeredBossNames : ALL_BOSS_NAMES

  const [selectedBoss, setSelectedBoss] = useState(visibleBossNames[0] ?? '')
  const [selectedDifficulty, setSelectedDifficulty] = useState<BossDifficulty | null>(
    defaultDifficultyFor(visibleBossNames[0] ?? ''),
  )

  const difficulties = getDifficultiesForBoss(selectedBoss)
  const maxPartySize = selectedDifficulty !== null ? getMaxPartySize(selectedBoss, selectedDifficulty) : 1

  function handleSelectBoss(bossName: string): void {
    setSelectedBoss(bossName)
    setSelectedDifficulty(defaultDifficultyFor(bossName))
  }

  function handleToggleOnlyRegistered(next: boolean): void {
    setOnlyRegistered(next)
    const nextVisibleBossNames = next && registeredBossNames.length > 0 ? registeredBossNames : ALL_BOSS_NAMES
    if (!nextVisibleBossNames.includes(selectedBoss)) {
      handleSelectBoss(nextVisibleBossNames[0] ?? '')
    }
  }

  return (
    <Modal onClose={props.onClose} testId="party-management-modal-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">파티 관리</h2>
        <p className="text-sm text-text-muted">보스별 파티 인원을 미리 설정해두면 보스 카드에 배지로 표시됩니다.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-text-muted">스케줄러에 등록된 보스만 보기</span>
          <button
            type="button"
            role="switch"
            aria-checked={onlyRegistered}
            aria-label="스케줄러에 등록된 보스만 보기"
            onClick={() => handleToggleOnlyRegistered(!onlyRegistered)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              onlyRegistered ? 'bg-primary' : 'bg-surface-2'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface transition-transform ${
                onlyRegistered ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

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
            {visibleBossNames.map((bossName) => (
              <option key={bossName} value={bossName}>
                {bossName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-text-muted">난이도</p>
          {difficulties.length === 0 ? (
            <p className="text-sm text-text-muted">이 보스는 아직 파티 설정을 지원하지 않습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {difficulties.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => setSelectedDifficulty(difficulty)}
                  aria-pressed={selectedDifficulty === difficulty}
                  className={
                    selectedDifficulty === difficulty
                      ? 'inline-flex rounded-full border-0 p-0 leading-none'
                      : 'inline-flex rounded-full border-0 p-0 leading-none opacity-40 hover:opacity-70'
                  }
                >
                  <DifficultyBadge difficulty={difficulty} />
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedDifficulty !== null ? (
          <PartySizeEditor
            key={`${selectedBoss}:${selectedDifficulty}`}
            maxPartySize={maxPartySize}
            initialValue={props.getPartySize(selectedBoss, selectedDifficulty)}
            onSave={(partySize) => props.onSetPartySize(selectedBoss, selectedDifficulty, partySize)}
            onClose={props.onClose}
          />
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

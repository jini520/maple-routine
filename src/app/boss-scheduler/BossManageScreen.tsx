import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Users } from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import weeklyBossesData from '../../data/weekly-bosses.json'
import { getMaxPartySize } from '../../lib/boss-crystal-prices'
import { worldEmblemUrl } from '../../lib/world-emblem'
import { partySizeKey, useBossSchedulerStore } from '../../features/boss-scheduler/store'
import { useToastStore } from '../../features/toast/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import type { BossDifficulty } from '../../types'

type BossTab = 'weekly' | 'monthly'

interface BossReferenceEntry {
  boss: string
  difficulties: string[]
  portraitSlug?: string | null
}

// 관리 페이지의 보스 목록은 게임 레퍼런스 데이터(weekly-bosses.json) 그대로다 — 주간 탭은
// 주간+시즌 주간, 월간 탭은 월간(ADR-035 결정 18). 난이도 후보도 같은 파일의 difficulties를 쓴다
// (폐기된 ManualBossPickerModal과 동일 소스).
const BOSSES_BY_TAB: Record<
  BossTab,
  Array<{ boss: string; difficulties: BossDifficulty[]; portraitSlug: string | null }>
> = {
  weekly: [
    ...(weeklyBossesData.weekly as BossReferenceEntry[]),
    ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ].map((entry) => ({
    boss: entry.boss,
    difficulties: entry.difficulties as BossDifficulty[],
    portraitSlug: entry.portraitSlug ?? null,
  })),
  monthly: (weeklyBossesData.monthly as BossReferenceEntry[]).map((entry) => ({
    boss: entry.boss,
    difficulties: entry.difficulties as BossDifficulty[],
    portraitSlug: entry.portraitSlug ?? null,
  })),
}

// ADR-035 결정 18: 보스 관리 페이지 — 두 모드 공통 진입("보스 관리"), PartyManagementModal 대체.
// 수동 모드: 전체 보스 체크리스트(행 탭 = 추적 토글, 즉시 저장) + 체크된 행에만 난이도 뱃지와
// 파티 스테퍼가 펼쳐진다. 자동 모드: 체크 토글 없이 같은 행 구조로 파티 인원만 설정하고,
// "등록된 보스만 보기" 토글(기본 ON, ADR-031 결정 4 승계)로 미등록 보스 사전 설정도 가능하다.
// 리디자인(2026-07-24, 와이어프레임 리뷰): 행을 2줄로 — 1번째 줄은 원형 보스 초상화 + 보스명
// + 파티 스테퍼(우상단 고정), 2번째 줄은 난이도 세그먼트(선택=뱃지/미선택=고스트 칩). 선택 상태는
// 체크 없이 카드 테두리·색으로만 나타낸다. 수동 토글 버튼엔 aria-label로 이름을 고정한다.
export function BossManageScreen(): React.JSX.Element {
  const {
    characters,
    selectedOcid,
    partySizes,
    manualTrackedByOcid,
    loadTrackedOcids,
    setPartySize,
    addManualBoss,
    removeManualBoss,
  } = useBossSchedulerStore()
  const { mode } = useTrackingModeStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<BossTab>('weekly')
  const [onlyRegistered, setOnlyRegistered] = useState(true)
  // 자동 모드에서 행마다 "어느 난이도의 파티 인원을 편집 중인지"를 담는 화면 전용 상태 —
  // 멤버십이 아니므로 저장하지 않는다(수동 모드의 난이도 선택은 멤버십 그 자체라 이걸 안 쓴다).
  const [autoDifficultyByBoss, setAutoDifficultyByBoss] = useState<Record<string, BossDifficulty>>({})

  // 스케줄러를 거치지 않고 직접 진입(새로고침 등)해도 스토어가 채워지도록 동일하게 로드한다.
  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effectiveSelectedOcid =
    selectedOcid !== null && characters.some((character) => character.ocid === selectedOcid)
      ? selectedOcid
      : (characters[0]?.ocid ?? null)

  const selected = characters.find((character) => character.ocid === effectiveSelectedOcid) ?? null
  const worldEmblem = selected?.world != null ? worldEmblemUrl(selected.world) : null

  // 등록 난이도 조회 — 난이도 기본 선택(등록 난이도 우선)과 자동 모드의 "등록된 보스만 보기"에 쓴다.
  const registeredDifficultyByBoss = new Map<string, BossDifficulty>()
  if (selected !== null) {
    for (const boss of [...selected.weeklyBosses, ...selected.monthlyBosses]) {
      if (boss.isRegistered) {
        registeredDifficultyByBoss.set(boss.matchedBossName ?? boss.apiName, boss.difficulty)
      }
    }
  }

  const trackedBossItems =
    selected !== null
      ? (manualTrackedByOcid?.[selected.ocid] ?? []).filter((item) => item.kind === 'boss')
      : []

  function trackedDifficultyOf(bossName: string): BossDifficulty | null {
    const item = trackedBossItems.find((candidate) => candidate.contentName === bossName)
    return item !== undefined ? ((item.difficulty ?? null) as BossDifficulty | null) : null
  }

  function defaultDifficultyFor(bossName: string, difficulties: BossDifficulty[]): BossDifficulty | null {
    return registeredDifficultyByBoss.get(bossName) ?? difficulties[0] ?? null
  }

  const allEntries = BOSSES_BY_TAB[activeTab]
  // 자동 모드 기본은 등록된 보스만 — 단 등록 보스가 하나도 없으면(신규 캐릭터 등) 전체 목록으로
  // 대체해 "미등록 보스 파티 인원 미리 설정"이라는 원래 목적이 막히지 않게 한다(ADR-031 결정 4).
  const registeredEntries = allEntries.filter((entry) => registeredDifficultyByBoss.has(entry.boss))
  const visibleEntries =
    mode === 'auto' && onlyRegistered && registeredDifficultyByBoss.size > 0 ? registeredEntries : allEntries

  async function handleToggleTracked(bossName: string, difficulties: BossDifficulty[]): Promise<void> {
    if (selected === null) return
    const trackedDifficulty = trackedDifficultyOf(bossName)
    if (trackedDifficulty !== null) {
      await removeManualBoss(selected.ocid, bossName, trackedDifficulty)
      return
    }
    const difficulty = defaultDifficultyFor(bossName, difficulties)
    if (difficulty !== null) {
      await addManualBoss(selected.ocid, bossName, difficulty)
    }
  }

  // 수동 모드의 난이도 변경 = (보스, 난이도) 멤버십 교체 — 기존 쌍을 지우고 새 쌍을 추가한다.
  async function handleSwitchDifficulty(
    bossName: string,
    from: BossDifficulty,
    to: BossDifficulty,
  ): Promise<void> {
    if (selected === null || from === to) return
    await removeManualBoss(selected.ocid, bossName, from)
    await addManualBoss(selected.ocid, bossName, to)
  }

  async function handleSetPartySize(
    bossName: string,
    difficulty: BossDifficulty,
    partySize: number,
  ): Promise<void> {
    if (selected === null) return
    try {
      await setPartySize(selected.ocid, bossName, difficulty, partySize)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했어요')
    }
  }

  // 콤팩트 스테퍼: 보더 pill 안에 사람 아이콘(파티 표식, 스케줄러 카드와 동일) + −/값/+.
  // "파티" 텍스트 라벨은 아이콘으로 대체하되, −/+ 버튼의 aria-label은 유지해 접근성을 지킨다.
  function renderPartyStepper(bossName: string, difficulty: BossDifficulty): React.JSX.Element {
    const ocid = selected?.ocid ?? ''
    const value = partySizes[partySizeKey(ocid, bossName, difficulty)] ?? 1
    const maxPartySize = getMaxPartySize(bossName, difficulty)
    return (
      <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface py-0.5 pl-2 pr-1">
        <Users className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden="true" />
        <button
          type="button"
          onClick={() => void handleSetPartySize(bossName, difficulty, value - 1)}
          disabled={value <= 1}
          aria-label={`${bossName} 파티원 수 감소`}
          className="flex h-6 w-6 items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums text-text">{value}</span>
        <button
          type="button"
          onClick={() => void handleSetPartySize(bossName, difficulty, value + 1)}
          disabled={value >= maxPartySize}
          aria-label={`${bossName} 파티원 수 증가`}
          className="flex h-6 w-6 items-center justify-center rounded-full text-text hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </span>
    )
  }

  // 세그먼트 컨트롤: 선택된 난이도는 풀컬러 DifficultyBadge, 미선택은 고스트 칩(뱃지와 높이 정렬).
  // 흐린 뱃지(opacity-40) 나열을 대체한다 — 저채도 테마에서 흐린 뱃지끼리 구분이 약했다.
  function renderDifficultyPills(
    difficulties: BossDifficulty[],
    selectedDifficulty: BossDifficulty | null,
    onSelect: (difficulty: BossDifficulty) => void,
  ): React.JSX.Element {
    return (
      <span className="flex flex-wrap items-center gap-2">
        {difficulties.map((difficulty) => {
          const isSelected = selectedDifficulty === difficulty
          return (
            <button
              key={difficulty}
              type="button"
              onClick={() => onSelect(difficulty)}
              aria-pressed={isSelected}
              className="inline-flex rounded-full border-0 p-0 leading-none"
            >
              {isSelected ? (
                <DifficultyBadge difficulty={difficulty} />
              ) : (
                <span className="inline-flex h-5 items-center rounded-full border border-border px-2.5 text-[10px] font-bold tracking-[.03em] text-text-disabled">
                  {difficulty}
                </span>
              )}
            </button>
          )
        })}
      </span>
    )
  }

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~탭~(자동)토글까지 sticky로 상단에 고정하고 그 아래 보스 목록만 스크롤 — 스케줄러
          화면과 동일 패턴(UI_GUIDE "스크롤 영역"). AppShell의 pt-[--sa-top]을 -mt로 상쇄하고
          pt-calc로 노치까지 bg-bg가 덮게 한다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/boss')}
                aria-label="뒤로"
                className="p-1 -ml-1 text-text-muted hover:text-text"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </button>
              <h1 className="text-lg font-semibold text-text">보스 관리</h1>
            </div>
            {selected !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted">
                {worldEmblem !== null && (
                  <img
                    src={worldEmblem}
                    alt={selected.world ?? ''}
                    className="h-3.5 w-auto shrink-0 object-contain"
                  />
                )}
                {selected.characterName}
              </span>
            )}
          </div>

          {selected !== null && (
            <>
              {mode === 'auto' && (
                <p className="text-sm text-text-muted">
                  자동 모드에서는 목록이 게임 등록 기준이에요 — 파티 인원만 설정할 수 있어요.
                </p>
              )}

              <div className="flex items-center gap-4">
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
                <button
                  type="button"
                  onClick={() => setActiveTab('monthly')}
                  className={
                    activeTab === 'monthly'
                      ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
                      : 'px-3 text-sm font-medium text-text-muted'
                  }
                >
                  월간
                </button>
              </div>

              {mode === 'auto' && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-text-muted">등록된 보스만 보기</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onlyRegistered}
                    aria-label="등록된 보스만 보기"
                    onClick={() => setOnlyRegistered((prev) => !prev)}
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
              )}
            </>
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {selected === null ? (
        <div className="px-4 pb-4">
          <p className="text-sm text-text-muted">캐릭터를 먼저 선택해주세요 — 보스 스케줄러의 "캐릭터 관리"에서 추가할 수 있어요.</p>
        </div>
      ) : (
        <ul className="space-y-2 px-4 pb-4">
            {visibleEntries.map((entry) => {
              const trackedDifficulty = mode === 'manual' ? trackedDifficultyOf(entry.boss) : null
              const isTracked = trackedDifficulty !== null

              // 자동 모드의 행 난이도: 화면 전용 선택 → 등록 난이도 → 첫 난이도 순.
              const autoDifficulty =
                autoDifficultyByBoss[entry.boss] ?? defaultDifficultyFor(entry.boss, entry.difficulties)

              // 스테퍼·난이도가 펼쳐지는 활성 난이도: 수동은 추적 난이도, 자동은 행 난이도.
              const activeDifficulty = mode === 'manual' ? trackedDifficulty : autoDifficulty
              const isExpanded = mode === 'auto' || isTracked

              const rowClassName =
                mode === 'manual' && isTracked
                  ? 'rounded-[14px] border border-primary bg-primary/15'
                  : 'rounded-[14px] border border-border bg-surface'

              const nameContent = (
                <>
                  <span aria-hidden="true">
                    <BossPortrait portraitSlug={entry.portraitSlug} label={entry.boss} size={44} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                    {entry.boss}
                  </span>
                </>
              )

              return (
                <li key={entry.boss} className={rowClassName}>
                  {/* 1번째 줄: 초상화 + 보스명(수동은 추적 토글 버튼) + 파티 스테퍼(우상단) */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {mode === 'manual' ? (
                      <button
                        type="button"
                        aria-pressed={isTracked}
                        aria-label={entry.boss}
                        onClick={() => void handleToggleTracked(entry.boss, entry.difficulties)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {nameContent}
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3">{nameContent}</div>
                    )}
                    {activeDifficulty !== null && renderPartyStepper(entry.boss, activeDifficulty)}
                  </div>

                  {/* 2번째 줄: 난이도 세그먼트 */}
                  {isExpanded && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 pb-2.5 pt-2.5">
                      {mode === 'manual' && trackedDifficulty !== null
                        ? renderDifficultyPills(entry.difficulties, trackedDifficulty, (difficulty) =>
                            void handleSwitchDifficulty(entry.boss, trackedDifficulty, difficulty),
                          )
                        : renderDifficultyPills(entry.difficulties, autoDifficulty, (difficulty) =>
                            setAutoDifficultyByBoss((prev) => ({ ...prev, [entry.boss]: difficulty })),
                          )}
                    </div>
                  )}
                </li>
              )
            })}
        </ul>
      )}
    </div>
  )
}

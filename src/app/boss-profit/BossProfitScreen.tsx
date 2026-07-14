import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus, RefreshCw } from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import weeklyBossesData from '../../data/weekly-bosses.json'
import {
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitStore,
  type BossProfitWeeklySubtotal,
} from '../../features/boss-profit/store'
import { formatScheduleSyncError } from '../../features/schedule-sync/format'
import { formatBossProfitPeriodLabel, isEarliestNavigablePeriod, isLatestPeriod } from '../../lib/boss-profit-period'
import type { BossCycle } from '../../types'

// components/CharacterTrackingPicker와 동일한 얼굴 크롭 기법(ADR-015)을 이 화면의 32px
// 아바타 슬롯 크기에 맞춰 재사용한다 — 이 프로젝트는 화면마다 UI를 그대로 복제하는 관례를
// 따른다(탭 pill과 동일한 이유, ADR-018).
const AVATAR_SOURCE_IMAGE_SIZE = 300
// 원본 크롭 박스({ x: 115, y: 120, size: 64 })와 중심(147, 152)은 유지한 채 size만 64→48로
// 줄여 확대율을 높였다(사용자 요청, 2026-07-14 — 원 크기가 아니라 이미지 확대 배율 조정).
const AVATAR_FACE_CROP_BOX = { x: 123, y: 128, size: 48 }
const AVATAR_SIZE = 32

// BossPortrait의 size prop 기본값(40px, 기존 h-10 관례)과 동일하게 시작값을 맞춘다 —
// /debug/boss-portrait-size에서 이 값을 조정해보고 확정되면 여기 상수만 바꾸면 된다.
const BOSS_PORTRAIT_SIZE = 40

function avatarFaceCropStyle(): React.CSSProperties {
  const scale = AVATAR_SIZE / AVATAR_FACE_CROP_BOX.size
  return {
    width: AVATAR_SOURCE_IMAGE_SIZE * scale,
    height: AVATAR_SOURCE_IMAGE_SIZE * scale,
    left: -AVATAR_FACE_CROP_BOX.x * scale,
    top: -AVATAR_FACE_CROP_BOX.y * scale,
  }
}

function CharacterAvatar(props: { characterName: string; imageUrl: string | null }): React.JSX.Element {
  return (
    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-2">
      {props.imageUrl !== null ? (
        <img
          src={props.imageUrl}
          alt={props.characterName}
          className="absolute max-w-none"
          style={avatarFaceCropStyle()}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text">
          {props.characterName.charAt(0)}
        </span>
      )}
    </span>
  )
}

interface BossReferenceEntry {
  boss: string
  portraitSlug?: string
}

const REFERENCE_ENTRIES: BossReferenceEntry[] = [
  ...(weeklyBossesData.weekly as BossReferenceEntry[]),
  ...(weeklyBossesData.eventWeekly as BossReferenceEntry[]),
  ...(weeklyBossesData.monthly as BossReferenceEntry[]),
]

function findPortraitSlug(boss: string): string | null {
  return REFERENCE_ENTRIES.find((entry) => entry.boss === boss)?.portraitSlug ?? null
}

function rowKey(row: BossProfitRow): string {
  return `${row.ocid}-${row.boss}-${row.difficulty}-${row.cycle}-${row.periodKey}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sumPayout(rows: BossProfitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.payoutMeso ?? 0), 0)
}

function sumSubtotals(subtotals: BossProfitWeeklySubtotal[]): number {
  return subtotals.reduce((sum, subtotal) => sum + subtotal.totalMeso, 0)
}

interface BossProfitBossRowProps {
  row: BossProfitRow
  setPartySize: BossProfitStore['setPartySize']
}

function BossProfitBossRow(props: BossProfitBossRowProps): React.JSX.Element {
  const { row } = props
  const [error, setError] = useState<string | null>(null)
  const isPriceUnknown = row.priceMeso === null
  const partySize = row.partySize ?? 1

  async function handleChange(delta: number): Promise<void> {
    const next = clamp(partySize + delta, 1, row.maxPartySize)
    try {
      await props.setPartySize(row, next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파티원 수를 확인해주세요')
    }
  }

  return (
    <li className="flex items-start gap-3 p-4 border-b border-border last:border-b-0">
      <BossPortrait portraitSlug={findPortraitSlug(row.boss)} label={row.boss} size={BOSS_PORTRAIT_SIZE} />

      <div className="flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-text">{row.boss}</span>
          <span className="text-sm text-text-muted">· {row.difficulty}</span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-2">
          <div
            className={
              isPriceUnknown
                ? 'inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5 opacity-40'
                : 'inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5'
            }
          >
            <button
              type="button"
              onClick={() => handleChange(-1)}
              disabled={isPriceUnknown || partySize <= 1}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 감소`}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              <Minus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="text-xs tabular-nums text-text">{partySize}</span>
            <button
              type="button"
              onClick={() => handleChange(1)}
              disabled={isPriceUnknown || partySize >= row.maxPartySize}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 증가`}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {isPriceUnknown ? (
            <span className="inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              가격 미확정
            </span>
          ) : (
            <span className="text-sm font-semibold text-text tabular-nums">
              {(row.payoutMeso ?? 0).toLocaleString()} 메소
            </span>
          )}
        </div>

        {error !== null && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    </li>
  )
}

function AccordionFooter(props: { characterName: string; totalMeso: number }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface-2 text-sm">
      <span className="text-text-muted">{props.characterName} 합계</span>
      <span className="font-semibold tabular-nums text-text">{props.totalMeso.toLocaleString()} 메소</span>
    </div>
  )
}

function WeeklyAccordionBody(props: {
  characterName: string
  rows: BossProfitRow[]
  setPartySize: BossProfitStore['setPartySize']
}): React.JSX.Element {
  return (
    <div className="border-t border-border">
      <ul>
        {props.rows.map((row) => (
          <BossProfitBossRow key={rowKey(row)} row={row} setPartySize={props.setPartySize} />
        ))}
      </ul>
      <AccordionFooter characterName={props.characterName} totalMeso={sumPayout(props.rows)} />
    </div>
  )
}

function WeeklySubtotalRow(props: { subtotal: BossProfitWeeklySubtotal; now: Date }): React.JSX.Element {
  const { subtotal } = props
  const label = formatBossProfitPeriodLabel('weekly', subtotal.periodKey, props.now)

  return (
    <li
      className={
        subtotal.state === 'upcoming' || subtotal.state === 'unavailable'
          ? 'flex items-center gap-3 p-4 border-b border-border opacity-40'
          : 'flex items-center gap-3 p-4 border-b border-border'
      }
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-text">{label.primary}</p>
        <p className="text-xs text-text-muted tabular-nums">{label.secondary}</p>
      </div>

      {subtotal.state === 'inProgress' && (
        <span className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">
          진행 중
        </span>
      )}

      {subtotal.state === 'upcoming' && <span className="text-xs text-text-muted">예정</span>}
      {subtotal.state === 'unavailable' && <span className="text-xs text-text-muted">데이터 없음</span>}
      {(subtotal.state === 'confirmed' || subtotal.state === 'inProgress') && (
        <span className="text-sm font-semibold text-text tabular-nums">{subtotal.totalMeso.toLocaleString()} 메소</span>
      )}
    </li>
  )
}

function MonthlyAccordionBody(props: {
  characterName: string
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
  setPartySize: BossProfitStore['setPartySize']
  now: Date
}): React.JSX.Element {
  const totalMeso = sumPayout(props.bossRows) + sumSubtotals(props.weeklySubtotals)

  return (
    <div className="border-t border-border">
      {props.weeklySubtotals.length > 0 && (
        <>
          <p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2">
            주간 보스 수익 · 주차별 합계
          </p>
          <ul>
            {props.weeklySubtotals.map((subtotal) => (
              <WeeklySubtotalRow key={subtotal.periodKey} subtotal={subtotal} now={props.now} />
            ))}
          </ul>
        </>
      )}

      {props.bossRows.length > 0 && (
        <>
          <p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2">
            월간 보스 수익
          </p>
          <ul>
            {props.bossRows.map((row) => (
              <BossProfitBossRow key={rowKey(row)} row={row} setPartySize={props.setPartySize} />
            ))}
          </ul>
        </>
      )}

      <AccordionFooter characterName={props.characterName} totalMeso={totalMeso} />
    </div>
  )
}

interface CharacterGroup {
  ocid: string
  characterName: string
  imageUrl: string | null
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
}

function buildCharacterGroups(
  rows: BossProfitRow[],
  weeklySubtotals: BossProfitWeeklySubtotal[],
): CharacterGroup[] {
  const groups: CharacterGroup[] = []
  const indexByOcid = new Map<string, number>()

  function ensureGroup(ocid: string, characterName: string, imageUrl: string | null): CharacterGroup {
    const existingIndex = indexByOcid.get(ocid)
    if (existingIndex !== undefined) {
      return groups[existingIndex]
    }
    const group: CharacterGroup = { ocid, characterName, imageUrl, bossRows: [], weeklySubtotals: [] }
    indexByOcid.set(ocid, groups.length)
    groups.push(group)
    return group
  }

  for (const row of rows) {
    ensureGroup(row.ocid, row.characterName, row.imageUrl).bossRows.push(row)
  }
  for (const subtotal of weeklySubtotals) {
    ensureGroup(subtotal.ocid, subtotal.characterName, subtotal.imageUrl).weeklySubtotals.push(subtotal)
  }

  return groups
}

function groupTotalMeso(group: CharacterGroup): number {
  return sumPayout(group.bossRows) + sumSubtotals(group.weeklySubtotals)
}

function CharacterAccordion(props: {
  group: CharacterGroup
  tab: BossCycle
  setPartySize: BossProfitStore['setPartySize']
  now: Date
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const { group } = props
  const totalMeso = groupTotalMeso(group)

  // 펼침 상태에 따라 바깥 wrapper와 header의 className만 바꾼다 — 루트 엘리먼트 타입을
  // button↔div로 바꾸면 React가 트리를 통째로 언마운트/리마운트해 헤더 버튼의 포커스가
  // 날아간다(실사용 키보드 접근성 문제이자, 테스트에서 클릭 참조가 stale해지는 원인이었다).
  return (
    <div className={isExpanded ? 'rounded-[14px] bg-surface border border-border overflow-hidden' : ''}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={
          isExpanded
            ? 'flex w-full items-center gap-3 p-4'
            : 'flex w-full items-center gap-3 rounded-[14px] bg-surface border border-border p-4'
        }
      >
        <CharacterAvatar characterName={group.characterName} imageUrl={group.imageUrl} />
        <span className="flex-1 truncate text-left text-sm font-semibold text-text">{group.characterName}</span>
        <span className="text-sm font-bold text-text tabular-nums">{totalMeso.toLocaleString()} 메소</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      {isExpanded &&
        (props.tab === 'weekly' ? (
          <WeeklyAccordionBody
            characterName={group.characterName}
            rows={group.bossRows}
            setPartySize={props.setPartySize}
          />
        ) : (
          <MonthlyAccordionBody
            characterName={group.characterName}
            bossRows={group.bossRows}
            weeklySubtotals={group.weeklySubtotals}
            setPartySize={props.setPartySize}
            now={props.now}
          />
        ))}
    </div>
  )
}

export function BossProfitScreen(): React.JSX.Element {
  const {
    status,
    tab,
    periodKey,
    rows,
    weeklySubtotals,
    isPeriodLoading,
    periodUnavailable,
    error,
    staleCharacterNames,
    trackedOcids,
    loadTrackedOcids,
    refresh,
    setTab,
    goToPreviousPeriod,
    goToNextPeriod,
    setPartySize,
  } = useBossProfitStore()

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  if (isEmpty) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-semibold text-text">보스 수익</h1>

        <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
          추적 중인 캐릭터가 없습니다 — 보스 스케줄러에서 캐릭터를 선택해주세요
        </div>
      </div>
    )
  }

  const now = new Date()
  const periodLabel = formatBossProfitPeriodLabel(tab, periodKey, now)
  const isNextDisabled = isLatestPeriod(tab, periodKey, now)
  const isPrevDisabled = isEarliestNavigablePeriod(tab, periodKey)
  const characterGroups = buildCharacterGroups(rows, weeklySubtotals)
  const totalMeso = characterGroups.reduce((sum, group) => sum + groupTotalMeso(group), 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">보스 수익</h1>
        <button
          type="button"
          onClick={() => refresh(trackedOcids ?? [])}
          aria-label="새로고침"
          className="p-2 text-primary-text hover:text-primary-hover"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setTab('weekly')}
          className={
            tab === 'weekly'
              ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
              : 'px-3 text-sm font-medium text-text-muted'
          }
        >
          주간
        </button>
        <button
          type="button"
          onClick={() => setTab('monthly')}
          className={
            tab === 'monthly'
              ? 'rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary'
              : 'px-3 text-sm font-medium text-text-muted'
          }
        >
          월간
        </button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => goToPreviousPeriod()}
          disabled={isPrevDisabled}
          aria-label="이전 기간"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-text">{periodLabel.primary}</p>
          <p className="mt-0.5 text-xs text-text-muted tabular-nums">{periodLabel.secondary}</p>
        </div>

        <button
          type="button"
          onClick={() => goToNextPeriod()}
          disabled={isNextDisabled}
          aria-label="다음 기간"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {staleCharacterNames.length > 0 && (
        <p className="text-sm text-error">
          일부 캐릭터 동기화 실패: {staleCharacterNames.join(', ')} — 마지막 동기화 결과를 표시 중입니다
        </p>
      )}

      {!isPeriodLoading && (status === 'idle' || status === 'loading') && characterGroups.length === 0 && (
        <p className="text-sm text-text-muted">불러오는 중...</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-error">{error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}</p>
      )}

      {isPeriodLoading && (
        <div className="rounded-[14px] border border-dashed border-border p-6 flex flex-col items-center gap-3 text-center">
          <div className="h-6 w-6 rounded-full border-[3px] border-border border-t-primary animate-spin motion-reduce:animate-none" />
          <p className="text-xs text-text-muted">{periodLabel.primary} 기록을 불러오는 중...</p>
        </div>
      )}

      {!isPeriodLoading && periodUnavailable && (
        <p className="text-sm text-error">이 기간을 불러오지 못했습니다 — 다시 시도해주세요</p>
      )}

      {!isPeriodLoading && status === 'loaded' && characterGroups.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
          아직 처치한 보스가 없습니다
        </div>
      )}

      {!isPeriodLoading && characterGroups.length > 0 && (
        <div className="rounded-[14px] bg-surface border border-border shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(153,117,179,0.18)] p-6 text-center">
          <p className="text-sm text-text-muted">{periodLabel.primary} 총 수익</p>
          <p className="text-lg font-semibold text-text">{totalMeso.toLocaleString()} 메소</p>
        </div>
      )}

      {!isPeriodLoading &&
        characterGroups.map((group) => (
          <CharacterAccordion key={group.ocid} group={group} tab={tab} setPartySize={setPartySize} now={now} />
        ))}
    </div>
  )
}

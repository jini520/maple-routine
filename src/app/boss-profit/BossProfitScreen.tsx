import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus, RefreshCw } from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { MAPLE_LEAF_PATH } from '../../components/mapleLeafPath'
import weeklyBossesData from '../../data/weekly-bosses.json'
import {
  dropRowKey,
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitStore,
  type BossProfitWeeklySubtotal,
} from '../../features/boss-profit/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { formatBossProfitPeriodLabel, isLatestPeriod, isPeriodQueryable } from '../../lib/boss-profit-period'
import { getItemIconUrl } from '../../lib/item-icons'
import type { BossCycle } from '../../types'
import type { RecordedDrop } from '../../types/drops'
import { BossDropSheet } from './BossDropSheet'

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

// 접힌 보스 행의 이름 라인 오른쪽에 붙는 드롭 지시자(ADR-038). 있으면 아이콘 스택+개수, 없으면
// "＋ 드롭 추가" 칩. 상자 결과는 실제 나온 아이템(반지 등) 아이콘으로 뜬다.
function DropIndicator(props: { drops: RecordedDrop[] }): React.JSX.Element {
  if (props.drops.length === 0) {
    return (
      <span className="ml-auto flex-none rounded-full border border-dashed border-primary/45 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-text">
        ＋ 드롭 추가
      </span>
    )
  }

  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <span className="ml-auto flex flex-none items-center">
      {shown.map((drop, index) => {
        const url = getItemIconUrl(drop.itemName, drop.slot)
        return url !== null ? (
          <img
            key={`${drop.itemName}-${index}`}
            src={url}
            alt=""
            className="relative h-6 w-6 object-contain"
            style={{ marginLeft: index === 0 ? 0 : -2, zIndex: shown.length - index }}
          />
        ) : (
          <span
            key={`${drop.itemName}-${index}`}
            className="relative h-6 w-6 rounded-md border-[1.5px] border-surface bg-surface-2"
            style={{ marginLeft: index === 0 ? 0 : -2, zIndex: shown.length - index }}
          />
        )
      })}
      {extra > 0 && (
        <span
          className="relative grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-surface bg-surface-2 text-[10px] font-bold text-text-muted"
          style={{ marginLeft: -2, zIndex: 0 }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}

interface BossProfitBossRowProps {
  row: BossProfitRow
  drops: RecordedDrop[]
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
}

function BossProfitBossRow(props: BossProfitBossRowProps): React.JSX.Element {
  const { row } = props
  const [error, setError] = useState<string | null>(null)
  const [isDropSheetOpen, setIsDropSheetOpen] = useState(false)
  const isPriceUnknown = row.priceMeso === null
  // 미완료(보스 스케줄러에 등록만 되고 아직 처치 전) placeholder는 파티원 수를 조정해도 의미가
  // 없다 — 계산은 항상 0메소로 고정된다(ADR-032). "가격 미확정"과 동일한 비활성 처리를 재사용한다.
  const isEditable = row.isComplete && !isPriceUnknown
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

      <div className="flex-1 min-w-0">
        {/* 이름 라인 전체가 드롭 시트 열기 버튼(ADR-038). 파티 스테퍼는 아래 줄이라 탭 충돌 없음. */}
        <button
          type="button"
          onClick={() => setIsDropSheetOpen(true)}
          aria-label={`${row.boss} ${row.difficulty} 드롭 아이템 관리`}
          className="flex w-full items-center gap-1.5 text-left"
        >
          <DifficultyBadge difficulty={row.difficulty} />
          <span className="truncate text-sm font-semibold text-text">{row.boss}</span>
          <DropIndicator drops={props.drops} />
        </button>

        <div className="flex items-center justify-between gap-2 mt-2">
          <div
            className={
              isEditable
                ? 'inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5'
                : 'inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5 opacity-40'
            }
          >
            <button
              type="button"
              onClick={() => handleChange(-1)}
              disabled={!isEditable || partySize <= 1}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 감소`}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              <Minus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="text-xs tabular-nums text-text">{partySize}</span>
            <button
              type="button"
              onClick={() => handleChange(1)}
              disabled={!isEditable || partySize >= row.maxPartySize}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 증가`}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {!row.isComplete ? (
            <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
              미완료
            </span>
          ) : isPriceUnknown ? (
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

      {isDropSheetOpen && (
        <BossDropSheet
          boss={row.boss}
          difficulty={row.difficulty}
          isComplete={row.isComplete}
          initialDrops={props.drops}
          onSave={(drops) => props.setBossDrops(row, drops)}
          onClose={() => setIsDropSheetOpen(false)}
        />
      )}
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
  dropsByRowKey: Record<string, RecordedDrop[]>
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
}): React.JSX.Element {
  return (
    <div className="border-t border-border">
      <ul>
        {props.rows.map((row) => (
          <BossProfitBossRow
            key={rowKey(row)}
            row={row}
            drops={props.dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
            setPartySize={props.setPartySize}
            setBossDrops={props.setBossDrops}
          />
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
      {subtotal.state === 'unavailable' && <span className="text-xs text-text-muted">조회 불가</span>}
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
  dropsByRowKey: Record<string, RecordedDrop[]>
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
  now: Date
  isMonthlyBossQueryable: boolean
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

      {(props.bossRows.length > 0 || !props.isMonthlyBossQueryable) && (
        <>
          <p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2">
            월간 보스 수익
          </p>
          {props.bossRows.length > 0 ? (
            <ul>
              {props.bossRows.map((row) => (
                <BossProfitBossRow
                  key={rowKey(row)}
                  row={row}
                  drops={props.dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
                  setPartySize={props.setPartySize}
                  setBossDrops={props.setBossDrops}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-text-muted">조회 불가</p>
          )}
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
  dropsByRowKey: Record<string, RecordedDrop[]>
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
  now: Date
  isMonthlyBossQueryable: boolean
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
            dropsByRowKey={props.dropsByRowKey}
            setPartySize={props.setPartySize}
            setBossDrops={props.setBossDrops}
          />
        ) : (
          <MonthlyAccordionBody
            characterName={group.characterName}
            bossRows={group.bossRows}
            weeklySubtotals={group.weeklySubtotals}
            dropsByRowKey={props.dropsByRowKey}
            setPartySize={props.setPartySize}
            setBossDrops={props.setBossDrops}
            now={props.now}
            isMonthlyBossQueryable={props.isMonthlyBossQueryable}
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
    canGoPreviousPeriod,
    error,
    staleCharacterNames,
    trackedOcids,
    lastSyncedAt,
    loadTrackedOcids,
    refresh,
    setTab,
    goToPreviousPeriod,
    goToNextPeriod,
    setPartySize,
    setBossDrops,
    dropsByRowKey,
  } = useBossProfitStore()

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  if (isEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom)-4rem)] flex-col p-4">
        <h1 className="text-lg font-semibold text-text">보스 수익</h1>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary/15">
            <svg width="42" height="43" viewBox="0 0 127 130" className="fill-primary" aria-hidden="true">
              <path d={MAPLE_LEAF_PATH} />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-text">추적 중인 캐릭터가 없습니다</p>
            <p className="max-w-[220px] text-sm text-text-muted">
              보스 스케줄러에서 캐릭터를 선택하면 수익 현황을 확인할 수 있습니다
            </p>
          </div>
          <Link
            to="/boss?openPicker=1"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-bg hover:bg-primary-hover"
          >
            캐릭터 선택하러 가기
          </Link>
        </div>
      </div>
    )
  }

  const now = new Date()
  const periodLabel = formatBossProfitPeriodLabel(tab, periodKey, now)
  // 최신(=현재) 기간에서는 다음 이동을 막고, 새로고침 버튼도 이때만 노출한다(#30) — 과거 기간은
  // cache-first·checked-once 모델이라 수동 새로고침이 무의미하고 오히려 현재 기간으로 되돌린다.
  const isCurrentPeriod = isLatestPeriod(tab, periodKey, now)
  const isNextDisabled = isCurrentPeriod
  // 이전 이동 가능 여부는 store가 매 기간 로드 시 계산해둔 canGoPreviousPeriod로 판단한다(#29) —
  // 조회 불가능하고 캐시 기록도 없는 기간에 착지하지 않도록 막는다.
  const isPrevDisabled = !canGoPreviousPeriod
  // 캐시된 기록이 없는 상태에서 이 기간을 "지금" API로 조회할 수 있는지(ADR-032) — false면
  // "아직 처치한 보스가 없습니다"(확정된 빈 상태)가 아니라 "조회 불가"(확인 자체를 못 함)를 보여준다.
  const periodQueryable = isPeriodQueryable(tab, periodKey, now)
  const characterGroups = buildCharacterGroups(rows, weeklySubtotals)
  const totalMeso = characterGroups.reduce((sum, group) => sum + groupTotalMeso(group), 0)

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~총 수익 카드까지는 화면 상단에 고정하고 그 아래 캐릭터 아코디언 목록만
          스크롤되게 한다(사용자 요청, 2026-07-14) — content-scheduler/boss-scheduler와
          동일한 sticky 헤더 패턴(docs/UI_GUIDE.md "스크롤 영역" 참고)을 그대로 재사용한다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text">보스 수익</h1>
            {/* 동기화 상태 영역(마지막 동기화 시각 텍스트 + 새로고침 버튼)은 현재 기간에서만
                노출한다(#30) — 과거 기간은 cache-first·checked-once 모델이라 실시간 동기화 개념이
                없어 "조회 중..."/"방금 전"/"n분 전" 표시도, 재조회 버튼도 의미가 없다. */}
            {isCurrentPeriod && (
              <div className="flex shrink-0 items-center gap-2">
                <p className="text-sm text-text-muted whitespace-nowrap">
                  {status === 'loading' ? '조회 중...' : formatSyncedAt(lastSyncedAt)}
                </p>
                <button
                  type="button"
                  onClick={() => refresh(trackedOcids ?? [])}
                  aria-label="새로고침"
                  className="p-2 text-primary-text hover:text-primary-hover"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
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
            <p className="text-sm text-error">
              {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
            </p>
          )}

          {!isPeriodLoading && periodUnavailable && (
            <p className="text-sm text-error">이 기간을 불러오지 못했습니다 — 다시 시도해주세요</p>
          )}

          {!isPeriodLoading && characterGroups.length > 0 && (
            <div className="rounded-[14px] bg-surface border border-border shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(153,117,179,0.18)] p-6 text-center">
              <p className="text-sm text-text-muted">{periodLabel.primary} 총 수익</p>
              <p className="text-lg font-semibold text-text">{totalMeso.toLocaleString()} 메소</p>
            </div>
          )}
        </div>

        {/* 헤더 아래에 살짝 겹쳐 그라데이션+블러로 카드가 잘려 보이지 않고 자연스럽게
            사라지도록 한다(content-scheduler/boss-scheduler와 동일한 패턴). */}
        <div
          className="pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="space-y-2 px-4 pb-4">
        {isPeriodLoading && (
          <div className="rounded-[14px] border border-dashed border-border p-6 flex flex-col items-center gap-3 text-center">
            <div className="h-6 w-6 rounded-full border-[3px] border-border border-t-primary animate-spin motion-reduce:animate-none" />
            <p className="text-xs text-text-muted">{periodLabel.primary} 기록을 불러오는 중...</p>
          </div>
        )}

        {!isPeriodLoading && status === 'loaded' && characterGroups.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-border p-4 text-sm text-text-muted">
            {periodQueryable ? '아직 처치한 보스가 없습니다' : '조회 불가'}
          </div>
        )}

        {!isPeriodLoading &&
          characterGroups.map((group) => (
            // key에 tab·periodKey를 포함해 탭 전환/기간 이동 시 아코디언을 remount시킨다(#27) —
            // 펼침 상태(isExpanded)는 CharacterAccordion 로컬 state라, key가 그대로면 인스턴스가
            // 재사용돼 한 탭/기간에서 펼친 상태가 다른 탭/기간으로 그대로 이어졌다.
            <CharacterAccordion
              key={`${tab}-${periodKey}-${group.ocid}`}
              group={group}
              tab={tab}
              dropsByRowKey={dropsByRowKey}
              setPartySize={setPartySize}
              setBossDrops={setBossDrops}
              now={now}
              isMonthlyBossQueryable={periodQueryable}
            />
          ))}
      </div>
    </div>
  )
}

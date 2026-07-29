import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { UnavailableNotice } from '../../components/EmptyState/UnavailableNotice'
import weeklyBossesData from '../../data/weekly-bosses.json'
import {
  dropRowKey,
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitStore,
  type BossProfitWeeklySubtotal,
} from '../../features/boss-profit/store'
import { formatScheduleSyncError, formatSyncedAt } from '../../features/schedule-sync/format'
import { isSeasonBossName, WEEKLY_BOSS_CLEAR_LIMIT, WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss-matching'
import { formatBossProfitPeriodLabel, isLatestPeriod, isPeriodQueryable } from '../../lib/boss-profit-period'
import { getItemIconUrl, getItemIconUrlByFile } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import { worldEmblemUrl } from '../../lib/world-emblem'
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

// 아바타 테두리를 보스 처치 한도만큼 쪼갠 진행 링([[ADR-054]] 정정 1·3, 사용자 요청) — 처치할
// 때마다 한 칸씩 찬다. 헤더 가로폭을 전혀 쓰지 않아 캐릭터명을 가리지 않는 것이 이 표현을 고른 이유다.
// 링은 초상화 "바깥"에 여백을 두고 두른다(정정 3) — 그래서 아바타 슬롯이 초상화(32px)보다 큰 40px다.
// 슬롯은 칸 수(주간 12 · 월간 1)와 무관하게 항상 40px로 고정한다: 탭마다 크기가 달라지면 탭을 옮길
// 때마다 모든 카드가 튄다(높이는 ResizeObserver 실측이라 따라오지만, 그 튐 자체가 [[ADR-049]]가
// 없애려던 것이다). 초상화 이미지 크기는 32px 그대로라 얼굴 크롭은 영향받지 않는다.
const AVATAR_SLOT_SIZE = 40
const AVATAR_RING_STROKE = 2.5
// 칸 사이 간격(viewBox 단위 호 길이). 12칸이 하나의 원처럼 보이지 않도록 눈에 띄는 최소값.
const AVATAR_RING_GAP = 2.4

function AvatarClearRing(props: { cleared: number; total: number; cycle: BossCycle }): React.JSX.Element {
  // 링 중심 반지름 19 = 바깥 끝 20(슬롯 경계) · 안쪽 끝 18 → 초상화 반지름 16과 2px 여백(정정 3).
  const radius = (AVATAR_SLOT_SIZE - AVATAR_RING_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  const segment = circumference / props.total
  // strokeLinecap="round"는 칸 양끝을 stroke 두께의 절반(=1)씩 더 그린다(정정 5) — 그만큼 dash를
  // 미리 줄여야 눈에 보이는 칸 길이와 칸 사이 간격이 butt일 때와 같게 유지된다. 빼지 않으면 갭이
  // 2.4 → 0.4로 뭉개져 12칸이 하나의 원처럼 보인다.
  const dash = Math.max(segment - AVATAR_RING_GAP - AVATAR_RING_STROKE, 0.5)
  // 캡이 시작점 뒤로 0.5 stroke만큼 튀어나오므로 그만큼 밀어야 칸이 원래 자리에 그대로 앉는다.
  const capOffset = AVATAR_RING_STROKE / 2
  // 칸이 하나뿐이면(월간 탭 — 월간 보스가 검은마법사 1종) dash를 걸지 않고 온전한 원으로 그린다
  // ([[ADR-059]] 정정 1, 사용자 요청). 위 간격은 "칸과 칸을 나누기 위한" 장치라, 나눌 상대가 없는
  // 링에서는 나눔이 아니라 결손으로 읽힌다. 값을 0으로 만드는 대신 속성을 통째로 빼는 이유는 dash
  // 양끝의 둥근 캡이 정확히 겹쳐 이음매가 비치는 것을 피하기 위해서다.
  const isSingleSegment = props.total === 1

  return (
    // -rotate-90: SVG 각도 0은 3시 방향이라 12시부터 시계방향으로 차게 돌린다.
    // 링이 진행률의 유일한 표현이므로(정정 7 — n/12 텍스트 보류) 레이블은 링이 갖는다. 링까지
    // aria-hidden이면 스크린리더 사용자에게는 진행률이 아예 존재하지 않게 된다. 레이블의 주기는
    // 탭을 따라간다([[ADR-059]] 결정 7) — 두 탭이 같은 컴포넌트를 쓰므로 "주간"으로 고정하면
    // 월간 탭에서 거짓말이 된다.
    <svg
      viewBox={`0 0 ${AVATAR_SLOT_SIZE} ${AVATAR_SLOT_SIZE}`}
      className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
      role="img"
      aria-label={`${props.cycle === 'weekly' ? '주간' : '월간'} 보스 처치 ${props.cleared} / ${props.total}`}
    >
      {Array.from({ length: props.total }, (_, index) => (
        <circle
          key={index}
          cx={AVATAR_SLOT_SIZE / 2}
          cy={AVATAR_SLOT_SIZE / 2}
          r={radius}
          fill="none"
          strokeWidth={AVATAR_RING_STROKE}
          strokeLinecap="round"
          className={index < props.cleared ? 'stroke-primary' : 'stroke-border'}
          strokeDasharray={isSingleSegment ? undefined : `${dash} ${circumference - dash}`}
          strokeDashoffset={isSingleSegment ? undefined : -(index * segment + capOffset)}
        />
      ))}
    </svg>
  )
}

function CharacterAvatar(props: {
  characterName: string
  imageUrl: string | null
  // 탭이 정한 진행률(주간 = n/12, 월간 = n/월간 보스 종류 수). 두 탭·모든 기간에 항상 그린다([[ADR-059]]).
  clearProgress: { cleared: number; total: number; cycle: BossCycle }
}): React.JSX.Element {
  return (
    // 슬롯(40px) 안에 초상화(32px)를 중앙 배치하고 링은 그 바깥 테두리에 그린다. 링을 이미지 span
    // "안"에 넣으면 overflow-hidden에 stroke 바깥 절반이 잘리므로 형제로 두고 슬롯에 절대배치한다.
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      {/* relative를 이 span에 유지해야 얼굴 크롭(absolute + left/top)의 기준 박스가 32px 초상화로
          남는다 — 40px 슬롯이 기준이 되면 크롭이 4px씩 밀린다(ADR-015 크롭 기법 그대로). */}
      <span className="relative h-8 w-8 overflow-hidden rounded-full bg-surface-2">
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
      <AvatarClearRing
        cleared={props.clearProgress.cleared}
        total={props.clearProgress.total}
        cycle={props.clearProgress.cycle}
      />
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

// 월간 탭 진행 링의 분모([[ADR-059]] 결정 4) — 리터럴 1이 아니라 참조 데이터에서 파생한다. 월간
// 보스가 늘면 링 칸 수가 따라 늘어, "데이터는 2종인데 링은 1칸"이 될 수 없다. WEEKLY_BOSS_CLEAR_LIMIT
// 처럼 lib/boss-matching에 두지 않는 이유는 성격이 달라서다 — 그쪽 둘은 게임이 정한 한도이자 보스
// 스케줄러와 공유하는 값이고, 이건 "우리가 추적하는 월간 보스 종류 수"라 이 화면만 쓴다.
const MONTHLY_BOSS_COUNT = weeklyBossesData.monthly.length

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
    // 아이콘 스택(h-6)과 같은 슬롯이라 높이도 h-6으로 맞춘다(ADR-049) — py로 높이를 만들면
    // text-[11px]의 line-height(font 의존)가 그대로 행 높이에 실려 드롭 유무로 행이 튄다.
    return (
      <span className="ml-auto inline-flex h-6 flex-none items-center rounded-full border border-dashed border-primary/45 bg-primary/10 px-2.5 text-[11px] font-bold text-primary-text">
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
        return (
          <span
            key={`${drop.itemName}-${index}`}
            className="relative h-6 w-6 flex-none"
            style={{ marginLeft: index === 0 ? 0 : -2, zIndex: shown.length - index }}
          >
            {url !== null ? (
              <img src={url} alt="" className="h-6 w-6 object-contain" />
            ) : (
              <span className="block h-6 w-6 rounded-md border-[1.5px] border-surface bg-surface-2" />
            )}
            {/* 특수 스킬 반지(반지 상자 드릴다운 결과, ADR-041)만 등급이 기록된다 — 드롭 시트
                ItemThumb의 lv 뱃지와 같은 규칙. 아이콘이 24px(시트는 36px)이라 좌우 패딩만 줄였다.
                absolute라 이름 줄의 h-6 고정(ADR-049)에는 영향을 주지 않는다. */}
            {drop.ringLevel !== undefined && (
              <span className="absolute -bottom-1 -right-0.5 rounded-full bg-primary px-0.5 py-px text-[8px] font-bold leading-none text-white ring-1 ring-bg">
                lv{drop.ringLevel}
              </span>
            )}
          </span>
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
  // 이 보스에서 고가 아이템을 획득했으면 행 배경에 골드 셰인이 흐르는 강조 효과(valuable-drop-row)를 준다
  // — 캐릭터 카드를 펼쳤을 때 카드 테두리 효과 대신 실제 획득한 보스 행으로 강조가 이동하는 지점(사용자 요청).
  const hasValuableDrop = props.drops.some((drop) => isValuableDrop(drop.itemName))
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
    // 마지막 행도 테두리 "박스"는 남기고 색만 지운다(last:border-b-transparent, ADR-049) —
    // last:border-b-0이면 그 행만 1px 짧아진다. 배경은 border-box 기준이라 valuable-drop-row의
    // 골드 배경이 투명 테두리 자리도 그대로 채운다(시각 변화 없음).
    <li
      className={`flex items-start gap-3 p-4 border-b border-border last:border-b-transparent${
        hasValuableDrop ? ' valuable-drop-row' : ''
      }`}
    >
      <BossPortrait portraitSlug={findPortraitSlug(row.boss)} label={row.boss} size={BOSS_PORTRAIT_SIZE} />

      <div className="flex-1 min-w-0">
        {/* 이름 라인 전체가 드롭 시트 열기 버튼(ADR-038). 파티 스테퍼는 아래 줄이라 탭 충돌 없음. */}
        <button
          type="button"
          onClick={() => setIsDropSheetOpen(true)}
          aria-label={`${row.boss} ${row.difficulty} 드롭 아이템 관리`}
          // h-6 고정(ADR-049) — 자식(난이도 뱃지 20px · 보스명 20px · 드롭 지시자 24px) 중 최대값에
          // 높이를 맡기면 지시자 종류가 바뀔 때마다 행 높이가 흔들린다.
          className="flex h-6 w-full items-center gap-1.5 text-left"
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

// 소계 footer는 두지 않는다(ADR-047 후속 3) — 헤더가 sticky라 캐릭터 합계가 스크롤 내내 보여 중복이다.
// 그 결과 셸 하단에 닿는 배경 요소가 없어 하단 모서리 보정도 불필요하다. 새로 추가한다면 셸엔
// overflow-hidden을 걸 수 없으므로(ADR-047 결정 2) 그 요소가 직접 rounded-b-[14px]를 가져야 한다.

function WeeklyAccordionBody(props: {
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
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
  dropsByRowKey: Record<string, RecordedDrop[]>
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
  now: Date
  isMonthlyBossQueryable: boolean
}): React.JSX.Element {
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
            <UnavailableNotice compact />
          )}
        </>
      )}
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

// 이 캐릭터가 현재 기간에 기록한 고가 아이템 드롭 목록. 드롭은 dropRowKey(ocid,boss,difficulty,periodKey)로
// 저장되므로 그룹의 보스 행마다 조회해 isValuableDrop(ADR-038)로 거른다. weekly 탭 기준이며, monthly 탭에서는
// 월간 보스 행의 드롭만 집계된다(주차별 합계에는 보스 행이 없어 대상이 아님).
function collectGroupValuableDrops(
  group: CharacterGroup,
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  const valuable: RecordedDrop[] = []
  for (const row of group.bossRows) {
    const drops = dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []
    for (const drop of drops) {
      if (isValuableDrop(drop.itemName)) valuable.push(drop)
    }
  }
  return valuable
}

// 이 기간 전체(모든 추적 캐릭터)의 고가 드롭 — 총 수익 헤드라인 뱃지용(ADR-046). 캐릭터별 집계를
// 그대로 합치므로 월간 탭 한계(주차별 합계 행엔 보스 행이 없어 월간 보스 드롭만 잡힘)도 동일하게 승계한다.
function collectAllValuableDrops(
  groups: CharacterGroup[],
  dropsByRowKey: Record<string, RecordedDrop[]>,
): RecordedDrop[] {
  return groups.flatMap((group) => collectGroupValuableDrops(group, dropsByRowKey))
}

// 이 캐릭터가 이번 주에 처치한 주간 보스 수([[ADR-054]] 결정 3) — 처치 수는 store 필드가 아니라
// rows에서 파생한다. 보스명 기준 distinct라 같은 보스를 여러 난이도로 완료해도 1로 센다(게임 룰이
// 그렇고, 보스 스케줄러가 쓰는 countClearedWeeklyBosses도 content_name 그룹당 1이다 — 두 지표가
// 어긋나면 같은 숫자가 화면마다 다르게 보인다). 시즌 보스(메이린)는 12마리 제한 예외라 제외한다.
// cycle 필터는 호출부(주간 탭)에서 사실상 no-op이지만, 월드별 결정석 합계(#53)도 이 함수 하나를
// 공유하므로 함수 안에 둔다.
function countGroupClearedWeeklyBosses(group: CharacterGroup): number {
  const clearedBossNames = new Set<string>()
  for (const row of group.bossRows) {
    if (row.cycle !== 'weekly' || !row.isComplete || isSeasonBossName(row.boss)) continue
    clearedBossNames.add(row.boss)
  }
  return clearedBossNames.size
}

interface WorldCrystalSummary {
  world: string
  cleared: number
}

// 월드별 주간 결정석 소진량([[ADR-054]] 결정 1 — 90은 계정이 아니라 월드당 한도다). 캐릭터별
// 처치 수는 위 countGroupClearedWeeklyBosses를 그대로 재사용하고(계산 두 벌 금지, 결정 3) 여기서는
// 월드 묶음만 얹는다. 그룹의 행은 모두 같은 캐릭터에서 나오므로 월드도 첫 행에서 읽으면 된다.
// world가 null인 캐릭터(구버전 캐시)는 어느 월드 한도에도 귀속시킬 수 없어 조용히 제외한다
// (결정 6 — "미분류" 줄을 만들지 않는다). 결과 순서는 Map 삽입 순서 = 월드가 처음 등장한 캐릭터의
// 정렬 순서라 렌더마다 흔들리지 않는다(표시 순서 고정, [[ADR-036]]).
function summarizeWorldCrystals(groups: CharacterGroup[]): WorldCrystalSummary[] {
  const clearedByWorld = new Map<string, number>()
  for (const group of groups) {
    const world = group.bossRows[0]?.world ?? null
    if (world === null) continue
    clearedByWorld.set(world, (clearedByWorld.get(world) ?? 0) + countGroupClearedWeeklyBosses(group))
  }
  return [...clearedByWorld].map(([world, cleared]) => ({ world, cleared }))
}

// 이 캐릭터가 이 달에 처치한 월간 보스 수(보스명 distinct — 같은 보스를 여러 난이도로 잡아도 1).
// 주간 쪽 countGroupClearedWeeklyBosses와 대칭이며, **월간 탭 진행 링과 월간 결정석 칩이 이 함수
// 하나를 공유한다**([[ADR-059]] 결정 5 — [[ADR-054]] 결정 3의 "계산 두 벌 금지"를 월간에도 적용).
function countGroupClearedMonthlyBosses(group: CharacterGroup): number {
  const clearedBossNames = new Set<string>()
  for (const row of group.bossRows) {
    if (row.cycle !== 'monthly' || !row.isComplete) continue
    clearedBossNames.add(row.boss)
  }
  return clearedBossNames.size
}

// 이 기간 월간 보스(검은마법사) 결정석 개수. 주간 90 한도에 포함되지 않는 별개 수치라([[ADR-054]]
// 결정 1·8) 위 주간 집계와 섞지 않는다 — 시즌 보스는 weekly 소속이라 여기선 판정할 것이 없다.
// 결정석은 캐릭터마다 각자 나오므로 그룹별 처치 수를 더한다.
function countMonthlyCrystals(groups: CharacterGroup[]): number {
  return groups.reduce((total, group) => total + countGroupClearedMonthlyBosses(group), 0)
}

// 결정석 아이콘(주간/월간). 드랍 테이블 항목이 아니라 UI 표시 전용이라 item-icons.json에 등록하지 않고
// 파일명으로 직접 조회한다([[ADR-054]] 결정 10). 파일이 없으면 null — 아이콘만 생략하고 숫자는 그대로 둔다.
const WEEKLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_weekly.webp')
const MONTHLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_monthly.webp')

// 배지가 카드 상단 밖으로 올라간 양(-top-2 = 0.5rem). sticky 레일 오프셋에서 이만큼 상쇄해야
// stuck 시 배지가 헤더 상단선에 걸린다(ADR-047 후속).
const BADGE_TOP_OFFSET = 8

// 실제 획득한 고가 아이템 아이콘(최대 3개 + 나머지 개수)을 골드 반짝임 칩으로 보여준다.
// 배치·라벨은 호출부가 정한다(ADR-046) — 캐릭터 카드는 우상단 절대배치(overflow-hidden에 잘리지 않도록
// 카드 바깥 relative 래퍼에 붙인다), 총 수익 헤드라인은 라벨행 우측 인라인. 외형·아이콘 스택 규칙은 공통.
function ValuableDropBadge(props: {
  drops: RecordedDrop[]
  label: string
  className?: string
}): React.JSX.Element {
  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <span
      role="img"
      aria-label={props.label}
      title="고가 아이템 드롭"
      className={`valuable-drop-badge flex flex-none items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2${
        props.className !== undefined ? ` ${props.className}` : ''
      }`}
    >
      <Sparkles className="h-3 w-3 flex-none" strokeWidth={2.5} aria-hidden="true" />
      <span className="flex items-center">
        {shown.map((drop, index) => {
          const url = getItemIconUrl(drop.itemName, drop.slot)
          const stackStyle = { marginLeft: index === 0 ? 0 : -6, zIndex: shown.length - index }
          return url !== null ? (
            <img
              key={`${drop.itemName}-${index}`}
              src={url}
              alt=""
              className="relative h-5 w-5 flex-none rounded-full bg-surface object-contain ring-[1.5px] ring-white/80"
              style={stackStyle}
            />
          ) : (
            <span
              key={`${drop.itemName}-${index}`}
              className="relative h-5 w-5 flex-none rounded-full bg-surface-2 ring-[1.5px] ring-white/80"
              style={stackStyle}
            />
          )
        })}
      </span>
      {extra > 0 && <span className="text-[10px] font-bold leading-none tabular-nums">+{extra}</span>}
    </span>
  )
}

// 총 수익 헤드라인의 결정석 판매 현황([[ADR-054]] 결정 9, 정정 2·3으로 배치 변경) — **라벨행의
// "{기간} 총 수익" 텍스트 바로 옆** 칩이다(사용자 요청). 원래는 금액행 아래 새 줄이었는데 그 한 줄이
// sticky 헤더를 그대로 높여 목록을 잠식했다(헤더를 줄여둔 [[ADR-049]] 작업을 되돌리는 셈).
// **칩 높이는 라벨(text-xs = 16px)과 같은 h-4로 고정한다** — 이 줄에 흐름으로 들어가는 요소가
// 16px를 넘으면 라벨행이 튀고, 그것이 바로 고가 드롭 뱃지(24px)를 absolute로 빼낸 이유다
// ([[ADR-049]] 결정 2). 그 뱃지가 여전히 우측 끝을 absolute로 쓰므로 칩은 좌측(라벨 옆)에 붙는다.
// 월드별 분해는 흐름이 아니라 **absolute 팝오버**로 띄운다 — 펼쳐도 헤더 높이가 변하지 않는다.
function CrystalSummaryChip(props: { tab: BossCycle; groups: CharacterGroup[] }): React.JSX.Element | null {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)

  const isWeekly = props.tab === 'weekly'
  const worlds = isWeekly ? summarizeWorldCrystals(props.groups) : []
  // 주간 탭인데 월드를 아는 캐릭터가 하나도 없으면(구버전 캐시만 있는 경우) 대비할 한도가 없다.
  // 반대로 월드는 알지만 처치 수가 0이면 "0 / 90"을 그대로 보여준다(정보로서 유효하다).
  if (isWeekly && worlds.length === 0) return null

  const iconUrl = isWeekly ? WEEKLY_CRYSTAL_ICON_URL : MONTHLY_CRYSTAL_ICON_URL
  const cleared = isWeekly
    ? worlds.reduce((sum, summary) => sum + summary.cleared, 0)
    : countMonthlyCrystals(props.groups)
  // 각 월드가 각자 90을 가지므로 복수 월드의 분모는 90 × 월드 수다(결정 7).
  const limit = WEEKLY_CRYSTAL_SALE_LIMIT * worlds.length
  const isExpandable = worlds.length > 1
  const label = isWeekly ? `주간 결정석 판매 ${cleared} / ${limit}` : `월간 결정석 ${cleared}개`

  // 칩은 화면에 "간단히"만 — 월드 수·월드명 같은 부가 표기는 팝오버로 넘긴다(사용자 요청).
  const chipContent = (
    <>
      {iconUrl !== null && <img src={iconUrl} alt="" className="h-4 w-4 flex-none object-contain" />}
      {/* 숫자와 단위 사이는 마진이 아니라 실제 공백 문자로 띄운다 — 마진만으론 textContent가
          "34/90"으로 붙어 스크린리더가 이어 읽는다([[ADR-046]]에서 "메소" 단위로 정한 규약).
          "개"는 한국어 표기상 숫자에 붙으므로 공백을 넣지 않는다. */}
      {isWeekly ? (
        <span className="text-xs font-bold leading-none tabular-nums text-primary">
          {cleared} <span className="font-semibold opacity-70">/ {limit}</span>
        </span>
      ) : (
        <span className="text-xs font-bold leading-none tabular-nums text-primary">
          {cleared}
          <span className="font-semibold opacity-70">개</span>
        </span>
      )}
    </>
  )

  // h-5(20px) — 라벨행이 h-6(24px)으로 고정돼 있으므로 그 안에 들어가기만 하면 된다. leading-none과
  // 함께 두어야 글꼴 line-height가 칩 높이를 밀어 올리지 않는다.
  const chipClassName = 'ml-2 flex h-5 flex-none items-center gap-1 rounded-full bg-primary/12 px-1.5'

  // 단일 월드·월간 탭은 펼칠 것이 없어 버튼으로 두지 않는다. 수치만으로는 무엇의 비율인지 읽히지
  // 않으므로 칩 전체에 레이블을 주고 아이콘은 장식(alt="")으로 남긴다(아바타 링과 동일 규약).
  if (!isExpandable) {
    return (
      <span role="img" aria-label={label} className={chipClassName}>
        {chipContent}
      </span>
    )
  }

  return (
    <>
      {/* 팝오버가 열려 있는 동안 바깥 탭으로 닫는다. 칩(z-20)보다 아래, 나머지 헤더 내용 위. */}
      {isBreakdownOpen && (
        <button
          type="button"
          aria-label="월드별 결정석 판매 현황 닫기"
          onClick={() => setIsBreakdownOpen(false)}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}
      <button
        type="button"
        onClick={() => setIsBreakdownOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={isBreakdownOpen}
        className={`relative z-20 ${chipClassName}`}
      >
        {chipContent}
        {isBreakdownOpen ? (
          <ChevronUp className="h-3 w-3 flex-none text-primary" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3 flex-none text-primary" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>
      {isBreakdownOpen && (
        // 흐름 밖(absolute)이라 헤더 높이에 영향이 없다 — 월드가 늘어도 sticky 영역은 그대로다.
        // 기준 박스는 라벨행(relative)이고 칩이 좌측에 있으므로 left-0에 맞춘다(우측은 고가 드롭
        // 뱃지 자리). 페이지 sticky 헤더가 z-10으로 스택 컨텍스트를 만들므로 이 z-20은 그 안에서만
        // 겨루고, 헤더 자체가 목록 위에 있어 팝오버는 캐릭터 카드 위로 그려진다([[ADR-047]] 결정 6).
        <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[168px] rounded-[12px] border border-border bg-surface p-2 shadow-lg">
          <p className="px-1 pb-1.5 text-[11px] font-bold tracking-wide text-text-muted">월드별 판매 현황</p>
          <div className="space-y-1">
            {worlds.map((summary) => {
              const emblemUrl = worldEmblemUrl(summary.world)
              return (
                <div key={summary.world} className="flex items-center gap-1.5 px-1">
                  {emblemUrl !== null && <img src={emblemUrl} alt="" className="h-4 w-4 flex-none" />}
                  <span className="text-xs text-text-muted">{summary.world}</span>
                  <span className="ml-auto pl-3 text-xs font-semibold tabular-nums text-text">
                    {summary.cleared} / {WEEKLY_CRYSTAL_SALE_LIMIT}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

function CharacterAccordion(props: {
  group: CharacterGroup
  tab: BossCycle
  dropsByRowKey: Record<string, RecordedDrop[]>
  setPartySize: BossProfitStore['setPartySize']
  setBossDrops: BossProfitStore['setBossDrops']
  now: Date
  isMonthlyBossQueryable: boolean
  stickyTop: number
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  // 배지 sticky 레일의 고정 범위와 하단 페이드 위치를 헤더에 맞추기 위한 헤더 실측 높이(ADR-047 후속).
  // 글꼴 확대 시 높이가 달라질 수 있어 상수 대신 측정한다.
  // isExpanded를 의존성에 두고 다시 측정해야 한다 — 접힘 헤더는 `border border-border`가 있어 펼침보다
  // 2px 높은데, ResizeObserver는 기본이 content-box 관찰이라 테두리만 사라지는 변화로는 콜백이 발생하지
  // 않는다. 접힘 측정값(66px)이 남으면 펼침 헤더(64px)와 페이드 사이에 2px 틈이 생긴다.
  const headerRef = useRef<HTMLButtonElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useEffect(() => {
    const element = headerRef.current
    if (element === null) return

    const measure = (): void => {
      setHeaderHeight(element.getBoundingClientRect().height)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [isExpanded])

  const { group } = props
  const totalMeso = groupTotalMeso(group)
  // 이 주차에 고가 아이템 드롭이 기록됐을 때: 카드에 골드 회전샤인 테두리/글로우(valuable-drop-card) +
  // 우상단 획득 아이템 배지를 준다. 접힘/펼침 모두 회전 샤인 테두리·글로우·배지는 유지하되, 펼치면
  // 글로우 맥동만 멈춘다(valuable-drop-card--expanded → 회전 샤인은 계속 돌고 글로우 확산만 정적). 추가로
  // 펼쳤을 때는 고가 아이템을 획득한 보스 행(valuable-drop-row, 배경 효과)에도 강조가 들어간다.
  const valuableDrops = collectGroupValuableDrops(group, props.dropsByRowKey)
  const hasValuable = valuableDrops.length > 0
  // 처치 진행 링은 두 탭 · 모든 기간에 그리고, 무엇을 세는지는 탭이 정한다([[ADR-059]] — 기간
  // 한정을 폐기했다. 과거 rows도 DB 기록에서 오고 그 행은 전부 isComplete: true라 파생식이 그대로
  // 성립한다). 월간 탭은 주간 처치 수를 끌어오지 않는다 — 월간 rows에는 주간 행 자체가 없고(주간분은
  // 금액 합계 행으로만 존재), 12는 주 단위로 초기화되는 한도라 월 단위로 곱한 분모는 게임에 없다.
  const clearProgress =
    props.tab === 'weekly'
      ? { cleared: countGroupClearedWeeklyBosses(group), total: WEEKLY_BOSS_CLEAR_LIMIT, cycle: props.tab }
      : { cleared: countGroupClearedMonthlyBosses(group), total: MONTHLY_BOSS_COUNT, cycle: props.tab }
  const shellClass = [
    // overflow-hidden은 여전히 금지(ADR-047) — 스크롤포트를 만들어 헤더 sticky를 무력화한다. 대신
    // overflow-clip을 쓴다(ADR-049): 스크롤 컨테이너를 만들지 않아 sticky와 공존하면서 자식을 카드
    // 모양대로 잘라낸다. 이 클리핑 하나로 (a) stuck 헤더의 둥근 모서리로 보스 행이 비치는 문제와
    // (b) 헤더가 카드 끝에서 릴리스될 때 하단 모서리가 뾰족해지는 문제가 함께 사라진다 — 헤더에
    // 상태별 라운딩을 분기할 필요가 없다. 클리핑은 패딩 박스(반경 13px = 14 - 테두리 1px) 기준.
    isExpanded ? 'overflow-clip rounded-[14px] bg-surface border border-border' : '',
    hasValuable
      ? isExpanded
        ? 'valuable-drop-card valuable-drop-card--expanded'
        : 'valuable-drop-card rounded-[14px]'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  // 펼침 상태에 따라 shell과 header의 className만 바꾼다 — 루트 엘리먼트 타입을 button↔div로 바꾸면
  // React가 트리를 통째로 언마운트/리마운트해 헤더 버튼의 포커스가 날아간다(실사용 키보드 접근성 문제이자,
  // 테스트에서 클릭 참조가 stale해지는 원인이었다). 배지는 shell(펼침 시 overflow-hidden) 바깥의 relative
  // 래퍼에 절대배치해, 카드 모서리 밖으로 살짝 튀어나와도 잘리지 않게 한다.
  return (
    // isolate(isolation:isolate): 우상단 배지의 z-index를 이 카드 안에 가둔다. 없으면 배지의 z-10이
    // 페이지 루트 stacking으로 새어나가 sticky 헤더(z-10)·하단 fixed nav·safe-area 위로 그려진다.
    <div className="relative isolate">
      {hasValuable &&
        (isExpanded ? (
          // 펼침: 배지도 헤더와 함께 고정한다(ADR-047 후속). 헤더 "안"에 넣으면 헤더의 z-[5] 스택
          // 컨텍스트에 갇혀 골드 링(z-6)이 배지 위를 지나가므로, 셸 바깥에 남기고 높이 0 sticky 레일에
          // 얹는다(h-0 + 자식 absolute라 레이아웃 영향 없음). sticky는 z-index 없이도 스택 컨텍스트를
          // 만들어 레일이 z-10을 가져야 링 위로 간다. top에 BADGE_TOP_OFFSET을 더하는 이유는 배지가
          // -top-2로 올라가 있어서 — 그래야 stuck 시 헤더 상단선에 걸치고 페이지 헤더 뒤로 숨지 않는다.
          // 바깥 absolute 박스는 레일의 고정 범위를 "카드 높이 - 헤더 높이"로 잘라 헤더와 같은 시점에
          // 떨어지게 한다(없으면 카드 끝에서 배지만 남아 어긋난다). absolute라 레이아웃엔 영향 없다.
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ bottom: headerHeight }}>
            <div className="sticky z-10 h-0" style={{ top: props.stickyTop + BADGE_TOP_OFFSET }}>
              <ValuableDropBadge
                drops={valuableDrops}
                label="고가 드롭"
                className="pointer-events-auto absolute -right-1.5 -top-2"
              />
            </div>
          </div>
        ) : (
          // 접힘: 고정할 헤더가 없고 containing block이 헤더 높이(~56px)뿐이라 레일을 쓰면 배지만 떠서
          // 카드와 어긋난다(사용자 요청) — ADR-045의 원래 구조 그대로, z-10도 배지 자신이 갖는다.
          <ValuableDropBadge drops={valuableDrops} label="고가 드롭" className="absolute -right-1.5 -top-2 z-10" />
        ))}

      {/* stuck 헤더 아래 경계 페이드(ADR-047 후속) — 중첩 sticky에서는 콘텐츠가 지나가는 경계가 여기라,
          페이지 헤더에서 뺀 공용 레시피를 카드 표면색(from-surface)으로 여기에 붙인다. 헤더의 자식
          (top-full)으로 두면 헤더가 카드 끝에서 릴리스될 때 페이드가 카드 밖으로 새어나오고, 셸엔
          overflow-hidden을 걸 수 없어(sticky 무력화) 클리핑도 못 한다. 그래서 본문 범위(top=헤더 높이 ~
          카드 바닥)로 제한한 박스 안의 sticky 요소로 둔다 — sticky가 자기 박스를 카드 안에 붙잡아준다. */}
      {/* headerHeight가 0이면(측정 전 첫 프레임·HMR로 effect가 재실행되지 않은 상태) 제약 박스 top이 0이 돼
          페이드가 카드 최상단(헤더 위)에 깔린다 — 잘못된 위치로 그리는 대신 측정될 때까지 렌더하지 않는다. */}
      {isExpanded && headerHeight > 0 && (
        // inset-x-px·bottom-px: 셸 테두리(border 1px) 두께만큼 들여 페이드가 테두리를 덮지 않게 한다
        // — 이 박스는 wrapper(= 셸 border-box) 기준이라 inset-x-0이면 테두리까지 덮는다. 테두리 두께를
        // 바꾸면 이 값도 함께 바꿀 것.
        <div
          className="pointer-events-none absolute inset-x-px bottom-px z-[5]"
          style={{ top: headerHeight }}
          aria-hidden="true"
        >
          <div
            className="sticky h-8 bg-gradient-to-b from-surface to-transparent backdrop-blur-sm"
            style={{
              top: props.stickyTop + headerHeight,
              maskImage: 'linear-gradient(to bottom, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
            }}
          />
        </div>
      )}

      <div className={shellClass}>
        <button
          ref={headerRef}
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          // 펼침 헤더는 카드 안에서 sticky로 고정한다(ADR-047) — top은 페이지 sticky 헤더 실측 높이라
          // 그 바로 아래에 붙고, bg-surface가 밑으로 지나가는 보스 행을 가린다. z-[5]는 드롭 아이콘
          // (relative + inline zIndex 1~3) 위 · 고가 드롭 배지(z-10, ADR-045) 아래 층.
          // 헤더는 라운딩 없이 "사각"이다(ADR-049) — 셸의 overflow-clip이 대신 깎는다. rounded-t-[14px]를
          // 주면 stuck 상태에서 모서리 안쪽이 투명이라 그 아래를 지나가는 보스 행이 비친다(사용자 보고).
          // 셸 클리핑은 카드 자신의 모서리에서만 일어나므로 stuck 헤더의 라운딩을 덮어주지 못한다 —
          // 반대로 헤더가 사각이면 카드 최상단(= 클리핑 곡선과 일치)에서 클리핑이 라운딩을 만들어준다.
          style={isExpanded ? { top: props.stickyTop } : undefined}
          // 상하 패딩은 p-4(16px)가 아니라 py-3(12px)이다([[ADR-054]] 정정 6) — 아바타 슬롯이 진행
          // 링 때문에 32 → 40px로 커진 만큼(정정 3) 패딩에서 8px을 돌려받아 헤더 높이를 링 도입
          // 전과 같은 64px로 되돌린다(12 + 40 + 12). 좌우는 보스 행(p-4)과 맞춰 16px 유지.
          className={
            isExpanded
              ? 'sticky z-[5] flex w-full items-center gap-3 bg-surface px-4 py-3'
              : 'flex w-full items-center gap-3 rounded-[14px] bg-surface border border-border px-4 py-3'
          }
        >
          <CharacterAvatar
            characterName={group.characterName}
            imageUrl={group.imageUrl}
            clearProgress={clearProgress}
          />
          <span className="flex-1 truncate text-left text-sm font-semibold text-text">{group.characterName}</span>
          {/* 숫자 표기(n/12)는 보류 상태다([[ADR-054]] 정정 7) — 헤더 가로폭을 두고 캐릭터명과 경합하는데
              둘 다 만족하는 배치를 아직 찾지 못했다. 진행률은 아바타 링이 표현하고, 정확한 수치가 필요해지면
              그때 다시 설계한다. 링 자체는 그대로 두므로 되살릴 때 파생 함수는 그대로 쓸 수 있다. */}
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
              rows={group.bossRows}
              dropsByRowKey={props.dropsByRowKey}
              setPartySize={props.setPartySize}
              setBossDrops={props.setBossDrops}
            />
          ) : (
            <MonthlyAccordionBody
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

  const navigate = useNavigate()

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  // 펼친 캐릭터 카드 헤더를 이 페이지 sticky 헤더 "아래"에 붙이기 위한 실측 높이(ADR-047).
  // 페이지 헤더는 불투명(bg-bg)하고 높이가 상태에 따라 가변이라(탭·기간 라벨·동기화 실패 경고·에러 문구·
  // 총 수익 헤드라인 유무) 상수로 둘 수 없다. 미지원 환경은 0으로 남아 top-0으로 자연 degrade한다.
  // 빈 상태에서는 헤더 자체가 렌더되지 않으므로 isEmpty가 풀릴 때 다시 붙인다.
  const stickyHeaderRef = useRef<HTMLDivElement>(null)
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0)

  useEffect(() => {
    const element = stickyHeaderRef.current
    if (element === null) return

    const measure = (): void => {
      setStickyHeaderHeight(element.getBoundingClientRect().height)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [isEmpty])

  if (isEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom)-4rem)] flex-col p-4">
        <h1 className="text-lg font-semibold text-text">보스 수익</h1>

        <div className="flex flex-1 flex-col items-center justify-center">
          <EmptyState
            size="page"
            icon="leaf"
            title="추적 중인 캐릭터가 없습니다"
            description="보스 스케줄러에서 캐릭터를 선택하면 수익 현황을 확인할 수 있습니다"
            action={{
              label: '캐릭터 선택하러 가기',
              onClick: () => navigate('/boss?openPicker=1'),
            }}
          />
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
  // 총 수익 헤드라인 우측 뱃지용 — 이 기간 전체 고가 드롭(ADR-046)
  const periodValuableDrops = collectAllValuableDrops(characterGroups, dropsByRowKey)

  return (
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~총 수익 카드까지는 화면 상단에 고정하고 그 아래 캐릭터 아코디언 목록만
          스크롤되게 한다(사용자 요청, 2026-07-14) — content-scheduler/boss-scheduler와
          동일한 sticky 헤더 패턴(docs/UI_GUIDE.md "스크롤 영역" 참고)을 그대로 재사용한다. */}
      <div ref={stickyHeaderRef} className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          <h1 className="text-lg font-semibold text-text">보스 수익</h1>

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

            {/* 동기화 상태 영역(마지막 동기화 시각 텍스트 + 새로고침 버튼)은 현재 기간에서만
                노출한다(#30) — 과거 기간은 cache-first·checked-once 모델이라 실시간 동기화 개념이
                없어 "조회 중..."/"방금 전"/"n분 전" 표시도, 재조회 버튼도 의미가 없다.
                제목 줄이 아니라 탭과 같은 줄에 둔다(ADR-049). */}
            {isCurrentPeriod && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <p className="text-sm text-text-muted whitespace-nowrap">
                  {status === 'loading' ? '조회 중...' : formatSyncedAt(lastSyncedAt)}
                </p>
                {/* 이 줄의 높이는 활성 탭 pill(py-[5px] + text-sm 20px = 30px)이 정한다. 기본 p-2면
                    아이콘 16 + 패딩 16 = 32px라 새로고침이 없는 과거 기간과 2px 어긋난다(ADR-049). */}
                <button
                  type="button"
                  onClick={() => refresh(trackedOcids ?? [])}
                  aria-label="새로고침"
                  className="flex h-[30px] w-[30px] items-center justify-center text-primary-text hover:text-primary-hover"
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

          {/* ADR-061 결정 2: 보여줄 데이터가 아예 없을 때만 셸 승계 카드를 그린다. */}
          {!isPeriodLoading && (status === 'idle' || status === 'loading') && characterGroups.length === 0 && (
            <LoadingState size="page" message="불러오고 있어요" />
          )}

          {status === 'error' && (
            <p className="text-sm text-error">
              {error !== null ? formatScheduleSyncError(error) : '오류가 발생했습니다'}
            </p>
          )}

          {!isPeriodLoading && periodUnavailable && (
            <p className="text-sm text-error">이 기간을 불러오지 못했습니다 — 다시 시도해주세요</p>
          )}

          {/* 총 수익 요약은 카드가 아니라 헤드라인이다(ADR-046) — 아래 캐릭터 카드가 전부 같은 카드 셸이라
              요약도 카드면 "동일한 흰 카드의 반복"으로 묻힌다. 카드 셸을 걷어내고 색·크기로만 위계를 주고,
              라벨행 우측에는 이 기간 전체 고가 드롭 뱃지(ADR-045 배지 재사용)를 장식 겸 정보로 얹는다. */}
          {!isPeriodLoading && characterGroups.length > 0 && (
            <div>
              {/* 뱃지는 흐름 밖(absolute)에 둔다(ADR-049) — 흐름에 있으면 라벨(16px)보다 큰
                  뱃지(24px)가 줄 높이를 정해 뱃지 유무로 헤드라인이 8px 튄다. 뱃지에 붙일 탭 확대
                  애니메이션도 주변 레이아웃을 밀지 않아야 한다. */}
              {/* 라벨행 높이를 h-6(24px)으로 "명시" 고정한다([[ADR-054]] 정정 4, 사용자 요청) —
                  전에는 라벨(text-xs = 16px)이 우연히 정하는 값이라, 그보다 큰 요소를 흐름에 넣는
                  순간 줄이 커졌다(그래서 24px 고가 드롭 뱃지를 absolute로 빼냈다, [[ADR-049]] 결정 2).
                  높이를 못 박아두면 그 의존이 끊긴다 — 뱃지·결정석 칩이 있든 없든 줄은 항상 24px다. */}
              <div className="relative flex h-6 items-center">
                <p className="text-xs font-semibold tracking-wide text-text-muted">
                  {periodLabel.primary} 총 수익
                </p>
                {/* 결정석 판매 현황은 라벨 텍스트 바로 옆에 둔다([[ADR-054]] 정정 3, 사용자 요청).
                    칩은 줄 높이(24px) 안에서 h-5까지 키울 수 있다 — 24px를 넘기지만 않으면 된다.
                    우측 끝은 여전히 고가 드롭 뱃지(absolute)의 자리이므로 침범하지 않는다. */}
                <CrystalSummaryChip tab={tab} groups={characterGroups} />
                {periodValuableDrops.length > 0 && (
                  <ValuableDropBadge
                    drops={periodValuableDrops}
                    label="이 기간 고가 드롭"
                    className="absolute right-0 top-1/2 -translate-y-1/2"
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Coins className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                </span>
                {/* 단위는 별도 span으로 격하하되 숫자와 사이에 실제 공백 문자를 남긴다 — 마진만으로 띄우면
                    textContent가 "N메소"로 붙어 스크린리더가 붙여 읽는다(ADR-046 트레이드오프). */}
                <p className="text-xl font-extrabold leading-none tabular-nums text-primary">
                  {totalMeso.toLocaleString()}{' '}
                  <span className="text-xs font-bold text-text-muted">메소</span>
                </p>
              </div>
              <div className="mt-3 h-px bg-border" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* 공용 레시피의 헤더-목록 경계 페이드 오버레이(absolute top-full h-8)는 이 화면에 두지 않는다
            (ADR-047 결정 6) — 펼친 카드의 sticky 헤더가 멈추는 자리가 바로 그 밴드라, z-10 페이지 헤더
            안의 오버레이가 stuck 헤더 상단을 덮어 가린다. 경계는 총 수익 헤드라인 하단 헤어라인이 담당. */}
      </div>

      <div className="space-y-2 px-4 pb-4">
        {/* ADR-061 결정 2·3·4: 점선 박스(빈 상태의 어법)와 비-브랜드 CSS 링을 버리고 셸 승계
            카드를 쓴다 — 백필이 끝나면 같은 자리·같은 껍데기에 캐릭터 카드가 들어온다. */}
        {isPeriodLoading && (
          <LoadingState message={`${periodLabel.primary} 기록을 불러오고 있어요`} />
        )}

        {/* ADR-060: "확정된 빈 상태"와 "조회 자체를 못 함"은 디자인을 공유하지 않는다 — 같은 모양이면
            조회 불가가 "데이터가 없다"로 오해된다. 처치 0건은 CTA를 달지 않는다(앱 안에 할 일이 없다). */}
        {!isPeriodLoading &&
          status === 'loaded' &&
          characterGroups.length === 0 &&
          (periodQueryable ? (
            <EmptyState
              icon={Coins}
              title="아직 처치한 보스가 없습니다"
              description="보스를 처치하면 수익이 자동으로 집계됩니다"
            />
          ) : (
            <UnavailableNotice />
          ))}

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
              stickyTop={stickyHeaderHeight}
            />
          ))}
      </div>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { BossPortrait } from '../../components/BossPortrait/BossPortrait'
import { DifficultyBadge } from '../../components/DifficultyBadge/DifficultyBadge'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { ProfitIcon } from '../../components/ProfitIcon/ProfitIcon'
import { PullToRefreshIndicator } from '../../components/PullToRefreshIndicator/PullToRefreshIndicator'
import { PULL_SETTLE_TRANSITION, resolveContentOffsetPx } from '../../lib/pull-to-refresh'
import { usePullToRefresh } from '../../lib/use-pull-to-refresh'
import { UnavailableNotice } from '../../components/EmptyState/UnavailableNotice'
import { usePeriodLoadErrorToast } from '../../features/boss-profit/use-period-error-toast'
import { ValuableDropBadge } from '../../components/ValuableDropBadge/ValuableDropBadge'
import weeklyBossesData from '../../data/weekly-bosses.json'
import {
  dropRowKey,
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitStore,
  type BossProfitWeeklySubtotal,
  type WeeklySubtotalState,
} from '../../features/boss-profit/store'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import { useToastStore } from '../../features/toast/store'
import {
  useScheduleSyncErrorToast,
  useStaleCharactersToast,
} from '../../features/schedule-sync/use-sync-error-toast'
import { anchorPopover, type PopoverAnchorGeometry } from '../../lib/popover-anchor'
import { isSeasonBossName, WEEKLY_BOSS_CLEAR_LIMIT, WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss-matching'
import {
  formatBossProfitPeriodLabel,
  isLatestPeriod,
  isPeriodQueryable,
  isPeriodRefreshable,
} from '../../lib/boss-profit-period'
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
    // rotate-90 + -scale-x-100: 12시부터 반시계방향으로 차게 만드는 조합이다([[ADR-059]] 정정 2,
    // 사용자 요청). SVG circle의 경로는 3시에서 시작해 시계방향으로 도는데, 좌우로 뒤집으면 진행
    // 방향이 반시계로 바뀌면서 시작점이 9시로 간다 — 거기서 시계방향 90도를 더해 시작점만 12시로
    // 되돌린다. 칸 배치식(dash·dashoffset)은 그대로 둔다: 부호를 뒤집으면 round 캡 보정(ADR-054
    // 정정 5)까지 함께 다시 유도해야 한다.
    // 링이 진행률의 유일한 표현이므로(정정 7 — n/12 텍스트 보류) 레이블은 링이 갖는다. 링까지
    // aria-hidden이면 스크린리더 사용자에게는 진행률이 아예 존재하지 않게 된다. 레이블의 주기는
    // 탭을 따라간다([[ADR-059]] 결정 7) — 두 탭이 같은 컴포넌트를 쓰므로 "주간"으로 고정하면
    // 월간 탭에서 거짓말이 된다.
    <svg
      viewBox={`0 0 ${AVATAR_SLOT_SIZE} ${AVATAR_SLOT_SIZE}`}
      className="pointer-events-none absolute inset-0 h-full w-full rotate-90 -scale-x-100"
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
      <span className="ml-auto inline-flex h-6 flex-none items-center rounded-full border border-dashed border-primary bg-primary-tint px-2.5 text-[11px] font-bold text-primary-ink">
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
              <span className="absolute -bottom-1 -right-0.5 rounded-full bg-primary px-0.5 py-px text-[8px] font-bold leading-none text-on-primary ring-1 ring-bg">
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
  const [isDropSheetOpen, setIsDropSheetOpen] = useState(false)
  // 이 보스에서 고가 아이템을 획득했으면 행 배경에 골드 셰인이 흐르는 강조 효과(valuable-drop-row)를 준다
  // — 캐릭터 카드를 펼쳤을 때 카드 테두리 효과 대신 실제 획득한 보스 행으로 강조가 이동하는 지점(사용자 요청).
  const hasValuableDrop = props.drops.some((drop) => isValuableDrop(drop.itemName))
  const isPriceUnknown = row.priceMeso === null
  // 미완료(보스 스케줄러에 등록만 되고 아직 처치 전) placeholder는 파티원 수를 조정해도 의미가
  // 없다 — 계산은 항상 0메소로 고정된다(ADR-032). "가격 미확정"과 동일한 비활성 처리를 재사용한다.
  const isEditable = row.isComplete && !isPriceUnknown
  const partySize = row.partySize ?? 1

  // ADR-063: 예외 메시지를 그대로 렌더하던 인라인 문단을 걷어내고 토스트로 알린다 — 개발자용
  // 문구('setPartySize: …')와 SQLite 네이티브 원문이 사용자에게 새던 유일한 자리였다. 문구는
  // 보스 관리 화면(BossManageScreen)과 같아 두 경로가 통일된다.
  async function handleChange(delta: number): Promise<void> {
    const next = clamp(partySize + delta, 1, row.maxPartySize)
    try {
      await props.setPartySize(row, next)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
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
            <span className="inline-block rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-ink">
              가격 미확정
            </span>
          ) : (
            <span className="text-sm font-semibold text-text tabular-nums">
              {(row.payoutMeso ?? 0).toLocaleString()} 메소
            </span>
          )}
        </div>

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

// ADR-068 결정 3: 동기화가 실패한 캐릭터를 **카드에서** 식별한다. 전에는 토스트가 인원 수만 알려
// 어느 카드인지 알 수 없었다([[ADR-063]]가 남긴 숙제, 이슈 #78 B).
//
// **표식은 아이콘 하나다 — 금액 옆, 라벨 없음**(시안 A에서 두 번 정정, 실물 확인 후 사용자 확정
// 2026-07-31). 경위:
//  ① 시안 A는 "금액 자리를 배지가 대체"였다. 전제는 그 금액이 낡은 캐시에서 온 값이라는 것.
//  ② [[ADR-067]] 결정 7·4 구현 후 카드 금액은 **DB 기록에서만** 나온다 → 가릴 이유가 약해졌다.
//  ③ 실물을 띄워보니 라벨 배지("조회 불가")가 캐릭터명 폭을 먹어 **6자 이름부터 잘렸다**
//     (`내옆에최성일` → `내옆에…`). `n/12` 숫자 표기를 보류한 것과 같은 문제다([[ADR-054]] 정정 7).
// 그래서 라벨을 버리고 아이콘만 남긴다 — 이름·금액·합계가 모두 온전하다. 원인 문구는 토스트가
// 담당하고([[ADR-063]]) 스크린리더에는 role="img" + aria-label로 전달한다.
const CHARACTER_ISSUE_LABEL = {
  unavailable: '조회 불가',
  failed: '실패',
} as const

// 탭했을 때 "왜 이 아이콘이 떠 있는가"를 설명한다(사용자 요청 2026-07-31). 아이콘만으로는 원인을
// 말할 수 없고, 그 대가를 팝오버가 받는다.
const CHARACTER_ISSUE_EXPLANATION = {
  unavailable: {
    title: '조회할 수 없는 캐릭터입니다',
    body: '넥슨 API가 이 캐릭터를 조회하지 못합니다. 캐릭터 관리에서 추적을 해제할 수 있습니다.',
  },
  failed: {
    title: '동기화하지 못했습니다',
    body: '마지막으로 확인한 기록을 보여주고 있습니다. 새로고침하면 다시 시도합니다.',
  },
} as const

// **금액의 좌상단에 절대배치한다**(사용자 지정 2026-07-31) — 흐름에 두면 헤더 가로폭을 캐릭터명과
// 다투고(라벨 배지가 6자 이름을 잘라먹은 이유, [[ADR-054]] 정정 7) 화면 폭에 따라 겹침이 생긴다.
//
// 기준은 금액 래퍼의 왼쪽 끝 = **숫자가 시작하는 위치**다. 거기서 `-left-1`(4px)만 밀어 원형 배지의
// **시각적** 왼쪽 변이 첫 자리 글자와 한 줄로 맞게 한다(원은 사각 글리프보다 안쪽으로 들어가 보인다,
// 사용자 미세 조정 2026-07-31).
//
// 처음 좌상단에 뒀을 때 숫자를 덮은 것은 위치가 아니라 **높이** 문제였다(-top-1.5, 6px) —
// `-top-3.5`(14px)면 글자 위쪽 여백만 쓰므로 겹치지 않고, 그래서 좌측에 폭을 비울 필요도 없다
// (초기 시도에서는 20px을 비웠다).
function CharacterIssueBadge(props: {
  issue: 'unavailable' | 'failed'
  onToggle: () => void
}): React.JSX.Element {
  const isPermanent = props.issue === 'unavailable'
  return (
    // span으로 두는 이유: 카드 헤더 자체가 <button>이라 그 안에 button을 넣으면 중첩 인터랙티브가
    // 된다(HTML 위반 + 클릭 충돌). span은 인터랙티브 콘텐츠가 아니므로 중첩이 허용되고, 클릭을
    // stopPropagation해 아코디언 토글과 갈라낸다. 대가는 키보드 포커스를 못 받는 것 — 상태 자체는
    // aria-label로 읽히고 원인 문구는 토스트([[ADR-063]])가 담당한다.
    <span
      data-testid="character-issue-badge"
      role="img"
      aria-label={CHARACTER_ISSUE_LABEL[props.issue]}
      title={CHARACTER_ISSUE_EXPLANATION[props.issue].title}
      onClick={(event) => {
        event.stopPropagation()
        event.preventDefault()
        props.onToggle()
      }}
      className={
        isPermanent
          ? 'absolute -top-3.5 -left-1 z-[7] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-info-tint text-info-ink ring-1 ring-bg'
          : 'absolute -top-3.5 -left-1 z-[7] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-error-tint text-error-ink ring-1 ring-bg'
      }
    >
      {isPermanent ? (
        <Ban className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
      )}
    </span>
  )
}

// 팝오버는 **셸 바깥**(카드 루트 relative isolate)에 둔다 — 셸은 펼침 상태에서 overflow-clip이라
// ([[ADR-049]]) 안에 두면 잘린다. 고가 드롭 배지를 셸 바깥에 둔 것과 같은 이유다([[ADR-047]]).
//
// z-[20]: 카드 안 층 순서는 드롭 아이콘 1~3 < sticky 헤더 5 < 골드 링 6 < 고가 드롭 배지 10이므로
// 그 전부보다 위다. **카드 루트의 isolate가 이 z를 카드 안에 가두므로** 페이지 sticky 헤더(z-10)나
// 하단 fixed nav 위로는 절대 올라가지 않는다 — 다른 화면 요소를 가릴 수 없다.
const ISSUE_POPOVER_WIDTH = 220
const ISSUE_POPOVER_EDGE_GAP = 12
// 아이콘 바로 아래에 붙인다(사용자 지정 2026-07-31). 아이콘은 헤더에서 y 9~23px을 차지하고 꼬리는
// 팝오버 위로 6px 튀어나오므로, 30px이면 꼬리 끝이 아이콘 밑변에서 1px 아래에 온다 — 닿아 보이면서
// 아이콘을 덮지는 않는다(팝오버가 z-20이라 덮으면 아이콘이 잘려 보인다).
// **금액 글자를 덮는 것은 허용**한다("메소 가려도 되니까 위치를 아이콘이랑 맞춰") — 열린 동안
// 그 카드의 금액 대신 팝오버가 말한다.
const ISSUE_POPOVER_TOP = 30
const ISSUE_CARET_SIZE = 8

/**
 * 배지 x좌표를 실측해 팝오버 위치로 넘긴다. 금액은 자릿수에 따라 폭이 변해 **배지의 x를 고정값으로
 * 알 수 없다** — clamp·꼬리 계산은 순수 함수(`lib/popover-anchor`)가 맡고 여기서는 측정만 한다.
 */
function measureIssueAnchor(card: HTMLElement | null, money: HTMLElement | null): PopoverAnchorGeometry {
  if (card === null || money === null) {
    return { left: ISSUE_POPOVER_EDGE_GAP, caretLeft: ISSUE_POPOVER_WIDTH / 2 }
  }
  const cardRect = card.getBoundingClientRect()
  const moneyRect = money.getBoundingClientRect()
  return anchorPopover({
    containerWidth: cardRect.width,
    // 배지는 금액 왼쪽 끝에서 4px 밀려 있고(-left-1) 폭이 14px이므로 중심은 그 +7px이다.
    anchorCenterX: moneyRect.left - cardRect.left - 4 + 7,
    popoverWidth: ISSUE_POPOVER_WIDTH,
    edgeGap: ISSUE_POPOVER_EDGE_GAP,
    caretSize: ISSUE_CARET_SIZE,
  })
}

function CharacterIssuePopover(props: {
  issue: 'unavailable' | 'failed'
  geometry: PopoverAnchorGeometry
  onClose: () => void
}): React.JSX.Element {
  const copy = CHARACTER_ISSUE_EXPLANATION[props.issue]
  return (
    <div
      data-testid="character-issue-popover"
      role="status"
      style={{ left: props.geometry.left, width: ISSUE_POPOVER_WIDTH, top: ISSUE_POPOVER_TOP }}
      className="absolute z-[20] rounded-[12px] border border-border bg-surface p-3 shadow-lg"
    >
      {/* 꼬리: 45도 회전한 정사각형의 위·왼쪽 테두리만 남겨 카드 배경과 이어 붙인다. */}
      <span
        aria-hidden="true"
        style={{ left: props.geometry.caretLeft, width: ISSUE_CARET_SIZE, height: ISSUE_CARET_SIZE }}
        className="absolute -top-[5px] rotate-45 border-l border-t border-border bg-surface"
      />
      <p className="text-xs font-bold text-text">{copy.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{copy.body}</p>
      <button
        type="button"
        onClick={props.onClose}
        className="mt-2 text-[11px] font-semibold text-primary-ink underline"
      >
        닫기
      </button>
    </div>
  )
}

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

// ADR-068 결정 2: **행동이 있는 상태에만 버튼을 준다.** 여섯 상태 중 사용자가 할 수 있는 것은
// notChecked(조회)와 failed(다시 시도) 둘뿐이고, 나머지는 금액 또는 비활성 배지로 정적이다.
// 금액을 모르는 상태에 0을 쓰지 않는 것이 핵심이다 — 0은 "0원 벌었다"로 읽힌다.
const SUBTOTAL_ACTION_LABEL: Partial<Record<WeeklySubtotalState, string>> = {
  notChecked: '조회',
  failed: '다시 시도',
}

const SUBTOTAL_STATIC_LABEL: Partial<Record<WeeklySubtotalState, string>> = {
  upcoming: '예정',
  outOfRange: '조회 불가',
  notCollected: '집계 전',
}

function WeeklySubtotalRow(props: {
  subtotal: BossProfitWeeklySubtotal
  now: Date
  onRetry: () => void
}): React.JSX.Element {
  const { subtotal } = props
  const label = formatBossProfitPeriodLabel('weekly', subtotal.periodKey, props.now)
  const actionLabel = SUBTOTAL_ACTION_LABEL[subtotal.state]
  const staticLabel = SUBTOTAL_STATIC_LABEL[subtotal.state]
  // 금액을 말할 수 있는 상태 — 기록이 있거나(recorded), 조회해서 0건을 확인했거나, 진행 중.
  const showsMeso =
    subtotal.state === 'recorded' || subtotal.state === 'confirmedEmpty' || subtotal.state === 'inProgress'

  return (
    <li
      className={
        staticLabel !== undefined
          ? 'flex items-center gap-3 p-4 border-b border-border opacity-40'
          : 'flex items-center gap-3 p-4 border-b border-border'
      }
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-text">{label.primary}</p>
        <p className="text-xs text-text-muted tabular-nums">{label.secondary}</p>
      </div>

      {subtotal.state === 'inProgress' && (
        <span className="rounded-full bg-primary-tint text-primary-ink text-[10px] font-semibold px-2 py-0.5">
          진행 중
        </span>
      )}

      {staticLabel !== undefined && <span className="text-xs text-text-muted">{staticLabel}</span>}

      {/* 누를 수 있는 행만 어포던스(칩)를 갖는다. 한 주를 누르면 그 달의 미확인 주를 함께 채운다 —
          같은 백필이 그 달 전체를 대상으로 돌기 때문이고, 탭 수를 늘릴 이유가 없다. */}
      {actionLabel !== undefined && (
        <button
          type="button"
          onClick={props.onRetry}
          className={
            subtotal.state === 'failed'
              ? 'inline-flex items-center gap-1.5 rounded-full bg-error-tint px-2.5 py-1 text-[11px] font-semibold text-error-ink'
              : 'inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary-ink'
          }
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {actionLabel}
        </button>
      )}

      {showsMeso && (
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
  onRetryPeriod: () => void
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
              <WeeklySubtotalRow
                key={subtotal.periodKey}
                subtotal={subtotal}
                now={props.now}
                onRetry={props.onRetryPeriod}
              />
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
// ADR-069 결정 2: 집계 단위가 **행**이다. 전에는 `group.bossRows[0]?.world` 로 캐릭터당 월드를
// 하나로 정했는데, 주 중간에 월드를 옮기면 한 캐릭터의 행이 두 월드에 걸치므로 첫 행의 월드로
// 전부 쏠렸다. 판매 한도(90)는 **월드마다 따로 산정**되므로(사용자 확인) 그 주의 판매량은 두
// 월드에 각각 계상돼야 한다.
//
// 같은 보스는 한 주에 한 번만 처치할 수 있어(사용자 확인) 한 행은 정확히 한 월드에 속한다 —
// 그래서 행 단위로 갈라도 "보스명 distinct"의 의미가 유지된다(캐릭터별로 세던 것과 결과가 같고,
// 걸치는 주에서만 갈린다). 월드를 모르는 행(컬럼 도입 전 기록)은 조용히 빠진다([[ADR-054]] 결정 5).
//
// 캐릭터 카드의 진행 링은 이 함수를 쓰지 않는다 — 클리어 수는 캐릭터 단위로 이어지므로 월드와
// 무관하게 그 주 전체를 센다. 두 숫자의 집계 단위가 다른 것은 게임 규칙이 그렇게 갈려 있어서다.
function summarizeWorldCrystals(groups: CharacterGroup[]): WorldCrystalSummary[] {
  // 월드 → (캐릭터 → 그 월드에서 처치한 보스명 집합). 캐릭터를 한 번 더 갈라야 서로 다른
  // 캐릭터가 같은 보스를 잡은 것이 하나로 합쳐지지 않는다.
  const bossNamesByWorld = new Map<string, Map<string, Set<string>>>()

  for (const group of groups) {
    for (const row of group.bossRows) {
      if (row.world === null) {
        continue
      }
      // **월드 집합과 처치 수를 분리한다**: 월드를 아는 행이 있으면 처치가 0이어도 그 월드를
      // 목록에 넣어 `0 / 90` 을 보여준다([[ADR-054]] 결정 — "월드는 알고 처치가 0이면 0 / 90을
      // 그대로 보여준다"). 완료 조건을 월드 판정에 섞으면 그 표시가 사라진다.
      const byCharacter = bossNamesByWorld.get(row.world) ?? new Map<string, Set<string>>()
      const bossNames = byCharacter.get(row.ocid) ?? new Set<string>()
      if (row.cycle === 'weekly' && row.isComplete && !isSeasonBossName(row.boss)) {
        bossNames.add(row.boss)
      }
      byCharacter.set(row.ocid, bossNames)
      bossNamesByWorld.set(row.world, byCharacter)
    }
  }

  return [...bossNamesByWorld].map(([world, byCharacter]) => ({
    world,
    cleared: [...byCharacter.values()].reduce((sum, bossNames) => sum + bossNames.size, 0),
  }))
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
        <span className="text-xs font-bold leading-none tabular-nums text-primary-ink">
          {cleared} <span className="font-semibold opacity-70">/ {limit}</span>
        </span>
      ) : (
        <span className="text-xs font-bold leading-none tabular-nums text-primary-ink">
          {cleared}
          <span className="font-semibold opacity-70">개</span>
        </span>
      )}
    </>
  )

  // h-5(20px) — 라벨행이 h-6(24px)으로 고정돼 있으므로 그 안에 들어가기만 하면 된다. leading-none과
  // 함께 두어야 글꼴 line-height가 칩 높이를 밀어 올리지 않는다.
  const chipClassName = 'ml-2 flex h-5 flex-none items-center gap-1 rounded-full bg-primary-tint px-1.5'

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
          <ChevronUp className="h-3 w-3 flex-none text-primary-ink" strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3 flex-none text-primary-ink" strokeWidth={2.5} aria-hidden="true" />
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
  // ADR-068 결정 2: 주차 행의 조회·다시 시도 버튼이 이 기간을 다시 로드한다(store.retryPeriod).
  onRetryPeriod: () => void
  // ADR-068 결정 3: 이 캐릭터의 동기화가 실패했으면 그 종류(없으면 undefined).
  issue?: 'unavailable' | 'failed'
  stickyTop: number
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  // ADR-068 결정 3 정정 3: 아이콘만으로는 원인을 말할 수 없어, 탭하면 설명 팝오버를 연다.
  const [isIssueOpen, setIsIssueOpen] = useState(false)
  // 배지·팝오버를 함께 감싸는 앵커 — 바깥 탭 판정과 팝오버 위치 실측에 쓴다.
  const issueAnchorRef = useRef<HTMLDivElement>(null)
  const moneyRef = useRef<HTMLSpanElement>(null)
  const [issueGeometry, setIssueGeometry] = useState<PopoverAnchorGeometry>({
    left: ISSUE_POPOVER_EDGE_GAP,
    caretLeft: ISSUE_POPOVER_WIDTH / 2,
  })
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
  // 팝오버는 열려 있는 동안 카드 아래 내용을 덮으므로, **스크롤이 시작되면 닫는다**(사용자 우려
  // 2026-07-31 — 스크롤 중 다른 컨텐츠를 가리는 문제). 바깥 탭도 닫는다: 투명 오버레이를 쓰지 않고
  // document 리스너로 판정한다 — 오버레이는 카드의 isolate 안에 갇혀 다른 카드 위를 덮지 못한다.
  useEffect(() => {
    if (!isIssueOpen) return

    const closeOnOutside = (event: Event): void => {
      const target = event.target
      if (target instanceof Node && issueAnchorRef.current?.contains(target) === true) return
      setIsIssueOpen(false)
    }
    const closeOnScroll = (): void => setIsIssueOpen(false)

    document.addEventListener('pointerdown', closeOnOutside, true)
    window.addEventListener('scroll', closeOnScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      window.removeEventListener('scroll', closeOnScroll)
    }
  }, [isIssueOpen])

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
    // 팝오버가 열린 동안만 이 카드를 형제 카드 위로 들어올린다. 형제 카드는 각자 isolate라 z-auto
    // 스태킹 컨텍스트이고, **나중 형제가 먼저 형제 위에 그려진다** — 그래서 카드 안의 z-20만으로는
    // 팝오버가 아래 카드에 가려진다(실물 확인 2026-07-31). z는 9로 묶는다: 형제 카드(z-auto)보다
    // 위지만 **페이지 sticky 헤더(z-10)보다 아래**라, 스크롤로 카드가 헤더 밑으로 들어갈 때 헤더를
    // 덮지 않는다(스크롤 시작 시 팝오버를 닫는 것과 함께 이 두 겹의 방어를 둔다).
    <div
      ref={issueAnchorRef}
      className={isIssueOpen ? 'relative isolate z-[9]' : 'relative isolate'}
    >
      {props.issue !== undefined && isIssueOpen && (
        <CharacterIssuePopover
          issue={props.issue}
          geometry={issueGeometry}
          onClose={() => setIsIssueOpen(false)}
        />
      )}
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
          onClick={() => {
            // 카드를 펼치거나 접으면 설명 팝오버를 닫는다(사용자 지적 2026-07-31). 바깥 탭 판정은
            // 카드 루트를 "안"으로 보므로 헤더 클릭으로는 닫히지 않았다. 게다가 펼침은 레이아웃을
            // 바꿔 열기 직전에 실측한 팝오버 위치가 낡은 값이 된다 — 닫는 것이 두 문제를 함께 없앤다.
            setIsIssueOpen(false)
            setIsExpanded((prev) => !prev)
          }}
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
          {/* 금액을 relative 래퍼로 감싸 배지의 절대배치 기준으로 쓴다 — 래퍼는 흐름상 금액과 같은
              크기이므로 레이아웃에 영향이 없다. */}
          {/* 금액을 relative 래퍼로 감싸 배지의 절대배치 기준으로 쓴다 — 배지는 우상단(글자 위쪽
              여백)에 얹히므로 **가로폭을 쓰지 않고 숫자도 덮지 않는다**. 좌상단이었을 때는 금액 첫
              자리를 가려 좌측에 20px을 비워야 했다(실물 확인 2026-07-31). */}
          <span ref={moneyRef} className="relative text-sm font-bold text-text tabular-nums">
            {props.issue !== undefined && (
              <CharacterIssueBadge
                issue={props.issue}
                onToggle={() => {
                  // 열기 직전에 실측한다 — 금액 폭은 기간·파티원 수에 따라 바뀌므로 한 번 계산해
                  // 두고 재사용할 수 없다.
                  setIssueGeometry(measureIssueAnchor(issueAnchorRef.current, moneyRef.current))
                  setIsIssueOpen((prev) => !prev)
                }}
              />
            )}
            {totalMeso.toLocaleString()} 메소
          </span>
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
              onRetryPeriod={props.onRetryPeriod}
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
    periodState,
    canGoPreviousPeriod,
    error,
    staleCharacterNames,
    characterIssues,
    trackedOcids,
    lastSyncedAt,
    loadTrackedOcids,
    refresh,
    setTab,
    goToPreviousPeriod,
    goToNextPeriod,
    retryPeriod,
    setPartySize,
    setBossDrops,
    dropsByRowKey,
  } = useBossProfitStore()

  const navigate = useNavigate()

  // ADR-063: 동기화 전체 실패는 토스트로 알린다. 기간 라벨·"n분 전" 표기가 남아 맥락은 화면에 있다.
  useScheduleSyncErrorToast(error, {
    onRetry: () => refresh(trackedOcids ?? []),
    onOpenSettings: () => navigate('/settings'),
  })

  // ADR-063: 일부 캐릭터만 실패한 경우도 토스트로 옮긴다. Toast 본문은 truncate(Toast.tsx)라
  // 이름을 나열하면 잘리므로 이름 대신 인원 수만 싣는다 — 어느 캐릭터인지는 잃지만, 지금은 선택된
  // 캐릭터가 아닌 카드의 실패를 알 방법이 아예 없던 것보다 낫다(캐릭터 카드 자체에 표식을 붙이는
  // 안은 별도 작업, 이슈 #78 B).
  useStaleCharactersToast(staleCharacterNames, () => refresh(trackedOcids ?? []))

  useEffect(() => {
    loadTrackedOcids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isEmpty = trackedOcids === null || trackedOcids.length === 0

  // 최신(=현재) 기간에서는 다음 이동을 막는다. 아래 빈 상태 조기 반환보다 위에 두는 것은 당겨서
  // 새로고침 훅이 canRefreshPeriod를 필요로 하기 때문이다(훅 규칙). now는 여기서 한 번만 만든다 —
  // 두 번 호출하면 두 시각이 기간 경계를 사이에 두고 갈려 "현재 기간 판정"과 "기간 라벨"이 서로
  // 다른 기간을 가리킬 수 있다.
  const now = new Date()
  const isCurrentPeriod = isLatestPeriod(tab, periodKey, now)
  // 동기화 상태 영역·당겨서 새로고침의 공통 게이트(ADR-076) — "이 기간이 최신인가"가 아니라
  // "지금 재조회하면 이 화면의 숫자가 달라질 수 있는가"다. 완전히 닫힌 과거 기간은
  // cache-first·checked-once라 무의미하지만, 진행 중인 주를 품은 지난 달(7월 5주차 = 7/30~8/5)은
  // 지금도 값이 늘어나고 그 값을 만드는 것은 실시간 동기화뿐이다.
  const canRefreshPeriod = isPeriodRefreshable(tab, periodKey, now)

  // ADR-072: 목록 최상단에서 당기면 헤더 새로고침 버튼과 같은 재조회가 돈다(제스처는 추가 수단이다).
  // 빈 상태에서는 당길 목록이 없어 끄고(결정 13), 재조회 중에는 새 당김을 시작하지 않는다(결정 12).
  // 새로고침이 의미 없는 과거 기간에서도 끈다(결정 9) — 그 기간에서 refresh는 periodKey를 현재
  // 기간으로 리셋하므로 제스처를 쓰는 순간 보고 있던 기간이 튕겨 나간다(#30). 진행 중인 주를 품은
  // 지난 달은 refresh가 그 기간을 유지하므로 예외다(ADR-076). 헤더 버튼과 같은 플래그를 쓴다.
  const pullToRefresh = usePullToRefresh({
    enabled: !isEmpty && canRefreshPeriod,
    isRefreshing: status === 'loading',
    onRefresh: () => refresh(trackedOcids ?? []),
  })

  // ADR-073 결정 6: 목록이 내려가는 거리이자 인디케이터가 채우는 틈의 높이다 — 인디케이터와 같은
  // 함수·같은 인자를 쓴다. 두 벌로 계산하면 값이 어긋나는 순간 인디케이터가 카드 위에 겹치거나
  // 반대로 빈 띠가 남는다.
  const pullOffset = resolveContentOffsetPx(pullToRefresh.distance, pullToRefresh.phase)

  // 펼친 캐릭터 카드 헤더를 이 페이지 sticky 헤더 "아래"에 붙이기 위한 실측 높이(ADR-047).
  // 페이지 헤더는 불투명(bg-bg)하고 높이가 상태에 따라 가변이라(탭·기간 라벨·동기화 실패 경고·에러 문구·
  // 총 수익 헤드라인 유무) 상수로 둘 수 없다. 미지원 환경은 0으로 남아 top-0으로 자연 degrade한다.
  // 빈 상태에서는 헤더 자체가 렌더되지 않으므로 isEmpty가 풀릴 때 다시 붙인다.
  const stickyHeaderRef = useRef<HTMLDivElement>(null)
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0)

  // ADR-080: 기간·탭이 바뀌면 아코디언 key(`${tab}-${periodKey}-${ocid}`)가 바뀌어 카드가 전부
  // 접히고(#27 펼침 리셋) **문서 높이가 붕괴한다**(실측 1939 → 874). 스크롤을 내린 상태였다면
  // 브라우저가 오프셋을 잘라내야 하는데, 잘리기 전 1~2프레임 동안 레이아웃은 이미 짧고 오프셋은
  // 그대로라 sticky 헤더가 화면 밖(`headerTop=-1154`)에 그려진다 — 헤더가 사라졌다 돌아오는 그것이
  // 깜빡임의 정체다(프레임 단위 계측, 실기기 2026-08-02. 최상단에서 재현되지 않는 이유는 잘라낼
  // 스크롤이 없어서다).
  //
  // useLayoutEffect 인 것이 핵심이다 — DOM 커밋 후 **페인트 전**에 돌아야 그 프레임이 그려지기
  // 전에 스크롤이 0이 된다. useEffect 면 이미 늦다.
  //
  // 동작을 바꾸는 것이 아니다: 카드가 전부 접히면 문서(874px)가 뷰포트와 같아 최대 스크롤이 0이라
  // 어차피 최상단으로 클램프된다. 도착지는 그대로 두고 가는 길의 깨진 프레임만 없앤다.
  //
  // 히스토리 왕복은 tab·periodKey를 바꾸지 않으므로([[ADR-077]]) 여기 걸리지 않는다 — 돌아왔을 때
  // 스크롤 위치가 유지된다는 계약은 그대로다.
  // ADR-080: 기간·탭이 바뀌면 **페인트 전에** 문서를 최상단으로 옮긴다.
  //
  // 기간이 바뀌면 아코디언 key(`${tab}-${periodKey}-${ocid}`)가 바뀌어 카드가 전부 접히고(#27 펼침
  // 리셋) 문서 높이가 붕괴한다(실측 1939 → 874). 스크롤을 내린 상태였다면 브라우저가 오프셋을
  // 잘라내야 하는데, 잘리기 전 1~2프레임 동안 레이아웃은 이미 짧고 오프셋은 그대로라 sticky 헤더가
  // 화면 밖(`headerTop=-1154`)에 그려진다 — 헤더가 사라졌다 돌아오는 그것이 깜빡임의 정체다
  // (프레임 단위 계측, 실기기 2026-08-02). `useEffect` 면 이미 늦다.
  //
  // **목적지가 0인 것이 중요하다**([[ADR-082]] 실패로 확인). 0은 sticky 헤더의 자연 위치라 iOS의
  // 스크롤 스레드가 트랜스폼을 못 따라잡아도 헤더가 제자리에 그려진다. 0이 아닌 위치를 복원하면
  // 그 트랜스폼이 한 박자 늦는 프레임에 헤더가 화면 밖으로 사라진다.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, periodKey])

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

  // 훅(아래 usePeriodLoadErrorToast)이 이 값을 읽으므로 isEmpty 조기 반환보다 위에서 계산한다 —
  // 순수 함수라 위치를 올려도 결과가 같고, 토스트 조건과 화면 조건이 같은 값을 보게 된다.
  const characterGroups = buildCharacterGroups(rows, weeklySubtotals)

  // ADR-083 결정 3: 기간 로드 실패는 **카드가 있을 때만** 토스트다. 카드가 없으면 문구가 사라진
  // 자리에 빈 칸이 남으므로 아래에서 ErrorState를 그린다(같은 실패의 두 얼굴, 문구는 통일).
  usePeriodLoadErrorToast({
    isFailed: periodState === 'failed' && characterGroups.length > 0,
    isLoading: isPeriodLoading,
    periodKey,
    onRetry: () => void retryPeriod(),
  })

  if (isEmpty) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom)-4rem)] flex-col p-4">
        {/* 빈 상태에는 히스토리 진입점이 없지만(ADR-071 결정 7) 딥링크로는 닿을 수 있어 여기도 건다. */}
        <Outlet />
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

  const periodLabel = formatBossProfitPeriodLabel(tab, periodKey, now)
  const isNextDisabled = isCurrentPeriod
  // 이전 이동 가능 여부는 store가 매 기간 로드 시 계산해둔 canGoPreviousPeriod로 판단한다(#29) —
  // 조회 불가능하고 캐시 기록도 없는 기간에 착지하지 않도록 막는다.
  const isPrevDisabled = !canGoPreviousPeriod
  // 캐시된 기록이 없는 상태에서 이 기간을 "지금" 볼 수 있는지(ADR-032) — false면
  // "아직 처치한 보스가 없습니다"(확정된 빈 상태)가 아니라 "조회 불가"(확인 자체를 못 함)를 보여준다.
  //
  // **현재 기간은 백필 가능성을 묻지 않는다**([[ADR-067]] 결정 2 정정 2) — 조회일이 미래라
  // isPeriodQueryable이 false지만 그건 "조회 불가"가 아니라 실시간 동기화가 원천이라는 뜻이다.
  // 처치가 0건이면 그것이 확정된 사실이므로 빈 상태가 맞다. 이 판정의 최종 형태는
  // resolvePeriodDataState(6상태)이고, 화면 전체를 그 상태로 옮기는 것은 [[ADR-068]] 배선 단계다.
  const periodQueryable = isCurrentPeriod || isPeriodQueryable(tab, periodKey, now)
  const totalMeso = characterGroups.reduce((sum, group) => sum + groupTotalMeso(group), 0)
  // 총 수익 헤드라인 우측 뱃지용 — 이 기간 전체 고가 드롭(ADR-046)
  const periodValuableDrops = collectAllValuableDrops(characterGroups, dropsByRowKey)

  return (
    // ADR-077: 히스토리 오버레이(<Outlet />)는 아래 space-y-4 루트 **바깥**에 둔다 — 그 유틸리티는
    // 형제에게 margin-top을 주는데, fixed inset-0 오버레이에 그 마진이 걸리면 1rem 밀려 그려진다.
    <>
    <div className="-mt-[var(--sa-top)] space-y-4">
      {/* 제목~총 수익 카드까지는 화면 상단에 고정하고 그 아래 캐릭터 아코디언 목록만
          스크롤되게 한다(사용자 요청, 2026-07-14) — content-scheduler/boss-scheduler와
          동일한 sticky 헤더 패턴(docs/UI_GUIDE.md "스크롤 영역" 참고)을 그대로 재사용한다. */}
      <div ref={stickyHeaderRef} className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-4">
          {/* 히스토리 진입점([[ADR-071]] 결정 7, 이슈 #54) — 이 화면의 고가 드롭 강조는 전부 "지금 보고
              있는 기간"에 갇혀 있고, 전 기간을 가로지르는 목록은 저쪽이 담당한다.

              **제목 줄 우측**에 두고, 보스/컨텐츠 스케줄러의 "캐릭터 관리"·"보스 관리"와 **같은 패턴**을
              쓴다(사용자 지정 2026-08-01): `justify-between` 제목 줄 + `text-sm font-medium
              text-text-muted hover:text-text`. 서브 화면으로 보내는 헤더 링크가 이미 그 어휘라 새 스타일을
              만들 이유가 없다. 탭 줄에 있던 것을 옮긴 것이므로 그 줄의 30px 규칙([[ADR-049]])은 이제
              무관하다 — 제목 줄 높이는 h1(28px)이 정한다. */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text">보스 수익</h1>
            <button
              type="button"
              onClick={() => navigate('/profit/drops')}
              className="text-sm font-medium text-text-muted hover:text-text"
            >
              히스토리
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTab('weekly')}
              className={
                tab === 'weekly'
                  ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
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
                  ? 'rounded-full bg-primary-tint px-3 py-[5px] text-sm font-semibold text-primary-ink'
                  : 'px-3 text-sm font-medium text-text-muted'
              }
            >
              월간
            </button>

            {/* 동기화 상태 영역(마지막 동기화 시각 텍스트 + 새로고침 버튼)은 새로고침이 의미 있는
                기간에서만 노출한다(#30, ADR-076) — 완전히 닫힌 과거 기간은 cache-first·checked-once
                모델이라 실시간 동기화 개념이 없어 "조회 중..."/"방금 전"/"n분 전" 표시도, 재조회
                버튼도 의미가 없다. 진행 중인 주를 품은 지난 달만 예외다.
                제목 줄이 아니라 탭과 같은 줄에 둔다(ADR-049). */}
            {canRefreshPeriod && (
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
                  className="flex h-[30px] w-[30px] items-center justify-center text-primary-ink hover:text-primary-hover"
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

          {/* ADR-061 결정 2: 보여줄 데이터가 아예 없을 때만 셸 승계 카드를 그린다. */}
          {!isPeriodLoading && (status === 'idle' || status === 'loading') && characterGroups.length === 0 && (
            <LoadingState size="page" message="불러오고 있어요" />
          )}

          {/* ADR-068 결정 1·7: 상태마다 얼굴이 다르다. 기록이 있으면(periodState === 'recorded')
              아무것도 띄우지 않는다 — 목요일 새벽처럼 백필만 막힌 경우 기록은 정확하고 사용자가
              할 일도 없다. notCollected는 "아직"이라고 말하고, failed는 액션이 필요해
              토스트로 옮겼다([[ADR-083]] 결정 3 — 여기 있던 밑줄 버튼이 그것이다). */}
          {!isPeriodLoading && characterGroups.length > 0 && periodState === 'notCollected' && (
            <p className="flex items-center gap-1.5 text-sm text-text-muted">
              <Clock className="h-4 w-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
              아직 집계되지 않았습니다 — 준비되면 자동으로 채워집니다
            </p>
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink">
                  <ProfitIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                </span>
                {/* 단위는 별도 span으로 격하하되 숫자와 사이에 실제 공백 문자를 남긴다 — 마진만으로 띄우면
                    textContent가 "N메소"로 붙어 스크린리더가 붙여 읽는다(ADR-046 트레이드오프). */}
                <p className="text-xl font-extrabold leading-none tabular-nums text-primary-ink">
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

        {/* ADR-072 결정 4·5: 인디케이터는 sticky 헤더 블록의 마지막 자식이고 absolute라 이 블록의 실측
            높이(stickyHeaderHeight)를 바꾸지 않는다 — 흐름 자식이면 당길 때마다 ResizeObserver가
            발화해 펼친 카드의 중첩 sticky 헤더가 손가락을 따라 흔들린다(ADR-047 결정 3). */}
        <PullToRefreshIndicator distance={pullToRefresh.distance} phase={pullToRefresh.phase} />
      </div>

      {/* ADR-073 결정 1·2: 헤더는 sticky로 제자리에 두고 이 목록 블록만 손가락을 따라 내려간다.
          마진·높이가 아니라 transform 이라 터치 프레임마다의 리플로우가 없고, 헤더의 실측
          높이(stickyHeaderHeight)도 건드리지 않는다. 오프셋이 0이면 transform 을 아예 걸지
          않는다(결정 3) — translateY(0px) 조차 containing block·stacking context를 만들어 sticky
          후손(ADR-047 중첩 카드 헤더)의 기준을 바꾼다. 당김은 window.scrollY <= 0 에서만 시작되므로
          (ADR-072 결정 2) 당기는 순간엔 멈춘(stuck) 카드 헤더가 없어 stickyTop 을 보정할 대상도
          없다. 반면 transition 은 어떤 컨텍스트도 만들지 않으므로 항상 걸어둔다. 그래야 오프셋이
          0으로 돌아갈 때 복귀 애니메이션이 살고(붙였다 떼면 마지막 프레임에 전환이 없어 순간이동한다),
          드래그 중에만 'none' 이다(결정 4) — 손가락이 붙어 있는데 전환이 걸리면 목록이 늘 뒤처져 그려진다. */}
      <div
        data-testid="pull-content"
        className="space-y-2 px-4 pb-4"
        style={{
          transform: pullOffset > 0 ? `translateY(${pullOffset}px)` : undefined,
          transition: pullToRefresh.isDragging ? 'none' : PULL_SETTLE_TRANSITION,
        }}
      >
        {/* ADR-061 결정 2·3·4: 점선 박스(빈 상태의 어법)와 비-브랜드 CSS 링을 버리고 셸 승계
            카드를 쓴다 — 백필이 끝나면 같은 자리·같은 껍데기에 캐릭터 카드가 들어온다. */}
        {isPeriodLoading && (
          <LoadingState message={`${periodLabel.primary} 기록을 불러오고 있어요`} />
        )}

        {/* ADR-060: "확정된 빈 상태"와 "조회 자체를 못 함"은 디자인을 공유하지 않는다 — 같은 모양이면
            조회 불가가 "데이터가 없다"로 오해된다. 처치 0건은 CTA를 달지 않는다(앱 안에 할 일이 없다). */}
        {/* ADR-060 + ADR-068 결정 1: "확정된 빈 상태"와 "확인 자체를 못 함"은 디자인을 공유하지
            않는다. 어느 쪽인지는 store가 계산한 periodState가 답한다 — 전에는 화면이
            isPeriodQueryable로 따로 판정해 백필과 어긋났다(이슈 #78 E). */}
        {!isPeriodLoading &&
          status === 'loaded' &&
          characterGroups.length === 0 &&
          (periodState === 'confirmedEmpty' ? (
            <EmptyState
              icon={ProfitIcon}
              title="아직 처치한 보스가 없습니다"
              description="보스를 처치하면 수익이 자동으로 집계됩니다"
            />
          ) : periodState === 'notCollected' ? (
            <UnavailableNotice variant="notCollected" />
          ) : periodState === 'failed' ? (
            <ErrorState
              title="이 기간을 불러오지 못했습니다"
              description="네트워크 상태를 확인해주세요"
              action={{ label: '다시 시도', onClick: () => void retryPeriod() }}
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
              onRetryPeriod={() => void retryPeriod()}
              issue={characterIssues[group.ocid]}
              stickyTop={stickyHeaderHeight}
            />
          ))}
      </div>
    </div>
    <Outlet />
    </>
  )
}

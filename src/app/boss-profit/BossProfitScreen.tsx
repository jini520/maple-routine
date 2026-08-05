import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { AnimatedMeso } from '../../components/atoms/AnimatedMeso/AnimatedMeso'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { ProfitIcon } from '../../components/atoms/ProfitIcon/ProfitIcon'
import { PullToRefreshIndicator } from '../../components/molecules/PullToRefreshIndicator/PullToRefreshIndicator'
import { PULL_SETTLE_TRANSITION, resolveContentOffsetPx } from '../../lib/pull-to-refresh'
import { usePullToRefresh } from '../../lib/use-pull-to-refresh'
import { UnavailableNotice } from '../../components/molecules/EmptyState/UnavailableNotice'
import { usePeriodLoadErrorToast } from '../../features/boss-profit/use-period-error-toast'
import { ValuableDropBadge } from '../../components/molecules/ValuableDropBadge/ValuableDropBadge'
import weeklyBossesData from '../../data/weekly-bosses.json'
import {
  useBossProfitStore,
} from '../../features/boss-profit/store'
import { formatSyncedAt } from '../../features/schedule-sync/format'
import {
  useScheduleSyncErrorToast,
  useStaleCharactersToast,
} from '../../features/schedule-sync/use-sync-error-toast'
import { type PopoverAnchorGeometry } from '../../lib/popover-anchor'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss-matching'
import {
  formatBossProfitPeriodLabel,
  isLatestPeriod,
  isPeriodQueryable,
  isPeriodRefreshable,
} from '../../lib/boss-profit-period'
import type { BossProfitContextValue } from './boss-profit-context'
import { ThemeHeaderBackdrop } from '../../components/templates/ThemeHeaderBackdrop/ThemeHeaderBackdrop'
import {
  buildCharacterGroups,
  collectAllValuableDrops,
  collectGroupValuableDrops,
  countGroupClearedMonthlyBosses,
  countGroupClearedWeeklyBosses,
  groupTotalMeso,
  type CharacterGroup,
} from './character-groups'
import { CharacterAvatar } from './CharacterAvatar'
import { MonthlyAccordionBody, WeeklyAccordionBody } from './AccordionBody'
import { CharacterIssueBadge, CharacterIssuePopover, measureIssueAnchor, ISSUE_POPOVER_EDGE_GAP, ISSUE_POPOVER_WIDTH } from './CharacterIssue'
import { BossProfitContextProvider, useBossProfitContext } from './boss-profit-context'
import { CrystalSummaryChip, DeltaChip } from './HeadlineChips'
import { useScreenNavigate } from '../../lib/use-screen-navigate'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'









// 월간 탭 진행 링의 분모([[ADR-059]] 결정 4) — 리터럴 1이 아니라 참조 데이터에서 파생한다. 월간
// 보스가 늘면 링 칸 수가 따라 늘어, "데이터는 2종인데 링은 1칸"이 될 수 없다. WEEKLY_BOSS_CLEAR_LIMIT
// 처럼 lib/boss-matching에 두지 않는 이유는 성격이 달라서다 — 그쪽 둘은 게임이 정한 한도이자 보스
// 스케줄러와 공유하는 값이고, 이건 "우리가 추적하는 월간 보스 종류 수"라 이 화면만 쓴다.
const MONTHLY_BOSS_COUNT = weeklyBossesData.monthly.length









// 소계 footer는 두지 않는다(ADR-047 후속 3) — 헤더가 sticky라 캐릭터 합계가 스크롤 내내 보여 중복이다.
// 그 결과 셸 하단에 닿는 배경 요소가 없어 하단 모서리 보정도 불필요하다. 새로 추가한다면 셸엔
// overflow-hidden을 걸 수 없으므로(ADR-047 결정 2) 그 요소가 직접 rounded-b-[14px]를 가져야 한다.























// 배지가 카드 상단 밖으로 올라간 양(-top-2 = 0.5rem). sticky 레일 오프셋에서 이만큼 상쇄해야
// stuck 시 배지가 헤더 상단선에 걸린다(ADR-047 후속).
const BADGE_TOP_OFFSET = 8

// 중첩 sticky([[ADR-047]])의 멈춤 위치. 인자는 **뷰포트 기준** 실측값(페이지 헤더 높이 등)인데
// sticky 의 `top` 은 **스크롤포트 기준**이고, 이 화면의 스크롤포트는 `top-[var(--sa-top)]` 에서
// 시작한다([[ADR-099]] 결정 6·[[ADR-100]] 결정 3) — 그 차이만큼 빼지 않으면 카드 헤더가 안전영역
// 만큼 아래에 멈춘다.
function stickyOffset(viewportPx: number): string {
  return `calc(${viewportPx}px - var(--sa-top))`
}



// 프롭에는 **이 캐릭터 카드에 매인 것만** 남는다 — 기간·탭 맥락과 스토어 바인딩 8개는
// 컨텍스트에서 읽는다(ADR-094 3단계 정정). 그 8개는 아무 중간 컴포넌트도 쓰지 않고 4단계를
// 통과만 하고 있었다.
function CharacterAccordion(props: {
  group: CharacterGroup
  // ADR-068 결정 3: 이 캐릭터의 동기화가 실패했으면 그 종류(없으면 undefined).
  issue?: 'unavailable' | 'failed'
  stickyTop: number
}): React.JSX.Element {
  const { tab, loadedTab, loadedPeriodKey, dropsByRowKey, scrollRoot } = useBossProfitContext()
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
  // ADR-085 결정 2: 접기 전에 "사라질 높이"(셸 − 헤더)를 재기 위한 셸 참조.
  const shellRef = useRef<HTMLDivElement>(null)

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

  // ADR-085 결정 2: 접으면 본문이 사라져 문서가 크게 줄고, 스크롤을 내린 상태였다면 브라우저가
  // 오프셋을 잘라낸다. 문제는 **그 잘라내기 자체**다 — iOS 스크롤 스레드가 접기 전 오프셋을 35~40ms
  // 뒤에 되돌려 보내 2프레임 동안 페이지 전체가 옛 오프셋으로 다시 그려진다(실기기 프레임 계측:
  // 정상 프레임 하나 뒤에 `y1065 h-1065`, 밀린 거리 = 잘린 양). 잘려야 할 오프셋이 없으면 되돌려
  // 보낼 옛 값도 없다.
  //
  // 그래서 **접기 전에**, 문서 높이가 아직 그대로일 때 접은 뒤의 최대 스크롤로 먼저 옮기고 다음
  // 프레임에 접는다. 이때의 scrollTo 는 레이아웃 변경과 무관한 평범한 스크롤이라 스크롤 스레드가
  // 제 방식대로 처리하면 그만이다 — 이미 잘린 뒤에 불러 아무 일도 하지 못했던 [[ADR-084]]의 호출과
  // 다른 점이 그것이다.
  const collapse = (): void => {
    const shell = shellRef.current
    const header = headerRef.current
    const scroller = scrollRoot.current
    const removedHeight =
      shell === null || header === null
        ? 0
        : shell.getBoundingClientRect().height - header.getBoundingClientRect().height
    if (scroller === null) {
      setIsExpanded(false)
      return
    }
    // ADR-100 결정 4: 스크롤 주체가 문서가 아니라 이 화면의 컨테이너다 — 읽는 값도 전부 그쪽이다.
    const nextMaxScroll = Math.max(0, scroller.scrollHeight - removedHeight - scroller.clientHeight)
    if (scroller.scrollTop <= nextMaxScroll) {
      setIsExpanded(false)
      return
    }
    scroller.scrollTo(0, nextMaxScroll)
    requestAnimationFrame(() => setIsExpanded(false))
  }

  const { group } = props
  const totalMeso = groupTotalMeso(group)
  // 이 주차에 고가 아이템 드롭이 기록됐을 때: 카드에 골드 회전샤인 테두리/글로우(valuable-drop-card) +
  // 우상단 획득 아이템 배지를 준다. 접힘/펼침 모두 회전 샤인 테두리·글로우·배지는 유지하되, 펼치면
  // 글로우 맥동만 멈춘다(valuable-drop-card--expanded → 회전 샤인은 계속 돌고 글로우 확산만 정적). 추가로
  // 펼쳤을 때는 고가 아이템을 획득한 보스 행(valuable-drop-row, 배경 효과)에도 강조가 들어간다.
  const valuableDrops = collectGroupValuableDrops(group, dropsByRowKey)
  const hasValuable = valuableDrops.length > 0
  // 처치 진행 링은 두 탭 · 모든 기간에 그리고, 무엇을 세는지는 탭이 정한다([[ADR-059]] — 기간
  // 한정을 폐기했다. 과거 rows도 DB 기록에서 오고 그 행은 전부 isComplete: true라 파생식이 그대로
  // 성립한다). 월간 탭은 주간 처치 수를 끌어오지 않는다 — 월간 rows에는 주간 행 자체가 없고(주간분은
  // 금액 합계 행으로만 존재), 12는 주 단위로 초기화되는 한도라 월 단위로 곱한 분모는 게임에 없다.
  const clearProgress =
    tab === 'weekly'
      ? { cleared: countGroupClearedWeeklyBosses(group), total: WEEKLY_BOSS_CLEAR_LIMIT, cycle: tab }
      : { cleared: countGroupClearedMonthlyBosses(group), total: MONTHLY_BOSS_COUNT, cycle: tab }
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

    // ADR-100 결정 4: 문서가 아니라 컨테이너가 스크롤되므로 window 에는 scroll 이 오지 않는다 —
    // 옮기지 않으면 스크롤해도 팝오버가 안 닫힌다(조용히 죽는 회귀).
    const scroller = scrollRoot.current
    document.addEventListener('pointerdown', closeOnOutside, true)
    scroller?.addEventListener('scroll', closeOnScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside, true)
      scroller?.removeEventListener('scroll', closeOnScroll)
    }
  }, [isIssueOpen, scrollRoot])

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
            <div className="sticky z-10 h-0" style={{ top: stickyOffset(props.stickyTop + BADGE_TOP_OFFSET) }}>
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
              top: stickyOffset(props.stickyTop + headerHeight),
              maskImage: 'linear-gradient(to bottom, black, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
            }}
          />
        </div>
      )}

      <div ref={shellRef} className={shellClass}>
        <button
          ref={headerRef}
          type="button"
          onClick={() => {
            // 카드를 펼치거나 접으면 설명 팝오버를 닫는다(사용자 지적 2026-07-31). 바깥 탭 판정은
            // 카드 루트를 "안"으로 보므로 헤더 클릭으로는 닫히지 않았다. 게다가 펼침은 레이아웃을
            // 바꿔 열기 직전에 실측한 팝오버 위치가 낡은 값이 된다 — 닫는 것이 두 문제를 함께 없앤다.
            setIsIssueOpen(false)
            if (!isExpanded) {
              setIsExpanded(true)
              return
            }
            collapse()
          }}
          // 펼침 헤더는 카드 안에서 sticky로 고정한다(ADR-047) — top은 페이지 sticky 헤더 실측 높이라
          // 그 바로 아래에 붙고, bg-surface가 밑으로 지나가는 보스 행을 가린다. z-[5]는 드롭 아이콘
          // (relative + inline zIndex 1~3) 위 · 고가 드롭 배지(z-10, ADR-045) 아래 층.
          // 헤더는 라운딩 없이 "사각"이다(ADR-049) — 셸의 overflow-clip이 대신 깎는다. rounded-t-[14px]를
          // 주면 stuck 상태에서 모서리 안쪽이 투명이라 그 아래를 지나가는 보스 행이 비친다(사용자 보고).
          // 셸 클리핑은 카드 자신의 모서리에서만 일어나므로 stuck 헤더의 라운딩을 덮어주지 못한다 —
          // 반대로 헤더가 사각이면 카드 최상단(= 클리핑 곡선과 일치)에서 클리핑이 라운딩을 만들어준다.
          style={isExpanded ? { top: stickyOffset(props.stickyTop) } : undefined}
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
            <AnimatedMeso
              identity={`character|${group.ocid}|${loadedTab}|${loadedPeriodKey}`}
              value={totalMeso}
            />{' '}
            메소
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden="true" />
          )}
        </button>

        {isExpanded &&
          (tab === 'weekly' ? (
            <WeeklyAccordionBody rows={group.bossRows} />
          ) : (
            <MonthlyAccordionBody
              bossRows={group.bossRows}
              weeklySubtotals={group.weeklySubtotals}
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
    loadedTab,
    loadedPeriodKey,
    rows,
    weeklySubtotals,
    isPeriodLoading,
    periodState,
    previousPeriodTotalMeso,
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

  // 히스토리 오버레이(`/profit/drops`)를 여닫는 이동 전용이다 — 그 화면은 자기 스크롤 컨테이너를
  // 갖고, 돌아왔을 때 이 화면의 스크롤이 유지되는 것이 [[ADR-077]] 의 계약이라 스크롤을 건드리면 안
  // 된다. 화면을 통째로 바꾸는 이동은 아래 navigateToScreen 을 쓴다([[ADR-098]] 결정 1).
  const navigate = useNavigate()
  const navigateToScreen = useScreenNavigate()

  // ADR-063: 동기화 전체 실패는 토스트로 알린다. 기간 라벨·"n분 전" 표기가 남아 맥락은 화면에 있다.
  useScheduleSyncErrorToast(error, {
    onRetry: () => refresh(trackedOcids ?? []),
    onOpenSettings: () => navigateToScreen('/settings'),
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
  // ADR-100: 이 화면의 스크롤 주체. 문서가 아니라 이 요소가 스크롤되므로 스크롤 상태가 화면과
  // 함께 태어나고 함께 죽는다(히스토리 오버레이 왕복에서도 이 컨테이너는 언마운트되지 않는다).
  const scrollRootRef = useRef<HTMLDivElement>(null)

  const pullToRefresh = usePullToRefresh({
    enabled: !isEmpty && canRefreshPeriod,
    isRefreshing: status === 'loading',
    onRefresh: () => refresh(trackedOcids ?? []),
    // ADR-100 결정 4: 최상단 판정도 문서가 아니라 이 화면의 컨테이너 기준이다.
    scrollRoot: scrollRootRef,
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
    // ADR-100 결정 4: 스크롤 주체가 컨테이너다. 마운트 시점엔 ref 가 이미 붙어 있다(레이아웃 이펙트).
    scrollRootRef.current?.scrollTo(0, 0)
  }, [tab, periodKey])

  // ADR-085 결정 1: 헤더가 fixed 라 흐름에서 빠졌고, 목록은 이 실측 높이의 spacer 로 자리를 받는다.
  // 그래서 **페인트 전에** 재야 한다 — useEffect 로 재면 첫 프레임에 spacer 가 0이라 목록이 위로 튄다.
  useLayoutEffect(() => {
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
              onClick: () => navigateToScreen('/boss?openPicker=1'),
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

  // 기간·탭 맥락과 스토어 바인딩을 자손에게 내린다(ADR-094 3단계) — 이 8개는 4단계를 타고
  // 내려가며 51지점을 만들고 있었고, 중간 컴포넌트는 어느 것도 쓰지 않고 통과만 시켰다.
  // 참조 동일성을 위한 메모이제이션은 하지 않는다 — 성능 문제의 증거가 없고(ADR-094 결정 5),
  // 이 값들은 어차피 렌더마다 바뀌어 소비처가 다시 그려지는 것이 정상이다.
  const bossProfitContext: BossProfitContextValue = {
    tab,
    periodKey,
    loadedTab,
    loadedPeriodKey,
    now,
    dropsByRowKey,
    setPartySize,
    setBossDrops,
    isMonthlyBossQueryable: periodQueryable,
    onRetryPeriod: () => void retryPeriod(),
    scrollRoot: scrollRootRef,
  }

  return (
    // ADR-077: 히스토리 오버레이(<Outlet />)는 아래 space-y-4 루트 **바깥**에 둔다 — 그 유틸리티는
    // 형제에게 margin-top을 주는데, fixed inset-0 오버레이에 그 마진이 걸리면 1rem 밀려 그려진다.
    <BossProfitContextProvider value={bossProfitContext}>
    {/* ADR-100 결정 1·2(정정): 스크롤의 소유자가 문서가 아니라 이 화면이다. **고정 헤더와 spacer 는
        래퍼 하나로 묶어 셸 *안*에 둔다** — 스크롤 인디케이터는 스크롤포트 위에 겹쳐 그려지므로,
        헤더를 셸 바깥 형제로 두면 그 헤더(z-10)가 인디케이터를 가린다(실기기 관측 2026-08-06).
        래퍼로 묶는 것이 요점이다: 벌거벗은 채로 넣으면 셸 안쪽 `space-y-4` 의 마진이 spacer 에
        얹혀 목록이 16px 내려간다([[ADR-085]] 결정 1의 함정 — 공용 `PageHeader` 도 같은 이유로
        [고정 헤더 + spacer] 를 한 <div> 로 감싼다). 히스토리 오버레이만 셸 바깥이다([[ADR-077]]). */}
    <ScreenScroll ref={scrollRootRef}>
      <div>
        {/* 제목~총 수익 카드까지는 화면 상단에 고정하고 그 아래 캐릭터 아코디언 목록만
            스크롤되게 한다(사용자 요청, 2026-07-14).

            **이 화면만 `fixed` 다**([[ADR-085]] 결정 1, 다른 4개 화면은 공용 sticky 레시피 그대로).
            `sticky` 요소의 화면 위치는 스크롤 오프셋의 함수라, iOS 스크롤 스레드가 접기 전 오프셋을
            뒤늦게 되돌려 보내는 프레임에 헤더가 화면 밖(`-1065px`)으로 날아갔다(실기기 프레임 계측).
            `fixed` 는 뷰포트 기준이라 그 의존 자체가 없다. 이 헤더는 문서 최상단의 첫 요소라 원래도
            모든 스크롤 위치에서 뷰포트 상단에 붙어 있었으므로 **보이는 모습은 동일**하다 — 바뀌는 것은
            그 위치를 무엇이 정하느냐뿐이다. 흐름에서 빠진 자리는 아래 spacer 가 실측 높이로 채운다.

            루트(`space-y-4`) **바깥**에 둔다 — 흐름과 무관한 것을 흐름 컨테이너에 넣으면 그 유틸리티의
            `margin-top` 이 spacer 위에 얹혀 목록이 16px 더 내려간다([[ADR-077]] 결정 3과 같은 이유). */}
        <div ref={stickyHeaderRef} className="fixed inset-x-0 top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
          {/* ADR-088 결정 5-1: 헤더 자리의 테마 배경 조각(배경 없는 테마에선 렌더 안 됨) */}
          <ThemeHeaderBackdrop />
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
                    {/* [[ADR-087]] 정정 1: 이 키에만 기간이 없다 — 기간이 바뀌어도 같은 자리의 같은
                        뜻을 가진 하나의 숫자로 보고 굴린다("기간 이동은 총 수익만", 사용자 결정). */}
                    <AnimatedMeso identity={`total|${loadedTab}`} value={totalMeso} />{' '}
                    <span className="text-xs font-bold text-text-muted">메소</span>
                  </p>
                  {/* ADR-087 결정 1: 라벨행이 아니라 이 줄에 붙는다 — 32px 금액행 안에 들어가므로
                      헤더 높이가 늘지 않는다(라벨행 h-6 제약과도 무관하다). */}
                  <DeltaChip
                    totalMeso={totalMeso}
                    previousMeso={previousPeriodTotalMeso}
                    tab={tab}
                    periodKey={periodKey}
                    now={now}
                  />
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

        {/* ADR-085 결정 1: fixed 헤더가 흐름에서 빠진 자리 — 실측 높이 그대로. */}
        <div aria-hidden="true" style={{ height: stickyHeaderHeight }} />
      </div>

      {/* ADR-073 결정 1·2: 헤더는 sticky로 제자리에 두고 이 목록 블록만 손가락을 따라 내려간다.
          마진·높이가 아니라 transform 이라 터치 프레임마다의 리플로우가 없고, 헤더의 실측
          높이(stickyHeaderHeight)도 건드리지 않는다. 오프셋이 0이면 transform 을 아예 걸지
          않는다(결정 3) — translateY(0px) 조차 containing block·stacking context를 만들어 sticky
          후손(ADR-047 중첩 카드 헤더)의 기준을 바꾼다. 당김은 컨테이너가 최상단일 때만 시작되므로
          ([[ADR-072]] 결정 2 · [[ADR-100]] 결정 4) 당기는 순간엔 멈춘(stuck) 카드 헤더가 없어 stickyTop 을 보정할 대상도
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
              issue={characterIssues[group.ocid]}
              stickyTop={stickyHeaderHeight}
            />
          ))}
      </div>
    </ScreenScroll>
    <Outlet />
    </BossProfitContextProvider>
  )
}

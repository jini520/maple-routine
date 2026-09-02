// 캐릭터 카드(아코디언) — 웹에서는 `BossProfitScreen.tsx` 안에 인라인이던 것이 파일로 나왔다.
//
// **나눈 이유는 줄 수가 아니라 관심사다**([[ADR-094]] 결정 7). 이 카드는 화면과 다른 것을 안다 —
// 펼침 상태 · 고가 드롭 강조([[ADR-045]]) · 실패 배지와 그 팝오버의 **비동기 측정**([[ADR-068]]
// 결정 3) · 아이템 내역 상자([[ADR-124]] 결정 7). 화면은 기간·탭·목록을 안다. 웹이 한 파일이었던
// 것은 그 파일이 이미 1,026줄이라 더 나눌 엄두를 못 낸 쪽에 가깝다.
//
// ══ 못 옮긴 것 — **중첩 sticky**([[ADR-047]]) ═══════════════════════════════════════
//
// 펼친 카드 헤더가 페이지 헤더 아래에 멈추지 않는다. 근거와 되살리는 두 길은
// `BossProfitScreen.contract.md` «못 옮긴 것» 에 있고, 요약하면 이렇다 — RN 의 sticky
// (`stickyHeaderIndices`)는 **스크롤 뷰의 직계 자식**만 붙일 수 있어 목록을 [헤더, 본문, 헤더, …]
// 로 펴야 하는데 그러면 [[ADR-045]] 의 카드 링이 두 조각으로 갈려 이음매가 생기고([[ADR-049]] 의
// 셸 클리핑도 자를 상자를 잃는다), 손수 만드는 길은 공용 `ScreenScroll` 을 `Animated.ScrollView`
// 로 바꿔야 하는 데다 **jest 가 한 줄도 검증하지 못한다**(레이아웃이 없어 sticky 가 발동하지 않는다).
//
// 그래서 딸린 셋도 함께 없다 — 배지 sticky 레일([[ADR-047]] 후속 2) · stuck 헤더 하단 페이드
// (후속 1) · 페이지 헤더 실측을 받던 `stickyTop` 프롭([[ADR-100]] 결정 3). **배지는 펼침·접힘 모두
// [[ADR-045]] 의 원래 구조**(`absolute -right-1.5 -top-2`)를 쓴다 — 레일이 없으면 그것이 맞는
// 자리이고, 웹도 접힘에서는 그 구조였다.
//
// ══ 고가 드롭 강조가 CSS 에서 값으로 내려온다 ([[ADR-045]]) ═════════════════════════
//
// 웹은 `index.css` 의 `.valuable-drop-card` 한 덩어리(글로우 `box-shadow` + `::before` conic 링 +
// `@media (prefers-reduced-motion)` 안의 두 애니메이션)였다. RN 에서 셋으로 갈린다.
//
// ① **회전 샤인 링 → 정적 골드 2px 테두리.** RN 에는 conic-gradient 도 `mask-composite: xor` 도
//    없다. 다만 이것은 임시방편이 아니라 **[[ADR-045]] 가 정해 둔 degrade 경로 그대로**다 —
//    그 결정은 `@property` 미지원 WebView 를 위해 *"정적 골드 테두리로 자연 degrade"* 를 이미
//    설계했고(`--vd-angle` 의 `initial-value: 0deg`), 그 폴백이 그리는 것이 정확히 이 그림이다.
//    반경은 [[ADR-049]] 결정 3 대로 펼침 13 · 접힘 14 다.
// ② **글로우 맥동 → `boxShadow` 두 겹의 교차 페이드.** RN 은 `box-shadow` 를 키프레임으로
//    보간하지 않으므로 파라미터를 굴릴 수 없다. 대신 두 끝점(0%/100% 와 50%)을 각각 가진 겹을
//    반대 방향 `opacity` 로 교차시킨다 — **끝점 둘은 웹과 정확히 같고** 중간만 파라미터 보간이
//    아니라 알파 교차다. 그 두 끝점을 웹 CSS 와 대조하던 `keyframes-parity.test.ts` 는 웹 소스와
//    함께 지워졌다([[ADR-155]]·[[ADR-156]]). 지금 끝점을 지키는 것은 `valuable-card-glow.ts` 의
//    출처 표기뿐이다.
// ③ **펼치면 맥동만 멈춘다**(결정 4). 웹은 복합 선택자로 `animation: none` 을 덮었고, 여기서는
//    맥동 겹을 렌더하지 않고 정적 폴백 그림자만 남긴다. 그것이 웹의 `animation: none` 이 고정하는
//    바로 그 값(`.valuable-drop-card` 의 `box-shadow`)이다.
//
// 맥동 겹이 **셸 안이 아니라 카드 루트에 붙는** 것이 짝이 되는 조건이다. 펼침 셸은 자식을 잘라내므로
// ([[ADR-049]]) 안에 두면 밖으로 번지는 그림자가 잘린다 — 웹에서 그 그림자가 셸 **자신의**
// `box-shadow` 라 `overflow: clip` 에 안 잘렸던 것과 같은 결과를 다른 방법으로 얻는다.
//
// ══ 그 밖에 갈린 것 넷 ═════════════════════════════════════════════════════════════
//
// ① **실패 배지의 팝오버 위치를 여기서 잰다.** 웹의 `measureIssueAnchor(card, money)` 는 동기
//    호출이었고 RN 의 측정은 콜백이라, step 6 이 환산(`resolveIssueAnchor`)만 남기고 재는 일을
//    호출부로 내보냈다. 두 상자를 **같은 기준**(윈도우)에서 재야 뺄셈이 성립한다.
// ② **바깥 탭·스크롤로 닫는 코드가 없다.** 웹은 `document` 의 캡처 리스너와 스크롤 컨테이너의
//    `scroll` 을 들었다([[ADR-100]] 결정 4). RN 에는 전역 탭 신호가 없고, 이 팝오버는 `fixed` 가
//    아니라 **카드 안 절대배치**라 스크롤하면 카드와 함께 움직여 "어느 카드의 것인지"를 잃지
//    않는다. 닫는 길은 팝오버 자신의 `닫기` 와 헤더 탭 둘이다(헤더 탭은 웹에도 있었다).
// ③ **아이템 칩이 `<span role="button">` 에서 `Pressable` 이 된다.** 웹이 span 을 쓴 이유는 카드
//    헤더가 `<button>` 이라 중첩 인터랙티브가 되기 때문이었고(그래서 `stopPropagation` +
//    `preventDefault` + `tabIndex` + `onKeyDown` 네 줄을 손으로 달았다), RN 은 터치를 가장 깊은
//    곳이 가져가므로 중첩이 정상이다 — 그 네 줄이 함께 사라진다(`CharacterIssueBadge` 와 같은 자리).
// ④ **접기가 상태만 바꾼다**([[ADR-102]] 결정 1)는 계약은 **코드가 없어서** 지켜진다. 여기에
//    스크롤 조작을 다시 넣지 말 것 — 웹에서 그것이 정확히 [[ADR-085]] 결정 2 였고 두 프레임으로
//    갈려 페이지가 튀었다.
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { formatMesoShort } from '../../lib/boss/boss-profit-delta'
import { sumDropPayout } from '../../lib/drop/drop-price'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'
import type { PopoverAnchorGeometry } from '../../lib/popover-anchor'
import weeklyBossesData from '../../data/weekly-bosses.json'

import { AnimatedNumber, ChevronDownIcon, ChevronUpIcon, Text } from '../../components/atoms'
import { ValuableDropBadge } from '../../components/molecules/ValuableDropBadge/ValuableDropBadge'
import { AnimatedView } from '../../lib/nativewind-interop'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { MonthlyAccordionBody, WeeklyAccordionBody } from './AccordionBody'
import { useBossProfitContext } from './boss-profit-context'
import { CharacterPortrait } from '../../components/molecules/CharacterPortrait/CharacterPortrait'
import {
  CharacterIssueBadge,
  CharacterIssuePopover,
  resolveIssueAnchor,
  ISSUE_POPOVER_EDGE_GAP,
  ISSUE_POPOVER_WIDTH,
  type CharacterIssue,
} from './CharacterIssue'
import {
  collectGroupDrops,
  collectGroupValuableDrops,
  countGroupClearedMonthlyBosses,
  countGroupClearedWeeklyBosses,
  groupTotalMeso,
  type CharacterGroup,
} from './character-groups'
import { ItemRevenuePopover, useAnchoredPopover, type PopoverAnchorRect } from './ItemRevenuePopover'
import {
  VALUABLE_CARD_GLOW_HIGH,
  VALUABLE_CARD_GLOW_HIGH_FADE,
  VALUABLE_CARD_GLOW_LOW,
  VALUABLE_CARD_GLOW_LOW_FADE,
  VALUABLE_CARD_GLOW_STATIC,
  VALUABLE_CARD_RING_COLOR,
  VALUABLE_CARD_RING_RADIUS,
  VALUABLE_CARD_RING_WIDTH,
} from './valuable-card-glow'

// 월간 탭 진행 링의 분모([[ADR-059]] 결정 4) — 리터럴 1이 아니라 참조 데이터에서 파생한다. 월간
// 보스가 늘면 링 칸 수가 따라 늘어 "데이터는 2종인데 링은 1칸"이 될 수 없다. `boss-matching` 의
// 두 한도와 나란히 두지 않는 이유는 성격이 달라서다 — 그쪽은 게임이 정한 한도이고 이건 "우리가
// 추적하는 월간 보스 종류 수"라 이 화면만 쓴다.
const MONTHLY_BOSS_COUNT = weeklyBossesData.monthly.length

/**
 * 카드 강조 — 글로우(카드 루트에 붙는 그림자 겹)와 링(셸 위에 얹는 골드 테두리)을 함께 낸다.
 *
 * 둘을 한 컴포넌트로 두지 않고 둘로 나누는 이유는 **붙는 자리가 다르기** 때문이다: 글로우는 밖으로
 * 번져야 해서 잘리지 않는 카드 루트에, 링은 셸 모양을 따라야 해서 셸 안에 붙는다(파일 머리).
 */
function ValuableCardGlow(props: { isExpanded: boolean }): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  // 펼침([[ADR-045]] 결정 4)과 모션 줄이기는 같은 그림에 도달한다 — 정적 폴백 하나.
  if (props.isExpanded || reduceMotion) {
    return (
      <View
        testID="valuable-drop-card-glow-static"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: 14, boxShadow: [...VALUABLE_CARD_GLOW_STATIC] }]}
      />
    )
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <AnimatedView
        testID="valuable-drop-card-glow-low"
        style={[StyleSheet.absoluteFill, { borderRadius: 14, boxShadow: [...VALUABLE_CARD_GLOW_LOW] }, VALUABLE_CARD_GLOW_LOW_FADE]}
      />
      <AnimatedView
        testID="valuable-drop-card-glow-high"
        style={[StyleSheet.absoluteFill, { borderRadius: 14, boxShadow: [...VALUABLE_CARD_GLOW_HIGH] }, VALUABLE_CARD_GLOW_HIGH_FADE]}
      />
    </View>
  )
}

/**
 * 골드 테두리 — 웹 `::before` 회전 샤인 링의 **degrade 그림**(파일 머리 ①).
 *
 * 반경은 [[ADR-049]] 결정 3 을 그대로 따른다: 펼침 셸은 자식을 **패딩 박스**(반경 13 = 14 − 테두리
 * 1)에서 자르므로 링도 13, 접힘 셸은 테두리가 없어 14 다.
 */
function ValuableCardRing(props: { isExpanded: boolean }): React.JSX.Element {
  return (
    <View
      testID="valuable-drop-card-ring"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderWidth: VALUABLE_CARD_RING_WIDTH,
          borderColor: VALUABLE_CARD_RING_COLOR,
          borderRadius: props.isExpanded
            ? VALUABLE_CARD_RING_RADIUS.expanded
            : VALUABLE_CARD_RING_RADIUS.collapsed,
        },
      ]}
    />
  )
}

/**
 * 아이템 칩이 있을 때만 금액을 세로 스택으로 감싼다 — 없으면 자식을 그대로 흘려보낸다.
 *
 * **값을 안 매긴 카드는 뷰가 한 겹도 늘지 않는다**([[ADR-124]] 결정 7 · [[ADR-094]] 결정 4) —
 * 웹에서 스냅샷이 이것을 두 번 잡아냈다(래퍼 `span`, `nowrap` 클래스 누출).
 */
function ItemAwareMoney(props: { wrap: boolean; children: React.ReactNode }): React.JSX.Element {
  if (!props.wrap) return <>{props.children}</>
  return <View className="items-end gap-1">{props.children}</View>
}

export function CharacterAccordion(props: {
  group: CharacterGroup
  /** [[ADR-068]] 결정 3: 이 캐릭터의 동기화가 실패했으면 그 종류(없으면 `undefined`). */
  issue?: CharacterIssue
}): React.JSX.Element {
  const { tab, loadedTab, loadedPeriodKey, dropsByRowKey } = useBossProfitContext()
  const [isExpanded, setIsExpanded] = useState(false)
  // [[ADR-068]] 결정 3 정정 3: 아이콘만으로는 원인을 말할 수 없어, 탭하면 설명 팝오버를 연다.
  const [isIssueOpen, setIsIssueOpen] = useState(false)
  const [issueGeometry, setIssueGeometry] = useState<PopoverAnchorGeometry>({
    left: ISSUE_POPOVER_EDGE_GAP,
    caretLeft: ISSUE_POPOVER_WIDTH / 2,
  })
  // 팝오버 가로 위치를 정하려면 **카드와 금액 두 상자**가 필요하다(금액 폭이 자릿수에 따라 변해
  // 배지의 x 를 고정값으로 알 수 없다). state 가 아니라 ref 인 것은 이 값을 **렌더가 읽지 않기**
  // 때문이다 — 재는 일은 배지를 탭한 뒤에만 일어난다(state 로 두면 카드마다 마운트 렌더가 한 번 는다).
  const cardRef = useRef<View | null>(null)
  const moneyRef = useRef<View | null>(null)
  const {
    ref: itemChipRef,
    isOpen: isItemPopoverOpen,
    anchor: itemAnchor,
    toggle: toggleItemPopover,
    close: closeItemPopover,
  } = useAnchoredPopover()

  const { group } = props
  const totalMeso = groupTotalMeso(group, dropsByRowKey)
  // 이 기간에 고가 아이템을 먹었을 때: 카드에 골드 링 + 글로우 + 우상단 획득 아이템 배지.
  const valuableDrops = collectGroupValuableDrops(group, dropsByRowKey)
  const hasValuable = valuableDrops.length > 0
  const groupDrops = collectGroupDrops(group, dropsByRowKey)
  // 월간 탭에서는 주간 보스 수익이 **주차 소계로 뭉쳐** 들어오므로 그 안의 아이템분도 더해야 카드
  // 합계와 맞는다 — 낱개로는 못 꺼내지만 합은 안다([[ADR-071]] 결정 10 과 같은 구조적 한계).
  const itemTotal =
    sumDropPayout(groupDrops) +
    group.weeklySubtotals.reduce((sum, subtotal) => sum + sumDropPayout(subtotal.drops), 0)
  const hasItemRevenue = itemTotal > 0
  // 낱개가 없는 몫은 **주차 한 줄씩** 말한다. 라벨을 `N주차` 로 고정하는 이유는
  // `formatBossProfitPeriodLabel` 이 최근 두 주만 "이번 주"/"지난 주"로 불러 줄이 어긋나기 때문이다.
  const weeklyItemLines = group.weeklySubtotals
    .map((subtotal, index) => ({
      periodKey: subtotal.periodKey,
      label: `${index + 1}주차`,
      meso: sumDropPayout(subtotal.drops),
    }))
    .filter((line) => line.meso > 0)

  // 처치 진행 링은 두 탭 · 모든 기간에 그리고, 무엇을 세는지는 탭이 정한다([[ADR-059]]). 월간 탭은
  // 주간 처치 수를 끌어오지 않는다 — 월간 rows 에 주간 행 자체가 없고, 12는 주 단위로 초기화되는
  // 한도라 월 단위로 곱한 분모는 게임에 없다([[ADR-006]]).
  const clearProgress =
    tab === 'weekly'
      ? { cleared: countGroupClearedWeeklyBosses(group), total: WEEKLY_BOSS_CLEAR_LIMIT, cycle: tab }
      : { cleared: countGroupClearedMonthlyBosses(group), total: MONTHLY_BOSS_COUNT, cycle: tab }

  /**
   * 배지를 탭하면 두 상자를 재서 팝오버를 앉힌다(파일 머리 ①).
   *
   * 측정이 오기 전에도 팝오버는 뜬다 — `resolveIssueAnchor` 의 기본 기하(왼쪽 끝)로 서 있다가
   * 다음 프레임에 제자리를 잡는다. 웹은 동기라 이 틈이 없었다.
   */
  function toggleIssue(): void {
    if (isIssueOpen) {
      setIsIssueOpen(false)
      return
    }
    setIsIssueOpen(true)
    const card = cardRef.current
    const money = moneyRef.current
    if (card === null || money === null) return
    card.measureInWindow((cx, cy, cw, ch) => {
      const cardRect: PopoverAnchorRect = { left: cx, top: cy, width: cw, height: ch }
      money.measureInWindow((mx, my, mw, mh) => {
        setIssueGeometry(resolveIssueAnchor(cardRect, { left: mx, top: my, width: mw, height: mh }))
      })
    })
  }

  return (
    // 웹의 `isolate` 는 배지의 `z-10` 을 카드 안에 가두는 장치였다. RN 은 형제 순서가 곧 그리는
    // 순서이고 `zIndex` 도 부모 안에서만 겨루므로 그 격리가 기본값이다 — 새어나갈 곳이 없다.
    <View
      ref={cardRef}
      testID="character-accordion"
      className={isIssueOpen ? 'relative z-[9]' : 'relative'}
    >
      {/* 글로우는 셸 **바깥**이다 — 셸은 펼침 상태에서 자식을 잘라내므로([[ADR-049]]) 안에 두면
          밖으로 번지는 그림자가 잘린다(파일 머리 ②). */}
      {hasValuable && <ValuableCardGlow isExpanded={isExpanded} />}

      {props.issue !== undefined && isIssueOpen && (
        <CharacterIssuePopover
          issue={props.issue}
          geometry={issueGeometry}
          onClose={() => setIsIssueOpen(false)}
        />
      )}

      {/* 아이템 내역은 별도 네이티브 윈도우로 화면 위에 뜬다(step 6) — 보스 행이 쓰는 것과 같은
          컴포넌트다. 카드 셸의 클리핑을 피하는 것이 그 선택의 이유이고, 웹의 포털+`fixed` 와
          성질이 같다. */}
      {isItemPopoverOpen && (
        <ItemRevenuePopover
          drops={groupDrops}
          weeklyLines={weeklyItemLines}
          crystalMeso={totalMeso - itemTotal}
          itemMeso={itemTotal}
          anchor={itemAnchor}
          onClose={closeItemPopover}
        />
      )}

      {/* 배지는 셸 바깥·카드 우상단이다([[ADR-045]]). 펼침에도 같은 자리인 것이 웹과 갈리는
          지점이고(레일이 sticky 와 함께 사라졌다, 파일 머리), 웹의 접힘 구조 그대로다. */}
      {hasValuable && (
        <ValuableDropBadge
          drops={valuableDrops}
          label="고가 드롭"
          className="absolute -right-1.5 -top-2 z-10"
        />
      )}

      <View
        className={
          isExpanded
            ? 'overflow-hidden rounded-[14px] border border-border bg-surface'
            : undefined
        }
      >
        {/* 상하 패딩이 `p-4`(16)가 아니라 `py-3`(12)인 것은 아바타 슬롯이 진행 링 때문에 32 → 40px
            로 커진 만큼 돌려받은 것이다([[ADR-054]] 정정 6) — 헤더 높이는 링 도입 전과 같은 64px
            (12 + 40 + 12). 좌우는 보스 행(`p-4`)과 맞춰 16px 유지. */}
        <Pressable
          role="button"
          aria-expanded={isExpanded}
          // [[ADR-102]] 결정 1: 접기는 **상태만 바꾼다.** 여기에 스크롤 조작을 다시 넣지 말 것.
          onPress={() => {
            // 카드를 여닫으면 설명 팝오버를 닫는다 — 펼침이 레이아웃을 바꿔 열기 직전에 잰 위치가
            // 낡은 값이 되고, 헤더 탭은 팝오버 바깥 탭으로 잡히지도 않는다(웹과 같은 이유).
            setIsIssueOpen(false)
            setIsExpanded((expanded) => !expanded)
          }}
          className={
            isExpanded
              ? 'w-full flex-row items-center gap-3 bg-surface px-4 py-3'
              : 'w-full flex-row items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3'
          }
        >
          <CharacterPortrait
            variant="compact"
            characterName={group.characterName}
            imageUrl={group.imageUrl}
            clears={{
              cleared: clearProgress.cleared,
              total: clearProgress.total,
              label: clearProgress.cycle === 'weekly' ? '주간' : '월간',
            }}
          />
          <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-text">
            {group.characterName}
          </Text>
          {/* 숫자 표기(n/12)는 보류 상태 그대로다([[ADR-054]] 정정 7) — 헤더 가로폭을 캐릭터명과
              다투는 문제가 안 풀렸다. 진행률은 아바타 링이 표현한다. */}

          <ItemAwareMoney wrap={hasItemRevenue}>
            {/* 실패 배지의 절대배치 기준이자 팝오버 가로 위치의 기준 상자다. 아이템이 섞이면
                **금액 색이 달라진다**([[ADR-124]] 결정 7) — 새 색을 만들지 않고 보스 행의
                `아이템 +N` 칩과 같은 `primary-ink` 를 쓴다. */}
            <View ref={moneyRef} className="relative flex-row items-center">
              {props.issue !== undefined && (
                <CharacterIssueBadge issue={props.issue} onToggle={toggleIssue} />
              )}
              <Text
                className={`text-sm font-bold ${hasItemRevenue ? 'text-primary-ink' : 'text-text'}`}
                style={TABULAR_NUMS}
              >
                <AnimatedNumber
                  identity={`character|${group.ocid}|${loadedTab}|${loadedPeriodKey}`}
                  value={totalMeso}
                />
                {' 메소'}
              </Text>
            </View>

            {hasItemRevenue && (
              <Pressable
                ref={itemChipRef}
                role="button"
                aria-label={`${group.characterName} 아이템 수익 확인`}
                aria-expanded={isItemPopoverOpen}
                onPress={toggleItemPopover}
                className="h-5 shrink-0 flex-row items-center rounded-full bg-primary-tint px-2"
              >
                <Text
                  className="text-11 font-bold leading-none text-primary-ink"
                  style={TABULAR_NUMS}
                >
                  아이템 +{formatMesoShort(itemTotal)}
                </Text>
              </Pressable>
            )}
          </ItemAwareMoney>

          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
          )}
        </Pressable>

        {isExpanded &&
          (tab === 'weekly' ? (
            <WeeklyAccordionBody rows={group.bossRows} />
          ) : (
            <MonthlyAccordionBody bossRows={group.bossRows} weeklySubtotals={group.weeklySubtotals} />
          ))}

        {/* 링은 셸 **안**의 마지막 자식이라 콘텐츠 위에 그려진다 — 웹이 `::before` 에 `z-index: 6`
            을 준 것과 같은 자리다([[ADR-047]] 결정 4). */}
        {hasValuable && <ValuableCardRing isExpanded={isExpanded} />}
      </View>
    </View>
  )
}

/**
 * 보스 수익 화면의 캐릭터 카드. 펼침·고가 드롭 강조·실패 배지·아이템 내역을 갖는 아코디언.
 *
 * 화면과 나눈 것은 줄 수가 아니라 관심사다. 화면은 기간·탭·목록을 알고 이 카드는 펼침 상태와
 * 카드 안의 것들을 안다.
 *
 * 고가 드롭 강조가 셋으로 갈려 있다.
 *
 * ① 회전 샤인 링 대신 **정적 골드 2px 테두리**다. RN 에 conic-gradient 도 `mask-composite` 도 없다.
 * ② 글로우 맥동은 **`boxShadow` 두 겹의 교차 페이드**다. RN 이 그림자를 키프레임으로 보간하지
 *    않아서 파라미터를 못 굴린다. 두 끝점은 같고 중간만 알파 교차다.
 * ③ 모션 줄이기면 정적 테두리만 남는다.
 *
 * @see docs/features/boss-profit.md 정책
 */
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
import { CharacterPortrait } from '../../components/organisms/CharacterPortrait/CharacterPortrait'
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

// 월간 탭 진행 링의 분모. 리터럴 1이 아니라 참조 데이터에서 파생한다. 월간
// 보스가 늘면 링 칸 수가 따라 늘어 "데이터는 2종인데 링은 1칸"이 될 수 없다. `boss-matching` 의
// 두 한도와 나란히 두지 않는 이유는 성격이 달라서다. 그쪽은 게임이 정한 한도이고 이건 "우리가
// 추적하는 월간 보스 종류 수"라 이 화면만 쓴다.
const MONTHLY_BOSS_COUNT = weeklyBossesData.monthly.length

/**
 * 카드 강조. 글로우(카드 루트에 붙는 그림자 겹)와 링(셸 위에 얹는 골드 테두리)을 함께 낸다.
 *
 * 둘을 한 컴포넌트로 두지 않고 둘로 나누는 이유는 **붙는 자리가 다르기** 때문이다: 글로우는 밖으로
 * 번져야 해서 잘리지 않는 카드 루트에, 링은 셸 모양을 따라야 해서 셸 안에 붙는다(파일 머리).
 */
function ValuableCardGlow(props: { isExpanded: boolean }): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  // 펼침과 모션 줄이기는 같은 그림에 도달한다. 정적 폴백 하나.
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
 * 골드 테두리. 웹 `::before` 회전 샤인 링의 **degrade 그림**(파일 머리 ①).
 *
 * 반경은 을 그대로 따른다: 펼침 셸은 자식을 **패딩 박스**(반경 13 = 14 − 테두리
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
 * 아이템 칩이 있을 때만 금액을 세로 스택으로 감싼다. 없으면 자식을 그대로 흘려보낸다.
 *
 * **값을 안 매긴 카드는 뷰가 한 겹도 늘지 않는다**.
 */
function ItemAwareMoney(props: { wrap: boolean; children: React.ReactNode }): React.JSX.Element {
  if (!props.wrap) return <>{props.children}</>
  return <View className="items-end gap-1">{props.children}</View>
}

export function CharacterAccordion(props: {
  group: CharacterGroup
  /**: 이 캐릭터의 동기화가 실패했으면 그 종류(없으면 `undefined`). */
  issue?: CharacterIssue
}): React.JSX.Element {
  const { tab, loadedTab, loadedPeriodKey, dropsByRowKey } = useBossProfitContext()
  const [isExpanded, setIsExpanded] = useState(false)
  // : 아이콘만으로는 원인을 말할 수 없어, 탭하면 설명 팝오버를 연다.
  const [isIssueOpen, setIsIssueOpen] = useState(false)
  const [issueGeometry, setIssueGeometry] = useState<PopoverAnchorGeometry>({
    left: ISSUE_POPOVER_EDGE_GAP,
    caretLeft: ISSUE_POPOVER_WIDTH / 2,
  })
  // 팝오버 가로 위치를 정하려면 **카드와 금액 두 상자**가 필요하다(금액 폭이 자릿수에 따라 변해
  // 배지의 x 를 고정값으로 알 수 없다). state 가 아니라 ref 인 것은 이 값을 **렌더가 읽지 않기**
  // 때문이다. 재는 일은 배지를 탭한 뒤에만 일어난다(state 로 두면 카드마다 마운트 렌더가 한 번 는다).
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
  // 합계와 맞는다. 낱개로는 못 꺼내지만 합은 안다.
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

  // 처치 진행 링은 두 탭 · 모든 기간에 그리고, 무엇을 세는지는 탭이 정한다. 월간 탭은
  // 주간 처치 수를 끌어오지 않는다. 월간 rows 에 주간 행 자체가 없고, 12는 주 단위로 초기화되는
  // 한도라 월 단위로 곱한 분모는 게임에 없다.
  const clearProgress =
    tab === 'weekly'
      ? { cleared: countGroupClearedWeeklyBosses(group), total: WEEKLY_BOSS_CLEAR_LIMIT, cycle: tab }
      : { cleared: countGroupClearedMonthlyBosses(group), total: MONTHLY_BOSS_COUNT, cycle: tab }

  /**
   * 배지를 탭하면 두 상자를 재서 팝오버를 앉힌다(파일 머리 ①).
   *
   * 측정이 오기 전에도 팝오버는 뜬다. `resolveIssueAnchor` 의 기본 기하(왼쪽 끝)로 서 있다가
   * 다음 프레임에 제자리를 잡는다.
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
    // 형제 순서가 곧 그리는
    // 순서이고 `zIndex` 도 부모 안에서만 겨루므로 그 격리가 기본값이다. 새어나갈 곳이 없다.
    <View
      ref={cardRef}
      testID="character-accordion"
      className={isIssueOpen ? 'relative z-[9]' : 'relative'}
    >
      {/* 글로우는 셸 **바깥**이다. 셸은 펼침 상태에서 자식을 잘라내므로 안에 두면
          밖으로 번지는 그림자가 잘린다(파일 머리 ②). */}
      {hasValuable && <ValuableCardGlow isExpanded={isExpanded} />}

      {props.issue !== undefined && isIssueOpen && (
        <CharacterIssuePopover
          issue={props.issue}
          geometry={issueGeometry}
          onClose={() => setIsIssueOpen(false)}
        />
      )}

      {/* 아이템 내역은 별도 네이티브 윈도우로 화면 위에 뜬다. 보스 행이 쓰는 것과 같은
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

      {/* 배지는 셸 바깥·카드 우상단이다. 펼침에도 같은 자리다. */}
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
            로 커진 만큼 돌려받은 것이다. 헤더 높이는 링 도입 전과 같은 64px
            (12 + 40 + 12). 좌우는 보스 행(`p-4`)과 맞춰 16px 유지. */}
        <Pressable
          role="button"
          aria-expanded={isExpanded}
          // : 접기는 **상태만 바꾼다.** 여기에 스크롤 조작을 다시 넣지 말 것.
          onPress={() => {
            // 카드를 여닫으면 설명 팝오버를 닫는다. 펼침이 레이아웃을 바꿔 열기 직전에 잰 위치가
            // 낡은 값이 되고, 헤더 탭은 팝오버 바깥 탭으로 잡히지도 않는다.
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
          {/* 숫자 표기(n/12)는 보류 상태 그대로다. 헤더 가로폭을 캐릭터명과
              다투는 문제가 안 풀렸다. 진행률은 아바타 링이 표현한다. */}

          <ItemAwareMoney wrap={hasItemRevenue}>
            {/* 실패 배지의 절대배치 기준이자 팝오버 가로 위치의 기준 상자다. 아이템이 섞이면
                **금액 색이 달라진다**. 새 색을 만들지 않고 보스 행의
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

        {/* 링은 셸 **안**의 마지막 자식이라 콘텐츠 위에 그려진다. */}
        {hasValuable && <ValuableCardRing isExpanded={isExpanded} />}
      </View>
    </View>
  )
}

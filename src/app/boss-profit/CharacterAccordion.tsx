/**
 * 보스 수익 화면의 캐릭터 카드. 펼침·고가 드롭 강조·실패 배지·아이템 내역을 갖는 아코디언.
 *
 * 화면과 나눈 것은 줄 수가 아니라 관심사다. 화면은 기간·탭·목록을 알고 이 카드는 펼침 상태와
 * 카드 안의 것들을 안다.
 *
 * 고가 드롭을 먹은 카드는 테두리 대신 카드 전면의 오로라 금속빛(`HologramSheen`)으로 강조한다. 빛만 저절로 흐르고 카드는 고정이다.
 *
 * @see docs/features/boss-profit.md 정책
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { bossesInSection } from '../../lib/boss/bosses'
import { sumDropPayout } from '../../lib/drop/drop-price'
import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'


import { AnimatedNumber, ChevronDownIcon, ChevronUpIcon, Text } from '../../components/atoms'
import { AuroraText } from '../../components/molecules/AuroraText/AuroraText'
import { ValuableDropMark } from '../../components/molecules/ValuableDropMark/ValuableDropMark'
import { HologramSheen } from '../../components/organisms/HologramSheen/HologramSheen'
import { useHoloMotion } from '../../components/organisms/HologramSheen/holo-motion'
import { AURORA_TEXT } from '../../constants/style/aurora'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useThemeMode } from '../../theme/context'
import { MonthlyAccordionBody, WeeklyAccordionBody } from './AccordionBody'
import { ItemRevenueTrigger } from './ItemRevenueTrigger'
import { useBossProfitContext } from './boss-profit-context'
import { CharacterPortrait } from '../../components/organisms/CharacterPortrait/CharacterPortrait'
import {
  CharacterIssueAmount,
  CharacterIssueBadge,
  CharacterIssuePopover,
  type CharacterIssue,
} from './CharacterIssue'
import {
  collectRevenueDrops,
  collectGroupValuableDrops,
  countGroupClearedMonthlyBosses,
  countGroupClearedWeeklyBosses,
  groupTotalMeso,
  monthlyCrystalMesoOf,
  type CharacterGroup,
} from './character-groups'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { ItemRevenuePopover } from './ItemRevenuePopover'

/** 카드 수익 내역 상자에 싣는 아이템 건수. 나머지는 한 줄로 접는다. */
const CARD_REVENUE_LIST_LIMIT = 5

/**
 * 머리의 금액 상자. 아이템이 섞였을 때만 **금액 자체가 내역을 여는 버튼**이 된다.
 *
 * 감싸는 갈래가 따로 있는 것은 실패 배지의 절대배치 기준(금액 칸)이 안쪽 상자여야 하기
 * 때문이다. 아이템이 없으면 래퍼를 아예 안 만들어 그 행의 트리가 안 달라진다.
 */
function MoneyBox({
  // 구조 분해가 필수다. `props.triggerRef` 로 읽으면 `react-hooks/refs` 가 그 접근을 렌더 중
  // ref 접근으로 본다(보스 행이 훅을 구조 분해하는 것과 같은 이유).
  triggerRef,
  ...props
}: {
  wrap: boolean
  label: string
  isOpen: boolean
  onPress: () => void
  triggerRef: (node: View | null) => void
  markColor?: string
  children: React.ReactNode
}): React.JSX.Element {
  if (!props.wrap) return <>{props.children}</>
  return (
    <ItemRevenueTrigger
      ref={triggerRef}
      label={props.label}
      isOpen={props.isOpen}
      onPress={props.onPress}
      markColor={props.markColor}
    >
      {props.children}
    </ItemRevenueTrigger>
  )
}

/**
 * 카드 머리를 감싸는 상자. 펼칠 수 있으면 버튼이고 아니면 보통 상자다.
 *
 * 펼칠 수 없는 카드에서 버튼 역할까지 빼는 것은 스크린리더 때문이다. `onPress` 만 떼면 그
 * 자리가 여전히 `펼치기` 로 읽혀 누를 것이 있다고 말한다.
 */
function CardHeader(props: {
  expandable: boolean
  isExpanded: boolean
  onPress: () => void
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  if (!props.expandable) return <View className={props.className}>{props.children}</View>
  return (
    <Pressable
      role="button"
      aria-expanded={props.isExpanded}
      onPress={props.onPress}
      className={props.className}
    >
      {props.children}
    </Pressable>
  )
}

export function CharacterAccordion(props: {
  group: CharacterGroup
  /** 이 캐릭터의 동기화가 실패했으면 그 종류(없으면 `undefined`). */
  issue?: CharacterIssue
  /**
   * 조회 불가 팝오버의 `캐릭터 관리로 이동하기`. **화면이 준다** - 이 카드는 네비게이션을 모르고,
   * 알게 하면 카드만 세우는 테스트가 전부 네비게이션 컨테이너를 요구한다.
   *
   * 안 주면 그 버튼이 안 선다. 화면이 주는지는 `BossProfitScreen` 테스트가 지킨다.
   */
  onOpenCharacterManage?: () => void
}): React.JSX.Element {
  const { tab, loadedTab, loadedPeriodKey, dropsByRowKey } = useBossProfitContext()
  const [isOpenedByUser, setIsOpenedByUser] = useState(false)
  // 아이콘만으로는 원인을 말할 수 없어, 탭하면 설명 팝오버를 연다. 금액 칸을 재서 그 아래에 꼬리를 댄다.
  const {
    ref: issueAnchorRef,
    isOpen: isIssueOpen,
    anchor: issueAnchor,
    toggle: toggleIssue,
    close: closeIssue,
  } = useAnchoredPopover()
  const {
    ref: itemChipRef,
    isOpen: isItemPopoverOpen,
    anchor: itemAnchor,
    toggle: toggleItemPopover,
    close: closeItemPopover,
  } = useAnchoredPopover()

  const { group } = props
  const totalMeso = groupTotalMeso(group, dropsByRowKey)
  /**
   * 금액을 **말할 수 없는** 카드인가. 그러면 그 자리를 `조회 불가` 배지가 채운다.
   *
   * 조건이 둘 다 필요하다.
   *
   * - **조회 불가**여야 한다. `failed` 는 마지막으로 확인한 기록을 보여주는 상태라 이 자리가 아니다
   * - **금액이 0** 이어야 한다. 0 이 아니면 그 돈은 기록에서 온 **아는 사실**이라 덮으면 안 된다.
   *   행 수로 보지 않는 이유는 스케줄 캐시가 남은 캐릭터다. 조회는 못 하는데 낡은 캐시가 행을
   *   만들어, 행이 있는데 금액은 `0 메소` 인 자리가 실제로 생긴다
   */
  const cannotStateAmount = props.issue === 'unavailable' && totalMeso === 0
  /**
   * 실제로 펼쳐진 상태. **금액을 말할 수 없는 카드는 펼치지 않는다**(사용자 지정).
   *
   * 그 카드는 본문에 그릴 것이 없다. 주간이면 행이 아예 없거나 낡은 스케줄 캐시가 만든 미완료
   * 행만 남고, 월간이면 금액을 말할 수 있는 주가 하나도 없어 주차 줄마다 같은 배지가 반복된다.
   *
   * 펼침 state 를 지우지 않고 곱하는 것은 되돌아올 자리를 남기기 위해서다. 드롭 값이 지워져
   * 금액이 0 으로 떨어지면 본문이 닫히고, 값이 다시 생기면 열어 둔 그대로 돌아온다.
   */
  const isExpanded = isOpenedByUser && !cannotStateAmount
  /**
   * 금액 옆 **원형 배지**가 말할 것. `undefined` 면 안 선다.
   *
   * 월간의 조회 불가는 뺀다(사용자 지정). 그 탭은 펼치면 주차 줄마다 `조회 불가` 를 적으므로
   * 머리의 원형 배지가 같은 말을 한 번 더 하는데, 그 자리가 금액 좌상단이라 숫자를 가린다.
   * `failed` 는 남는다. 그것은 한 주가 아니라 카드 전체의 사실이라 주차 줄이 대신 말해 주지 않는다.
   */
  const badgeIssue =
    tab === 'monthly' && props.issue === 'unavailable' ? undefined : props.issue
  // 이 기간에 고가 아이템을 먹었을 때: 홀로그램 빛 + 머리 오른쪽 위 아이템 표시 + 오로라 금액.
  const valuableDrops = collectGroupValuableDrops(group, dropsByRowKey)
  const hasValuable = valuableDrops.length > 0
  const holoMotion = useHoloMotion(hasValuable)
  const themeMode = useThemeMode()
  // 카드 금액(`groupTotalMeso`)과 같은 원천이어야 상자의 목록 · 아이템 줄 · 합계가 맞는다.
  const groupDrops = collectRevenueDrops(group, dropsByRowKey)
  const itemTotal = sumDropPayout(groupDrops)
  const hasItemRevenue = itemTotal > 0
  // 낱개가 없는 몫은 주차 한 줄씩 말한다. 라벨을 `N주차` 로 고정하는 것은
  // `formatBossProfitPeriodLabel` 이 최근 두 주만 이번 주·지난 주로 불러 줄이 어긋나기 때문이다.
  const weeklyItemLines = group.weeklySubtotals
    .map((subtotal, index) => ({
      periodKey: subtotal.periodKey,
      label: `${index + 1}주차`,
      meso: sumDropPayout(subtotal.drops),
    }))
    .filter((line) => line.meso > 0)

  // 처치 진행 링은 두 탭 · 모든 기간에 그리고 무엇을 세는지는 탭이 정한다. 월간 탭은 주간 처치
  // 수를 끌어오지 않는다. 월간 rows 에 주간 행 자체가 없고, 12 는 주 단위로 초기화되는 한도라
  // 월 단위로 곱한 분모는 게임에 없다.
  //
  // 월간 분모는 리터럴 1 이 아니라 보스 표의 월간 보스 종류 수다. 표는 켜는 동안 서버 응답으로 덮일 수
  // 있어 그릴 때 읽는다.
  const amountText = (
    <>
      <AnimatedNumber identity={`character|${group.ocid}|${loadedTab}|${loadedPeriodKey}`} value={totalMeso} />
      {' 메소'}
    </>
  )

  const clearProgress =
    tab === 'weekly'
      ? { cleared: countGroupClearedWeeklyBosses(group), total: WEEKLY_BOSS_CLEAR_LIMIT, cycle: tab }
      : { cleared: countGroupClearedMonthlyBosses(group), total: bossesInSection('monthly').length, cycle: tab }

  return (
    // 형제 순서가 곧 그리는 순서이고 `zIndex` 도 부모 안에서만 겨루므로 그 격리가 기본값이다.
    <View testID="character-accordion" className="relative">
      {props.issue !== undefined && isIssueOpen && (
        <CharacterIssuePopover
          issue={props.issue}
          anchor={issueAnchor}
          onClose={closeIssue}
          onOpenCharacterManage={
            props.onOpenCharacterManage === undefined
              ? undefined
              : () => {
                  closeIssue()
                  props.onOpenCharacterManage?.()
                }
          }
        />
      )}

      {/* 아이템 내역은 별도 네이티브 윈도우로 화면 위에 뜬다. 보스 행이 쓰는 것과 같은
          컴포넌트다. 카드 셸의 클리핑을 피하는 것이 그 선택의 이유다. */}
      {isItemPopoverOpen && (
        <ItemRevenuePopover
          drops={groupDrops}
          limit={CARD_REVENUE_LIST_LIMIT}
          weeklyLines={weeklyItemLines}
          crystalMeso={totalMeso - itemTotal}
          monthlyCrystalMeso={monthlyCrystalMesoOf(group)}
          itemMeso={itemTotal}
          anchor={itemAnchor}
          onClose={closeItemPopover}
        />
      )}

      {/* 머리와 본문을 한 셸이 감싸 펼쳐도 한 카드로 읽힌다. 빛은 셸의 첫 자식이라 바탕과 내용 사이에 깔리고,
          펼치면 본문 바탕까지 덮는다. */}
      <View testID="character-card-shell" className="rounded-[14px] bg-surface">
        {hasValuable && <HologramSheen variant="card" motion={holoMotion} testID="character-card-sheen" />}
        <CardHeader
          expandable={!cannotStateAmount}
          isExpanded={isExpanded}
          // 접기는 **상태만 바꾼다.** 여기에 스크롤 조작을 다시 넣지 말 것.
          onPress={() => {
            // 카드를 여닫으면 설명 팝오버를 닫는다. 펼침이 레이아웃을 바꿔 열기 직전에 잰 위치가 낡은 값이 된다.
            closeIssue()
            setIsOpenedByUser((expanded) => !expanded)
          }}
          className="w-full flex-row items-center gap-3 px-4 py-3"
        >
          <CharacterPortrait
            variant="compact"
            characterName={group.characterName}
            imageUrl={group.imageUrl}
            unavailable={props.issue === 'unavailable'}
            clears={{
              cleared: clearProgress.cleared,
              total: clearProgress.total,
              label: clearProgress.cycle === 'weekly' ? '주간' : '월간',
            }}
          />
          <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-text">
            {group.characterName}
          </Text>
          {/* 숫자 표기(n/12)는 두지 않는다. 헤더 가로폭을 캐릭터명과 다투는 문제가 안 풀렸다.
              진행률은 아바타 링이 표현한다. */}

          {/* 오른쪽 열은 위가 고가 드롭 표시, 아래가 금액이다. 고가 드롭이 없는 카드도 금액이 같은 줄에 서서
              카드끼리 금액이 맞는다. */}
          <View className="shrink-0 items-end gap-0.5">
            <View className="h-[22px] justify-center">
              {hasValuable && <ValuableDropMark drops={valuableDrops} label="고가 드롭" />}
            </View>
            <View className="h-[22px] justify-center">
              <MoneyBox
                wrap={hasItemRevenue}
                label={`${group.characterName} 아이템 수입 확인`}
                isOpen={isItemPopoverOpen}
                onPress={toggleItemPopover}
                triggerRef={itemChipRef}
                // 화살표는 금액 바로 왼쪽이라 그라디언트가 시작하는 색이어야 금액과 한 덩어리로 보인다.
                markColor={hasValuable ? AURORA_TEXT[themeMode][0] : undefined}
              >
                {/* 실패 배지의 절대배치 기준이자 설명 팝오버가 꼬리를 대는 상자다. 아이템이 섞이면
                    금액 색이 달라진다. 새 색을 만들지 않고 보스 행과 같은 `primary-ink` 를 쓴다. */}
                <View ref={issueAnchorRef} className="relative flex-row items-center">
                  {cannotStateAmount ? (
                    <CharacterIssueAmount onToggle={toggleIssue} />
                  ) : (
                    <>
                      {badgeIssue !== undefined && (
                        <CharacterIssueBadge issue={badgeIssue} onToggle={toggleIssue} />
                      )}
                      {hasValuable ? (
                        <AuroraText testID="character-amount-aurora" className="text-sm font-bold" style={TABULAR_NUMS}>
                          {amountText}
                        </AuroraText>
                      ) : (
                        <Text
                          className={`text-sm font-bold ${hasItemRevenue ? 'text-primary-ink' : 'text-text'}`}
                          style={TABULAR_NUMS}
                        >
                          {amountText}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              </MoneyBox>
            </View>
          </View>

          {/* 펼칠 수 없는 카드에는 안 세운다. 눌러도 아무 일이 없는 셰브런은 거짓 어포던스다. */}
          {!cannotStateAmount &&
            (isExpanded ? (
              <ChevronUpIcon testID="accordion-chevron" className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
            ) : (
              <ChevronDownIcon testID="accordion-chevron" className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
            ))}
        </CardHeader>

        {isExpanded &&
          (tab === 'weekly' ? (
            <WeeklyAccordionBody rows={group.bossRows} />
          ) : (
            <MonthlyAccordionBody
              bossRows={group.bossRows}
              weeklySubtotals={group.weeklySubtotals}
              unavailable={props.issue === 'unavailable'}
            />
          ))}
      </View>
    </View>
  )
}

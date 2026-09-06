/**
 * 캐릭터 카드를 펼쳤을 때의 **본문**(화면에서 분리).
 *
 * 주간은 보스 행 목록만, 월간은 주차별 소계 + 월간 보스 행이다. 소계 행은 그 주를 조회할 수
 * 있는지에 따라 얼굴이 갈린다.
 */
import { Pressable, View } from 'react-native'

import type { WeeklySubtotalState } from '../../features/boss-profit/store'
import { dropRowKey } from '../../features/boss-profit/store'
import type { BossProfitRow, BossProfitWeeklySubtotal } from '../../features/boss-profit/store'
import { formatBossProfitPeriodLabel } from '../../lib/boss/boss-profit-period'
import { sumDropPayout } from '../../lib/drop/drop-price'

import { WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'

import { AnimatedNumber, Badge, RefreshCwIcon, Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { BossProfitBossRow } from './BossProfitBossRow'
import { ItemRevenueTrigger } from './ItemRevenueTrigger'
import { useBossProfitContext } from './boss-profit-context'
import { rowKey } from './character-groups'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { ItemRevenuePopover } from './ItemRevenuePopover'

// 행동이 있는 상태에만 버튼을 준다. 남은 것은 failed(다시 시도) 하나이고 나머지는 금액 또는
// 비활성 배지로 정적이다. 금액을 모르는 상태에 0 을 쓰지 않는 것이 핵심이다. 0 은 0원 벌었다
// 로 읽힌다.
//
// `조회` 버튼이 사라진 것은 사용자가 조회를 트는 개념이 없어졌기 때문이다. 창이 진입할 때
// 창 안 기간을 다 채우므로 누를 자리가 없다.
export const SUBTOTAL_ACTION_LABEL: Partial<Record<WeeklySubtotalState, string>> = {
  failed: '다시 시도',
}

/**
 * 펼친 카드의 본문. 보스 목록이 **자기 바탕** 위에 앉는다.
 *
 * 머리와 본문이 둘 다 흰 바탕이고 사이가 `border` 1px 하나라, 캐릭터 머리가 보스 목록의 첫
 * 줄처럼 읽혔다. 보스 행에도 같은 두께의 같은 색 선이 깔려 있어 그 한 줄만 성격이 다르다는
 * 신호가 없었다.
 *
 * 색은 38토큰에 없어 모드에서 파생한다(`theme/theme-vars` 의 `resolveCardBody`). 라이트는
 * 배경보다 연한 파스텔, 다크는 배경보다 조금 밝은 톤온톤이다. `surface-2` 를 쓰면 라이트에서
 * 칙칙하고, `bg` 를 쓰면 본문이 페이지에 녹는다.
 */
export const ACCORDION_BODY_CLASS = 'border-t border-border bg-card-body'

export const SUBTOTAL_STATIC_LABEL: Partial<Record<WeeklySubtotalState, string>> = {
  upcoming: '예정',
  outOfRange: '조회 불가',
  notCollected: '집계 전',
}

/**
 * 무리의 머리. 알약 하나와 오른쪽 값 하나.
 *
 * 월간 띠는 `primary-tint` 바탕, 주간 띠는 `surface-2` 다. 알약은 둘 다 카드 흰색이라 바탕
 * 위에서 뜬다. **월간 오른쪽에는 아무것도 안 적는다**(사용자 지정). 그 줄이 주간 12·90 한도에
 * 안 든다는 것은 띠가 갈라 놓은 것으로 충분하고, 그 이상은 화면이 규칙을 설명하려 드는 것이다.
 */
function SectionBand(props: { label: string; count?: string; monthly?: boolean }): React.JSX.Element {
  const monthly = props.monthly === true
  return (
    <View
      testID="accordion-band"
      className={`h-[26px] flex-row items-center border-b border-border px-4 ${
        monthly ? 'bg-primary-tint' : 'bg-surface-2'
      }`}
    >
      {/* `w-9` 를 빼지 말 것. 빼면 알약이 글자 폭에 딱 붙고, 안드로이드가 그릴 때 뒷 음절이 다음
          줄로 넘어가 알약 높이에 가려 사라진다(`주간` 이 `주` 로 보였다. 실측: 여유 1.3px 면 잘리고
          3.3px 면 안 잘린다). 두 음절이 17.3dp 라 36dp 면 12px 남는다. 안쪽 글자가 `fixed` 라
          OS 글자 배수를 안 따르므로 폭을 값으로 못박아도 넘치지 않는다.

          가운데 정렬은 글자 쪽 `text-center` 로 한다. 여기에 `items-center` 를 주면 글자 상자가
          다시 글자 폭으로 줄어 방금 만든 여유가 사라진다. */}
      <View className="h-[18px] w-9 justify-center rounded-full bg-surface px-[7px]">
        <Text
          fixed
          className={`text-center text-chip-sm font-bold ${
            monthly ? 'text-primary-ink' : 'text-text-muted'
          }`}
        >
          {props.label}
        </Text>
      </View>
      {props.count !== undefined && (
        <Text
          fixed
          testID="accordion-band-count"
          style={TABULAR_NUMS}
          className="ml-auto text-chip-sm font-bold text-text-disabled"
        >
          {props.count}
        </Text>
      )}
    </View>
  )
}

/**
 * 주간 본문. **월간 보스가 맨 위에 서고** 그 아래가 주간 12마리다.
 *
 * 두 무리를 띠가 가른다. 월간 띠는 그 줄이 있을 때만, 주간 띠는 늘 선다(사용자 지정). 주간
 * 띠가 늘 서는 것은 그 오른쪽의 `n / 12` 가 **주간 한도를 숫자로 말하는 유일한 자리**이기
 * 때문이다. 아바타 링은 그 수를 그림으로만 말한다.
 */
export function WeeklyAccordionBody(props: { rows: BossProfitRow[] }): React.JSX.Element {
  const { dropsByRowKey } = useBossProfitContext()
  const monthlyRows = props.rows.filter((row) => row.cycle === 'monthly')
  const weeklyRows = props.rows.filter((row) => row.cycle !== 'monthly')
  const cleared = weeklyRows.filter((row) => row.isComplete).length

  function bossRow(row: BossProfitRow, isLast: boolean): React.JSX.Element {
    return (
      <BossProfitBossRow
        key={rowKey(row)}
        row={row}
        isLast={isLast}
        drops={dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
      />
    )
  }

  return (
    <View testID="accordion-body" className={ACCORDION_BODY_CLASS}>
      {monthlyRows.length > 0 && <SectionBand label="월간" monthly />}
      {monthlyRows.map((row) => bossRow(row, false))}

      <SectionBand label="주간" count={`${cleared} / ${WEEKLY_BOSS_CLEAR_LIMIT}`} />
      {weeklyRows.map((row, index) => bossRow(row, index === weeklyRows.length - 1))}
    </View>
  )
}

export function WeeklySubtotalRow(props: { subtotal: BossProfitWeeklySubtotal }): React.JSX.Element {
  const { subtotal } = props
  const { now, onRetryPeriod } = useBossProfitContext()
  const label = formatBossProfitPeriodLabel('weekly', subtotal.periodKey, now)
  const actionLabel = SUBTOTAL_ACTION_LABEL[subtotal.state]
  const staticLabel = SUBTOTAL_STATIC_LABEL[subtotal.state]
  // 금액을 말할 수 있는 상태. 기록이 있거나(recorded), 조회해서 0건을 확인했거나, 진행 중.
  const showsMeso =
    subtotal.state === 'recorded' || subtotal.state === 'confirmedEmpty' || subtotal.state === 'inProgress'

  const itemMeso = sumDropPayout(subtotal.drops)
  // 구조 분해가 필수다. 이유는 `BossProfitBossRow` 의 같은 자리 주석 참고.
  const { ref: itemChipRef, isOpen: isItemPopoverOpen, anchor: itemAnchor, toggle: toggleItemPopover, close: closeItemPopover } =
    useAnchoredPopover()

  const amount = (
    <Text
      className={
        itemMeso > 0
          ? 'text-sm font-semibold text-primary-ink'
          : 'text-sm font-semibold text-text'
      }
      style={TABULAR_NUMS}
    >
      <AnimatedNumber identity={`subtotal|${subtotal.ocid}|${subtotal.periodKey}`} value={subtotal.totalMeso} />
      {' 메소'}
    </Text>
  )

  return (
    <View
      testID="weekly-subtotal-row"
      className={
        staticLabel !== undefined
          ? 'flex-row items-center gap-3 border-b border-border p-4 opacity-40'
          : 'flex-row items-center gap-3 border-b border-border p-4'
      }
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text">{label.primary}</Text>
        <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
          {label.secondary}
        </Text>
      </View>

      {subtotal.state === 'inProgress' && (
        <Badge variant="primary">진행 중</Badge>
      )}

      {staticLabel !== undefined && <Text className="text-xs text-text-muted">{staticLabel}</Text>}

      {/* 누를 수 있는 행만 어포던스(칩)를 갖는다. 한 주를 누르면 그 달의 미확인 주를 함께 채운다.
          같은 백필이 그 달 전체를 대상으로 돌기 때문이고, 탭 수를 늘릴 이유가 없다. */}
      {actionLabel !== undefined && (
        <Pressable
          role="button"
          aria-label={`${label.primary} ${actionLabel}`}
          onPress={onRetryPeriod}
          className={
            subtotal.state === 'failed'
              ? 'flex-row items-center gap-1.5 rounded-full bg-error-tint px-2.5 py-1'
              : 'flex-row items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1'
          }
        >
          <RefreshCwIcon
            className={subtotal.state === 'failed' ? 'h-3 w-3 text-error-ink' : 'h-3 w-3 text-primary-ink'}
            strokeWidth={2}
            aria-hidden
          />
          <Text
            className={
              subtotal.state === 'failed'
                ? 'text-11 font-semibold text-error-ink'
                : 'text-11 font-semibold text-primary-ink'
            }
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}

      {showsMeso &&
        (itemMeso === 0 ? (
          amount
        ) : (
          // 아이템이 섞이면 금액 자체가 버튼이다. 보스 행·캐릭터 카드와 같은 규칙·같은 잉크다.
          // 이 주의 아이템을 낱개로 보려면 여기서 연다.
          <ItemRevenueTrigger
            ref={itemChipRef}
            label={`${label.primary} 아이템 수익 확인`}
            isOpen={isItemPopoverOpen}
            onPress={toggleItemPopover}
          >
            {amount}
          </ItemRevenueTrigger>
        ))}

      {isItemPopoverOpen && (
        <ItemRevenuePopover
          drops={subtotal.drops}
          crystalMeso={subtotal.totalMeso - itemMeso}
          itemMeso={itemMeso}
          anchor={itemAnchor}
          onClose={closeItemPopover}
        />
      )}
    </View>
  )
}

/**
 * 월간 본문. **주차별 합계만** 있다.
 *
 * 월간 보스 상세는 여기 없다. 주간 탭의 그 캐릭터 목록 맨 위로 갔다(사용자 지정). 이 탭은
 * 순수하게 `그 달에 누가 얼마를 벌었나` 다.
 *
 * `bossRows` 는 그래도 받는다. 아바타 진행 링이 그 행으로 월간 보스 처치를 세기 때문이다
 * (사용자 선택. 그래야 두 탭 사이에 링의 뜻이 안 갈린다). 그리지만 않는다.
 */
export function MonthlyAccordionBody(props: {
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
}): React.JSX.Element {

  return (
    <View testID="accordion-body" className={ACCORDION_BODY_CLASS}>
      {props.weeklySubtotals.length > 0 && (
        <>
          <SectionBand label="주차별 합계" />
          {props.weeklySubtotals.map((subtotal) => (
            <WeeklySubtotalRow key={subtotal.periodKey} subtotal={subtotal} />
          ))}
        </>
      )}

    </View>
  )
}

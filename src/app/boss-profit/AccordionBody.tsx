// 캐릭터 카드를 펼쳤을 때의 **본문**([[ADR-094]] 결정 7로 화면에서 분리).
//
// 주간은 보스 행 목록만, 월간은 주차별 소계 + 월간 보스 행이다. 소계 행은 그 주를 조회할 수
// 있는지에 따라 얼굴이 갈린다([[ADR-068]]).
//
// ── RN 으로 옮기며 갈린 것 넷 ─────────────────────────────────────────────────────
//
// ① `<ul>`/`<li>` 가 사라진다(RN 에 목록 시맨틱이 없다). 대신 **마지막 보스 행을 부모가 알려
//    준다** — 웹의 `last:border-b-transparent` 짝이다(`BossProfitBossRow` 의 `isLast`).
// ② `space-y-*` → `gap-*`(NativeWind 에 형제 선택자가 없다).
// ③ 팝오버 앵커가 비동기로 온다 — 보스 행과 **같은 훅**(`useAnchoredPopover`)을 쓴다. 스크롤로
//    닫던 효과는 별도 네이티브 윈도우라 구조가 대신 지킨다(`ItemRevenuePopover` 파일 머리 ②).
// ④ 글자가 상자에서 `Text` 로 내려오고 `tabular-nums` 는 값으로 준다(`lib/text-styles.ts`).
import { Pressable, View } from 'react-native'

import type { WeeklySubtotalState } from '../../features/boss-profit/store'
import { dropRowKey } from '../../features/boss-profit/store'
import type { BossProfitRow, BossProfitWeeklySubtotal } from '../../features/boss-profit/store'
import { formatBossProfitPeriodLabel } from '../../lib/boss-profit-period'
import { formatMesoShort } from '../../lib/boss-profit-delta'
import { sumDropPayout } from '../../lib/drop-price'

import { Badge } from '../../components/atoms/Badge/Badge'
import { Text } from '../../components/atoms/Text/Text'
import { UnavailableNotice } from '../../components/molecules/EmptyState/UnavailableNotice'
import { RefreshCwIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { BossProfitBossRow } from './BossProfitBossRow'
import { useBossProfitContext } from './boss-profit-context'
import { rowKey } from './character-groups'
import { ItemRevenuePopover, useAnchoredPopover } from './ItemRevenuePopover'
import { AnimatedNumber } from '../../components/atoms/AnimatedNumber/AnimatedNumber'

// [[ADR-068]] 결정 2: **행동이 있는 상태에만 버튼을 준다.** 여섯 상태 중 사용자가 할 수 있는 것은
// notChecked(조회)와 failed(다시 시도) 둘뿐이고, 나머지는 금액 또는 비활성 배지로 정적이다.
// **금액을 모르는 상태에 0을 쓰지 않는 것이 핵심이다** — 0은 "0원 벌었다"로 읽힌다([[ADR-124]] 가
// 드롭 가격에서 지키는 것과 같은 원칙이 기간 상태에도 선다).
export const SUBTOTAL_ACTION_LABEL: Partial<Record<WeeklySubtotalState, string>> = {
  notChecked: '조회',
  failed: '다시 시도',
}

export const SUBTOTAL_STATIC_LABEL: Partial<Record<WeeklySubtotalState, string>> = {
  upcoming: '예정',
  outOfRange: '조회 불가',
  notCollected: '집계 전',
}

export function WeeklyAccordionBody(props: { rows: BossProfitRow[] }): React.JSX.Element {
  const { dropsByRowKey } = useBossProfitContext()

  return (
    <View className="border-t border-border">
      {props.rows.map((row, index) => (
        <BossProfitBossRow
          key={rowKey(row)}
          row={row}
          isLast={index === props.rows.length - 1}
          drops={dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
        />
      ))}
    </View>
  )
}

export function WeeklySubtotalRow(props: { subtotal: BossProfitWeeklySubtotal }): React.JSX.Element {
  const { subtotal } = props
  const { now, onRetryPeriod } = useBossProfitContext()
  const label = formatBossProfitPeriodLabel('weekly', subtotal.periodKey, now)
  const actionLabel = SUBTOTAL_ACTION_LABEL[subtotal.state]
  const staticLabel = SUBTOTAL_STATIC_LABEL[subtotal.state]
  // 금액을 말할 수 있는 상태 — 기록이 있거나(recorded), 조회해서 0건을 확인했거나, 진행 중.
  const showsMeso =
    subtotal.state === 'recorded' || subtotal.state === 'confirmedEmpty' || subtotal.state === 'inProgress'

  const itemMeso = sumDropPayout(subtotal.drops)
  // 구조 분해가 필수다 — 이유는 `BossProfitBossRow` 의 같은 자리 주석 참고.
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

      {/* 누를 수 있는 행만 어포던스(칩)를 갖는다. 한 주를 누르면 그 달의 미확인 주를 함께 채운다 —
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
          // 아이템이 섞이면 금액 아래에 칩을 쌓는다 — 보스 행·캐릭터 카드와 **같은 규칙·같은 잉크**다
          // (2026-08-10 사용자 요청). 이 주의 아이템을 낱개로 보려면 여기서 연다.
          <View className="items-end gap-1">
            {amount}
            <Pressable
              ref={itemChipRef}
              role="button"
              onPress={toggleItemPopover}
              aria-label={`${label.primary} 아이템 수익 확인`}
              aria-expanded={isItemPopoverOpen}
              className="h-5 shrink-0 flex-row items-center rounded-full bg-primary-tint px-2"
            >
              <Text className="text-11 font-bold leading-none text-primary-ink" style={TABULAR_NUMS}>
                아이템 +{formatMesoShort(itemMeso)}
              </Text>
            </Pressable>
          </View>
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

export function MonthlyAccordionBody(props: {
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
}): React.JSX.Element {
  const { dropsByRowKey, isMonthlyBossQueryable } = useBossProfitContext()

  return (
    <View className="border-t border-border">
      {props.weeklySubtotals.length > 0 && (
        <>
          <Text className="bg-surface-2 px-4 pb-1 pt-3 text-11 font-bold tracking-wide text-text-muted">
            주간 보스 수익 · 주차별 합계
          </Text>
          {props.weeklySubtotals.map((subtotal) => (
            <WeeklySubtotalRow key={subtotal.periodKey} subtotal={subtotal} />
          ))}
        </>
      )}

      {(props.bossRows.length > 0 || !isMonthlyBossQueryable) && (
        <>
          <Text className="bg-surface-2 px-4 pb-1 pt-3 text-11 font-bold tracking-wide text-text-muted">
            월간 보스 수익
          </Text>
          {props.bossRows.length > 0 ? (
            props.bossRows.map((row, index) => (
              <BossProfitBossRow
                key={rowKey(row)}
                row={row}
                isLast={index === props.bossRows.length - 1}
                drops={dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
              />
            ))
          ) : (
            <UnavailableNotice compact />
          )}
        </>
      )}
    </View>
  )
}

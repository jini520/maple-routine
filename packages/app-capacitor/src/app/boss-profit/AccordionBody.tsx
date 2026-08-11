// 캐릭터 카드를 펼쳤을 때의 **본문**(ADR-094 결정 7로 화면에서 분리).
//
// 주간은 보스 행 목록만, 월간은 주차별 소계 + 월간 보스 행이다. 소계 행은 그 주를 조회할 수
// 있는지에 따라 얼굴이 갈린다([[ADR-068]]).

import type { WeeklySubtotalState } from '@core/features/boss-profit/store'
import { AnimatedMeso } from '../../components/atoms/AnimatedMeso/AnimatedMeso'
import { UnavailableNotice } from '../../components/molecules/EmptyState/UnavailableNotice'
import { dropRowKey } from '@core/features/boss-profit/store'
import type { BossProfitRow, BossProfitWeeklySubtotal } from '@core/features/boss-profit/store'
import { formatBossProfitPeriodLabel } from '@core/lib/boss-profit-period'
import { BossProfitBossRow } from './BossProfitBossRow'
import { useBossProfitContext } from './boss-profit-context'
import { rowKey } from './character-groups'
import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatMesoShort } from '@core/lib/boss-profit-delta'
import { sumDropPayout } from '@core/lib/drop-price'
import { ItemRevenuePopover } from './ItemRevenuePopover'

// ADR-068 결정 2: **행동이 있는 상태에만 버튼을 준다.** 여섯 상태 중 사용자가 할 수 있는 것은
// notChecked(조회)와 failed(다시 시도) 둘뿐이고, 나머지는 금액 또는 비활성 배지로 정적이다.
// 금액을 모르는 상태에 0을 쓰지 않는 것이 핵심이다 — 0은 "0원 벌었다"로 읽힌다.
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
    <div className="border-t border-border">
      <ul>
        {props.rows.map((row) => (
          <BossProfitBossRow
            key={rowKey(row)}
            row={row}
            drops={dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
          />
        ))}
      </ul>
    </div>
  )
}

export function WeeklySubtotalRow(props: {
  subtotal: BossProfitWeeklySubtotal
}): React.JSX.Element {
  const { subtotal } = props
  const { now, onRetryPeriod, scrollRoot } = useBossProfitContext()
  const label = formatBossProfitPeriodLabel('weekly', subtotal.periodKey, now)
  const actionLabel = SUBTOTAL_ACTION_LABEL[subtotal.state]
  const staticLabel = SUBTOTAL_STATIC_LABEL[subtotal.state]
  // 금액을 말할 수 있는 상태 — 기록이 있거나(recorded), 조회해서 0건을 확인했거나, 진행 중.
  const showsMeso =
    subtotal.state === 'recorded' || subtotal.state === 'confirmedEmpty' || subtotal.state === 'inProgress'

  const itemMeso = sumDropPayout(subtotal.drops)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)

  function togglePopover(): void {
    const rect = chipRef.current?.getBoundingClientRect()
    if (rect !== undefined) setAnchor((prev) => (prev === null ? rect : null))
  }

  // 스크롤·리사이즈에 닫는다 — `fixed` 상자는 스크롤을 따라오지 않아 어느 주차의 것인지 잃는다.
  useEffect(() => {
    if (anchor === null) return
    const close = (): void => setAnchor(null)
    const scroller = scrollRoot.current
    scroller?.addEventListener('scroll', close, { passive: true })
    window.addEventListener('resize', close)
    return () => {
      scroller?.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
    }
  }, [anchor, scrollRoot])

  // 아이템이 없으면 금액 마크업이 종전과 한 글자도 다르지 않아야 한다(DOM 스냅샷, [[ADR-094]] 결정 4).
  const amount = (
    <span
      className={
        itemMeso > 0
          ? 'whitespace-nowrap text-sm font-semibold text-primary-ink tabular-nums'
          : 'text-sm font-semibold text-text tabular-nums'
      }
    >
      <AnimatedMeso identity={`subtotal|${subtotal.ocid}|${subtotal.periodKey}`} value={subtotal.totalMeso} /> 메소
    </span>
  )

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
          onClick={onRetryPeriod}
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

      {showsMeso &&
        (itemMeso === 0 ? (
          amount
        ) : (
          // 아이템이 섞이면 금액 아래에 칩을 쌓는다 — 보스 행·캐릭터 카드와 **같은 규칙·같은 잉크**다
          // (2026-08-10 사용자 요청). 이 주의 아이템을 낱개로 보려면 여기서 연다.
          <span className="flex flex-col items-end gap-1">
            {amount}
            <button
              ref={chipRef}
              type="button"
              onClick={togglePopover}
              aria-label={`${label.primary} 아이템 수익 확인`}
              aria-expanded={anchor !== null}
              className="flex h-5 flex-none items-center whitespace-nowrap rounded-full bg-primary-tint px-2 text-[11px] font-bold leading-none tabular-nums text-primary-ink"
            >
              아이템 +{formatMesoShort(itemMeso)}
            </button>
          </span>
        ))}

      {anchor !== null && (
        <ItemRevenuePopover
          drops={subtotal.drops}
          crystalMeso={subtotal.totalMeso - itemMeso}
          itemMeso={itemMeso}
          anchor={anchor}
          onClose={() => setAnchor(null)}
        />
      )}
    </li>
  )
}

export function MonthlyAccordionBody(props: {
  bossRows: BossProfitRow[]
  weeklySubtotals: BossProfitWeeklySubtotal[]
}): React.JSX.Element {
  const { dropsByRowKey, isMonthlyBossQueryable } = useBossProfitContext()

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

              />
            ))}
          </ul>
        </>
      )}

      {(props.bossRows.length > 0 || !isMonthlyBossQueryable) && (
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
                  drops={dropsByRowKey[dropRowKey(row.ocid, row.boss, row.difficulty, row.periodKey)] ?? []}
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

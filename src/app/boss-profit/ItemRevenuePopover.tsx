// 아이템 수익 내역 상자([[ADR-124]] 결정 7) — 보스 행과 캐릭터 카드가 **같은 것을 쓴다**.
//
// **화면 위에 포털로 띄운다.** 카드 셸은 펼침 상태에서 `overflow-clip` 이라([[ADR-049]]) 트리거
// 옆에 절대배치하면 잘리고, 카드 루트에 붙이는 [[ADR-068]] 방식은 트리거가 헤더에 있을 때의
// 처방이라 목록 한가운데인 보스 행에는 맞지 않는다. `position: fixed` + 포털이면 두 제약을 함께
// 피한다. 가로 위치는 실패 배지 팝오버와 같은 순수 함수(`anchorPopover`)를 쓰되 컨테이너를 카드가
// 아니라 **뷰포트**로 준다.
//
// **어느 보스에서 나왔는지는 말하지 않는다**(사용자 지정 2026-08-10) — 캐릭터 카드에서는 여러
// 보스가 섞이는데 출처를 달면 줄이 길어지고, 정작 알고 싶은 것은 무엇을 얼마에 팔았나다.
//
// **기록 한 건이 한 줄이다.** 같은 아이템을 `×N` 으로 접었다가 되돌렸다(2026-08-10) — 가격이
// 기록 단위 실판매가라([[ADR-124]] 결정 1) **같은 아이템도 건마다 판 값이 다를 수 있고**, 접으면
// 그 차이가 합계 하나로 뭉개진다. 접는 순간 이 기능이 애초에 왜 기록 단위인지를 배신한다.

import { createPortal } from 'react-dom'
import { formatMesoShort } from '../../lib/boss-profit-delta'
import { dropPayoutMeso } from '../../lib/drop-price'
import type { RecordedDrop } from '@core/types/drops'
import { getItemIconUrl } from '../../lib/item-icons'
import { anchorPopover } from '../../lib/popover-anchor'

export const ITEM_POPOVER_WIDTH = 248
const ITEM_POPOVER_EDGE_GAP = 12
const ITEM_CARET_SIZE = 8
/** 트리거 밑변과 상자 윗변 사이 — 꼬리(8px의 절반이 삐져나온다)가 닿아 보이는 최소값. */
const ITEM_POPOVER_GAP = 8
/** 목록이 길어지면 상자가 화면을 넘긴다 — 안에서 스크롤시킨다. */
const ITEM_LIST_MAX_HEIGHT = 260

export function ItemRevenuePopover(props: {
  drops: RecordedDrop[]
  anchor: DOMRect
  onClose: () => void
  /**
   * 이 층의 결정석 합과 아이템 합(2026-08-10 사용자 요청 — 세 자리 모두 갈라 본다).
   *
   * **목록에서 더하지 않고 받는다.** 목록은 "이름을 댈 수 있는 것"만 담는데 그게 아이템 전부가
   * 아닐 수 있다 — 월간 탭에서는 주간 보스 수익이 주차 소계로 뭉쳐 들어와 그 안의 아이템을
   * 낱개로 못 꺼낸다([[ADR-071]] 결정 10 과 같은 구조적 한계). 목록 합으로 계산하면 그 경우
   * **합계가 카드 숫자와 어긋난다.**
   */
  crystalMeso: number
  itemMeso: number
  /**
   * 낱개로 못 펼치는 몫을 **주차 한 줄씩** 말한다(2026-08-10 사용자 요청).
   *
   * 월간 탭의 캐릭터 카드에서만 쓴다 — 그 층의 주간 수익은 주차 소계로 뭉쳐 들어와 목록(`drops`)
   * 에 낱개가 없다. 아이템까지 보려면 그 주차 행을 열면 된다(거기도 같은 상자가 붙는다).
   */
  weeklyLines?: { periodKey: string; label: string; meso: number }[]
}): React.JSX.Element {
  const geometry = anchorPopover({
    containerWidth: window.innerWidth,
    anchorCenterX: props.anchor.left + props.anchor.width / 2,
    popoverWidth: ITEM_POPOVER_WIDTH,
    edgeGap: ITEM_POPOVER_EDGE_GAP,
    caretSize: ITEM_CARET_SIZE,
  })
  // 스킵은 싣지 않는다 — "값을 매기지 않기로 한 것"이라 수익 내역에서 할 말이 없다. 미입력은
  // 남긴다: 그 줄이 곧 "여기 값이 비었다"는 신호다.
  // 값이 큰 것부터 낸다(사용자 지정 2026-08-10) — 맨 위가 그 기간의 최대 수확이고, 미입력(0)은
  // 자연히 바닥으로 간다. `sort` 는 안정 정렬이라 같은 값끼리는 기록 순서가 유지된다.
  const listed = props.drops
    .filter((drop) => drop.priceState !== 'excluded')
    .slice()
    .sort((a, b) => dropPayoutMeso(b) - dropPayoutMeso(a))


  return createPortal(
    <>
      {/* 바깥 탭으로 닫는다. 스크롤로 닫는 것은 여는 쪽이 맡는다 — `fixed` 라 스크롤하면 상자만
          제자리에 남아 어느 줄의 것인지 잃는다. */}
      <button
        type="button"
        aria-label="아이템 수익 닫기"
        onClick={props.onClose}
        className="fixed inset-0 z-[90] cursor-default"
      />
      <div
        data-testid="item-revenue-popover"
        role="dialog"
        aria-label="아이템 수익"
        style={{
          left: geometry.left,
          top: props.anchor.bottom + ITEM_POPOVER_GAP,
          width: ITEM_POPOVER_WIDTH,
        }}
        className="fixed z-[91] rounded-[12px] border border-border bg-surface p-3 shadow-lg"
      >
        {/* 꼬리: 45도 돌린 정사각형의 위·왼쪽 테두리만 남겨 상자 배경과 이어 붙인다(실패 팝오버와 동일). */}
        <span
          aria-hidden="true"
          style={{ left: geometry.caretLeft, width: ITEM_CARET_SIZE, height: ITEM_CARET_SIZE }}
          className="absolute -top-1 block rotate-45 border-l border-t border-border bg-surface"
        />
        {listed.length === 0 ? (
          // 아이템이 없어도 상자는 뜬다(결정석/합계를 말해야 하므로) — 목록 자리에 그 사실을 쓴다.
          <p className="py-1.5 text-center text-[11px] text-text-disabled">기록된 아이템이 없어요</p>
        ) : (
        <ul className="space-y-1.5 overflow-y-auto" style={{ maxHeight: ITEM_LIST_MAX_HEIGHT }}>
          {listed.map((drop, index) => {
            const iconUrl = getItemIconUrl(drop.itemName, drop.slot)
            const share = drop.priceShare ?? 1
            return (
              <li key={`${drop.itemName}|${drop.ringLevel ?? ''}|${index}`} className="flex items-center gap-2">
                {iconUrl !== null ? (
                  <img src={iconUrl} alt="" className="h-5 w-5 flex-none object-contain" />
                ) : (
                  <span className="h-5 w-5 flex-none rounded bg-surface-2" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-text">
                    {drop.itemName}
                    {drop.ringLevel !== undefined && ` ${drop.ringLevel}레벨`}
                  </span>
                  {/* 나눠 가졌을 때만 그 분배를 말한다 — 1인이면 나눈 것이 없다. */}
                  {drop.priceState === 'entered' && share > 1 && (
                    <span className="block text-[10px] tabular-nums text-text-muted">
                      {formatMesoShort(drop.priceMeso ?? 0)} ÷ {share}인
                    </span>
                  )}
                </span>
                {drop.priceState === 'entered' ? (
                  <span className="flex-none text-[11px] font-bold tabular-nums text-text">
                    {formatMesoShort(dropPayoutMeso(drop))}
                  </span>
                ) : (
                  <span className="flex-none text-[10px] text-text-disabled">미입력</span>
                )}
              </li>
            )
          })}
        </ul>
        )}
        {props.weeklyLines !== undefined && props.weeklyLines.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            <p className="text-[10px] font-bold tracking-wide text-text-muted">주차별</p>
            {props.weeklyLines.map((line) => (
              <div key={line.periodKey} className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">{line.label}</span>
                <span className="text-[11px] font-semibold tabular-nums text-text">
                  {line.meso.toLocaleString()} 메소
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 space-y-1 border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">결정석</span>
              <span className="text-[11px] font-semibold tabular-nums text-text">
                {props.crystalMeso.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">아이템</span>
              {/* 아이템 쪽만 잉크를 준다 — 카드·행 칩과 같은 색이라 "그 색이 이 몫"이 이어진다. */}
              <span className="text-[11px] font-semibold tabular-nums text-primary-ink">
                {props.itemMeso.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1">
              <span className="text-[11px] font-semibold text-text-muted">합계</span>
              <span className="text-[11px] font-bold tabular-nums text-text">
                {(props.crystalMeso + props.itemMeso).toLocaleString()}
              </span>
            </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

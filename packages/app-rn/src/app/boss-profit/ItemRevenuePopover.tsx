// 아이템 수익 내역 상자([[ADR-124]] 결정 7) — 보스 행과 캐릭터 카드가 **같은 것을 쓴다**.
//
// **화면 위에 별도 네이티브 윈도우로 띄운다.** 카드 셸은 펼침 상태에서 `overflow-clip` 이라
// ([[ADR-049]]) 트리거 옆에 절대배치하면 잘리고, 카드 루트에 붙이는 [[ADR-068]] 방식은 트리거가
// 헤더에 있을 때의 처방이라 목록 한가운데인 보스 행에는 맞지 않는다.
//
// **어느 보스에서 나왔는지는 말하지 않는다**(사용자 지정 2026-08-10) — 캐릭터 카드에서는 여러
// 보스가 섞이는데 출처를 달면 줄이 길어지고, 정작 알고 싶은 것은 무엇을 얼마에 팔았나다.
//
// **기록 한 건이 한 줄이다.** 같은 아이템을 `×N` 으로 접었다가 되돌렸다(2026-08-10) — 가격이
// 기록 단위 실판매가라([[ADR-124]] 결정 1) **같은 아이템도 건마다 판 값이 다를 수 있고**, 접으면
// 그 차이가 합계 하나로 뭉개진다. 접는 순간 이 기능이 애초에 왜 기록 단위인지를 배신한다.
//
// ══ 무엇으로 그렸나 — `react-native` 의 `Modal` (step 6 결정) ═══════════════════════
//
// step 지시가 준 세 갈래를 실제 제약에 대 보면 남는 것이 하나다.
//
// | 갈래 | 왜 아닌가 / 왜인가 |
// |---|---|
// | 화면 안 절대 배치 | **[[ADR-049]] 가 막는다** — 펼친 카드 셸이 `overflow: clip` 이라 잘린다. 셸 밖 화면 루트까지 올리려면 컨텍스트로 좌표를 흘려야 하는데 그것이 곧 포털을 손으로 만드는 일이다 |
// | `BottomSheet` | 상호작용의 **모양이 바뀐다.** 이 상자는 "지금 이 줄의 내역"이라 트리거를 지목해야 하고(꼬리가 그 일을 한다), 게다가 보스 행은 [[ADR-124]] 결정 6 때문에 이미 시트를 열어 둔 채 살아 있는 자리다 — 시트 위 시트는 다른 물건이다 |
// | **`Modal`** | 웹이 고른 것(`createPortal(document.body)` + `position: fixed`)과 **성질이 같다** — 부모의 클리핑·스태킹 밖이고 탭바까지 덮는다. 우리 `Modal` **organism** 이 아니라 그것이 감싸는 `react-native` 의 `Modal` 인 이유는 organism 이 **스크림 + 중앙 정렬**을 소유하기 때문이다(`Modal.tsx` — `bg-scrim` · `items-center`). 웹의 백드롭은 **투명**했고 상자는 트리거에 붙는다. 스크림을 켜면 그것은 팝오버가 아니라 대화상자다 |
//
// 같은 판단을 이미 한 자리가 있다 — `DropEffectOverlay` 도 organism 이 아니라 `Modal` 프리미티브를
// 직접 쓴다(전체 화면 연출이라 스크림도 패널도 필요 없다).
//
// ══ RN 으로 옮기며 갈린 것 다섯 ═══════════════════════════════════════════════════
//
// ① **`getBoundingClientRect()`(동기) → `measureInWindow()`(비동기).** 웹은 탭 핸들러 안에서 그
//    자리에서 쟀지만 RN 의 측정은 콜백으로 온다. 그래서 상자는 **열리자마자 트리에 들어가고 위치를
//    알 때까지 `opacity-0` 으로 기다린다**(측정은 다음 프레임에 오므로 눈에는 안 보이는 한 프레임).
//    좌표를 모르는 채 아무 데나 그리지 않는다 — 그것이 이 저장소가 반복해 온 "모르는 것을 단정하지
//    않는다" 이고, 실제로 [[ADR-101]] 이 없앤 "모르는 사실을 그리는 프레임"과 같은 종류다.
//    **jest 는 레이아웃을 계산하지 않아 그 콜백이 오지 않는다** — 테스트가 보는 것은 늘 `opacity: 0`
//    인 상자다(내용 단언은 그대로 성립한다).
// ② **스크롤로 닫는 코드가 사라진다.** 웹은 `fixed` 상자가 스크롤을 안 따라와 어느 줄의 것인지
//    잃으므로 스크롤 컨테이너를 들었다([[ADR-100]] 결정 4). 별도 네이티브 윈도우는 아래 화면에
//    손가락이 닿지 않아 **스크롤이 일어날 수 없다** — 계약이 사라진 게 아니라 구조가 지킨다.
//    회전(웹의 `resize`)만 남아 `Dimensions` 변화로 닫는다.
// ③ `window.innerWidth` → `useWindowDimensions().width`.
// ④ `overflow-y-auto` + `maxHeight` → `ScrollView` + `maxHeight`.
// ⑤ 글자가 상자에서 `Text` 로 내려온다(RN 은 글자 스타일을 상속하지 않는다). `truncate` 는
//    `numberOfLines={1}` 이다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'

import { formatMesoShort } from '@core/lib/boss-profit-delta'
import { dropPayoutMeso } from '@core/lib/drop-price'
import type { RecordedDrop } from '@core/types/drops'
import { getItemIconUrl } from '@core/lib/item-icons'
import { anchorPopover } from '@core/lib/popover-anchor'

import { TABULAR_NUMS } from '../../lib/text-styles'

export const ITEM_POPOVER_WIDTH = 248
const ITEM_POPOVER_EDGE_GAP = 12
const ITEM_CARET_SIZE = 8
/** 트리거 밑변과 상자 윗변 사이 — 꼬리(8px의 절반이 삐져나온다)가 닿아 보이는 최소값. */
const ITEM_POPOVER_GAP = 8
/** 목록이 길어지면 상자가 화면을 넘긴다 — 안에서 스크롤시킨다. */
const ITEM_LIST_MAX_HEIGHT = 260

/** 트리거의 **윈도우 기준** 사각형 — 웹 `DOMRect` 자리. `measureInWindow` 가 주는 네 값 그대로다. */
export interface PopoverAnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export interface AnchoredPopover {
  /**
   * 트리거에 다는 ref — 이것을 재서 상자를 앉힌다.
   *
   * **`RefObject` 가 아니라 콜백 ref 다.** 훅이 `RefObject` 를 객체에 담아 돌려주면 호출부의
   * `popover.toggle` 같은 평범한 프로퍼티 접근까지 `react-hooks/refs` 가 "렌더 중 ref 접근"으로
   * 읽는다(실측 — 이 파일 하나 때문에 lint 에러 14건). 노드를 훅 안에 가둬 두면 밖으로 나가는
   * 것은 함수와 값뿐이라 그 물음 자체가 사라진다. 웹의 `use-measured-height`([[ADR-112]] 결정 3)
   * 가 같은 형태를 고른 것과 이유가 겹친다.
   */
  ref: (node: View | null) => void
  /** 열려 있는가. 위치를 아직 몰라도 `true` 일 수 있다(파일 머리 ①). */
  isOpen: boolean
  /** 잰 결과. `null` 이면 아직 모른다 — 상자는 그리되 보이지 않는다. */
  anchor: PopoverAnchorRect | null
  toggle: () => void
  close: () => void
}

/**
 * 트리거를 재서 팝오버를 여닫는다 — 웹의 `chipRef` + `anchor` state + `openPopover` + 스크롤 닫기
 * 효과가 하던 일 전부.
 *
 * **호출부가 셋이라 여기 산다**(보스 행 · 주차 소계 행 · 캐릭터 카드) — [[ADR-094]] 결정 1 의
 * "호출부 2곳 이상". 팝오버 자신의 관심사라 별도 파일로 가르지 않는다.
 */
export function useAnchoredPopover(): AnchoredPopover {
  const nodeRef = useRef<View | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<PopoverAnchorRect | null>(null)

  const ref = useCallback((node: View | null) => {
    nodeRef.current = node
  }, [])

  function close(): void {
    setIsOpen(false)
    setAnchor(null)
  }

  function toggle(): void {
    if (isOpen) {
      close()
      return
    }
    setIsOpen(true)
    nodeRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ left: x, top: y, width, height })
    })
  }

  // 회전하면 잰 좌표가 거짓이 된다 — 웹의 `resize` 리스너 자리다. 스크롤 쪽은 구조가 대신
  // 지키므로(파일 머리 ②) 여기 없다.
  useEffect(() => {
    if (!isOpen) return
    const subscription = Dimensions.addEventListener('change', () => {
      setIsOpen(false)
      setAnchor(null)
    })
    return () => subscription.remove()
  }, [isOpen])

  return { ref, isOpen, anchor, toggle, close }
}

export function ItemRevenuePopover(props: {
  drops: RecordedDrop[]
  /** `null` 이면 아직 못 쟀다 — 그리되 보이지 않는다(파일 머리 ①). */
  anchor: PopoverAnchorRect | null
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
  const { width: windowWidth } = useWindowDimensions()
  const { anchor } = props

  const geometry = anchorPopover({
    containerWidth: windowWidth,
    anchorCenterX: anchor === null ? 0 : anchor.left + anchor.width / 2,
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

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={props.onClose}>
      {/* 바깥 탭으로 닫는다. **스크림이 없다** — 웹의 백드롭도 투명했다(파일 머리 표). */}
      <Pressable aria-label="아이템 수익 닫기" onPress={props.onClose} className="flex-1" />
      <View
        testID="item-revenue-popover"
        role="dialog"
        aria-label="아이템 수익"
        style={{
          left: geometry.left,
          top: anchor === null ? 0 : anchor.top + anchor.height + ITEM_POPOVER_GAP,
          width: ITEM_POPOVER_WIDTH,
        }}
        className={`absolute rounded-[12px] border border-border bg-surface p-3 shadow-lg${
          anchor === null ? ' opacity-0' : ''
        }`}
      >
        {/* 꼬리: 45도 돌린 정사각형의 위·왼쪽 테두리만 남겨 상자 배경과 이어 붙인다. */}
        <View
          aria-hidden
          style={{ left: geometry.caretLeft, width: ITEM_CARET_SIZE, height: ITEM_CARET_SIZE, top: -4 }}
          className="absolute rotate-45 border-l border-t border-border bg-surface"
        />
        {listed.length === 0 ? (
          // 아이템이 없어도 상자는 뜬다(결정석/합계를 말해야 하므로) — 목록 자리에 그 사실을 쓴다.
          <Text className="py-1.5 text-center text-[11px] text-text-disabled">기록된 아이템이 없어요</Text>
        ) : (
          <ScrollView style={{ maxHeight: ITEM_LIST_MAX_HEIGHT }} contentContainerClassName="gap-1.5">
            {listed.map((drop, index) => {
              const iconUrl = getItemIconUrl(drop.itemName, drop.slot)
              const share = drop.priceShare ?? 1
              return (
                <View
                  key={`${drop.itemName}|${drop.ringLevel ?? ''}|${index}`}
                  className="flex-row items-center gap-2"
                >
                  {iconUrl !== null ? (
                    <Image source={iconUrl} resizeMode="contain" className="h-5 w-5 shrink-0" />
                  ) : (
                    <View className="h-5 w-5 shrink-0 rounded bg-surface-2" />
                  )}
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-[11px] font-semibold text-text">
                      {drop.itemName}
                      {drop.ringLevel !== undefined && ` ${drop.ringLevel}레벨`}
                    </Text>
                    {/* 나눠 가졌을 때만 그 분배를 말한다 — 1인이면 나눈 것이 없다. */}
                    {drop.priceState === 'entered' && share > 1 && (
                      <Text className="text-[10px] text-text-muted" style={TABULAR_NUMS}>
                        {formatMesoShort(drop.priceMeso ?? 0)} ÷ {share}인
                      </Text>
                    )}
                  </View>
                  {/* **[[ADR-124]]: 값이 없는 줄에 0 을 쓰지 않는다.** 미입력은 "0원에 팔았다"가
                      아니라 "아직 안 적었다" 이고, 그 둘을 같은 숫자로 그리면 사용자의 기록이
                      조용히 거짓이 된다. 합산에서 0으로 접히는 것(`dropPayoutMeso`)과 화면이
                      말하는 것은 다른 층이다. */}
                  {drop.priceState === 'entered' ? (
                    <Text className="shrink-0 text-[11px] font-bold text-text" style={TABULAR_NUMS}>
                      {formatMesoShort(dropPayoutMeso(drop))}
                    </Text>
                  ) : (
                    <Text className="shrink-0 text-[10px] text-text-disabled">미입력</Text>
                  )}
                </View>
              )
            })}
          </ScrollView>
        )}
        {props.weeklyLines !== undefined && props.weeklyLines.length > 0 && (
          <View className="mt-2 gap-1 border-t border-border pt-2">
            <Text className="text-[10px] font-bold tracking-wide text-text-muted">주차별</Text>
            {props.weeklyLines.map((line) => (
              <View key={line.periodKey} className="flex-row items-center justify-between">
                <Text className="text-[11px] text-text-muted">{line.label}</Text>
                <Text className="text-[11px] font-semibold text-text" style={TABULAR_NUMS}>
                  {line.meso.toLocaleString()} 메소
                </Text>
              </View>
            ))}
          </View>
        )}
        <View className="mt-2 gap-1 border-t border-border pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] text-text-muted">결정석</Text>
            <Text className="text-[11px] font-semibold text-text" style={TABULAR_NUMS}>
              {props.crystalMeso.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] text-text-muted">아이템</Text>
            {/* 아이템 쪽만 잉크를 준다 — 카드·행 칩과 같은 색이라 "그 색이 이 몫"이 이어진다. */}
            <Text className="text-[11px] font-semibold text-primary-ink" style={TABULAR_NUMS}>
              {props.itemMeso.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-1">
            <Text className="text-[11px] font-semibold text-text-muted">합계</Text>
            <Text className="text-[11px] font-bold text-text" style={TABULAR_NUMS}>
              {(props.crystalMeso + props.itemMeso).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

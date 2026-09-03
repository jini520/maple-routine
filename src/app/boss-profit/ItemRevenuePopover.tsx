/**
 * 아이템 수익 내역 상자. 보스 행과 캐릭터 카드가 같은 것을 쓴다.
 *
 * 화면 위에 별도 네이티브 윈도우로 띄운다. 카드 셸은 펼침 상태에서 `overflow-clip` 이라 트리거
 * 옆에 절대배치하면 잘리고, 카드 루트에 붙이는 방식은 트리거가 헤더에 있을 때의 처방이라 목록
 * 한가운데인 보스 행에는 맞지 않는다.
 *
 * 어느 보스에서 나왔는지는 말하지 않는다. 캐릭터 카드에서는 여러 보스가 섞이는데 출처를 달면
 * 줄이 길어지고, 정작 알고 싶은 것은 무엇을 얼마에 팔았나다.
 *
 * 기록 한 건이 한 줄이다. 가격이 기록 단위 실판매가라 같은 아이템도 건마다 판 값이 다를 수
 * 있고, `×N` 으로 접으면 그 차이가 합계 하나로 뭉개진다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'

import { formatMesoShort } from '../../lib/boss/boss-profit-delta'
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import type { RecordedDrop } from '../../types/drops'
import { getItemIconUrl } from '../../lib/assets/asset-lookup'
import { anchorPopover } from '../../lib/popover-anchor'

import { Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'

export const ITEM_POPOVER_WIDTH = 248
const ITEM_POPOVER_EDGE_GAP = 12
const ITEM_CARET_SIZE = 8
/** 트리거 밑변과 상자 윗변 사이. 꼬리(8px의 절반이 삐져나온다)가 닿아 보이는 최소값. */
const ITEM_POPOVER_GAP = 8
/** 목록이 길어지면 상자가 화면을 넘긴다. 안에서 스크롤시킨다. */
const ITEM_LIST_MAX_HEIGHT = 260

/** 트리거의 **윈도우 기준** 사각형. 웹 `DOMRect` 자리. `measureInWindow` 가 주는 네 값 그대로다. */
export interface PopoverAnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export interface AnchoredPopover {
  /**
   * 트리거에 다는 ref. 이것을 재서 상자를 앉힌다.
   *
   * `RefObject` 가 아니라 콜백 ref 다. 훅이 `RefObject` 를 객체에 담아 돌려주면 호출부의
   * `popover.toggle` 같은 평범한 프로퍼티 접근까지 `react-hooks/refs` 가 렌더 중 ref 접근으로
   * 읽는다. 노드를 훅 안에 가둬 두면 밖으로 나가는 것은 함수와 값뿐이라 그 물음 자체가 사라진다.
   */
  ref: (node: View | null) => void
  /** 열려 있는가. 위치를 아직 몰라도 `true` 일 수 있다. */
  isOpen: boolean
  /** 잰 결과. `null` 이면 아직 모른다. 상자는 그리되 보이지 않는다. */
  anchor: PopoverAnchorRect | null
  toggle: () => void
  close: () => void
}

/**
 * 트리거를 재서 팝오버를 여닫는다.
 *
 * 호출부가 셋이라 여기 산다(보스 행 · 주차 소계 행 · 캐릭터 카드). 팝오버 자신의 관심사라
 * 별도 파일로 가르지 않는다.
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

  // 회전하면 잰 좌표가 거짓이 된다. 스크롤 쪽은 별도 네이티브 윈도우라는 구조가 대신 지킨다.
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
  /** `null` 이면 아직 못 쟀다. 그리되 보이지 않는다. */
  anchor: PopoverAnchorRect | null
  onClose: () => void
  /**
   * 이 층의 결정석 합과 아이템 합.
   *
   * 목록에서 더하지 않고 받는다. 목록은 이름을 댈 수 있는 것만 담는데 그게 아이템 전부가 아닐
   * 수 있다. 월간 탭에서는 주간 보스 수익이 주차 소계로 뭉쳐 들어와 그 안의 아이템을 낱개로
   * 못 꺼내고, 목록 합으로 계산하면 합계가 카드 숫자와 어긋난다.
   */
  crystalMeso: number
  itemMeso: number
  /**
   * 낱개로 못 펼치는 몫을 주차 한 줄씩 말한다.
   *
   * 월간 탭의 캐릭터 카드에서만 쓴다. 그 층의 주간 수익은 주차 소계로 뭉쳐 들어와 목록
   * (`drops`)에 낱개가 없다. 아이템까지 보려면 그 주차 행을 열면 된다.
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

  // 스킵은 싣지 않는다. 값을 매기지 않기로 한 것이라 수익 내역에서 할 말이 없다. 미입력은
  // 남긴다. 그 줄이 곧 여기 값이 비었다 는 신호다.
  //
  // 값이 큰 것부터 낸다. 맨 위가 그 기간의 최대 수확이고 미입력(0)은 자연히 바닥으로 간다.
  // `sort` 는 안정 정렬이라 같은 값끼리는 기록 순서가 유지된다.
  const listed = props.drops
    .filter((drop) => drop.priceState !== 'excluded')
    .slice()
    .sort((a, b) => dropPayoutMeso(b) - dropPayoutMeso(a))

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={props.onClose}>
      {/* 바깥 탭으로 닫는다. **스크림이 없다**. */}
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
          // 아이템이 없어도 상자는 뜬다(결정석/합계를 말해야 하므로). 목록 자리에 그 사실을 쓴다.
          <Text className="py-1.5 text-center text-11 text-text-disabled">기록된 아이템이 없어요</Text>
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
                    <Text numberOfLines={1} className="text-11 font-semibold text-text">
                      {drop.itemName}
                      {drop.ringLevel !== undefined && ` ${drop.ringLevel}레벨`}
                    </Text>
                    {/* 나눠 가졌을 때만 그 분배를 말한다. 1인이면 나눈 것이 없다. */}
                    {drop.priceState === 'entered' && share > 1 && (
                      <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
                        {formatMesoShort(drop.priceMeso ?? 0)} ÷ {share}인
                      </Text>
                    )}
                  </View>
                  {/* 값이 없는 줄에 0 을 쓰지 않는다. 미입력은 0원에 팔았다 가 아니라 아직 안
                      적었다 이고, 그 둘을 같은 숫자로 그리면 사용자의 기록이 조용히 거짓이
                      된다. 합산에서 0 으로 접히는 것과 화면이 말하는 것은 다른 층이다. */}
                  {drop.priceState === 'entered' ? (
                    <Text className="shrink-0 text-11 font-bold text-text" style={TABULAR_NUMS}>
                      {formatMesoShort(dropPayoutMeso(drop))}
                    </Text>
                  ) : (
                    <Text className="shrink-0 text-10 text-text-disabled">미입력</Text>
                  )}
                </View>
              )
            })}
          </ScrollView>
        )}
        {props.weeklyLines !== undefined && props.weeklyLines.length > 0 && (
          <View className="mt-2 gap-1 border-t border-border pt-2">
            <Text className="text-10 font-bold tracking-wide text-text-muted">주차별</Text>
            {props.weeklyLines.map((line) => (
              <View key={line.periodKey} className="flex-row items-center justify-between">
                <Text className="text-11 text-text-muted">{line.label}</Text>
                <Text className="text-11 font-semibold text-text" style={TABULAR_NUMS}>
                  {line.meso.toLocaleString()} 메소
                </Text>
              </View>
            ))}
          </View>
        )}
        <View className="mt-2 gap-1 border-t border-border pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-11 text-text-muted">결정석</Text>
            <Text className="text-11 font-semibold text-text" style={TABULAR_NUMS}>
              {props.crystalMeso.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-11 text-text-muted">아이템</Text>
            {/* 아이템 쪽만 잉크를 준다. 카드·행 칩과 같은 색이라 "그 색이 이 몫"이 이어진다. */}
            <Text className="text-11 font-semibold text-primary-ink" style={TABULAR_NUMS}>
              {props.itemMeso.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-1">
            <Text className="text-11 font-semibold text-text-muted">합계</Text>
            <Text className="text-11 font-bold text-text" style={TABULAR_NUMS}>
              {(props.crystalMeso + props.itemMeso).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

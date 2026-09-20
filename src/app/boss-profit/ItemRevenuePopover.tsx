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
 *
 * 값을 매긴 기록만 싣는다. 미입력을 0 이나 빈 줄로 그리면 적지 않은 사실이 판 값처럼 읽힌다.
 */
import { Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'

import { type PopoverAnchorRect } from '../../hooks/useAnchoredPopover'

import { formatMesoShort } from '../../lib/boss/boss-profit-delta'
import { sortDropsForDisplay, takeTopDropsByPayout } from '../../lib/drop/drop-order'
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import type { RecordedDrop } from '../../types/drops'
import { dropItemIconOf } from '../../lib/assets/asset-lookup'
import { dropItemNameOf } from '../../lib/drop/drop-items'
import { anchorPopover } from '../../lib/popover-anchor'

import { Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'

export const ITEM_POPOVER_WIDTH = 248
const ITEM_POPOVER_EDGE_GAP = 12
const ITEM_CARET_SIZE = 8
/** 트리거 밑변과 상자 윗변 사이. 꼬리(8px의 절반이 삐져나온다)가 닿아 보이는 최소값. */
const ITEM_POPOVER_GAP = 8
/** 목록 상자의 높이 상한. 넘치면 안에서 스크롤한다. */
const ITEM_LIST_MAX_HEIGHT = 260

export function ItemRevenuePopover(props: {
  drops: RecordedDrop[]
  /** `null` 이면 아직 못 쟀다. 그리되 보이지 않는다. */
  anchor: PopoverAnchorRect | null
  onClose: () => void
  /** 이 층의 결정석 합과 아이템 합. 합계 줄은 목록이 아니라 이 두 값으로 만든다. */
  crystalMeso: number
  /**
   * `crystalMeso` **안에 든** 월간 보스 몫. 0 이거나 안 주면 결정석이 한 줄이다.
   *
   * 주간 몫을 따로 안 받는 것은 두 줄의 합이 합계 줄과 늘 맞아야 하기 때문이다. 여기서 빼서
   * 만들면 어긋날 수가 없다.
   */
  monthlyCrystalMeso?: number
  itemMeso: number
  /** 주차마다 한 줄씩 서는 아이템 몫. 월간 탭의 캐릭터 카드에서만 쓴다. */
  weeklyLines?: { periodKey: string; label: string; meso: number }[]
  /**
   * 목록에 실을 건수. 주면 몫이 큰 순 상위 N 건과 나머지 한 줄이고, 안 주면 전부를
   * `sortDropsForDisplay` 차례로 싣는다.
   *
   * 보스 행 · 주차 소계 상자는 안 준다. 그 상자는 같은 행의 아이콘 스택과 맨 앞이 맞아야 한다.
   */
  limit?: number
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

  // 자르지 않는 차례는 보스 행의 아이콘 스택과 **같은 함수**가 정한다. 갈라 두면 스택 맨 앞의
  // 그림과 목록 맨 위의 줄이 서로 다른 아이템이 된다.
  const top =
    props.limit === undefined
      ? {
          shown: sortDropsForDisplay(props.drops.filter((drop) => drop.priceState === 'entered')),
          restCount: 0,
          restMeso: 0,
        }
      : takeTopDropsByPayout(props.drops, props.limit)
  const listed = top.shown

  // 결정석은 한 줄이 기본이고, 월간 보스 몫이 있을 때만 둘로 갈린다. 월간 보스를 안 잡은 주가
  // 대부분이라 늘 두 줄로 두면 `월간 결정석 0` 이 없는 것을 있다고 말한다.
  const monthlyCrystal = props.monthlyCrystalMeso ?? 0
  const crystalLines =
    monthlyCrystal > 0
      ? [
          { label: '주간 결정석', meso: props.crystalMeso - monthlyCrystal },
          { label: '월간 결정석', meso: monthlyCrystal },
        ]
      : [{ label: '결정석', meso: props.crystalMeso }]

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
          // 아이템이 없어도 상자는 뜬다(결정석/합계를 말해야 하므로). 기록이 없을 때도 미입력만
          // 있을 때도 참인 문장이어야 한다.
          <Text className="py-1.5 text-center text-11 text-text-disabled">가격을 입력한 아이템이 없어요</Text>
        ) : (
          <ScrollView
            testID="item-revenue-list"
            style={{ maxHeight: ITEM_LIST_MAX_HEIGHT }}
            contentContainerClassName="gap-1.5"
          >
            {listed.map((drop, index) => {
              const iconUrl = dropItemIconOf(drop.itemKey)
              const share = drop.priceShare ?? 1
              return (
                <View
                  key={`${drop.itemKey ?? drop.itemName}|${drop.ringLevel ?? ''}|${index}`}
                  className="flex-row items-center gap-2"
                >
                  {iconUrl !== null ? (
                    <Image source={iconUrl} resizeMode="contain" className="h-5 w-5 shrink-0" />
                  ) : (
                    <View className="h-5 w-5 shrink-0 rounded bg-surface-2" />
                  )}
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-11 font-semibold text-text">
                      {dropItemNameOf(drop.itemKey, drop.itemName)}
                      {drop.ringLevel !== undefined && ` ${drop.ringLevel}레벨`}
                    </Text>
                    {/* 나눠 가졌을 때만 그 분배를 말한다. 1인이면 나눈 것이 없다. */}
                    {share > 1 && (
                      <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
                        {formatMesoShort(drop.priceMeso ?? 0)} ÷ {share}인
                      </Text>
                    )}
                  </View>
                  <Text className="shrink-0 text-11 font-bold text-text" style={TABULAR_NUMS}>
                    {formatMesoShort(dropPayoutMeso(drop))}
                  </Text>
                </View>
              )
            })}
            {top.restCount > 0 && (
              <View className="flex-row items-center justify-between">
                <Text className="text-11 text-text-muted">외 {top.restCount}건</Text>
                <Text className="shrink-0 text-11 font-bold text-text" style={TABULAR_NUMS}>
                  {formatMesoShort(top.restMeso)}
                </Text>
              </View>
            )}
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
          {crystalLines.map((line) => (
            <View key={line.label} className="flex-row items-center justify-between">
              <Text className="text-11 text-text-muted">{line.label}</Text>
              <Text className="text-11 font-semibold text-text" style={TABULAR_NUMS}>
                {line.meso.toLocaleString()}
              </Text>
            </View>
          ))}
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

/**
 * 인벤토리 격자. 한 줄에 다섯 칸이고, 아이템이 없는 자리도 빈 칸으로 채워 화면 아래 끝까지 이어진다. 게임 인벤토리처럼 판
 * 전체가 칸으로 보여야 가방으로 읽힌다.
 */
import { useState } from 'react'
import { Image, Pressable, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '../../components/atoms'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { InventoryCell } from '../../features/inventory/cells'
import { inventoryItemIconOf, inventoryItemNameOf } from '../../features/inventory/item-look'
import type { InventoryFace } from '../../features/inventory/load'
import { useThemeStore } from '../../features/theme/store'
import { resolveBottomBarMetrics } from '../../lib/bottom-bar-metrics'
import { getThemeDefinition } from '../../lib/theme/theme-registry'

const COLUMNS = 5
const GAP = 6
const PANEL_PADDING = 10
const ICON_SIZE = 36
const FACE_SIZE = 18

/** 칸에 서는 사각형의 자리. 팝오버의 꼬리가 이 칸을 가리킨다. */
export interface CellRect {
  left: number
  top: number
  width: number
  height: number
}

/** 숫자 둘레의 번짐. 바탕과 반대 밝기여야 그림 위에서도 숫자가 읽힌다. */
function useCountHalo(): string {
  const theme = getThemeDefinition(useThemeStore((state) => state.theme))
  return theme.mode === 'dark' ? theme.bg : '#FFFFFF'
}

function CellView(props: {
  cell: InventoryCell
  size: number
  face: InventoryFace | null
  halo: string
  index: number
  onPress: (cell: InventoryCell, rect: CellRect | null) => void
}): React.JSX.Element {
  const { cell, size } = props
  const icon = inventoryItemIconOf(cell.itemKey)
  const name = inventoryItemNameOf(cell.itemKey)
  const showsCount = cell.itemKindKey !== 'equipment'
  const count = String(cell.count)
  const [node, setNode] = useState<View | null>(null)
  return (
    <Pressable
      ref={setNode}
      testID={`inventory-cell-${props.index}`}
      role="button"
      aria-label={[name, cell.tag, cell.ringLevel === null ? null : `${cell.ringLevel}레벨`, showsCount ? `${cell.count}개` : null]
        .filter((part) => part !== null)
        .join(' ')}
      onPress={() => {
        // 팝오버는 자리를 재기 전에도 연다. 재고 나면 꼬리가 이 칸을 가리킨다.
        props.onPress(cell, null)
        node?.measureInWindow((left, top, width, height) => props.onPress(cell, { left, top, width, height }))
      }}
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-[10px] bg-card-inset active:opacity-70"
    >
      {icon === null ? (
        <View style={{ width: ICON_SIZE, height: ICON_SIZE }} />
      ) : (
        // 도트 그림이라 늘리면 뭉갠다. 원본 비율 그대로 둔다.
        <Image source={icon} style={{ width: ICON_SIZE, height: ICON_SIZE }} resizeMode="contain" aria-hidden />
      )}
      {cell.tag !== null && (
        <Text className="absolute right-[5px] top-[3px] text-9 text-text-muted" aria-hidden>
          {cell.tag}
        </Text>
      )}
      {cell.faceOcid !== null && props.face !== null && (
        <View className="absolute left-[3px] top-[3px]" aria-hidden>
          <CharacterAvatar
            imageUrl={props.face.imageUrl}
            name={props.face.name}
            size={FACE_SIZE}
            unavailable={props.face.unavailable}
            mirrored
          />
        </View>
      )}
      {cell.ringLevel !== null && (
        // 그림 오른쪽 아래. 개수와 마주 보는 자리라 왼쪽 위 얼굴 · 오른쪽 위 경로 글자와 겹치지 않는다.
        <View className="absolute bottom-2 right-[5px] rounded-full bg-primary px-1 py-px" aria-hidden>
          <Text className="text-9 font-bold leading-none text-on-primary">lv{cell.ringLevel}</Text>
        </View>
      )}
      {showsCount && (
        // 숫자의 가운데를 칸 왼쪽에서 15 에 둔다. 한 자리만 2 더 왼쪽이다. 가운데에 두면 그림에 너무 붙는다.
        <Text
          aria-hidden
          className="absolute bottom-2 text-center text-xs font-bold leading-3 text-text"
          style={[
            TABULAR_NUMS,
            {
              left: -5,
              width: 40,
              letterSpacing: -0.5,
              transform: [{ translateX: count.length === 1 ? -2 : 0 }],
              textShadowColor: props.halo,
              textShadowRadius: 2,
              textShadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          {count}
        </Text>
      )}
    </Pressable>
  )
}

/**
 * @param props.faces 칸의 `faceOcid` → 얼굴
 * @param props.onPressCell 칸을 누르면 그 칸과 화면에서의 자리를 받는다
 */
export function InventoryGrid(props: {
  cells: readonly InventoryCell[]
  faces: Readonly<Record<string, InventoryFace>>
  onPressCell: (cell: InventoryCell, rect: CellRect | null) => void
}): React.JSX.Element {
  const halo = useCountHalo()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [width, setWidth] = useState(0)
  const [top, setTop] = useState<number | null>(null)
  const [node, setNode] = useState<View | null>(null)

  const size = width === 0 ? 0 : (width - PANEL_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS
  // 판이 화면 아래 끝(하단바 위)까지 닿을 만큼 줄을 채운다. 아이템이 그보다 많으면 아이템 수만큼 선다.
  const bottom = windowHeight - insets.bottom - resolveBottomBarMetrics(windowWidth).spacePx
  const fitRows = top === null || size <= 0 ? 0 : Math.floor((bottom - top - PANEL_PADDING * 2 + GAP) / (size + GAP))
  const rows = Math.max(Math.ceil(props.cells.length / COLUMNS), fitRows, 1)
  const empties = rows * COLUMNS - props.cells.length

  function onLayout(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width)
    node?.measureInWindow((_left, measuredTop) => setTop(measuredTop))
  }

  return (
    <View
      ref={setNode}
      testID="inventory-grid"
      onLayout={onLayout}
      className="flex-row flex-wrap rounded-b-[14px] bg-surface"
      style={{ padding: PANEL_PADDING, gap: GAP }}
    >
      {size > 0 &&
        props.cells.map((cell, index) => (
          <CellView
            key={`${cell.kind}-${cell.kind === 'drop' ? cell.drop.dropRecordId : cell.kind === 'item' ? cell.item.id : 'hunt'}`}
            cell={cell}
            size={size}
            face={cell.faceOcid === null ? null : (props.faces[cell.faceOcid] ?? null)}
            halo={halo}
            index={index}
            onPress={props.onPressCell}
          />
        ))}
      {size > 0 &&
        Array.from({ length: empties }, (_unused, index) => (
          <View key={`empty-${index}`} style={{ width: size, height: size }} className="rounded-[10px] bg-card-inset" />
        ))}
    </View>
  )
}

/**
 * 사냥 전리품 판매의 아이템 줄. 조각 · 소비 · 이벤트 칸이 같이 쓴다.
 *
 * 경매장에 파는 아이템(조각 · 이벤트)은 블록 하나에 개당 가격 · 개수 두 줄이 서고, NPC 가격이 정해진 소비 아이템은
 * 개수만 치므로 한 줄이다. 둘 다 그림 · 이름이 앞에 서서 무엇을 팔았는지가 줄마다 보인다.
 */
import { Image, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { getItemIconUrlByFile } from '../../../lib/assets/asset-lookup'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'

/** 블록 머리의 그림 한 변. */
const BLOCK_ICON_SIZE = 26

/** 아이템 그림. 그림을 못 찾으면 자리만 지킨다. 이름의 시작점이 줄마다 갈리지 않게. */
function LootIcon(props: { iconFile: string }): React.JSX.Element {
  const icon = getItemIconUrlByFile(props.iconFile)
  const size = { width: BLOCK_ICON_SIZE, height: BLOCK_ICON_SIZE }
  // 아이템 아이콘은 원본 비율 그대로 둔다. 상자에 맞춰 늘리면 도트가 뭉갠다.
  return icon === null ? <View style={size} /> : <Image source={icon} style={size} resizeMode="contain" aria-hidden />
}

/**
 * 경매장 아이템 블록. 머리는 그림 · 이름이고 오른쪽에 `right`(조각의 보유 개수)가 선다.
 *
 * @example
 * <LootBlock iconFile="sol_erda_fragment.webp" name="솔 에르다 조각" right={held}>
 *   <LootLine label="개당 가격" unit="메소">…</LootLine>
 * </LootBlock>
 */
export function LootBlock(props: {
  iconFile: string
  name: string
  right?: React.ReactNode
  children: React.ReactNode
  testID?: string
}): React.JSX.Element {
  return (
    <View testID={props.testID} className="gap-0.5 rounded-[10px] bg-card-inset px-3 py-2">
      <View className="min-h-[30px] flex-row items-center gap-2.5">
        <LootIcon iconFile={props.iconFile} />
        <Text className="shrink text-13 font-semibold text-text">{props.name}</Text>
        {props.right !== undefined && (
          <View className="ml-auto shrink-0 flex-row items-baseline gap-1">{props.right}</View>
        )}
      </View>
      {props.children}
    </View>
  )
}

/** 블록 안의 값 한 줄. 이름 · 치는 칸 · 단위. */
export function LootLine(props: { label: string; unit: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="min-h-7 flex-row items-center gap-3">
      <Text className="shrink-0 text-xs text-text-muted">{props.label}</Text>
      {props.children}
      <Text className="-ml-1.5 shrink-0 text-xs font-semibold text-text-muted">{props.unit}</Text>
    </View>
  )
}

/** 소비 아이템 한 줄. 이름 아래에 NPC 개당 가격이 작게 서고, 오른쪽이 개수 칸이다. */
export function NpcLootRow(props: {
  iconFile: string
  name: string
  npcPriceMeso: number
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="min-h-[52px] flex-row items-center gap-2.5 rounded-[10px] bg-card-inset px-3 py-2">
      <LootIcon iconFile={props.iconFile} />
      <View className="shrink gap-0.5">
        <Text className="text-13 font-semibold text-text">{props.name}</Text>
        <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
          개당 {props.npcPriceMeso.toLocaleString()} 메소
        </Text>
      </View>
      {props.children}
      <Text className="-ml-1.5 shrink-0 text-xs font-semibold text-text-muted">개</Text>
    </View>
  )
}

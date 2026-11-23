/**
 * MASPI 목록의 아이템 줄. 카드 하나에 그림 · 이름 · 기준가와 전일 대비 · 범위, 오른쪽에 최근 30일 작은 꺾은선이다.
 */
import { Image, Pressable, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { SparkLine } from '../../../components/molecules/SparkLine/SparkLine'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { marketItemFace } from '../../../features/market/catalog'
import { formatChangePct, formatMarketRange, toneOf, trendOf } from '../../../features/market/format'
import { getAssetImage } from '../../../lib/assets/asset-lookup'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import type { MarketEntry } from '../../../server/market'
import { useThemeAppearance } from '../../../theme/context'
import { TONE_TEXT, toneColor } from './tone'

/** 아이템 그림 한 변 */
const ICON_SIZE = 32

/**
 * 아이템 그림. 그림이 없으면 자리만 지켜 이름의 시작점이 줄마다 갈리지 않게 한다.
 * 원본 비율 그대로 둔다. 상자에 맞춰 늘리면 도트가 뭉갠다.
 */
export function MarketItemIcon(props: { iconAssetId: string | null }): React.JSX.Element {
  const icon = getAssetImage(props.iconAssetId)
  const size = { width: ICON_SIZE, height: ICON_SIZE }
  return icon === null ? <View style={size} /> : <Image source={icon} style={size} resizeMode="contain" aria-hidden />
}

export function MarketRow(props: { entry: MarketEntry; onPress: () => void }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const { entry } = props
  const face = marketItemFace(entry.itemKey)

  return (
    <Pressable
      testID={`market-row-${entry.itemKey}`}
      role="button"
      aria-label={face.name}
      onPress={props.onPress}
      className="flex-row items-center gap-2.5 rounded-[14px] bg-surface py-3 pl-3 pr-2.5"
    >
      <MarketItemIcon iconAssetId={face.iconAssetId} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-text">{face.name}</Text>
        <View className="flex-row items-baseline gap-1.5">
          <Text className="text-sm font-bold text-text" style={TABULAR_NUMS}>
            {formatMesoUnits(entry.price)}
          </Text>
          <Text className={`text-xs font-semibold ${TONE_TEXT[toneOf(entry.changePct)]}`} style={TABULAR_NUMS}>
            {formatChangePct(entry.changePct)}
          </Text>
        </View>
        <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
          범위 {formatMarketRange(entry.low, entry.high)}
        </Text>
      </View>
      <View style={{ width: 64 }}>
        <SparkLine values={entry.spark} color={toneColor(trendOf(entry.spark), definition)} height={32} strokeWidth={1.5} inset={3} />
      </View>
    </Pressable>
  )
}

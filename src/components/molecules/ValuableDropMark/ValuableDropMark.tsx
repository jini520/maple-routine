import { useId } from 'react'
import { Image, View } from 'react-native'
import { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { AURORA } from '../../../constants/style/aurora'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { dropItemIconOf } from '../../../lib/assets/asset-lookup'
import { Svg } from '../../../lib/nativewind-interop'
import type { RecordedDrop } from '../../../types/drops'
import { AuroraText } from '../AuroraText/AuroraText'

/** 보이는 그림 수. 넘치면 나머지 개수를 `+N` 으로 적는다. */
const MAX_ICONS = 3
/** 그림 뒤 빛의 지름. 그림(20)보다 커야 가장자리로 번져 보인다. */
const GLOW_SIZE = 30

/** 그림 뒤의 거의 안 보이는 오로라 빛. 그림을 덮지 않을 만큼만 옅게 깐다. RN 에 `drop-shadow` 가 없어 방사 그라디언트로 그린다. */
function IconGlow(): React.JSX.Element {
  const id = useId()
  const r = GLOW_SIZE / 2
  return (
    <Svg width={GLOW_SIZE} height={GLOW_SIZE} style={{ position: 'absolute', left: -5, top: -5 }} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={AURORA.cyan} stopOpacity={0.18} />
          <Stop offset="50%" stopColor={AURORA.lilac} stopOpacity={0.08} />
          <Stop offset="100%" stopColor={AURORA.lilac} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  )
}

/**
 * 고가 드롭 표시. 먹은 고가 아이템 그림을 틀 없이 늘어놓고 나머지 개수를 오로라 글자로 적는 줄.
 *
 * 그림은 겹치지 않는다. 겹치면 무엇을 먹었는지 알아보기 어렵다.
 */
export function ValuableDropMark(props: { drops: RecordedDrop[]; label: string }): React.JSX.Element {
  const shown = props.drops.slice(0, MAX_ICONS)
  const extra = props.drops.length - shown.length

  return (
    <View testID="valuable-drop-mark" role="img" aria-label={props.label} className="flex-row items-center gap-1">
      {shown.map((drop, index) => {
        const url = dropItemIconOf(drop.itemKey)
        return (
          <View key={`${drop.itemKey ?? drop.itemName}-${index}`} testID="valuable-drop-icon" className="h-5 w-5">
            <IconGlow />
            {url === null ? (
              <View className="h-5 w-5 rounded-md bg-surface-2" />
            ) : (
              <Image source={url} resizeMode="contain" className="h-5 w-5" />
            )}
          </View>
        )
      })}
      {extra > 0 && (
        <AuroraText className="ml-px text-11 font-bold" style={TABULAR_NUMS}>
          +{extra}
        </AuroraText>
      )}
    </View>
  )
}

import { Image, View } from 'react-native'
import { SparklesIcon, Text } from '../../atoms'

import { LinearGradient } from '../../../lib/nativewind-interop'
import type { RecordedDrop } from '../../../types/drops'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { getItemIconUrl } from '../../../lib/assets/asset-lookup'

const BADGE_GRADIENT = ['#ffe98a', '#f7c400'] as const
const BADGE_INK = '#6b4e00'
const BADGE_GLOW = [{ offsetX: 0, offsetY: 0, blurRadius: 8, color: 'rgba(247, 208, 13, 0.55)' }]

/** 아이콘 원의 흰 링 — 웹의 `ring-[1.5px] ring-white/80`. */
const ICON_RING = [
  { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: 'rgba(255, 255, 255, 0.8)' },
]

export function ValuableDropBadge(props: {
  drops: RecordedDrop[]
  label: string
  className?: string
}): React.JSX.Element {
  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <LinearGradient
      testID="valuable-drop-badge"
      accessibilityRole="image"
      aria-label={props.label}
      colors={BADGE_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ boxShadow: BADGE_GLOW }}
      className={`flex-row shrink-0 items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2${
        props.className !== undefined ? ` ${props.className}` : ''
      }`}
    >
      <SparklesIcon className="h-3 w-3 shrink-0" color={BADGE_INK} strokeWidth={2.5} aria-hidden />
      <View className="flex-row items-center">
        {shown.map((drop, index) => {
          const url = getItemIconUrl(drop.itemName, drop.slot)
          // 스택·링은 **두 갈래가 같다**(파일 머리 ⑥) — 웹도 두 분기에 같은 클래스를 적어 두었다.
          const stackStyle = {
            marginLeft: index === 0 ? 0 : -6,
            zIndex: shown.length - index,
            boxShadow: ICON_RING,
          }

          return url === null ? (
            <View
              key={`${drop.itemName}-${index}`}
              testID="valuable-drop-icon"
              style={stackStyle}
              className="h-5 w-5 shrink-0 rounded-full bg-surface-2"
            />
          ) : (
            <Image
              key={`${drop.itemName}-${index}`}
              testID="valuable-drop-icon"
              source={url}
              resizeMode="contain"
              style={stackStyle}
              className="h-5 w-5 shrink-0 rounded-full bg-surface"
            />
          )
        })}
      </View>
      {extra > 0 && (
        <Text
          className="text-10 font-bold leading-none"
          style={{ color: BADGE_INK, ...TABULAR_NUMS }}
        >
          +{extra}
        </Text>
      )}
    </LinearGradient>
  )
}

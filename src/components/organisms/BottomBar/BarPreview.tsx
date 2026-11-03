/**
 * 하단바 한 행의 그림. 설정의 하단 탭 순서 페이지가 카드마다 하나씩 둔다.
 *
 * 누를 수 없고 움직이지 않는다. 알약은 맨 왼쪽 칸에 있다. 하위 행에서는 그 칸이 그룹을 처음 열 때 열리는 화면이다.
 * 유리는 쓰지 않고 유리가 없는 기기의 바와 같은 색으로 칠한다. 카드 위라 뒤에 비칠 콘텐츠가 없다.
 */
import { View } from 'react-native'

import { barHeightOf } from '../../../lib/bottom-bar-metrics'
import { boxShadowOf } from '../../../lib/shadow'
import { BAR_GROUPS, type GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'
import { useThemeAppearance } from '../../../theme/context'
import { resolveBarColors } from './bar-colors'
import { BarBackGlyph, BarGlyph } from './BarGlyph'
import { BACK_CIRCLE_RATIO, BAR_PADDING, BAR_SHADOW, PILL_OVERHANG, PLATE_SHADOW } from './bar-shape'

export interface BarPreviewProps {
  items: readonly { id: GroupId | TabRouteName; label: string }[]
  /** 하위 행이면 첫 칸에 ← 를 두고 항목을 한 칸 옆에서 시작한다 */
  hasBack: boolean
  widthPx: number
  testID: string
}

export function BarPreview(props: BarPreviewProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const colors = resolveBarColors(definition)
  // 칸 폭과 알약 · ← 의 자리는 `BottomBar` 와 같은 식이다. 그래야 그 바와 같은 그림이 된다.
  const heightPx = barHeightOf(props.widthPx)
  const pillHeight = heightPx - BAR_PADDING * 2
  const backCircle = Math.round(pillHeight * BACK_CIRCLE_RATIO)
  const backCircleMargin = BAR_PADDING + (pillHeight - backCircle) / 2
  const itemWidth = (props.widthPx - BAR_PADDING * 2 - PILL_OVERHANG) / BAR_GROUPS.length
  const rowOffset = props.hasBack ? itemWidth : 0
  const plateShadow = boxShadowOf(definition.shadowColor, PLATE_SHADOW)

  return (
    <View
      testID={props.testID}
      style={{
        width: props.widthPx,
        height: heightPx,
        borderRadius: 999,
        backgroundColor: colors.bar,
        boxShadow: boxShadowOf(definition.shadowColor, BAR_SHADOW),
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: BAR_PADDING,
          left: BAR_PADDING + rowOffset,
          width: itemWidth + PILL_OVERHANG,
          height: pillHeight,
          borderRadius: 999,
          backgroundColor: colors.pill,
          boxShadow: plateShadow,
        }}
      />
      {props.hasBack ? (
        <View
          className="items-center justify-center"
          style={{
            position: 'absolute',
            left: backCircleMargin,
            top: backCircleMargin,
            width: backCircle,
            height: backCircle,
            borderRadius: 999,
            backgroundColor: colors.pill,
            boxShadow: plateShadow,
          }}
        >
          <BarBackGlyph color={colors.muted} />
        </View>
      ) : null}
      <View
        className="flex-row"
        style={{ position: 'absolute', top: BAR_PADDING, left: BAR_PADDING + PILL_OVERHANG / 2 + rowOffset }}
      >
        {props.items.map((item, index) => (
          <View key={item.id} className="items-center justify-center" style={{ width: itemWidth, height: pillHeight }}>
            <BarGlyph id={item.id} label={item.label} active={index === 0} accent={colors.accent} muted={colors.muted} />
          </View>
        ))}
      </View>
    </View>
  )
}

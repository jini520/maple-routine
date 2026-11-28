/**
 * 하단바 한 행의 그림. 설정의 하단 탭 순서 페이지가 카드마다 하나씩 둔다.
 *
 * 누를 수 없고 움직이지 않는다. 알약은 맨 왼쪽 칸에 있다. 하위 행에서는 그 칸이 그룹을 처음 열 때 열리는 화면이다.
 * 치수 · 아이콘 · 색은 바와 같다. 유리는 쓰지 않고 유리가 없는 기기의 바와 같은 불투명 판으로 칠한다. 카드 위라 뒤에
 * 비칠 콘텐츠가 없다.
 */
import { View } from 'react-native'

import { BACK_CIRCLE, BAR_HEIGHT, BAR_PADDING, PILL_HEIGHT, resolveBarRowLayout } from '../../../lib/bottom-bar-metrics'
import { boxShadowOf } from '../../../lib/shadow'
import { BAR_GROUPS, type GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'
import { useThemeAppearance } from '../../../theme/context'
import { resolveBarColors } from './bar-colors'
import { BarBackGlyph, BarGlyph } from './BarGlyph'
import { BAR_SHADOW, PLATE_SHADOW } from './bar-shape'

export interface BarPreviewProps {
  items: readonly { id: GroupId | TabRouteName; label: string }[]
  /** 하위 행이면 바 왼쪽에 ← 원을 따로 두고, 바는 남은 폭을 네 칸으로 나눈다 */
  hasBack: boolean
  /** 그룹 행 바의 폭. 하위 행은 이 폭 안에 ← 원과 바를 함께 놓는다. */
  widthPx: number
  testID: string
}

export function BarPreview(props: BarPreviewProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const colors = resolveBarColors(definition)
  // 칸과 알약의 자리는 `BottomBar` 와 같은 함수에서 나온다. 그래야 그 바와 같은 그림이 된다.
  const row = resolveBarRowLayout({
    fullLengthPx: props.widthPx,
    groupSlots: BAR_GROUPS.length,
    sub: props.hasBack,
    paddingPx: BAR_PADDING,
  })
  const barShadow = boxShadowOf(definition.shadowColor, BAR_SHADOW)
  const plate = { borderRadius: 999, backgroundColor: colors.bar, boxShadow: barShadow }

  return (
    <View testID={props.testID} style={{ width: props.widthPx, height: BAR_HEIGHT }}>
      {props.hasBack ? (
        <View
          className="items-center justify-center"
          style={[plate, { position: 'absolute', left: 0, top: (BAR_HEIGHT - BACK_CIRCLE) / 2, width: BACK_CIRCLE, height: BACK_CIRCLE }]}
        >
          <BarBackGlyph color={colors.muted} />
        </View>
      ) : null}
      <View style={[plate, { position: 'absolute', left: row.offsetPx, top: 0, width: row.lengthPx, height: BAR_HEIGHT }]}>
        <View
          style={{
            position: 'absolute',
            top: BAR_PADDING,
            left: BAR_PADDING,
            width: row.pillLengthPx,
            height: PILL_HEIGHT,
            borderRadius: 999,
            backgroundColor: colors.pill,
            boxShadow: boxShadowOf(definition.shadowColor, PLATE_SHADOW),
          }}
        />
        {props.items.map((item, index) => (
          <View
            key={item.id}
            className="items-center justify-center"
            style={{
              position: 'absolute',
              top: BAR_PADDING,
              left: row.firstCenterPx + index * row.spacingPx - row.pillLengthPx / 2,
              width: row.pillLengthPx,
              height: PILL_HEIGHT,
            }}
          >
            <BarGlyph id={item.id} label={item.label} active={index === 0} accent={colors.accent} muted={colors.muted} />
          </View>
        ))}
      </View>
    </View>
  )
}

import { View } from 'react-native'

import { Badge } from '../../components/atoms'

/**
 * 베타 기능 칸의 동그라미 오른쪽 위 모서리에 걸치는 `beta` 배지. 칸 이름 옆에는 배지가 들어갈 폭이 없다.
 *
 * @param props.ring 칸이 놓인 바탕색. 이 색의 테가 배지를 동그라미와 갈라 보이게 한다
 */
export function QuickLinkBetaBadge(props: { ring: string }): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      className="absolute rounded-full"
      style={{ top: -4, right: -10, boxShadow: `0 0 0 2px ${props.ring}` }}
    >
      <Badge variant="primary" size="xs">
        beta
      </Badge>
    </View>
  )
}

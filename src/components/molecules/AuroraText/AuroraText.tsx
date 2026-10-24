import MaskedView from '@react-native-masked-view/masked-view'
import type { TextStyle } from 'react-native'

import { AURORA_TEXT } from '../../../constants/style/aurora'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { useThemeMode } from '../../../theme/context'
import { Text } from '../../atoms'

/**
 * 오로라 그라디언트로 칠한 글자. 고가 드롭이 있는 카드의 금액과 `+N` 이 쓰는 부품.
 *
 * 글자를 두 번 그린다. 마스크용 한 벌과 그라디언트의 크기를 잡는 투명한 한 벌이다. `AnimatedNumber` 를 넣어도
 * 두 벌이 같은 기억에서 같은 시간 동안 굴러 어긋나지 않는다.
 */
export function AuroraText(props: {
  /** 글자 크기 · 굵기 클래스. 색은 이 부품이 정한다. */
  className: string
  style?: TextStyle
  testID?: string
  children: React.ReactNode
}): React.JSX.Element {
  const colors = AURORA_TEXT[useThemeMode()]
  return (
    <MaskedView
      testID={props.testID}
      maskElement={
        <Text className={props.className} style={props.style}>
          {props.children}
        </Text>
      }
    >
      <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text className={`${props.className} opacity-0`} style={props.style} aria-hidden>
          {props.children}
        </Text>
      </LinearGradient>
    </MaskedView>
  )
}

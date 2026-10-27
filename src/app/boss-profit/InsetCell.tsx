import { View } from 'react-native'

import { HologramSheen } from '../../components/organisms/HologramSheen/HologramSheen'
import { useHoloMotion } from '../../components/organisms/HologramSheen/holo-motion'

/**
 * 펼친 카드 안의 행 칸. card-inset 을 카드 색 위에 겹쳐 불투명하게 칠한 칸.
 *
 * card-inset 은 반투명이라 그대로 두면 카드의 홀로그램 효과가 칸 위로 비친다. 고가 드롭을 먹은 보스 행은
 * `sheen` 으로 칸 안에 카드보다 약한 같은 효과를 따로 깐다.
 */
export function InsetCell(props: {
  /** 안쪽 칸의 배치 · 여백 클래스. */
  className: string
  sheen?: boolean
  testID?: string
  children: React.ReactNode
}): React.JSX.Element {
  const holoMotion = useHoloMotion(props.sheen === true)
  return (
    <View className="rounded-[10px] bg-surface">
      <View testID={props.testID} className={`rounded-[10px] bg-card-inset ${props.className}`}>
        {props.sheen === true && <HologramSheen variant="row" motion={holoMotion} testID="boss-row-sheen" />}
        {props.children}
      </View>
    </View>
  )
}

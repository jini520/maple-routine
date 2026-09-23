/**
 * 파티 분배를 적고 고치는 자리로 보내는 줄. **배지 하나와 `변경`** 이다.
 *
 * 배지는 `솔로` · `파티 3인` · `67%` 셋 중 하나다. 비율은 결정석에만 있어(아이템은 건마다 값이 달라 드롭 기록이 든다)
 * 무엇의 비율인지 물을 일이 없고, 그래서 라벨이 없다.
 *
 * 값은 백분율이다. `나 : 나머지` 로 적으면 2:1 과 4:2 가 다른 값처럼 보이는데 둘은 같은 약속이다.
 *
 * 고치는 자리가 셋이다(보스 카드 · 보스 관리 화면 · 보스 수익 행). 셋이 같은 것을 다른 모양으로
 * 말하면 값이 무엇을 뜻하는지 자리마다 다시 읽어야 한다.
 */
import { Pressable, View } from 'react-native'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatShareRatio, type PartyShares } from '../../../lib/boss/party-shares'
import { Badge, Text } from '../../atoms'

/**
 * 크기 두 벌. **`compact` 는 보스 수익 카드**라 배지가 작고 비율에서 소수를 뗀다(사용자 지정).
 *
 * 그 카드는 금액과 한 줄을 나눠 쓰므로 이 줄이 커지면 카드가 통째로 커진다.
 */
const SIZES = {
  default: { badge: 'default', gap: 'gap-2', whole: false },
  compact: { badge: 'mini', gap: 'gap-[7px]', whole: true },
} as const

export function PartyShareSummary(props: {
  /** aria-label 접두. 목록에서 어느 행인지 구분한다(보스명). */
  label: string
  partySize: number
  /** 결정석 비율. 균등이면 인원을, 비율이면 내 몫을 적는다. */
  crystal: PartyShares
  size?: keyof typeof SIZES
  /** 고칠 수 없는 행. 글자만 흐리게 서고 `변경` 이 사라진다. */
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const crystalRatio = formatShareRatio(props.crystal, { whole: size.whole })

  return (
    <View
      testID="party-share-summary"
      className={`flex-row items-center ${size.gap}${props.disabled === true ? ' opacity-40' : ''}`}
    >
      {/* 혼자면 인원을 세지도 않는다. `파티 1인` 은 파티가 아니다. */}
      <Badge testID="party-share-badge" variant="primary" size={size.badge} style={TABULAR_NUMS}>
        {crystalRatio ?? (props.partySize <= 1 ? '솔로' : `파티 ${props.partySize}인`)}
      </Badge>
      {props.disabled !== true && (
        <Pressable
          role="button"
          aria-label={`${props.label} 파티 인원과 비율 변경`}
          onPress={props.onPress}
          hitSlop={HIT_SLOP}
        >
          {/* 조용한 글자 버튼이다. 이 줄의 주인공은 값이고 `변경` 은 곁들이다. 디자인 시스템의
              Text 버튼과 같은 잉크(`초기화` 가 쓰는 것)를 쓴다. */}
          <Text className="text-11 font-medium text-text-muted">변경</Text>
        </Pressable>
      )}
    </View>
  )
}

/** 글자 높이와 권장 타깃(44px)의 차이를 사방으로 나눈 몫. */
const HIT_SLOP = { top: 12, bottom: 12, left: 10, right: 10 }

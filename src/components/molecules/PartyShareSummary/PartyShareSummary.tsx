/**
 * 파티 분배를 적고 고치는 자리로 보내는 줄. **라벨을 이고 값이 아래** 선다.
 *
 * 균등이면 배지 하나이고(`솔로` · `파티 3인`) 비율이면 라벨을 인 열 둘을 상자로 두른다
 * (`결정석` · `아이템`). 열 사이는 세로선이 가른다. 모양을 나눈 것은 무엇이 설정된 상태인지
 * 한눈에 갈리게 하려는 것이다.
 *
 * 값은 백분율이다. `나 : 나머지` 로 적으면 2:1 과 4:2 가 다른 값처럼 보이는데 둘은 같은 약속이다.
 *
 * 고치는 자리가 셋이다(보스 카드 · 보스 관리 화면 · 보스 수익 행). 셋이 같은 것을 다른 모양으로
 * 말하면 값이 무엇을 뜻하는지 자리마다 다시 읽어야 한다.
 */
import { Pressable, View } from 'react-native'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatSharePercent, formatShareRatio, type PartyShares } from '../../../lib/boss/party-shares'
import { Badge, Text } from '../../atoms'

/**
 * 크기 두 벌. **`compact` 는 두 줄 합이 20** 이라 보스 수익 카드의 줄 높이를 안 바꾼다.
 *
 * 그 카드는 금액과 한 줄을 나눠 쓰므로 이 줄이 커지면 카드가 통째로 커진다.
 */
const SIZES = {
  default: { label: 'text-9', value: 'text-13', divider: 'h-[22px]', gap: 'gap-2', badge: 'default', box: 'px-2.5 py-1' },
  compact: { label: 'text-8', value: 'text-xs', divider: 'h-4', gap: 'gap-[7px]', badge: 'mini', box: 'px-2 py-0.5' },
} as const

export function PartyShareSummary(props: {
  /** aria-label 접두. 목록에서 어느 행인지 구분한다(보스명). */
  label: string
  partySize: number
  /** 결정석 비율. 균등이면 이 줄 전체가 파티 인원 한 열이 된다. */
  crystal: PartyShares
  /** 아이템 비율. 결정석이 비율일 때만 선다. */
  drop: PartyShares
  size?: keyof typeof SIZES
  /** 고칠 수 없는 행. 글자만 흐리게 서고 `변경` 이 사라진다. */
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  const size = SIZES[props.size ?? 'default']
  const crystalRatio = formatShareRatio(props.crystal)
  const dropRatio = formatShareRatio(props.drop)

  /** 라벨을 이고 선 값 한 열. */
  function column(label: string, value: string): React.JSX.Element {
    return (
      <View className="items-center">
        <Text className={`${size.label} font-semibold tracking-[.04em] text-text-muted`}>{label}</Text>
        <Text className={`${size.value} font-bold tracking-[-.01em] text-text`} style={TABULAR_NUMS}>
          {value}
        </Text>
      </View>
    )
  }

  return (
    <View
      testID="party-share-summary"
      className={`flex-row items-center ${size.gap}${props.disabled === true ? ' opacity-40' : ''}`}
    >
      {crystalRatio === null ? (
        // 균등이면 라벨을 안 인다. 나눌 것이 없어 **무엇의 비율인가**를 물을 일이 없고, 배지
        // 하나가 상태를 그대로 말한다. 혼자면 인원을 세지도 않는다.
        <Badge testID="party-share-badge" variant="primary" size={size.badge} style={TABULAR_NUMS}>
          {props.partySize <= 1 ? '솔로' : `파티 ${props.partySize}인`}
        </Badge>
      ) : (
        // 파티 모달의 비율 카드와 같은 바탕이다. 두 칸이 한 덩어리로 읽힌다.
        <View testID="party-share-ratio-box" className={`flex-row items-center rounded-lg bg-bg ${size.gap} ${size.box}`}>
          {column('결정석', crystalRatio)}
          <View className={`w-px bg-border ${size.divider}`} />
          {/* 비율을 켜면 모달이 둘 다 씨를 뿌린다. 값이 없는 행은 균등이라 1/n 이다. */}
          {column('아이템', dropRatio ?? formatSharePercent(1, Math.max(2, props.partySize)))}
        </View>
      )}
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

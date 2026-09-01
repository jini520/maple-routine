// 통합 목록에서 한 무리의 머리 — 「월간」·「주간」([[ADR-164]] 결정 3).
//
// **탭이 있던 자리를 그대로 잇지 않는다.** 탭은 누르는 것이었고 이것은 읽는 것이다 — pill 배경도
// `aria-selected` 도 없다. 대신 탭 시절 «주간 탭을 보고 있다» 는 맥락이 대신 말해 주던 것을
// 여기서 **이름으로** 말한다.
//
// 그래서 배지 둘이 함께 온다. `n/12`([[ADR-055]] 결정 8)와 `season`([[ADR-031]] 결정 3)은 게임이
// 주 단위로 강제하는 규칙이라 목록이 합쳐져도 «주간 것» 인데, 탭이 사라지면 그 소속을 말할 자리가
// 없어진다. 헤더가 그 자리다 — 두 배지는 **주간 헤더에만** 실린다.
//
// 스타일은 새로 만들지 않는다 — `season` 배지는 보스 스케줄러 헤더에 있던 인라인 클래스 그대로고
// (`Badge` atom 이 `secondary` 톤을 안 갖는다 — 그 파일 머리 «좁게 만든다»), `n/12` 는 같은
// `Badge tone="primary"` 다.
import { View } from 'react-native'

import { Badge, Text } from '../../atoms'
import type { BossCycle } from '../../../types'

const CYCLE_LABEL: Record<BossCycle, string> = {
  weekly: '주간',
  monthly: '월간',
}

export interface BossSectionHeaderProps {
  cycle: BossCycle
  /** 시즌 보스 완료 상태 — 챌린저스 월드가 아니거나 주간 무리가 아니면 `null`. */
  seasonState: 'complete' | 'incomplete' | null
  /** 이번 주 처치 수 — 아직 모르면 `null`(0 으로 단정하지 않는다). */
  clearCount: number | null
  clearLimit: number | null
}

export function BossSectionHeader(props: BossSectionHeaderProps): React.JSX.Element {
  const { seasonState, clearCount, clearLimit } = props

  return (
    <View
      testID={`boss-section-header-${props.cycle}`}
      className="flex-row items-center justify-between gap-2"
    >
      <Text className="text-sm font-semibold text-text">{CYCLE_LABEL[props.cycle]}</Text>

      <View className="flex-row items-center gap-2">
        {seasonState !== null && (
          <Badge variant={seasonState === 'complete' ? 'secondary' : 'primary'}>
            {`season ${seasonState === 'complete' ? '완료' : '미완료'}`}
          </Badge>
        )}
        {clearCount !== null && clearLimit !== null && (
          <Badge variant="primary">
            {clearCount}/{clearLimit}
          </Badge>
        )}
      </View>
    </View>
  )
}

import { ClockIcon, Text } from '../../atoms'

import { View } from 'react-native'

/**
 * **아직 집계 전**(`OPENAPI00009`)을 말하는 고지.
 *
 * 빈 상태와 디자인을 안 나눈다. 확인해서 없는 것과 아직 확인 못 한 것은 다른 사실이다.
 * 중립 톤 + `Clock` 이고 **시각을 암시하는 표현을 안 쓴다** - 집계 시각은 넥슨이 정하고 우리는
 * 브래킷으로만 안다.
 *
 * 액션이 없다. 고칠 수 있는 실패가 아니라 기다리면 풀리는 것이다.
 *
 * 전에는 `조회할 수 없습니다`(롤링 윈도우 밖) 문구를 함께 들었다. 기간 이동이 기록이 있는
 * 기간으로만 착지하게 되면서 그 자리가 사라져 걷었다.
 */
export function UnavailableNotice(): React.JSX.Element {
  return (
    <View
      testID="unavailable-notice"
      className="flex-row items-start gap-3 rounded-[14px] border border-border bg-surface-2 p-4"
    >
      <ClockIcon className="h-5 w-5 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
      <View className="gap-0.5">
        <Text className="text-sm font-semibold text-text">아직 집계되지 않았습니다</Text>
        <Text testID="unavailable-notice-description" className="text-xs text-text-muted">
          이 기간 기록이 준비되면 자동으로 채워집니다
        </Text>
      </View>
    </View>
  )
}

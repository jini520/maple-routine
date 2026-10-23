/**
 * 위젯 7. 가격을 아직 안 적은 드롭 건수를 그리는 타일.
 *
 * 이 타일이 옆 타일(위젯 4)의 `없음` 을 설명한다. 그쪽은 기록된 판매가만 줄 세우므로 값을 안 적은
 * 드롭이 순위에 아예 없다. 건수를 여기서만 말하는 것도 같은 이유다. 한 사실을 두 곳에서 말하지
 * 않는다.
 *
 * 제목 줄 아래의 `card-inset` 줄이 `기록하기` 다. 흐린 글자 한 줄이면 누를 수 있는 것으로 읽히지 않는다.
 * 누르는 곳은 타일 전체이고(격자가 감싼다) 이 줄은 그 표시다.
 *
 * **0건이어도 타일은 남는다.** 빼면 다음 주에 다시 나타날 때 새 기능처럼 보인다.
 */

import { View } from 'react-native'

import { CheckIcon, ChevronRightIcon, PencilIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { WidgetProps } from './types'

const TITLE = '가격 미입력'

/** 0건일 때. 0건이 아니라 **끝났다는 사실**을 말한다(숫자 0은 할 일처럼 읽힌다). */
const DONE_NOTE = '전부 기록했습니다'

export function UnpricedDropsWidget({ data }: WidgetProps): React.JSX.Element {
  const count = data.unpricedCount

  if (count === 0) {
    return (
      <View testID="widget-unpriced-drops" className="flex-1 flex-row items-center gap-2.5 p-3">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-inset">
          <CheckIcon className="h-[18px] w-[18px] text-primary-ink" strokeWidth={3} aria-hidden />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-11 font-semibold text-text-muted">{TITLE}</Text>
          <Text numberOfLines={1} className="text-11 text-text-muted">
            {DONE_NOTE}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View testID="widget-unpriced-drops" className="flex-1 justify-center gap-2 p-3">
      <View className="flex-row items-baseline gap-2">
        <Text className="flex-1 text-10 font-bold text-text-muted">{TITLE}</Text>
        <Text testID="unpriced-count" style={TABULAR_NUMS} className="text-15 font-bold text-text">
          {count}
          <Text className="text-11 font-semibold text-text-muted">건</Text>
        </Text>
      </View>
      <View testID="unpriced-cta" className="h-8 flex-row items-center gap-1.5 rounded-[10px] bg-card-inset px-2.5">
        <PencilIcon className="h-[13px] w-[13px] text-primary-ink" strokeWidth={2.2} aria-hidden />
        <Text className="flex-1 text-xs font-semibold text-primary-ink">기록하기</Text>
        <ChevronRightIcon className="h-3 w-3 text-primary-ink" strokeWidth={2.2} aria-hidden />
      </View>
    </View>
  )
}

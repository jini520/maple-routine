/**
 * 위젯 7. 가격을 아직 안 적은 드롭 건수를 그리는 타일.
 *
 * 이 타일이 옆 타일(위젯 4)의 `없음` 을 설명한다. 그쪽은 기록된 판매가만 줄 세우므로 값을 안 적은
 * 드롭이 순위에 아예 없다. 건수를 여기서만 말하는 것도 같은 이유다. 한 사실을 두 곳에서 말하지
 * 않는다.
 *
 * 제목 줄 아래의 `card-inset` 줄이 `기록하기` 다. 흐린 글자 한 줄이면 누를 수 있는 것으로 읽히지 않는다.
 * 누르는 곳은 타일 전체이고(격자가 감싼다) 이 줄은 그 표시다. 0건이면 같은 크기의 칸에 `전부 기록했습니다` 를
 * 적는다. 기록을 마치는 순간 위젯 크기가 바뀌면 같은 줄의 최고가 위젯까지 함께 출렁인다.
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

/** 아래 칸. 건수가 있으면 `기록하기`, 0건이면 `전부 기록했습니다`. 두 칸의 크기 · 모양이 같아야 위젯 크기가 그대로다 */
const CELL_CLASS = 'h-8 flex-row items-center gap-1.5 rounded-[10px] bg-card-inset px-2.5'

export function UnpricedDropsWidget({ data }: WidgetProps): React.JSX.Element {
  const count = data.unpricedCount

  return (
    <View testID="widget-unpriced-drops" className="grow justify-center gap-2 p-3">
      {/* 제목 줄 높이를 건수 글자(15/22)에 맞춰 둔다. 0건이면 건수가 없어 줄이 낮아진다. */}
      <View testID="unpriced-head" className="min-h-[22px] flex-row items-baseline gap-2">
        <Text className="flex-1 text-10 font-bold text-text-muted">{TITLE}</Text>
        {count > 0 && (
          <Text testID="unpriced-count" style={TABULAR_NUMS} className="text-15 font-bold text-text">
            {count}
            <Text className="text-11 font-semibold text-text-muted">건</Text>
          </Text>
        )}
      </View>
      {count > 0 ? (
        <View testID="unpriced-cta" className={CELL_CLASS}>
          <PencilIcon className="h-[13px] w-[13px] text-primary-ink" strokeWidth={2.2} aria-hidden />
          <Text className="flex-1 text-xs font-semibold text-primary-ink">기록하기</Text>
          <ChevronRightIcon className="h-3 w-3 text-primary-ink" strokeWidth={2.2} aria-hidden />
        </View>
      ) : (
        // 화살표가 없다. 기록할 것이 없는데 누를 곳처럼 보이면 빈 화면으로 보내는 것처럼 읽힌다.
        <View testID="unpriced-done" className={CELL_CLASS}>
          <CheckIcon className="h-[13px] w-[13px] text-text-muted" strokeWidth={2.6} aria-hidden />
          <Text className="flex-1 text-xs font-semibold text-text-muted">{DONE_NOTE}</Text>
        </View>
      )}
    </View>
  )
}

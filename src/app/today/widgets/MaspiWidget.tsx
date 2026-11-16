/**
 * MASPI 한 줄 위젯. 왼쪽에 `MASPI`, 오른쪽에 종가와 전일 대비 화살표, 바탕 전체에 최근 30일 꺾은선과 옅은 채움이다.
 *
 * 꺾은선 색은 30일 흐름, 화살표 색은 그날 등락이라 두 색이 엇갈리는 날이 있다. 기기에 남긴 값도 없고 받지도 못했으면
 * `0.00` 둘과 가운데의 평평한 회색 선을 그린다. 위젯은 사라지지 않는다.
 */
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { SparkLine } from '../../../components/molecules/SparkLine/SparkLine'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatIndex, formatIndexArrow, toneOf, trendOf } from '../../../features/market/format'
import { useThemeAppearance } from '../../../theme/context'
import { TONE_TEXT, toneColor } from '../../utility/maspi/tone'
import type { WidgetProps } from './types'

/** 위젯 높이. 다른 위젯보다 낮은 한 줄이라 아래 위젯을 크게 밀어내지 않는다 */
const HEIGHT = 44

export function MaspiWidget({ data }: WidgetProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const { maspi } = data
  const values = maspi?.series.map((point) => point.value) ?? []
  const change = maspi?.change ?? null
  const drawn = values.length >= 2

  return (
    <View testID="widget-maspi" className="justify-center overflow-hidden rounded-[14px]" style={{ height: HEIGHT }}>
      <View className="absolute inset-0">
        <SparkLine
          values={values}
          color={toneColor(trendOf(values), definition)}
          height={HEIGHT}
          strokeWidth={1.5}
          inset={8}
          fillOpacity={drawn ? 0.1 : undefined}
          lineOpacity={0.4}
        />
      </View>
      <View className="flex-row items-center gap-2 px-3">
        <Text className="flex-1 text-11 font-bold text-text-muted">MASPI</Text>
        <Text testID="widget-maspi-close" className="text-sm font-bold text-text" style={TABULAR_NUMS}>
          {formatIndex(maspi?.close ?? null)}
        </Text>
        <Text testID="widget-maspi-change" className={`text-xs font-semibold ${TONE_TEXT[toneOf(change)]}`} style={TABULAR_NUMS}>
          {formatIndexArrow(change)}
        </Text>
      </View>
    </View>
  )
}

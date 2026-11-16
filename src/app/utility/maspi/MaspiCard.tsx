/**
 * MASPI 목록 화면 맨 위의 지수 카드. `MASPI` 라벨, 큰 종가와 그 오른쪽 전일 대비, 폭 전체의 최근 30일 꺾은선이다.
 *
 * 꺾은선 색은 30일 동안의 흐름, 전일 대비 색은 그날 등락이라 두 색이 엇갈리는 날이 있다. 값이 없으면 `0.00` 과 평평한 회색 선이다.
 */
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { SparkLine } from '../../../components/molecules/SparkLine/SparkLine'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatIndex, formatIndexSigned, toneOf, trendOf } from '../../../features/market/format'
import type { MaspiResponse } from '../../../server/market'
import { useThemeAppearance } from '../../../theme/context'
import { TONE_TEXT, toneColor } from './tone'

export function MaspiCard(props: { maspi: MaspiResponse | undefined }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const values = props.maspi?.series.map((point) => point.value) ?? []
  const change = props.maspi?.change ?? null

  return (
    <View testID="maspi-card" className="rounded-[14px] bg-surface px-3.5 pb-3.5 pt-3">
      <Text className="text-11 font-bold text-text-muted">MASPI</Text>
      <View className="flex-row items-baseline gap-2">
        <Text testID="maspi-card-close" className="text-2xl font-bold text-text" style={TABULAR_NUMS}>
          {formatIndex(props.maspi?.close ?? null)}
        </Text>
        <Text testID="maspi-card-change" className={`text-sm font-bold ${TONE_TEXT[toneOf(change)]}`} style={TABULAR_NUMS}>
          {formatIndexSigned(change)}
        </Text>
      </View>
      <View className="mt-2.5">
        <SparkLine
          values={values}
          color={toneColor(trendOf(values), definition)}
          height={48}
          strokeWidth={2}
          inset={5}
          fillOpacity={0.12}
          endDotRadius={3}
        />
      </View>
    </View>
  )
}

/**
 * 계산기 맨 위의 합계 카드. 도넛은 캐릭터별 금액의 비중이고, 옆에 캐릭터별 이름 · 비율 · 금액, 아래 면에 합계가 있다.
 *
 * 조각 색은 레일 순서대로 넷이고 다섯째 캐릭터부터는 `그 외` 로 묶는다. 넷은 색약 · 일반 시야 구분 검사를 통과한 색이라
 * 테마를 따라가지 않는다. 색만으로 캐릭터를 가르지 않도록 이름을 늘 함께 적는다.
 */
import { View } from 'react-native'

import { Text } from '../../../components/atoms'
import { DonutRing } from '../../../components/molecules/DonutRing/DonutRing'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { formatEok } from '../../../lib/boss/boss-profit-calculator'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { useThemeAppearance } from '../../../theme/context'

const SLICE_COLORS = ['#E07A0A', '#7A5AC8', '#C9A400', '#8A3E05'] as const
const OTHER_COLOR = '#A3996E'

export interface TotalCardCharacter {
  ocid: string
  name: string
  meso: number
}

interface LegendRow {
  key: string
  name: string
  meso: number
  color: string
}

/** 앞의 넷은 제 이름, 다섯째부터는 `그 외 n명` 한 줄 */
function legendRows(characters: readonly TotalCardCharacter[]): LegendRow[] {
  const named = characters.slice(0, SLICE_COLORS.length).map((character, index) => ({
    key: character.ocid,
    name: character.name,
    meso: character.meso,
    color: SLICE_COLORS[index]!,
  }))
  const rest = characters.slice(SLICE_COLORS.length)
  if (rest.length === 0) return named
  return [
    ...named,
    { key: 'other', name: `그 외 ${rest.length}명`, meso: rest.reduce((sum, one) => sum + one.meso, 0), color: OTHER_COLOR },
  ]
}

export function TotalCard(props: {
  /** 레일 순서 */
  characters: readonly TotalCardCharacter[]
  bossCount: number
  /** 레일에서 고른 캐릭터. 범례에서 그 줄만 굵다 */
  selectedOcid: string
  style?: { boxShadow: string }
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const rows = legendRows(props.characters)
  const total = rows.reduce((sum, row) => sum + row.meso, 0)
  const empty = total === 0

  return (
    <View testID="calculator-total-card" className="mx-4 gap-3.5 rounded-[22px] bg-surface px-[18px] pb-3.5 pt-4" style={props.style}>
      <View className="flex-row items-center gap-[18px]">
        <DonutRing
          size={112}
          thickness={14}
          emptyColor={definition.surface2}
          slices={rows.map((row) => ({ key: row.key, value: row.meso, color: row.color }))}
          label={
            empty
              ? '캐릭터별 수익 분포. 고른 보스가 없습니다'
              : `캐릭터별 수익 분포. ${rows.map((row) => `${row.name} ${Math.round((row.meso / total) * 100)}%`).join(', ')}`
          }
        >
          <Text className="text-11 font-semibold text-text-muted">캐릭터</Text>
          <Text className="text-lg font-bold text-text" style={TABULAR_NUMS}>
            {props.characters.length}
          </Text>
        </DonutRing>
        <View className="flex-1 gap-1">
          {rows.map((row) => (
            <View key={row.key} testID={`calculator-legend-${row.key}`} className="h-[26px] flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: empty ? definition.surface2 : row.color }} />
              <Text className={`text-13 ${row.key === props.selectedOcid ? 'font-bold text-text' : 'font-medium text-text'}`}>{row.name}</Text>
              {!empty && (
                <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
                  {Math.round((row.meso / total) * 100)}%
                </Text>
              )}
              <Text className={`ml-auto text-sm font-bold ${empty ? 'text-text-disabled' : 'text-text'}`} style={TABULAR_NUMS}>
                {formatEok(row.meso)}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View className="-mx-1.5 gap-0.5 rounded-2xl bg-bg px-3 pb-3 pt-2.5">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="text-13 font-semibold text-text">주간 보스 예상 수익</Text>
          <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
            {props.characters.length}캐릭터 · 보스 {props.bossCount}
          </Text>
        </View>
        <Text
          testID="calculator-total"
          className={`text-2xl font-bold ${empty ? 'text-text-disabled' : 'text-text'}`}
          style={TABULAR_NUMS}
        >
          {formatMesoUnits(total)}
        </Text>
      </View>
    </View>
  )
}

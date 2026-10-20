/**
 * 계산기 맨 위의 합계 카드. 도넛은 캐릭터별 금액의 비중이고, 옆에 캐릭터별 이름 · 비율 · 금액, 아래 면에 합계가 있다.
 *
 * 조각 색은 테마 색이라 테마를 바꾸면 함께 바뀐다. 금액이 큰 캐릭터부터 늘어놓고 0 인 캐릭터는 그리지 않는다.
 * 다섯 캐릭터까지는 모두 적고, 그보다 많으면 큰 넷 뒤에 나머지를
 * `그 외 n캐릭터` 한 줄로 묶어 누르면 팝오버로 보인다. 색만으로 캐릭터를 가르지 않도록 이름을 늘 함께 적는다.
 */
import { useRef, useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChevronRightIcon, Text } from '../../../components/atoms'
import { DonutRing } from '../../../components/molecules/DonutRing/DonutRing'
import { AnchoredPopover } from '../../../components/molecules/Popover/Popover'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'
import { formatEok } from '../../../lib/boss/boss-profit-calculator'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { useThemeAppearance } from '../../../theme/context'
import type { ThemeDefinition } from '../../../types/theme'

/** 제 이름으로 적는 캐릭터 수의 상한. 이보다 많으면 앞의 `NAMED_WHEN_GROUPED` 만 적고 나머지를 묶는다 */
const MAX_NAMED = 5
const NAMED_WHEN_GROUPED = 4

/** 금액 순서대로 쓰는 조각 색. 묶음 줄은 마지막 색이다 */
function sliceColors(definition: ThemeDefinition): readonly string[] {
  return [definition.primary, definition.secondary, definition.third, definition.textMuted, definition.border]
}

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
  /** 묶음 줄이 품은 캐릭터 */
  grouped?: readonly TotalCardCharacter[]
}

/**
 * 금액이 큰 캐릭터부터 늘어놓고 금액이 0 인 캐릭터는 뺀다. 모두 0 이면 빈 상태임을 보이려고 모든 캐릭터를 그대로 둔다.
 */
function legendRows(all: readonly TotalCardCharacter[], colors: readonly string[]): LegendRow[] {
  const earning = all.filter((character) => character.meso > 0)
  const characters = earning.length === 0 ? all : [...earning].sort((a, b) => b.meso - a.meso)
  const namedCount = characters.length <= MAX_NAMED ? characters.length : NAMED_WHEN_GROUPED
  const named = characters.slice(0, namedCount).map((character, index) => ({
    key: character.ocid,
    name: character.name,
    meso: character.meso,
    color: colors[index]!,
  }))
  const rest = characters.slice(namedCount)
  if (rest.length === 0) return named
  return [
    ...named,
    {
      key: 'other',
      name: `그 외 ${rest.length}캐릭터`,
      meso: rest.reduce((sum, one) => sum + one.meso, 0),
      color: colors[colors.length - 1]!,
      grouped: rest,
    },
  ]
}

function percentOf(meso: number, total: number): string {
  return `${Math.round((meso / total) * 100)}%`
}

export function TotalCard(props: {
  /** 레일 순서. 범례는 금액 순서로 다시 늘어놓는다 */
  characters: readonly TotalCardCharacter[]
  bossCount: number
  /** 레일에서 고른 캐릭터. 범례에서 그 줄만 굵다 */
  selectedOcid: string
  style?: { boxShadow: string }
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const rows = legendRows(props.characters, sliceColors(definition))
  const otherRef = useRef<View>(null)
  const [otherAnchor, setOtherAnchor] = useState<PopoverAnchorRect | null>(null)
  const [otherOpen, setOtherOpen] = useState(false)
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
              : `캐릭터별 수익 분포. ${rows.map((row) => `${row.name} ${percentOf(row.meso, total)}`).join(', ')}`
          }
        >
          <Text className="text-11 font-semibold text-text-muted">캐릭터</Text>
          <Text className="text-lg font-bold text-text" style={TABULAR_NUMS}>
            {props.characters.length}
          </Text>
        </DonutRing>
        <View className="flex-1 gap-0.5">
          {rows.map((row) => {
            const strong = row.key === props.selectedOcid
            const label = (
              <>
                <View className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: empty ? definition.surface2 : row.color }} />
                <Text className={`text-11 text-text ${strong ? 'font-semibold' : 'font-medium'}`}>{row.name}</Text>
                {row.grouped !== undefined && <ChevronRightIcon className="h-3 w-3 text-text-muted" strokeWidth={2.5} aria-hidden />}
                {!empty && (
                  <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
                    {percentOf(row.meso, total)}
                  </Text>
                )}
                {/* 금액은 이름보다 한 단계만 굵다. 크게 강조할 값이 아니다. */}
                <Text
                  className={`ml-auto text-11 ${strong ? 'font-bold' : 'font-semibold'} ${empty ? 'text-text-disabled' : 'text-text'}`}
                  style={TABULAR_NUMS}
                >
                  {formatEok(row.meso)}
                </Text>
              </>
            )
            return row.grouped === undefined ? (
              <View key={row.key} testID={`calculator-legend-${row.key}`} className="h-[18px] flex-row items-center gap-1.5">
                {label}
              </View>
            ) : (
              <Pressable
                key={row.key}
                ref={otherRef}
                testID={`calculator-legend-${row.key}`}
                role="button"
                aria-label={`${row.name} 자세히`}
                onPress={() => {
                  setOtherOpen(true)
                  otherRef.current?.measureInWindow((left, top, width, height) => setOtherAnchor({ left, top, width, height }))
                }}
                className="h-[18px] flex-row items-center gap-1.5 active:opacity-60"
              >
                {label}
              </Pressable>
            )
          })}
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
      {otherOpen && (
        <AnchoredPopover
          testID="calculator-legend-other-popover"
          ariaLabel="그 외 캐릭터"
          closeLabel="그 외 캐릭터 닫기"
          anchor={otherAnchor}
          onClose={() => {
            setOtherOpen(false)
            setOtherAnchor(null)
          }}
          className="gap-1.5 px-3 py-2.5"
        >
          {(rows.find((row) => row.grouped !== undefined)?.grouped ?? []).map((character) => (
            <View key={character.ocid} className="flex-row items-center gap-2">
              <Text className="text-xs font-medium text-text">{character.name}</Text>
              {!empty && (
                <Text className="text-11 text-text-muted" style={TABULAR_NUMS}>
                  {percentOf(character.meso, total)}
                </Text>
              )}
              <Text className="ml-auto pl-3 text-xs font-semibold text-text" style={TABULAR_NUMS}>
                {formatEok(character.meso)}
              </Text>
            </View>
          ))}
        </AnchoredPopover>
      )}
    </View>
  )
}

/**
 * 이번 주 수익. 통계 화면의 이번 주를 한 장으로 줄인 위젯.
 *
 * 제목 줄의 세그먼트(`순 수익` · `수익` · `지출`)가 큰 숫자 · 반원 도넛 · 캐릭터 순위를 함께 바꾼다. 캐릭터
 * 줄을 누르면 그 캐릭터가 어느 갈래에서 벌고 썼는지 팝오버로 띄운다. 위젯 안에서 누르는 것이 있으므로
 * 타일 전체는 누를 수 없다.
 *
 * 색은 통계와 같이 수익은 `rise-ink`, 지출은 `fall-ink` 한 색이고 갈래는 명도 단계로 가른다.
 */

import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Path } from 'react-native-svg'

import { Text } from '../../../components/atoms'
import { CharacterAvatar } from '../../../components/molecules/CharacterAvatar/CharacterAvatar'
import { UnknownCharacterFace } from '../../../components/molecules/CharacterAvatar/UnknownCharacterFace'
import { AnchoredPopover } from '../../../components/molecules/Popover/Popover'
import { Segment } from '../../../components/molecules/Segment/Segment'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { CategoryTotal, StatsTotals } from '../../../features/stats/aggregate'
import { useAnchoredPopover } from '../../../hooks/useAnchoredPopover'
import { formatMesoCompact, formatMesoSigned } from '../../../lib/cashbook/meso-compact'
import { Svg } from '../../../lib/nativewind-interop'
import { restSliceColor, SLICE_LIMIT, sliceColor } from '../../../lib/stats/slice-steps'
import { semiDonutGeometry } from '../../../lib/today/semi-donut'
import { useThemeAppearance } from '../../../theme/context'
import type { WeeklyIncomeCharacterView, WeeklyIncomeView } from '../view-model'
import type { WidgetProps } from './types'

const MODES = ['순 수익', '수입', '지출'] as const
type Mode = (typeof MODES)[number]

const RANK_LABELS = ['1st', '2nd', '3rd'] as const
const FACE_PX = 32

const DONUT = { width: 168, thickness: 30 } as const
/** 조각 모서리의 둥근 정도. 조각을 이만큼 안으로 줄이고 같은 색 선으로 두르면 모서리가 둥글어진다 */
const CORNER = 4
/** 조각 사이 틈(px) */
const SLICE_GAP = 3

interface Slice {
  key: string
  name: string
  meso: number
  color: string
}

type Sign = '+' | '−' | null

function signedMeso(meso: number, sign: Sign): string {
  if (sign === null) return formatMesoCompact(meso)
  return formatMesoSigned(meso, sign)
}

/** 순 수익은 부호가 값에서 나온다. 0 은 부호가 없다 */
function netText(meso: number): string {
  if (meso === 0) return '0'
  return formatMesoSigned(Math.abs(meso), meso > 0 ? '+' : '−')
}

/** 갈래를 조각으로. 다섯을 넘으면 앞 넷 뒤를 `그 외 n` 한 조각으로 묶는다 */
function slicesOf(items: readonly CategoryTotal[], color: string): Slice[] {
  const cut = items.length === SLICE_LIMIT + 1 ? items.length : SLICE_LIMIT
  const slices = items.slice(0, cut).map((item, index) => ({
    key: item.key,
    name: item.name,
    meso: item.meso,
    color: sliceColor(color, index),
  }))
  const rest = items.slice(cut)
  if (rest.length > 0) {
    slices.push({
      key: 'rest',
      name: `그 외 ${rest.length}`,
      meso: rest.reduce((sum, item) => sum + item.meso, 0),
      color: restSliceColor(color),
    })
  }
  return slices
}

function modeValue(totals: StatsTotals, mode: Mode): number {
  if (mode === '순 수익') return totals.netMeso
  return mode === '수입' ? totals.incomeMeso : totals.expenseMeso
}

/** 순위. 그 세그먼트의 값이 0 인 캐릭터는 안 선다. 0 을 세우면 없다 가 아니라 꼴찌 로 읽힌다 */
function rankOf(characters: readonly WeeklyIncomeCharacterView[], mode: Mode): WeeklyIncomeCharacterView[] {
  return characters
    .filter((character) => modeValue(character, mode) !== 0)
    .sort((left, right) => modeValue(right, mode) - modeValue(left, mode))
    .slice(0, RANK_LABELS.length)
}

/**
 * 모서리가 둥근 반원 도넛. 경로는 `semiDonutGeometry` 가 만든다. 같은 색의 `CORNER × 2` 굵기 선을 둘러 모서리를 둥글게 한다.
 */
function SemiDonut(props: { slices: readonly Slice[]; trackColor: string; children: React.ReactNode }): React.JSX.Element {
  const shape = semiDonutGeometry(
    props.slices.map((slice) => slice.meso),
    { width: DONUT.width, thickness: DONUT.thickness, corner: CORNER, gap: SLICE_GAP },
  )
  const drawn = props.slices.flatMap((slice, index) =>
    shape.paths[index] ? [{ slice, d: shape.paths[index], strokeWidth: shape.strokeWidths[index] }] : [],
  )

  return (
    <View style={{ width: DONUT.width, height: shape.height }}>
      <Svg width={DONUT.width} height={shape.height} viewBox={`0 0 ${DONUT.width} ${shape.height}`}>
        {drawn.length === 0 ? (
          <Path d={shape.track} fill={props.trackColor} stroke={props.trackColor} strokeWidth={CORNER * 2} strokeLinejoin="round" />
        ) : (
          drawn.map(({ slice, d, strokeWidth }) => (
            <Path
              key={slice.key}
              testID={`weekly-income-slice-${slice.key}`}
              d={d}
              fill={slice.color}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          ))
        )}
      </Svg>
      <View pointerEvents="none" className="absolute inset-x-0 bottom-0 items-center">
        {props.children}
      </View>
    </View>
  )
}

function LegendRow(props: { slice: Slice; amount: string; ink?: string }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: props.slice.color }} />
      <Text className="text-11 text-text-muted">{props.slice.name}</Text>
      <Text style={[TABULAR_NUMS, props.ink === undefined ? undefined : { color: props.ink }]} className="ml-auto text-xs font-bold text-text">
        {props.amount}
      </Text>
    </View>
  )
}

interface PopoverGroup {
  label: string
  total: string
  color: string
  rows: CategoryTotal[]
}

function RankRow(props: {
  rank: string
  first: boolean
  character: WeeklyIncomeCharacterView
  amount: string
  ink: string
  groups: PopoverGroup[]
}): React.JSX.Element {
  // 구조 분해가 필수다. 프로퍼티로 읽으면 `react-hooks/refs` 가 그 접근을 렌더 중 ref 읽기로 본다.
  const { ref, isOpen, anchor, toggle, close } = useAnchoredPopover()
  return (
    <>
      <Pressable
        testID="weekly-income-rank"
        role="button"
        aria-label={`${props.character.name} 항목 보기`}
        aria-expanded={isOpen}
        onPress={toggle}
        className="flex-row items-center gap-2.5 rounded-[10px] bg-card-inset px-3 py-2"
      >
        <Text style={TABULAR_NUMS} className={`min-w-[26px] text-xs font-bold ${props.first ? 'text-text' : 'text-text-muted'}`}>
          {props.rank}
        </Text>
        <CharacterAvatar
          imageUrl={props.character.imageUrl}
          name={props.character.name}
          size={FACE_PX}
          className="shrink-0"
          fallback={<UnknownCharacterFace size={FACE_PX} />}
        />
        <Text testID="weekly-income-rank-name" numberOfLines={1} className="min-w-0 flex-1 text-xs font-semibold text-text">
          {props.character.name}
        </Text>
        {/* 팝오버는 이 금액 쪽에 뜬다. 누른 줄의 금액을 풀어 쓴 것이라 그 금액 아래에서 시작해야 이어 읽힌다. */}
        <View ref={ref} collapsable={false}>
          <Text style={[TABULAR_NUMS, { color: props.ink }]} className="text-xs font-bold">
            {props.amount}
          </Text>
        </View>
      </Pressable>
      {isOpen && (
        <AnchoredPopover
          testID="weekly-income-popover"
          ariaLabel={`${props.character.name} 이번 주 항목`}
          closeLabel="항목 닫기"
          anchor={anchor}
          onClose={close}
          className="gap-2 px-3 py-2.5"
        >
          {props.groups.map((group) => (
            <View key={group.label} className="gap-1">
              <View className="flex-row justify-between gap-4">
                <Text className="text-11 font-bold text-text-muted">{group.label}</Text>
                <Text style={[TABULAR_NUMS, { color: group.color }]} className="text-xs font-bold">
                  {group.total}
                </Text>
              </View>
              {group.rows.map((row, index) => (
                <View key={row.key} className="flex-row items-center gap-1.5">
                  <View
                    className="h-2 w-2 rounded-[2px]"
                    style={{ backgroundColor: sliceColor(group.color, index) }}
                  />
                  <Text className="text-xs font-semibold text-text">{row.name}</Text>
                  <Text style={TABULAR_NUMS} className="ml-auto pl-4 text-xs font-bold text-text">
                    {formatMesoCompact(row.meso)}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

export function WeeklyIncomeWidget({ data }: WidgetProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [mode, setMode] = useState<Mode>('순 수익')
  const view: WeeklyIncomeView = data.weeklyIncome
  const rise = definition.riseInk
  const fall = definition.fallInk

  const incomeGroup = (character: WeeklyIncomeCharacterView): PopoverGroup => ({
    label: '수입',
    total: formatMesoSigned(character.incomeMeso, '+'),
    color: rise,
    rows: character.income,
  })
  const expenseGroup = (character: WeeklyIncomeCharacterView): PopoverGroup => ({
    label: '지출',
    total: formatMesoSigned(character.expenseMeso, '−'),
    color: fall,
    rows: character.expense,
  })

  const { totals } = view
  const empty = view.income.length === 0 && view.expense.length === 0
  const netColor = totals.netMeso > 0 ? rise : totals.netMeso < 0 ? fall : definition.text

  let slices: Slice[]
  let legend: { slice: Slice; amount: string; ink?: string }[]
  let centerText: string
  let centerColor: string
  if (mode === '순 수익') {
    slices = [
      { key: 'income', name: '수입', meso: totals.incomeMeso, color: rise },
      { key: 'expense', name: '지출', meso: totals.expenseMeso, color: fall },
    ]
    legend = [
      { slice: slices[0], amount: formatMesoSigned(totals.incomeMeso, '+'), ink: rise },
      { slice: slices[1], amount: formatMesoSigned(totals.expenseMeso, '−'), ink: fall },
    ]
    centerText = netText(totals.netMeso)
    centerColor = netColor
  } else {
    const income = mode === '수입'
    slices = slicesOf(income ? view.income : view.expense, income ? rise : fall)
    legend = slices.map((slice) => ({ slice, amount: signedMeso(slice.meso, null) }))
    centerText = signedMeso(income ? totals.incomeMeso : totals.expenseMeso, income ? '+' : '−')
    centerColor = income ? rise : fall
  }

  const ranks = rankOf(view.characters, mode)

  return (
    <View testID="widget-weekly-income" className="gap-3 p-3.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-11 font-bold text-text-muted">이번 주 수입</Text>
        <Segment size="sm" options={MODES} selected={mode} onSelect={setMode} />
      </View>

      <View className="flex-row items-center gap-3.5">
        <SemiDonut slices={view.loading ? [] : slices} trackColor={definition.track}>
          <Text className="text-10 text-text-muted">{mode}</Text>
          {!view.loading && (
            <Text testID="weekly-income-total" style={[TABULAR_NUMS, { color: centerColor }]} className="text-base font-bold">
              {centerText}
            </Text>
          )}
        </SemiDonut>
        {!view.loading && (
          <View className="min-w-0 flex-1 gap-1.5">
            {empty ? (
              <Text testID="weekly-income-empty" className="text-11 text-text-muted">
                아직 이번 주 기록이 없습니다
              </Text>
            ) : (
              legend
                .filter((entry) => entry.slice.meso > 0)
                .map((entry) => <LegendRow key={entry.slice.key} {...entry} />)
            )}
          </View>
        )}
      </View>

      {ranks.length > 0 && (
        <View className="gap-1.5">
          {ranks.map((character, index) => (
            <RankRow
              key={character.key}
              rank={RANK_LABELS[index]}
              first={index === 0}
              character={character}
              amount={
                mode === '순 수익'
                  ? netText(character.netMeso)
                  : signedMeso(modeValue(character, mode), mode === '수입' ? '+' : '−')
              }
              ink={mode === '지출' ? fall : mode === '수입' ? rise : character.netMeso >= 0 ? rise : fall}
              groups={
                mode === '순 수익'
                  ? [incomeGroup(character), expenseGroup(character)].filter((group) => group.rows.length > 0)
                  : mode === '수입'
                    ? [incomeGroup(character)]
                    : [expenseGroup(character)]
              }
            />
          ))}
        </View>
      )}
    </View>
  )
}

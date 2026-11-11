/**
 * 위젯 5. 주간 결정석 판매 한도를 그리는 타일. 메이플 ID 가 하나면 2칸, 둘 이상이면 격자가 4칸으로 넓힌다.
 *
 * 지키는 것 다섯.
 *
 * ① 한도는 **메이플 ID 와 월드마다** 각각이라 분모도 그 줄마다다. **절대 합치지 않는다.** 합친
 *    수는 어느 월드에서도 팔 수 있는 양이 아니라 게임에 없는 수치다. 2칸이면 첫 월드만 링으로 그리고
 *    나머지는 첫 월드 이름 옆의 `외 N` 으로 접는다. 넓히면 메이플 ID 마다 칸을 둔다(`crystal-cells.ts`).
 * ② **한도 숫자가 이 파일에 한 번도 안 나온다**(주석 포함, 테스트가 검사한다). 뷰모델이
 *    `CrystalLimitView.limit` 에 실어 준다. 여기 적으면 참조 데이터가 바뀌어도 화면만 옛 한도를 말한다.
 * ③ 링은 칸이 아니라 **연속 호**다. 이 한도는 캐릭터당 주간 보스 한도의 몇 배라 쪼개면 읽을 수 없는
 *    톱니가 된다.
 * ④ 링은 12시에서 **반시계**로 찬다. 앱의 다른 진행률 링과 같은 방향이다.
 * ⑤ 링 안의 분자와 분모는 줄 높이를 0.92 로 낮춰 **바싹 붙인다**. 벌어지면 두 값으로 읽힌다.
 */

import { View } from 'react-native'

import { ProgressBar, ProgressRing, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useThemeAppearance } from '../../../theme/context'
import type { CrystalLimitView, CrystalMapleIdView } from '../view-model'
import { crystalCellRows, type CrystalCell } from './crystal-cells'
import type { WidgetProps } from './types'

const TITLE = '결정석 판매'

/** 월드를 아는 추적 캐릭터가 하나도 없을 때의 한 줄. 처치가 없을 뿐이면 뷰모델이 `0 / 한도` 를 준다. */
const EMPTY_NOTE = '집계할 기록이 없습니다'

const RING_STROKE = 4
const RING_PX = 46

/** 남은 개수는 음수가 되지 않는다. 추적 밖 캐릭터 때문에 한도를 넘겨 셀 일은 없지만, 넘겨도 −3개 남음 은 말이 안 된다. */
function remainingOf(view: CrystalLimitView): number {
  return Math.max(0, view.limit - view.cleared)
}

function ratioOf(view: CrystalLimitView): number {
  if (view.limit <= 0) return 0
  return Math.min(Math.max(view.cleared / view.limit, 0), 1)
}

/** 소진량 링 + 그 안의 분수. 링 뒤에 `card-inset` 원을 깔아 링이 카드 위에서 한 덩어리로 읽힌다. */
function Ring(props: { view: CrystalLimitView }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const numeratorPx = Math.round(RING_PX * 0.27)
  const denominatorPx = Math.round(RING_PX * 0.2)

  return (
    <View
      testID="crystal-ring"
      role="img"
      aria-label={`${props.view.world} 주간 결정석 판매 ${props.view.cleared} / ${props.view.limit}`}
      className="shrink-0 items-center justify-center rounded-full bg-card-inset"
      style={{ width: RING_PX, height: RING_PX }}
    >
      <View className="absolute inset-0">
        <ProgressRing
          testID="crystal-ring-svg"
          size={RING_PX}
          stroke={RING_STROKE}
          direction="ccw"
          track={definition.track}
          fill={definition.primary}
          progress={{ kind: 'continuous', ratio: ratioOf(props.view) }}
        />
      </View>
      {/* 두 줄이지만 한 값이다. 줄 높이를 글자보다 낮춰 분수로 읽히게 한다. */}
      <Text
        testID="crystal-ring-numerator"
        style={{ fontSize: numeratorPx, lineHeight: numeratorPx * 0.92, ...TABULAR_NUMS }}
        className="font-bold text-text"
      >
        {props.view.cleared}
      </Text>
      <Text
        testID="crystal-ring-denominator"
        style={{ fontSize: denominatorPx, lineHeight: denominatorPx * 0.92, ...TABULAR_NUMS }}
        className="text-text-muted"
      >
        {`/${props.view.limit}`}
      </Text>
    </View>
  )
}

/** `N개 남음`. 숫자만 굵다. */
function Remaining(props: { view: CrystalLimitView; testID?: string }): React.JSX.Element {
  return (
    <Text testID={props.testID} numberOfLines={1} className="text-11 text-text-muted">
      <Text style={TABULAR_NUMS} className="font-bold text-text">
        {remainingOf(props.view)}
      </Text>
      개 남음
    </Text>
  )
}

/** 월드 1 의 칸. 2칸 타일과 같이 링 오른쪽에 월드와 `N개 남음` 이다. 옆 칸에 맞춰 늘어나면 링 줄이 세로 가운데에 선다. */
function RingCell(props: { group: CrystalMapleIdView; view: CrystalLimitView }): React.JSX.Element {
  return (
    <View
      testID={`crystal-cell-ring-${props.group.accountId ?? ''}`}
      className="min-w-0 flex-1 gap-1.5 rounded-[10px] bg-card-inset px-2.5 pb-2.5 pt-2"
    >
      <Text numberOfLines={1} className="text-xs font-bold text-text">
        {props.group.name}
      </Text>
      <View className="grow flex-row items-center gap-2.5">
        <Ring view={props.view} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="text-xs font-semibold text-text">
            {props.view.world}
          </Text>
          <Remaining view={props.view} />
        </View>
      </View>
    </View>
  )
}

/** 막대 칸의 월드 한 줄. 월드 이름 · `N개 남음` 과 그 아래 막대다. */
function BarLine(props: { view: CrystalLimitView }): React.JSX.Element {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <View className="flex-row items-baseline justify-between gap-1.5">
        <Text numberOfLines={1} className="shrink text-xs font-semibold text-text">
          {props.view.world}
        </Text>
        <Remaining view={props.view} />
      </View>
      <ProgressBar percent={ratioOf(props.view) * 100} height="thin" fillTestId="crystal-bar" />
    </View>
  )
}

/** 월드 2 의 칸(반 폭, 한 열)과 월드 3 이상의 칸(전체 폭, 두 열). */
function BarCell(props: { cell: CrystalCell }): React.JSX.Element {
  const { group, kind } = props.cell
  const columns = kind === 'wide' ? 2 : 1
  const lines: CrystalLimitView[][] = []
  for (let index = 0; index < group.worlds.length; index += columns) lines.push(group.worlds.slice(index, index + columns))
  return (
    <View
      testID={`crystal-cell-${kind}-${group.accountId ?? ''}`}
      className="min-w-0 flex-1 gap-2 rounded-[10px] bg-card-inset px-2.5 pb-2.5 pt-2"
    >
      <Text numberOfLines={1} className="text-xs font-bold text-text">
        {group.name}
      </Text>
      {lines.map((line) => (
        <View key={line[0]?.worldKey} className="flex-row gap-3">
          {line.map((view) => (
            <BarLine key={view.worldKey} view={view} />
          ))}
          {/* 두 열의 마지막 줄에 월드가 하나면 오른쪽 열 자리를 비워 둔다. 왼쪽 막대가 두 열 폭으로 늘어나지 않게 */}
          {line.length < columns && <View className="flex-1" />}
        </View>
      ))}
    </View>
  )
}

/** 메이플 ID 가 둘 이상일 때의 4칸 위젯. 반 폭 칸 둘은 한 줄에 서서 높이를 맞춘다. */
function WideCrystalLimits(props: { groups: readonly CrystalMapleIdView[] }): React.JSX.Element {
  return (
    <View testID="widget-crystal-limit" className="gap-2 p-3">
      <Text className="text-11 font-bold text-text-muted">{TITLE}</Text>
      {crystalCellRows(props.groups).map((row) => (
        <View key={row.cells[0]?.group.accountId ?? ''} className="flex-row gap-2">
          {row.cells.map((cell) =>
            cell.kind === 'ring' && cell.group.worlds[0] !== undefined ? (
              <RingCell key={cell.group.accountId ?? ''} group={cell.group} view={cell.group.worlds[0]} />
            ) : (
              <BarCell key={cell.group.accountId ?? ''} cell={cell} />
            ),
          )}
          {/* 짝 없이 남은 반 폭 칸은 반 폭 그대로 둔다(사용자 지정). 넓히면 월드 수가 같은 칸의 폭이 자리에 따라 달라진다 */}
          {!row.wide && row.cells.length === 1 && <View className="flex-1" />}
        </View>
      ))}
    </View>
  )
}

export function CrystalLimitWidget({ data }: WidgetProps): React.JSX.Element {
  if (data.crystalLimits.length >= 2) return <WideCrystalLimits groups={data.crystalLimits} />
  const worlds = data.crystalLimits[0]?.worlds ?? []

  if (worlds.length === 0) {
    return (
      <View testID="widget-crystal-limit" className="grow justify-center gap-1 p-3">
        <Text className="text-11 font-bold text-text-muted">{TITLE}</Text>
        <Text testID="crystal-empty" numberOfLines={2} className="text-11 text-text-muted">
          {EMPTY_NOTE}
        </Text>
      </View>
    )
  }

  const [first, ...rest] = worlds
  return (
    <View testID="widget-crystal-limit" className="grow flex-row items-center gap-2.5 p-3">
      <Ring view={first} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-11 font-bold text-text-muted">{TITLE}</Text>
        {/* 줄에 안 들어가면 `외 N` 만 다음 줄로 내린다. 글자 하나로 합치면 말줄임에 잘린다. */}
        <View testID="crystal-world-line" className="flex-row flex-wrap items-baseline gap-x-1">
          <Text testID="crystal-world" numberOfLines={1} className="text-xs font-semibold text-text">
            {first.world}
          </Text>
          {rest.length > 0 && (
            <Text testID="crystal-rest" numberOfLines={1} className="text-11 text-text-muted">
              {`외 ${rest.length}`}
            </Text>
          )}
        </View>
        <Text testID="crystal-remaining" numberOfLines={1} className="text-11 text-text-muted">
          <Text style={TABULAR_NUMS} className="font-bold text-text">
            {remainingOf(first)}
          </Text>
          개 남음
        </Text>
      </View>
    </View>
  )
}

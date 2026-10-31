/**
 * 위젯 5. 주간 결정석 판매 한도를 월드별로 그리는 타일.
 *
 * 지키는 것 다섯.
 *
 * ① 한도는 계정이 아니라 **월드마다** 각각이라 분모도 월드마다다. **절대 합치지 않는다.** 합친
 *    수는 어느 월드에서도 팔 수 있는 양이 아니라 게임에 없는 수치다. 첫 월드만 링으로 그리고
 *    나머지는 첫 월드 이름 옆의 `외 N` 으로 접는다.
 * ② **한도 숫자가 이 파일에 한 번도 안 나온다**(주석 포함, 테스트가 검사한다). 뷰모델이
 *    `CrystalLimitView.limit` 에 실어 준다. 여기 적으면 참조 데이터가 바뀌어도 화면만 옛 한도를 말한다.
 * ③ 링은 칸이 아니라 **연속 호**다. 이 한도는 캐릭터당 주간 보스 한도의 몇 배라 쪼개면 읽을 수 없는
 *    톱니가 된다.
 * ④ 링은 12시에서 **반시계**로 찬다. 앱의 다른 진행률 링과 같은 방향이다.
 * ⑤ 링 안의 분자와 분모는 줄 높이를 0.92 로 낮춰 **바싹 붙인다**. 벌어지면 두 값으로 읽힌다.
 */

import { View } from 'react-native'

import { ProgressRing, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { useThemeAppearance } from '../../../theme/context'
import type { CrystalLimitView } from '../view-model'
import type { WidgetProps } from './types'

const TITLE = '결정석 판매'

/**
 * 집계할 것이 없을 때의 한 줄. 이유가 둘이지만(이번 주 처치 기록 없음 · 월드를 아는 행 없음)
 * 어느 쪽인지 말하지 않는다. 판매 0개라고 쓰면 없는 사실을 단정하고, 월드를 모른다는 사용자가
 * 할 수 있는 일이 없는 내부 사정이다.
 */
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

export function CrystalLimitWidget({ data }: WidgetProps): React.JSX.Element {
  const worlds = data.crystalLimits

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

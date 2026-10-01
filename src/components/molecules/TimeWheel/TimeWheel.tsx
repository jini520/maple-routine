/**
 * 시 · 분 두 열의 3D 원통 휠. 두 플랫폼이 같은 모양이다(OS 고르개를 쓰지 않고 JS 로 그린다).
 *
 * 칸을 넘길 때마다 선택 햅틱이 울리고, 휠이 멈춘 뒤에 `onChange` 가 한 번 온다.
 */
import WheelPicker from '@quidone/react-native-wheel-picker'
import { useMemo } from 'react'
import { View } from 'react-native'

import { Text } from '../../atoms'
import { selectionFeedback } from '../../../native/haptics'
import { useThemeAppearance } from '../../../theme/context'
import { HOUR_VALUES, minuteValues, snapMinute } from './time-wheel-values'

/** 가운데 칸 높이. 위아래로 한 칸씩 더 보인다 */
const ITEM_HEIGHT = 32
const VISIBLE_ITEM_COUNT = 3
const COLUMN_WIDTH = 56

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export interface TimeWheelProps {
  hour: number
  minute: number
  /** 분 단위(분). 60 을 나누는 값 */
  step: number
  onChange: (next: { hour: number; minute: number }) => void
  /** 열 뒤에 붙는 단위 글자(`시간` · `분 전`). 없으면 두 열 사이에 `:` 하나 */
  units?: { hour: string; minute: string }
  /** 흐리게 그릴 칸. 막는 일(값 되돌리기)은 부르는 쪽이 `onChange` 에서 한다 */
  isDisabled?: (hour: number, minute: number) => boolean
}

export function TimeWheel(props: TimeWheelProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  // 단위가 붙으면 길이(`1 시간`)라 앞의 0 을 안 채운다. 시각(`09:30`)일 때만 채운다.
  const padHour = props.units === undefined
  const hours = useMemo(
    () => HOUR_VALUES.map((value) => ({ value, label: padHour ? pad(value) : String(value) })),
    [padHour],
  )
  const minutes = useMemo(
    () => minuteValues(props.step).map((value) => ({ value, label: pad(value) })),
    [props.step],
  )
  const minute = snapMinute(props.minute, props.step)
  const { isDisabled, step } = props

  const textStyle = { color: definition.text, fontSize: 20, fontWeight: '600' as const }
  const common = {
    itemHeight: ITEM_HEIGHT,
    visibleItemCount: VISIBLE_ITEM_COUNT,
    width: COLUMN_WIDTH,
    enableScrollByTapOnItem: true,
    onValueChanging: () => selectionFeedback(),
    itemTextStyle: textStyle,
    // 가운데 칸 바탕. 두 열이 한 띠로 이어져 보이게 모서리를 두지 않는다(띠는 아래 View 가 그린다).
    overlayItemStyle: { backgroundColor: 'transparent' },
  }

  // 칸 그리기를 늘 이것으로 한다. 라이브러리 기본 칸은 가운데 정렬 · 줄 높이 = 칸 높이를 갖는데,
  // 막힌 칸이 있을 때만 갈아 끼우면 그 둘이 빠져 휠 하나만 글자가 어긋난다.
  function cell(label: string, disabled: boolean): React.ReactElement {
    return (
      <Text
        style={[
          textStyle,
          { textAlign: 'center', lineHeight: ITEM_HEIGHT },
          disabled && { color: definition.textDisabled },
        ]}
      >
        {label}
      </Text>
    )
  }

  return (
    <View className="flex-row items-center justify-center">
      {/* 두 열을 가로지르는 가운데 띠. 휠은 3D 로 눌려 칸 수 × 칸 높이보다 낮아서 위 끝이 아니라 가운데에 맞춘다. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 bg-card-body"
        style={{ top: '50%', marginTop: -ITEM_HEIGHT / 2, height: ITEM_HEIGHT, borderRadius: 10 }}
      />
      <WheelPicker
        {...common}
        data={hours}
        value={props.hour}
        renderItem={({ item }) =>
          // 그 시의 모든 분이 막혔을 때만 시를 흐린다.
          cell(
            item.label ?? '',
            isDisabled !== undefined && minuteValues(step).every((one) => isDisabled(item.value, one)),
          )
        }
        onValueChanged={({ item }) => props.onChange({ hour: item.value, minute })}
      />
      {props.units === undefined ? (
        <Text className="mx-1 text-lg font-bold text-text">:</Text>
      ) : (
        <Text className="text-sm font-semibold text-text-muted">{props.units.hour}</Text>
      )}
      <WheelPicker
        {...common}
        data={minutes}
        value={minute}
        renderItem={({ item }) => cell(item.label ?? '', isDisabled?.(props.hour, item.value) === true)}
        onValueChanged={({ item }) => props.onChange({ hour: props.hour, minute: item.value })}
      />
      {props.units !== undefined && (
        <Text className="text-sm font-semibold text-text-muted">{props.units.minute}</Text>
      )}
    </View>
  )
}

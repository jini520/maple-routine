/**
 * 시각을 고르는 팝오버. 누른 칸 아래로 열리고 5분 휠과 `확인` 을 든다.
 *
 * 상자는 `CalendarPopover` 와 같은 반경 12 · 테두리 · 꼬리 · 그림자이고, 폭은 휠에 맞춘다.
 *
 * 휠을 돌리는 동안은 팝오버 안의 값만 바뀐다. `확인` 을 눌러야 밖으로 나간다. 휠은 멈출 때마다 값을
 * 내므로, 돌리는 도중의 값으로 시트가 흔들리지 않게 한다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../atoms'
import { AnchoredPopover } from '../../molecules/Popover/Popover'
import { TimeWheel } from '../../molecules/TimeWheel/TimeWheel'
import type { PopoverAnchorRect } from '../../../hooks/useAnchoredPopover'

export interface TimePopoverProps {
  /** 분. 시각이면 그 날 0시부터, `units` 를 주면 그 길이 */
  minutes: number
  step: number
  /** 열 뒤 단위 글자. 시각이 아니라 길이(`1 시간 15 분 전`)를 고를 때 */
  units?: { hour: string; minute: string }
  /** 고를 수 없는 칸. 흐리게 그리고, 거기서 멈추면 `확인` 을 막는다 */
  isDisabled?: (minutes: number) => boolean
  /** 시 열의 첫 시(종료 휠은 시작 시부터) */
  firstHour?: number
  /** 시 열 왼쪽 날짜 열(`10/2 (금)` · `10/3 (토)`) */
  dayLabels?: { today: string; next: string }
  onConfirm: (minutes: number) => void
  /** `null` 이면 아직 못 쟀다. 그리되 보이지 않는다 */
  anchor: PopoverAnchorRect | null
  onClose: () => void
}

export function TimePopover(props: TimePopoverProps): React.JSX.Element {
  const [value, setValue] = useState(props.minutes)
  const { isDisabled } = props
  const blocked = isDisabled?.(value) === true

  return (
    <AnchoredPopover
      testID="time-popover"
      ariaLabel="시각 고르기"
      closeLabel="시각 고르기 닫기"
      anchor={props.anchor}
      onClose={props.onClose}
      className="px-3 pb-2 pt-3"
    >
      <TimeWheel
        units={props.units}
        firstHour={props.firstHour}
        dayLabels={props.dayLabels}
        hour={Math.floor(value / 60)}
        minute={value % 60}
        step={props.step}
        isDisabled={isDisabled === undefined ? undefined : (hour, minute) => isDisabled(hour * 60 + minute)}
        onChange={(next) => setValue(next.hour * 60 + next.minute)}
      />
      <View className="mt-1 flex-row justify-end">
        <Pressable
          role="button"
          aria-label="확인"
          disabled={blocked}
          onPress={() => props.onConfirm(value)}
          hitSlop={8}
          className={`px-2 py-1${blocked ? ' opacity-40' : ''}`}
        >
          <Text className="text-sm font-bold text-primary-ink">확인</Text>
        </Pressable>
      </View>
    </AnchoredPopover>
  )
}

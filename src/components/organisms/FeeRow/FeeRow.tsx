import { Pressable, View } from 'react-native'

import { CheckBox, Text } from '../../atoms'
import { MvpPlate } from '../../molecules/MvpPlate/MvpPlate'
import { Segment } from '../../molecules/Segment/Segment'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { MvpGradeKey } from '../../../lib/mvp/grades'

/**
 * 수수료 줄. `자동` 체크박스를 켜면 값 자리에 등급 명패와 요율, 끄면 세그먼트가 선다.
 *
 * 끈 이유를 적는 설명 줄은 없다. 체크박스가 꺼져 있는 것이 그 말이고, 줄이 하나 늘면 폼마다 높이가 는다.
 *
 * @example
 * <FeeRow label="수수료" auto={auto} onAutoChange={setAuto} autoFee={useAutoFee(ocid, dateKey)}
 *   options={['없음', '3%', '5%']} selected={manual} onSelect={setManual} />
 */
export function FeeRow<T extends string>(props: {
  label: string
  auto: boolean
  onAutoChange: (auto: boolean) => void
  /** 자동의 명패와 요율. 캐릭터를 고르기 전이면 `null` */
  autoFee: { grade: MvpGradeKey; percent: number } | null
  /** 자동인데 요율을 아직 모를 때 값 자리에 흐리게 서는 안내 */
  autoPlaceholder?: string
  options: readonly T[]
  selected: T | null
  onSelect: (value: T) => void
  /**
   * `field` 는 가계부 시트의 줄(아래 선), `compact` 는 파티 모달의 줄.
   *
   * `stacked` 는 드롭 가격 카드다. 이름과 `자동` 이 윗줄, 값이 아랫줄이라 판의 반쪽 너비에서도
   * 세그먼트가 이름과 자리를 다투지 않는다.
   */
  variant?: 'field' | 'compact' | 'stacked'
  testID?: string
}): React.JSX.Element {
  const compact = props.variant === 'compact'
  const stacked = props.variant === 'stacked'

  const value = (
    <View
      testID={props.testID === undefined ? undefined : `${props.testID}-value`}
      /*
        **`stacked` 는 값 줄 높이를 못박는다.** 자동을 켜고 끌 때 이 자리가 명패 + 요율(19)과
        세그먼트(26)를 오가는데, 안 못박으면 그 7px 만큼 아래의 버튼 줄과 옆 줄이 함께
        흔들린다. 26 은 세그먼트 쪽 높이다(조각 16 + `py-0.5` 4 + 상자 `p-0.5` 4 + 테두리 2).
      */
      className={`flex-row items-center justify-end gap-1.5${stacked ? ' h-[26px]' : ' flex-1'}`}
    >
      {props.auto ? (
        props.autoFee !== null ? (
          <>
            <MvpPlate grade={props.autoFee.grade} height={18} />
            <Text className="text-13 font-semibold text-text" style={TABULAR_NUMS}>
              {props.autoFee.percent}%
            </Text>
          </>
        ) : (
          props.autoPlaceholder !== undefined && (
            <Text className="text-13 text-text-disabled">{props.autoPlaceholder}</Text>
          )
        )
      ) : (
        <Segment options={props.options} selected={props.selected} fixed onSelect={props.onSelect} />
      )}
    </View>
  )

  return (
    <View testID={props.testID} className={stacked ? 'gap-1' : undefined}>
      <View
        testID={props.testID === undefined || !stacked ? undefined : `${props.testID}-head`}
        className={
          compact || stacked
            ? 'flex-row items-center gap-2.5'
            : 'min-h-7 flex-row items-center gap-3 border-b border-border pb-2'
        }
      >
        <Text
          className={
            compact
              ? 'text-11 font-semibold tracking-[.04em] text-text-muted'
              : `shrink-0 text-xs text-text-muted${stacked ? ' flex-1' : ''}`
          }
        >
          {props.label}
        </Text>
        <Pressable
          role="checkbox"
          aria-label="자동"
          aria-checked={props.auto}
          onPress={() => props.onAutoChange(!props.auto)}
          hitSlop={8}
          className="flex-row items-center gap-2"
        >
          <CheckBox checked={props.auto} />
          <Text className="text-xs font-semibold text-text-muted">자동</Text>
        </Pressable>
        {!stacked && value}
      </View>
      {stacked && value}
    </View>
  )
}

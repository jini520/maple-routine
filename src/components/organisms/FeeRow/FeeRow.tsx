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
  /** `field` 는 가계부 시트의 줄(아래 선), `compact` 는 파티 모달의 줄 */
  variant?: 'field' | 'compact'
  testID?: string
}): React.JSX.Element {
  const compact = props.variant === 'compact'
  return (
    <View testID={props.testID}>
      <View
        className={
          compact
            ? 'flex-row items-center gap-2.5'
            : 'min-h-7 flex-row items-center gap-3 border-b border-border pb-2'
        }
      >
        <Text
          className={
            compact
              ? 'text-11 font-semibold tracking-[.04em] text-text-muted'
              : 'shrink-0 text-xs text-text-muted'
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
        <View className="flex-1 flex-row items-center justify-end gap-1.5">
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
      </View>
    </View>
  )
}

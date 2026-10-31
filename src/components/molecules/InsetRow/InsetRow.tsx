import type { ReactNode } from 'react'
import { View } from 'react-native'

import { Text } from '../../atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'

/** 가운데 모달 안 칸 하나의 바탕. 줄 모양이 아닌 칸(작업 막대 · 고르는 칸)도 이 값으로 칠한다. */
export const INSET_ROW_CLASS = 'rounded-[10px] bg-card-inset px-3 py-2.5'

export interface InsetRowProps {
  /** 이름 앞의 표시. 아이콘 · 체크 · 스피너. */
  leading?: ReactNode
  label: string
  /** 이름 아래 작은 글자. */
  sub?: string
  /** 값 앞에 붙는 표시. 베타 배지처럼 값에 딸린 것. */
  trailing?: ReactNode
  /** 오른쪽 값. 숫자 폭을 맞춘다. */
  value?: string
  /** 값 글자 클래스. 기본은 굵은 본문색. */
  valueClassName?: string
  testID?: string
}

/**
 * 가운데 모달의 `card-inset` 칸 한 줄. 왼쪽에 이름, 오른쪽에 값을 둔다.
 *
 * @example <InsetRow label="버전" value={versionLabel} />
 */
export function InsetRow(props: InsetRowProps): React.JSX.Element {
  return (
    <View testID={props.testID} className={`flex-row items-center gap-2.5 ${INSET_ROW_CLASS}`}>
      {props.leading}
      <View className="min-w-0 flex-1 gap-px">
        <Text className="text-xs font-semibold text-text">{props.label}</Text>
        {props.sub !== undefined && <Text className="text-11 text-text-muted">{props.sub}</Text>}
      </View>
      {props.trailing}
      {props.value !== undefined && (
        <Text className={props.valueClassName ?? 'text-xs font-bold text-text'} style={TABULAR_NUMS}>
          {props.value}
        </Text>
      )}
    </View>
  )
}

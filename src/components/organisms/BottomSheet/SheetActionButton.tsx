/**
 * 바텀시트 바닥 줄의 주 버튼. 시트 아래 곡률에 맞춘 알약이다.
 *
 * 시트 가장자리에서 떨어지는 간격은 바텀시트가 화면 반경으로 정해 `SheetFooterInset` 으로 내려 준다. 바닥 줄은 좌우 여백 16 을
 * 이미 갖고 있어서, 버튼은 그 나머지만 더 들여쓴다.
 *
 * @example
 * <BottomSheet footer={<SheetActionButton label="저장" disabled={!canSave} onPress={save} />} …>
 */
import { useContext } from 'react'
import { Pressable } from 'react-native'

import { Text } from '../../atoms'
import { FOOTER_INSET, SheetFooterInset } from './sheet-footer-inset'

export function SheetActionButton(props: {
  label: string
  onPress: () => void
  disabled?: boolean
  testID?: string
}): React.JSX.Element {
  const gap = useContext(SheetFooterInset)
  const enabled = props.disabled !== true
  return (
    <Pressable
      role="button"
      aria-label={props.label}
      aria-disabled={!enabled}
      disabled={!enabled}
      testID={props.testID}
      onPress={props.onPress}
      // 반경 26 은 높이의 절반이다. 연속 곡률은 아이폰 화면 모서리와 같은 곡선이다.
      style={{ height: 52, borderRadius: 26, borderCurve: 'continuous', marginHorizontal: gap - FOOTER_INSET }}
      className={`items-center justify-center ${enabled ? 'bg-primary' : 'bg-surface-2'}`}
    >
      <Text className={`text-base font-bold ${enabled ? 'text-on-primary' : 'text-text-disabled'}`}>{props.label}</Text>
    </Pressable>
  )
}

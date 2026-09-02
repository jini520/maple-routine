/**
 * 시트 안에서 쓰는 입력 칸. `atoms/TextInput` 에 시트 배선만 얹은 것이다.
 *
 * 시트는 키보드가 올라올 때 자기를 밀어올리는데, **어느 칸에 초점이 있는지를 알아야** 그 계산에
 * 들어간다. 그 값을 `useSheetKeyboardTarget` 이 채운다.
 *
 * **molecule 이다** — 하는 일이 아톰과 훅을 합치는 것뿐이라 의 `atoms 조합 ·
 * 도메인 모름` 에 그대로 맞는다. 시트 컨텍스트를 읽는 것은 `src/hooks/` 의 훅이고 그것은 계층
 * 밖이다. organism 에 두면 이것을 가장 필요로 하는 molecule 둘이 못 가져온다.
 *
 * `organisms/BottomSheet/` 안에 두지 않는 것은 시트에 입력 칸이 있을 수도 없을 수도 있어서다
 * (사용자 지정).
 */
import { useSheetKeyboardTarget } from '../../../hooks/useSheetKeyboardTarget'
import { TextInput, type TextInputProps } from '../../atoms'

/**
 * 시트 안 입력 칸 하나. 프롭은 `atoms/TextInput` 과 똑같다.
 *
 * 시트 **밖**에서는 아톰을 그대로 쓸 것. 이 컴포넌트는 시트 밖에서도 안 터지지만(훅이 `unsafe`
 * 로 묻는다) 쓸 이유가 없다.
 *
 * @example
 * <SheetTextInput
 *   aria-label="판매가"
 *   value={meso === 0 ? '' : meso.toLocaleString()}
 *   onChangeText={(text) => setMeso(parseMesoInput(text))}
 *   keyboardType="number-pad"
 * />
 */
export function SheetTextInput({
  onFocus,
  onBlur,
  ...rest
}: TextInputProps): React.JSX.Element {
  const sheetKeyboard = useSheetKeyboardTarget(onFocus, onBlur)

  return <TextInput {...rest} {...sheetKeyboard} />
}

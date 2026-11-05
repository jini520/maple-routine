/**
 * `API 키로 로그인` 버튼. 넥슨 로그인 입구가 꺼진 빌드에서 로그인 화면의 넥슨 버튼 자리에 선다.
 *
 * 모양은 넥슨 버튼을 따른다. 입구를 켜면 같은 자리에 넥슨 버튼이 서므로, 모양이 같아야 첫 화면이 달라 보이지 않는다.
 * 그래서 알약인 `Button` 을 쓰지 않는다. 색만 테마 `primary` 로 바꾼다. 넥슨의 파랑이면 넥슨 로그인으로 읽힌다.
 *
 * @example <ApiKeyLoginButton onPress={() => setSheetOpen(true)} />
 * @see docs/features/auth.md 로그인 화면
 */
import { Pressable } from 'react-native'

import loginButtonImage from '../../../assets/nexon/login-button-wide-center.png'
import { naturalAspectStyle } from '../../../lib/image-aspect'
import { KeyRoundIcon, Text } from '../../atoms'

export function ApiKeyLoginButton(props: { onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      role="button"
      onPress={props.onPress}
      // 높이는 넥슨 그림의 비율이 정한다. 높이를 적으면 그림이 바뀔 때 두 버튼의 높이가 갈린다.
      style={naturalAspectStyle(loginButtonImage, { width: '100%' })}
      className="flex-row items-center justify-center gap-1.5 rounded-[6px] bg-primary"
    >
      <KeyRoundIcon className="h-[19px] w-[19px] text-on-primary" strokeWidth={2} aria-hidden />
      <Text className="text-base font-bold text-on-primary">API 키로 로그인</Text>
    </Pressable>
  )
}

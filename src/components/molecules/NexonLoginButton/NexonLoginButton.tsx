/**
 * 넥슨 Open ID 로그인 버튼. 모양은 넥슨의 `로그인 버튼 사용 가이드` 가 정한다.
 *
 * **검수가 이 버튼의 캡처를 본다.** 그래서 이 앱의 디자인 시스템을 안 따른다. 색(`#0077FF`) ·
 * 모서리(`6px`) · 심볼 · 폰트 · 여백이 전부 에셋 한 장 안에 있고, 우리가 다시 그리는 것이 없다.
 * 가이드는 색 변경 · 심볼 변형 · 폰트 임의 변경 · 텍스트 왜곡을 금지한다.
 *
 * @example <NexonLoginButton onPress={() => void signInWithNexon()} />
 * @see docs/features/auth.md 로그인 버튼
 */
import { Image, Pressable } from 'react-native'

import loginButtonImage from '../../../assets/nexon/login-button-wide-center.png'
import { naturalAspectStyle } from '../../../lib/image-aspect'

/** 그림 안에 적힌 글자. 읽어 주는 이름이 그림과 달라지면 안 된다. */
const LABEL = '넥슨ID 로그인'

export function NexonLoginButton(props: {
  onPress: () => void
  testID?: string
}): React.JSX.Element {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={LABEL}
      onPress={props.onPress}
      className="w-full"
    >
      <Image
        testID="nexon-login-button-image"
        source={loginButtonImage}
        // **높이를 적지 말 것.** 두 축이 다 정해지면 Yoga 가 종횡비를 안 써서 그림이 일그러지고,
        // 그것이 가이드의 `텍스트 왜곡 및 변형` 금지에 걸린다. 종횡비는 에셋의 고유 크기가 정한다.
        style={naturalAspectStyle(loginButtonImage, { width: '100%' })}
        resizeMode="contain"
        // 글자가 그림 안에 있어 읽을 것이 없다. 이름은 위 Pressable 이 든다.
        accessible={false}
      />
    </Pressable>
  )
}

/**
 * 앱을 떠나 시스템 브라우저로 가는 행.
 *
 * `SettingsRow` 와 골격은 같지만 **시맨틱이 링크**인 것이 요점이다. 한 컴포넌트로 합치지 않는다
 * (합치면 `onPress` 가 선택 필드가 되어 호출부에서 어느 쪽인지 타입으로 알 수 없다). 오른쪽 표식도
 * chevron 이 아니다: chevron 을 쓰면 다른 이동 행과 같은 약속을 하고는 다른 일을 한다.
 * 지금 이 컴포넌트를 쓰는 화면은 없다.
 *
 * 하나뿐이던 호출부, 개인정보 처리방침이 로 **앱 안 하위 페이지**가 되면서
 * (`SettingsAboutScreen` 이 `SettingsRow` 로 연다) 지금 사용처가 0 이다. 그래도 두는 이유는
 *  의 "행 우측 표기 5종"이 이 프리미티브로 고정돼 있어서다. 다섯 중 하나를
 * 지우면 다음에 외부 링크 행이 필요할 때 규격이 아니라 그때의 즉흥이 다시 자리를 잡는다.
 */
import { Linking, Pressable, View } from 'react-native'

import { ExternalLinkIcon, Text } from '../../components/atoms'
import { SETTINGS_ROW_CLASS } from './row-class'

export interface SettingsLinkRowProps {
  label: string
  href: string
}

export function SettingsLinkRow(props: SettingsLinkRowProps): React.JSX.Element {
  return (
    <Pressable
      role="link"
      onPress={() => void Linking.openURL(props.href)}
      className={SETTINGS_ROW_CLASS}
    >
      <Text className="text-sm font-medium text-text">{props.label}</Text>
      {/* `testID` 가 감싸는 `View` 에 있는 이유는 `SettingsRow` 의 chevron 과 같다. lucide 가
          그 프롭을 `data-testid` 로 바꿔 넘겨 RNTL 이 못 찾는다. */}
      <View testID="settings-row-external">
        <ExternalLinkIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
      </View>
    </Pressable>
  )
}

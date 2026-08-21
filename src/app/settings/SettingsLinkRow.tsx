// 앱을 떠나 시스템 브라우저로 가는 행([[ADR-118]] 결정 4 의 "외부 링크 행", 결정 7).
//
// `SettingsRow` 와 골격은 같지만 **시맨틱이 링크**인 것이 요점이다 — 한 컴포넌트로 합치지 않는다
// (합치면 `onPress` 가 선택 필드가 되어 호출부에서 어느 쪽인지 타입으로 알 수 없다). 오른쪽 표식도
// chevron 이 아니다: chevron 을 쓰면 다른 이동 행과 같은 약속을 하고는 다른 일을 한다.
//
// ── RN 으로 옮기며 갈린 것 둘 ────────────────────────────────────────────────────────
//
// ① **`<a target="_blank">` → `Pressable role="link"` + `Linking.openURL`** — `ApiKeyForm` 의 두
//    링크와 같은 처방이다.
// ② **`rel="noopener noreferrer"` 가 사라진다.** 그것은 브라우저 탭 사이의 문제였고(새 컨텍스트가
//    `window.opener` 로 원래 문서를 만지는 것) RN 에는 그 관계 자체가 없다 — OS 브라우저는 우리
//    프로세스 밖이다. **웹의 주석이 "`rel` 을 빼지 말 것"이라 적은 위험이 여기서는 존재하지 않는다.**
//
// ── 지금 이 컴포넌트를 쓰는 화면은 없다 ──────────────────────────────────────────────
//
// 유일한 호출부였던 개인정보 처리방침이 [[ADR-120]] 결정 11 로 **앱 안 하위 페이지**가 되면서
// (`SettingsAboutScreen` 이 `SettingsRow` 로 연다) 웹에서도 사용처가 0 이다. 그래도 옮기는 이유는
// [[ADR-118]] 결정 4 의 "행 우측 표기 5종"이 이 프리미티브로 고정돼 있어서다 — 다섯 중 하나를
// 지우면 다음에 외부 링크 행이 필요할 때 규격이 아니라 그때의 즉흥이 다시 자리를 잡는다.
import { Linking, Pressable, View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { ExternalLinkIcon } from '../../lib/icons'
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
      {/* `testID` 가 감싸는 `View` 에 있는 이유는 `SettingsRow` 의 chevron 과 같다 — lucide 가
          그 프롭을 `data-testid` 로 바꿔 넘겨 RNTL 이 못 찾는다. */}
      <View testID="settings-row-external">
        <ExternalLinkIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
      </View>
    </Pressable>
  )
}

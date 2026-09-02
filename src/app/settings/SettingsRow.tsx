// 설정 화면의 단일 리스트 컨테이너 안에서 반복되는 행 — 구분선은 부모가 형제 사이에 준다
// (이 컴포넌트 자체는 테두리를 갖지 않는다, `row-class.ts`).
//
// 우측은 값과 chevron 의 **병기**다. 옛 배타(`rightContent ?? chevron`)에서는
// 값이 있으면 화살표가 사라져 화살표가 "이 행에 값이 있는가"를 말했다. 사용자가 알고 싶은
// 것은 그것이 아니다. 병기 후 규칙은 "chevron 이 있으면 누르면 무언가 열린다, 없는 위험 색
// 행은 누르면 지운다"다.
//
// ── RN 으로 옮기며 갈린 것 셋 ────────────────────────────────────────────────────────
//
// ① `<button>` → `Pressable role="button"`. 웹에서 태그가 공짜로 주던 시맨틱을 명시로 되살린다
//    (`Button` atom 과 같은 판단).
// ② **라벨 클래스가 상자가 아니라 `Text` 에 있다**. RN 은 글자 스타일이 상속되지 않는다. 웹에서도
//    이미 `<span>` 이 들고 있었으므로 옮겨 붙일 자리가 그대로 있다.
// ③ `onClick` → `onPress`. **이름만 바꾸고 뜻은 그대로** 둔다. 이 행의 계약은 "누르면 한 번
//    불린다"이고 그것이 바뀌지 않는다.
//
// chevron 의 `testID` 가 아이콘이 아니라 **감싸는 `View`** 에 있는 것은 lucide 가 그 프롭을
// 가로채 `data-testid` 로 바꿔 넘기기 때문이다(웹판과 코드를 공유하는 흔적 —
// `lib/nativewind-interop.ts` 가 실측으로 적어 뒀다). 웹 테스트가 이 testID 로 `값과 화살표의
// 병기`를 지키고 있어 이름을 유지해야 한다.
import { Pressable, View } from 'react-native'

import { ChevronRightIcon, Text } from '../../components/atoms'
import { SETTINGS_ROW_CLASS } from './row-class'

export interface SettingsRowProps {
  label: string
  onPress: () => void
  rightContent?: React.ReactNode
  danger?: boolean
  /** rightContent 유무와 무관하게 chevron 을 그릴지. 기본 true. */
  showChevron?: boolean
}

export function SettingsRow(props: SettingsRowProps): React.JSX.Element {
  const showChevron = props.showChevron ?? true

  return (
    <Pressable role="button" onPress={props.onPress} className={SETTINGS_ROW_CLASS}>
      <Text
        className={
          props.danger === true
            ? 'text-sm font-medium text-error-ink'
            : 'text-sm font-medium text-text'
        }
      >
        {props.label}
      </Text>
      <View className="flex-row items-center gap-2">
        {props.rightContent}
        {showChevron && (
          <View testID="settings-row-chevron">
            <ChevronRightIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
          </View>
        )}
      </View>
    </Pressable>
  )
}

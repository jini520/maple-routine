/**
 * 적용은 즉시지만 **닫기는 따라오지 않는다**.
 *
 * 모달 자신이 선택 테마의 색으로 그려지므로, 열어둔 채로 고르면 그 자리에서 갈아입혀 보게 된다.
 * 전에는 한 번 고를 때마다 닫혀서 두 테마를 비교하려면 설정 행 → 모달을 다시 여는 왕복이 필요했다.
 *
 * 버튼이 "완료" 하나인 이유는 **되돌릴 것이 없기 때문**이다. `TrackingModeModal` 의 취소/적용
 * 2단계는 선택과 적용이 분리돼 있어 성립하는 것이고, 여기서는 이미 적용된
 * 뒤라 "취소"가 가리킬 대상이 없다(되돌리려면 원래 테마를 다시 고른다).
 *
 * RN 에서 갈린 것은 마크업뿐이다. `<h2>`/`<p>` → `Text`, `space-y-*` → `gap-*`, 그리고 웹이
 * 상자에 주던 `text-sm` 이 `Button` 의 `textClassName` 으로 옮겨간다(`Button.tsx` 파일 머리 ②).
 *
 * **"즉시 적용"이 RN 에서 실제로 눈에 보이는지는 확인 대상이다.** 웹은 `:root` 커스텀 프로퍼티가
 * 바뀌어 문서 전체가 다시 칠해졌고, RN 은 `ThemeProvider` 의 `vars()` View 가 갈리면서 그 아래
 * 트리가 다시 그려진다. 이 모달은 **네이티브 윈도우**(`react-native` 의 `Modal`)라 그 View 아래에
 * 있는지가 구조상 자명하지 않다. 육안 대조 목록에 넣어 둔다.
 */
import { View } from 'react-native'

import { useThemeStore } from '../../features/theme/store'

import { Button, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'
import { ThemeSelector } from './ThemeSelector'

export interface ThemeModalProps {
  onClose: () => void
}

export function ThemeModal(props: ThemeModalProps): React.JSX.Element {
  const { theme, selectTheme } = useThemeStore()

  return (
    <Modal onClose={props.onClose} testId="theme-modal-overlay">
      <Modal.Card>
        <View className="mb-4 gap-1">
          <Text className="text-lg font-semibold text-text">테마</Text>
          <Text className="text-sm text-text-muted">원하는 테마를 선택해주세요.</Text>
        </View>
        <ThemeSelector
          theme={theme}
          onSelect={(next) => {
            void selectTheme(next)
          }}
        />

        {/* 설정의 다른 모달(TrackingModeModal·DisconnectConfirm)과 같은 골격. 버튼만 하나다. */}
        <View className="mt-4 flex-row justify-end">
          <Button variant="primary" onPress={props.onClose} textClassName="text-sm">
            완료
          </Button>
        </View>
      </Modal.Card>
    </Modal>
  )
}

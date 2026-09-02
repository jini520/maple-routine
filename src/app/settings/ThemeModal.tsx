/**
 * 테마 고르는 모달. **적용은 즉시지만 닫기는 따라오지 않는다.**
 *
 * 모달 자신이 선택 테마의 색으로 그려지므로 열어둔 채로 고르면 그 자리에서 갈아입혀 본다. 한 번
 * 고를 때마다 닫히면 두 테마를 비교하려고 설정 행과 모달을 왕복해야 한다.
 *
 * 버튼이 `완료` 하나인 것은 되돌릴 것이 없어서다. 이미 적용된 뒤라 `취소` 가 가리킬 대상이 없다.
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

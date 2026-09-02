/**
 * 연결 해제 확인. 파괴적 동작이라 확인을 한 번 받는다.
 */
import { View } from 'react-native'

import { Button, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'

export interface DisconnectConfirmProps {
  isOpen: boolean
  isDisconnecting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectConfirm(props: DisconnectConfirmProps): React.JSX.Element | null {
  if (!props.isOpen) return null

  return (
    <Modal onClose={props.onCancel} testId="disconnect-confirm-overlay" align="center">
      <Modal.Card>
        <View className="gap-4">
          <View className="gap-1">
            <Text className="text-lg font-semibold text-text">연결을 해제할까요?</Text>
            <Text className="text-sm text-text-muted">
              API 키와 계정 연결이 해제되고 온보딩 화면으로 돌아갑니다. 보스 수익·드랍 기록은
              삭제되지 않습니다.
            </Text>
          </View>

          <View className="flex-row justify-end gap-2">
            <Button
              variant="text"
              disabled={props.isDisconnecting}
              onPress={props.onCancel}
              className={props.isDisconnecting ? 'opacity-50' : undefined}
            >
              취소
            </Button>
            <Button
              variant="danger"
              disabled={props.isDisconnecting}
              busy={props.isDisconnecting}
              onPress={props.onConfirm}
              className={`flex-row items-center justify-center${
                props.isDisconnecting ? ' opacity-50' : ''
              }`}
            >
              연결 해제
            </Button>
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}

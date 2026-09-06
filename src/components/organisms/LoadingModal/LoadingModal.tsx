/**
 * 불러오는 중을 **한 장으로** 말하는 모달. 완료 시점에만 프로그램으로 닫는다.
 *
 * 하위 화면마다 스피너를 두면 같은 사실이 어느 화면에 있느냐로 다르게 보인다. 수익·지출 층은
 * 두 하위가 한 데이터를 보므로 그 말도 층이 한다.
 *
 * 오버레이 탭으로 안 닫는 것은 `ProgressModal` 과 같은 이유다. 닫아 봐야 조회는 계속 도는데
 * 화면은 다 왔다 로 보인다.
 */
import { View } from 'react-native'

import { Text } from '../../atoms'
import { MapleSweepSpinner } from '../../atoms/Spinner/MapleSweepSpinner'
import { Modal } from '../Modal/Modal'

export interface LoadingModalProps {
  message: string
}

export function LoadingModal(props: LoadingModalProps): React.JSX.Element {
  return (
    <Modal onClose={() => {}} align="center" testId="loading-modal">
      <Modal.Card maxWidth="max-w-xs">
        <View className="items-center gap-3 py-2">
          <MapleSweepSpinner size={32} className="text-primary" />
          <Text className="text-center text-sm text-text-muted">{props.message}</Text>
        </View>
      </Modal.Card>
    </Modal>
  )
}

/**
 * 불러오는 중을 **한 장으로** 말하는 모달. 완료 시점에만 프로그램으로 닫는다.
 *
 * 하위 화면마다 스피너를 두면 같은 사실이 어느 화면에 있느냐로 다르게 보인다. 수익·지출 층은
 * 두 하위가 한 데이터를 보므로 그 말도 층이 한다.
 *
 * 오버레이 탭으로 안 닫는 것은 `ProgressModal` 과 같은 이유다. 닫아 봐야 조회는 계속 도는데
 * 화면은 다 왔다 로 보인다.
 *
 * **지금 무엇을 받는지는 안 적는다**(사용자 지정). 수집기가 늘어도 문구가 안 바뀌고, 사용자가
 * 기다리는 것은 무엇을 받는지가 아니라 얼마나 남았는지다.
 */
import { View } from 'react-native'

import { ProgressBar, Text } from '../../atoms'
import { MapleSweepSpinner } from '../../atoms/Spinner/MapleSweepSpinner'
import { Modal } from '../Modal/Modal'

export interface LoadingModalProps {
  title: string
  /** 끝난 작업 수 */
  done?: number
  /**
   * 해야 할 작업 수. **0 이면 바를 안 그린다.**
   *
   * 분모가 정해지기 전(원장 읽는 몇십 밀리초)이 있다. 그때 `0 / 0` 을 그리면 다 끝난 것처럼
   * 보이고 나눗셈도 성립하지 않는다.
   */
  total?: number
}

export function LoadingModal(props: LoadingModalProps): React.JSX.Element {
  const total = props.total ?? 0
  const done = props.done ?? 0
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0

  return (
    <Modal onClose={() => {}} align="center" testId="loading-modal">
      <Modal.Card maxWidth="max-w-xs">
        <View className="items-center gap-3.5">
          <MapleSweepSpinner size={36} className="text-primary" />
          <Text className="text-center text-15 font-semibold text-text">{props.title}</Text>
          {total > 0 && (
            <View testID="loading-modal-progress" className="w-full gap-1.5">
              <ProgressBar percent={percent} aria={{ now: done, max: total }} />
              <View className="flex-row justify-between">
                <Text className="text-11 text-text-muted">{`${done} / ${total}`}</Text>
                <Text className="text-11 text-text-muted">{`${percent}%`}</Text>
              </View>
            </View>
          )}
        </View>
      </Modal.Card>
    </Modal>
  )
}

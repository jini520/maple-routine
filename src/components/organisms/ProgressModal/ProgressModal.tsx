// 진행률(N/M) 바를 담은 모달. 저장·동기화처럼 완료 시점에만 프로그램적으로 닫는 용도라 오버레이
// 탭으로 닫히지 않게 `onClose` 를 no-op 으로 둔다. 진행률 바 스타일은 온보딩 예열 진행률 바
// ([[ADR-016]])와 동일하게 재사용한다.
//
// RN 으로 옮기며 바뀐 것은 둘뿐이다 — `space-y-2` → `gap-2`(NativeWind 에 형제 간격 유틸이 없다),
// `<p>` → `<Text>`. `onClose` 가 no-op 이므로 안드로이드 뒤로가기도 아무 일이 없다(`Modal` 이
// 그것을 `onClose` 로 잇는다) — 웹에서 오버레이 클릭이 무시되던 것과 같은 뜻이다.
import { View } from 'react-native'

import { ProgressBar, Text } from '../../atoms'
import { Modal } from '../Modal/Modal'

export interface ProgressModalProps {
  message: string
  completed: number
  total: number
}

export function ProgressModal(props: ProgressModalProps): React.JSX.Element {
  const percent = props.total > 0 ? Math.round((props.completed / props.total) * 100) : 0

  return (
    <Modal onClose={() => {}} align="center">
      <Modal.Card>
        <View className="gap-2">
          <Text className="text-sm text-text-muted">
            {props.message} ({props.completed}/{props.total})
          </Text>
          <ProgressBar percent={percent} aria={{ now: percent, max: 100 }} />
        </View>
      </Modal.Card>
    </Modal>
  )
}

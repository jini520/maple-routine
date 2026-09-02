/**
 * 스케줄 관리 방법(자동/수동) 전환 모달. **선택 → 확인 2단계**.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { useTrackingModeStore } from '../../features/tracking-mode/store'
import type { TrackingMode } from '../../storage/tracking-mode'

import { Button, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'
import { reloadTabStores } from './reload-tab-stores'
import { TrackingModeSelector } from './TrackingModeSelector'

export interface TrackingModeModalProps {
  onClose: () => void
}

export function TrackingModeModal(props: TrackingModeModalProps): React.JSX.Element {
  const { mode, setMode } = useTrackingModeStore()
  // 옵션 탭은 고르는 것일 뿐이다. 고른 값을 여기서 들고 있다가 "적용"에서
  // 한 번만 setMode를 부른다. 전에는 탭이 곧 적용이라 되돌릴 자리가 없었다.
  const [selected, setSelected] = useState<TrackingMode>(mode)
  const [isApplying, setIsApplying] = useState(false)
  const isUnchanged = selected === mode

  async function handleApply(): Promise<void> {
    if (isUnchanged) return
    setIsApplying(true)
    // setMode는 수동 전환 시 시드가 전부 끝난 뒤에만 resolve된다. 시드가
    // 끝나기 전에 닫으면 사용자가 방금 고른 모드가 아직 준비 안 된 상태를 보게 되므로 await 후 닫는다.
    await setMode(selected)
    //  정정: 시드는 저장소를 채우지만 수동 모드의 표시 목록을 정하는 것은 스토어
    // 메모리의 사본(`manualTrackedByOcid`)이고, RN 탭 화면은 마운트된 채 남아 스스로 다시 읽지
    // 않는다. 이 줄이 없으면 자동 → 수동 직후 세 탭이 "모드는 수동인데 멤버십은 빈 맵"을 그린다
    // (보스 탭의 "추적할 주간 보스가 없습니다", 새로고침해야 나옴). **시드 뒤여야 한다**. 먼저
    // 읽히면 그 회차가 옛 멤버십을 담는다.
    reloadTabStores(['content', 'boss', 'profit'])
    props.onClose()
  }

  return (
    <Modal
      // 시드(setMode) 진행 중에는 오버레이 클릭으로 닫히지 않게 한다. "캐릭터 관리 저장 진행률
      // 모달"과 동일 원칙(저장 도중엔 닫을 수 없다).
      onClose={() => {
        if (!isApplying) props.onClose()
      }}
      testId="tracking-mode-modal-overlay"
    >
      <Modal.Card>
        <View className="mb-4 gap-1">
          <Text className="text-lg font-semibold text-text">스케줄 관리 방법</Text>
          <Text className="text-sm text-text-muted">진행 상황을 어떻게 관리할지 선택해주세요.</Text>
        </View>
        <TrackingModeSelector mode={selected} isApplying={isApplying} onSelect={setSelected} />

        {/* 설정의 다른 확정 모달(DisconnectConfirm/CacheClearConfirm)과 같은 골격.
            다른 것은 색뿐. 모드 전환은 파괴적 동작이 아니라 진행 동작이라 border-error 가 아니다. */}
        <View className="mt-4 flex-row justify-end gap-2">
          <Button
            variant="text"
            disabled={isApplying}
            onPress={props.onClose}
            className={isApplying ? 'opacity-50' : undefined}
          >
            취소
          </Button>
          <Button
            variant="primary"
            // 바뀐 것이 없으면 누를 것도 없다(결정 23). 닫기는 취소·오버레이가 맡는다.
            disabled={isUnchanged || isApplying}
            busy={isApplying}
            onPress={() => {
              void handleApply()
            }}
            className={`flex-row items-center justify-center${
              isUnchanged || isApplying ? ' opacity-50' : ''
            }`}
            textClassName="text-sm"
          >
            적용
          </Button>
        </View>
      </Modal.Card>
    </Modal>
  )
}

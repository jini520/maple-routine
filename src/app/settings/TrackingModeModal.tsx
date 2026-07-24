import { useState } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { MapleSpinner } from '../../components/MapleSpinner/MapleSpinner'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { TrackingModeSelector } from './TrackingModeSelector'
import type { TrackingMode } from '../../storage/tracking-mode'

export interface TrackingModeModalProps {
  onClose: () => void
}

export function TrackingModeModal(props: TrackingModeModalProps): React.JSX.Element {
  const { mode, setMode } = useTrackingModeStore()
  const [isApplying, setIsApplying] = useState(false)

  async function handleSelect(next: TrackingMode): Promise<void> {
    if (next === mode) {
      props.onClose()
      return
    }
    setIsApplying(true)
    // ADR-035 결정 15: setMode는 수동 전환 시 시드가 전부 끝난 뒤에만 resolve된다. 시드가
    // 끝나기 전에 닫으면 사용자가 방금 고른 모드가 아직 준비 안 된 상태를 보게 되므로 await 후 닫는다.
    await setMode(next)
    props.onClose()
  }

  return (
    <Modal
      // 시드(setMode) 진행 중에는 오버레이 클릭으로 닫히지 않게 한다 — "캐릭터 관리 저장 진행률
      // 모달"과 동일 원칙(저장 도중엔 닫을 수 없다).
      onClose={() => {
        if (!isApplying) props.onClose()
      }}
      testId="tracking-mode-modal-overlay"
    >
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">스케줄 관리 방법</h2>
        <p className="text-sm text-text-muted">진행 상황을 어떻게 관리할지 선택해주세요.</p>
      </div>
      <TrackingModeSelector
        mode={mode}
        isApplying={isApplying}
        onSelect={(next) => {
          void handleSelect(next)
        }}
      />
      {isApplying && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
          <MapleSpinner size={18} />
          <span>적용하고 있어요</span>
        </div>
      )}
    </Modal>
  )
}

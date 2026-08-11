import { useState } from 'react'
import { Modal } from '../../components/organisms/Modal/Modal'
import { MapleSpinner } from '../../components/atoms/MapleSpinner/MapleSpinner'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { TrackingModeSelector } from './TrackingModeSelector'
import type { TrackingMode } from '@core/storage/tracking-mode'
import { Button } from '../../components/atoms/Button/Button'

export interface TrackingModeModalProps {
  onClose: () => void
}

export function TrackingModeModal(props: TrackingModeModalProps): React.JSX.Element {
  const { mode, setMode } = useTrackingModeStore()
  // ADR-035 결정 23: 옵션 탭은 고르는 것일 뿐이다 — 고른 값을 여기서 들고 있다가 "적용"에서
  // 한 번만 setMode를 부른다. 전에는 탭이 곧 적용이라 되돌릴 자리가 없었다.
  const [selected, setSelected] = useState<TrackingMode>(mode)
  const [isApplying, setIsApplying] = useState(false)
  const isUnchanged = selected === mode

  async function handleApply(): Promise<void> {
    if (isUnchanged) return
    setIsApplying(true)
    // ADR-035 결정 15: setMode는 수동 전환 시 시드가 전부 끝난 뒤에만 resolve된다. 시드가
    // 끝나기 전에 닫으면 사용자가 방금 고른 모드가 아직 준비 안 된 상태를 보게 되므로 await 후 닫는다.
    await setMode(selected)
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
      <Modal.Card>
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold text-text">스케줄 관리 방법</h2>
          <p className="text-sm text-text-muted">진행 상황을 어떻게 관리할지 선택해주세요.</p>
        </div>
        <TrackingModeSelector mode={selected} isApplying={isApplying} onSelect={setSelected} />

        {/* ADR-035 결정 23: 설정의 다른 확정 모달(DisconnectConfirm/CacheClearConfirm)과 같은 골격.
            다른 것은 색뿐 — 모드 전환은 파괴적 동작이 아니라 진행 동작이라 border-error 가 아니다. */}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="text"
            disabled={isApplying}
            onClick={props.onClose}
            className="disabled:opacity-50"
          >
            취소
          </Button>
          <Button
            variant="primary"
            // 바뀐 것이 없으면 누를 것도 없다(결정 23) — 닫기는 취소·오버레이가 맡는다.
            disabled={isUnchanged || isApplying}
            aria-busy={isApplying}
            onClick={() => {
            void handleApply()
            }}
            className="flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {/* ADR-061 결정 5·9 — 버튼 안 16px + 말줄임표 없는 '~중' 라벨 */}
            {isApplying && <MapleSpinner size={16} />}
            {isApplying ? '적용 중' : '적용'}
          </Button>
        </div>
      </Modal.Card>
    </Modal>
  )
}

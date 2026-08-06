import { Modal } from '../../components/organisms/Modal/Modal'
import { Button } from '../../components/atoms/Button/Button'
import { useThemeStore } from '../../features/theme/store'
import { ThemeSelector } from './ThemeSelector'

export interface ThemeModalProps {
  onClose: () => void
}

/**
 * 적용은 즉시지만 **닫기는 따라오지 않는다** ([[ADR-104]] 결정 7).
 *
 * 모달 자신이 선택 테마의 색으로 그려지므로, 열어둔 채로 고르면 그 자리에서 갈아입혀 보게 된다.
 * 전에는 한 번 고를 때마다 닫혀서 두 테마를 비교하려면 설정 행 → 모달을 다시 여는 왕복이 필요했다.
 *
 * 버튼이 "완료" 하나인 이유는 **되돌릴 것이 없기 때문**이다 — `TrackingModeModal` 의 취소/적용
 * 2단계([[ADR-035]] 결정 23)는 선택과 적용이 분리돼 있어 성립하는 것이고, 여기서는 이미 적용된
 * 뒤라 "취소"가 가리킬 대상이 없다(되돌리려면 원래 테마를 다시 고른다).
 */
export function ThemeModal(props: ThemeModalProps): React.JSX.Element {
  const { theme, selectTheme } = useThemeStore()

  return (
    <Modal onClose={props.onClose} testId="theme-modal-overlay">
      <Modal.Card>
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold text-text">테마</h2>
          <p className="text-sm text-text-muted">원하는 테마를 선택해주세요.</p>
        </div>
        <ThemeSelector theme={theme} onSelect={selectTheme} />

        {/* 설정의 다른 모달(TrackingModeModal·DisconnectConfirm)과 같은 골격 — 버튼만 하나다. */}
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={props.onClose} className="text-sm">
            완료
          </Button>
        </div>
      </Modal.Card>
    </Modal>
  )
}

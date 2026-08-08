import { KeyRound } from 'lucide-react'
import { Modal } from '../components/organisms/Modal/Modal'
import { useOnboardingStore } from '../features/onboarding/store'

// ADR-115 결정 10: 저장된 키가 무효화된 것을 **알리고 확인을 받는** 모달.
//
// 결정 1 의 "토스트 + 즉시 이동"을 대체한다. 즉시 이동은 사용자가 이유를 읽기도 전에 화면을
// 바꿔버려, 원인과 결과가 이어지지 않았다 — 토스트는 스스로 사라지기까지 한다. 이제 원래 화면이
// 뒤에 남은 채 이 모달이 덮이고, 사용자가 "확인"을 눌러야 이동한다.
//
// **닫을 수 없다**: `onClose` 가 no-op 이라 오버레이를 눌러도 닫히지 않고, 취소 버튼도 없다.
// 무효 키 상태에서는 어느 화면도 제 기능을 못 하므로 **닫아서 돌아갈 곳이 없다** — 닫기를 주면
// 아무것도 안 되는 화면에 사용자를 되돌려 보내는 셈이다. 진행 동작 하나만 둔다(진행 중 배경 탭을
// 막는 `UpdatePromptModal` 과 같은 방식).
export function ApiKeyInvalidModal(): React.JSX.Element | null {
  const { apiKeyInvalidNotice, confirmApiKeyInvalid } = useOnboardingStore()

  if (!apiKeyInvalidNotice) {
    return null
  }

  return (
    // 입력이 없어 키보드를 띄우지 않으므로 중앙 정렬이다(UpdatePromptModal 과 같은 판단).
    <Modal onClose={() => {}} testId="api-key-invalid-overlay" align="center">
      <Modal.Card maxWidth="max-w-xs">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error-tint text-error-ink">
            <KeyRound className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-text">API 키가 더 이상 유효하지 않습니다</h2>
            {/* 다음에 무슨 일이 일어나는지 먼저 말한다 — 확인을 누르면 화면이 바뀌기 때문이다. */}
            <p className="text-sm text-text-muted">키 입력 화면으로 이동합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => void confirmApiKeyInvalid()}
            className="w-full rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover px-5 py-2.5 text-sm"
          >
            확인
          </button>
        </div>
      </Modal.Card>
    </Modal>
  )
}

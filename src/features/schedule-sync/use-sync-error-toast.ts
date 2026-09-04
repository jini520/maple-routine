import { useEffect, useRef } from 'react'
import { useToastStore } from '../toast/store'
import { useApiKeyNotice } from '../auth/use-api-key-notice'
import { formatScheduleSyncError } from './format'
import type { ScheduleSyncError } from './schedule-sync'

// 스케줄 동기화 실패를 토스트로 알리는 훅 둘.
//
// 인라인 문단(`text-sm text-error-ink` 한 줄)을 걷고 토스트로 옮긴 근거는 하나다. 문구가
// 사라진 자리에 남는 것이 있는가. 새로고침 옆 n분 전(`formatSyncedAt`)이 지속 상태를 이미
// 담당하므로 인라인 문단은 실패 사실만 중복해 말하고 있었다. 게다가 인라인 문단에는 버튼을
// 붙일 자리가 없어 사용자가 새로고침 아이콘을 스스로 찾아야 했다.
//
// 스토어가 아니라 화면(훅)에서 띄우는 것은 남은 종류들의 재시도 액션이 화면의 refresh 를
// 필요로 하기 때문이다.
//
// 중복 방지는 스토어가 실패마다 새 객체·새 배열을 set 하는 성질을 쓴다. 그 값 자체를 dep 과
// 가드 키로 삼는다. 같은 종류가 연달아 실패해도 새 객체라 다시 알리고, 같은 값으로 재렌더될
// 때는 띄우지 않는다. ref 가드는 StrictMode 의 effect 이중 호출까지 막는다.

// 콜백은 매 렌더 새로 만들어지는 클로저라 dep에 넣지 않는다. 토스트 액션은 한참 뒤(사용자 클릭)에
// 실행되므로 그때의 최신 값을 써야 한다. 렌더 중 ref 쓰기는 금지(react-hooks/refs)라 effect에서 갱신한다.
function useLatestRef<T>(value: T): { current: T } {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

export function useScheduleSyncErrorToast(
  error: ScheduleSyncError | null,
  actions: { onRetry: () => void },
): void {
  const lastShownRef = useRef<ScheduleSyncError | null>(null)
  const actionsRef = useLatestRef(actions)

  // 무효 키(401/403·400 00005)와 429는 이 훅이 처리하지 않고 키 재입력 경로로 넘긴다
  //
  useApiKeyNotice(error)

  useEffect(() => {
    if (error === null || lastShownRef.current === error) {
      return
    }
    lastShownRef.current = error

    // 이 훅은 저장된 키로는 앞으로 갈 수 없는 두 원인에 아무 토스트도 띄우지 않는다. 그 원인은
    // 닫을 수 없는 모달로 알린다(`useApiKeyNotice` → `ApiKeyNoticeModal`). 토스트는 스스로
    // 사라져 놓칠 수 있는데 이 실패들은 확인하고 넘어가야 하는 종류다. 모달이 원인과 처방을
    // 함께 말하므로 같은 사실을 토스트로 한 번 더 말하지 않는다.
    if (error.kind === 'invalidApiKey' || error.kind === 'rateLimited') {
      return
    }

    const { showError } = useToastStore.getState()
    const message = formatScheduleSyncError(error)

    // 누를 수 있는 버튼을 주지 않는 종류. characterUnavailable(400 OPENAPI00003)은 영구라
    // 언제 눌러도 같은 400 이다.
    if (error.kind === 'characterUnavailable') {
      showError(message)
      return
    }

    showError(message, { label: '다시 시도', onClick: () => actionsRef.current.onRetry() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])
}

// 일부 캐릭터만 실패한 경우. 보스 수익 화면만 전체 캐릭터를 훑어 실패자를 모은다. 스케줄러 두
// 화면은 선택된 캐릭터만 보므로 이 신호가 없다.
//
// Toast 본문은 truncate 라 이름을 나열하면 잘린다. 이름 대신 인원 수만 실어 한 줄에 담고
// 어느 캐릭터인지는 포기한다.
//
// 기간 이동(loadPeriod)은 staleCharacterNames 를 건드리지 않아 다시 뜨지 않는다.
export function useStaleCharactersToast(staleCharacterNames: string[], onRetry: () => void): void {
  const lastShownRef = useRef<string[] | null>(null)
  const onRetryRef = useLatestRef(onRetry)

  useEffect(() => {
    if (staleCharacterNames.length === 0 || lastShownRef.current === staleCharacterNames) {
      return
    }
    lastShownRef.current = staleCharacterNames

    useToastStore
      .getState()
      .showError(`일부 캐릭터를 불러오지 못했습니다 (${staleCharacterNames.length}명)`, {
        label: '다시 시도',
        onClick: () => onRetryRef.current(),
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleCharacterNames])
}

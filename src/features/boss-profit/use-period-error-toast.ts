import { useEffect, useRef } from 'react'
import { useToastStore } from '../toast/store'

// 보스 수익 기간 로드 실패를 토스트로 알리는 훅.
//
// **카드가 있을 때만 부른다.** 기간 라벨·이전/다음 버튼·캐릭터 카드가 그 자리에 남으므로 실패는
// 이벤트다(원칙 4) — 옮기면 액션을 붙일 수 있다. 카드가 아예 없으면 문구가 사라진
// 자리에 빈 칸이 남으므로 화면이 `ErrorState` 를 그린다(호출부 조건).
//
// 문구는 그 `ErrorState` 의 제목과 같은 "이 기간을 불러오지 못했습니다"다 — 같은 실패의 두 얼굴이
// 다른 말을 하면 안 된다. 인라인에 붙어 있던 "— 다시 시도해주세요"는 액션 버튼이 대신하므로 뗀다.
//
// 중복 방지가 스케줄러 훅과 다른 이유: 저기서는 스토어가 실패마다 새 객체를
// 만들어 그 아이덴티티를 가드 키로 쓸 수 있지만, 여기서 오는 신호는 문자열 상태(`periodState`)다.
// 그래서 기간 키를 가드로 쓰되 **로딩이 시작되면 비운다** — 그러지 않으면 "다시 시도"를 눌러 같은
// 기간이 또 실패했을 때 아무 반응이 없다(눌렀는데 무반응이면 안 된다는 같은 요구).

export function usePeriodLoadErrorToast(params: {
  isFailed: boolean
  isLoading: boolean
  periodKey: string
  onRetry: () => void
}): void {
  const { isFailed, isLoading, periodKey } = params
  const lastShownKeyRef = useRef<string | null>(null)
  // 콜백은 매 렌더 새 클로저라 dep에 넣지 않는다 — 토스트 액션은 한참 뒤(사용자 클릭)에 실행되므로
  // 그때의 최신 값을 써야 한다. 렌더 중 ref 쓰기는 금지라 effect에서 갱신한다.
  const onRetryRef = useRef(params.onRetry)
  useEffect(() => {
    onRetryRef.current = params.onRetry
  })

  useEffect(() => {
    if (isLoading) {
      lastShownKeyRef.current = null
      return
    }
    if (!isFailed || lastShownKeyRef.current === periodKey) {
      return
    }
    lastShownKeyRef.current = periodKey

    useToastStore.getState().showError('이 기간을 불러오지 못했습니다', {
      label: '다시 시도',
      onClick: () => onRetryRef.current(),
    })
  }, [isFailed, isLoading, periodKey])
}

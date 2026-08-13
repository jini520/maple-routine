import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// 하위 페이지의 "뒤로" — **진짜 pop 이다**([[ADR-120]] 결정 9).
//
// 지금까지 관리 페이지들의 `←` 는 `navigateToScreen('/content')` 처럼 **앞으로 새 라우트를 밀어
// 넣었다.** 그래서 히스토리 스택이 계속 쌓이고, 하드웨어 뒤로가기를 누르면 방금 나온 관리 화면으로
// 되돌아갔다 — 스택 모델에서 성립하지 않는 동작이다.
//
// **`navigate(-1)` 하나로 끝나지 않는 경우가 하나 있다.** 딥링크·OTA 재시작으로 하위 페이지에 직접
// 들어오면 되돌아갈 항목이 없어 `-1` 이 앱을 벗어난다(안드로이드에서는 앱 종료). react-router 는
// 그 최초 진입 항목에 `key: 'default'` 를 주므로, 그때만 부모 경로로 `replace` 한다 — 뒤로 갔더니
// 앱이 꺼지는 대신 부모 화면이 나오고, `replace` 라 히스토리도 늘지 않는다.
export function useStackBack(parentPath: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    if (location.key === 'default') {
      navigate(parentPath, { replace: true })
      return
    }
    navigate(-1)
  }, [navigate, location.key, parentPath])
}

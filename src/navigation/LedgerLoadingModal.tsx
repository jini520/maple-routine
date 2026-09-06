/**
 * 수익·지출 층이 **불러오는 중**을 말하는 자리. 하위 화면은 자기 스피너를 갖지 않는다.
 *
 * 층이 소유한 회차(`useLedgerData`)를 그대로 읽는다. 그 회차가 오늘과 과거를 함께 받으므로,
 * 어느 하위에 서 있든 같은 사실을 같은 모양으로 본다.
 */
import { useEffect, useState } from 'react'

import { LoadingModal } from '../components/organisms/LoadingModal/LoadingModal'
import { useLedgerData } from '../features/ledger/useLedgerData'
import { useLedgerProgress } from '../features/ledger/progress'

/**
 * 이만큼 끌고 나서야 띄운다.
 *
 * 원장이 이미 찬 회차는 조회가 0건이라 몇백 밀리초에 끝난다. 그 사이 모달을 세우면 화면이
 * 한 번 번쩍일 뿐이고 사용자가 읽을 시간도 없다. 오래 걸리는 회차(첫 진입 84건)만 말한다.
 */
const SHOW_AFTER_MS = 400

export function LedgerLoadingModal(): React.JSX.Element | null {
  const { status } = useLedgerData()
  // 진행은 **별도 스토어**다. 층 프로바이더의 state 에 두면 작업 하나가 끝날 때마다 탭
  // 내비게이터가 통째로 다시 그려진다(첫 진입이면 84번).
  const done = useLedgerProgress((state) => state.done)
  const total = useLedgerProgress((state) => state.total)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (status !== 'filling') return

    const timer = setTimeout(() => setSlow(true), SHOW_AFTER_MS)
    // 되돌리는 것은 정리에서 한다. 효과 몸통에서 곧장 세우면 렌더가 한 번 더 돈다.
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [status])

  if (status !== 'filling' || !slow) return null
  return (
    <LoadingModal title="기록을 불러오고 있어요" done={done} total={total} />
  )
}

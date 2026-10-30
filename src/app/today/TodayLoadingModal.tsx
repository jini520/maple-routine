/**
 * today 가 **불러오는 중**을 말하는 자리. 위젯은 자기 스피너를 갖지 않는다.
 *
 * 캐릭터 설정을 마치고 처음 들어오는 회차가 이 모달의 자리다. 그때는 캐시가 비어 있어 격자가
 * 빈 채로 서는데, 표시가 제목 옆 글자와 도는 아이콘뿐이라 멈춘 것처럼 보였다(사용자 보고).
 */
import { useEffect, useState } from 'react'

import { LoadingModal } from '../../components/organisms/LoadingModal/LoadingModal'
import { useScheduleQueries } from '../../features/schedule-sync/use-schedule-queries'
import { useRefreshProgress } from '../../features/refresh/progress'

/**
 * 이만큼 끌고 나서야 띄운다. 수익·지출 층의 모달과 같은 값이다.
 *
 * 캐시가 찬 회차는 몇백 밀리초에 끝난다. 그 사이 모달을 세우면 화면이 한 번 번쩍일 뿐이고
 * 사용자가 읽을 시간도 없다.
 */
const SHOW_AFTER_MS = 400

export function TodayLoadingModal(): React.JSX.Element | null {
  // 스케줄러 둘과 today 가 같은 회차를 보므로 캐시 스냅샷 하나만 봐도 도는지를 안다. 뷰를 만들지 않고 스냅샷을
  // 보는 것은 today 가 이미 뷰를 만들고 기기 값을 읽는데 여기서 한 번 더 읽을 이유가 없어서다.
  const { status, snapshot, trackedOcids } = useScheduleQueries()
  // 진행은 **별도 스토어**다. 화면 state 에 두면 작업 하나가 끝날 때마다 격자가 통째로 다시
  // 그려진다.
  const done = useRefreshProgress((state) => state.done)
  const total = useRefreshProgress((state) => state.total)
  const [slow, setSlow] = useState(false)

  /**
   * 서는 조건은 한 물음이다. **그릴 것이 아직 없는데 도는 중인가.**
   *
   * 스냅샷에 스케줄이 하나도 없다는 것이 곧 캐시가 없다는 뜻이다. 회차가 도는 동안도 캐시의 값이 그대로
   * 보이므로, 캐시가 있으면 비어 있지 않다.
   *
   * `trackedOcids` 의 `null` 은 0명이 아니라 저장소를 아직 안 읽었다 다. 모르는 사이에 세우면
   * 캐릭터가 없는 계정에서도 뜬다.
   */
  const cold =
    status === 'loading' &&
    snapshot.schedules.size === 0 &&
    trackedOcids !== null &&
    trackedOcids.length > 0

  useEffect(() => {
    if (!cold) return

    const timer = setTimeout(() => setSlow(true), SHOW_AFTER_MS)
    // 되돌리는 것은 정리에서 한다. 효과 몸통에서 곧장 세우면 렌더가 한 번 더 돈다.
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [cold])

  if (!cold || !slow) return null
  // 문구가 `준비` 가 아니라 `불러오는` 인 것은 캐릭터 설정 화면이 시드 단계에서 이미
  // `체크리스트를 준비하고 있어요` 를 쓰기 때문이다. 두 화면이 이어서 뜬다.
  return <LoadingModal title="체크리스트를 불러오고 있어요" done={done} total={total} />
}

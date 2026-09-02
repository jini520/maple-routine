/**
 * 당김 인디케이터의 켜짐을 내는 훅. **사용자가 당긴 회차에만 참**이다.
 *
 * `status === 'loading'` 을 그대로 쓰면 안 된다. 그 값은 지금 조회 중인가이지 사용자가 당겼는가가
 * 아니고, 조회를 시작하는 자리가 당김 말고도 둘 더 있다(화면 마운트 하이드레이션 · 헤더 새로고침
 * 버튼). 그래서 **탭을 옮기기만 해도 인디케이터가 프로그램적으로 열린다**(사용자 보고).
 *
 * 잃는 것은 없다. 헤더 버튼은 자기 표시를 이미 갖고(아이콘이 돌고 `조회 중…` 이 뜬다), 자동 조회는
 * 원래 조용해야 하는 것이다.
 *
 * **스토어가 아니라 화면 로컬이다.** 방금 이 화면에서 당겼는가는 그 마운트에만 뜻이 있다. 스토어에
 * 두면 두 스케줄러가 같은 스토어를 나눠 쓰는 자리에서 한쪽의 당김이 다른 쪽 인디케이터를 연다.
 */

import { useState } from 'react'

export interface PullRefresh {
  /** `RefreshControl` 의 `refreshing`. **당긴 회차 동안만** 참이다. */
  refreshing: boolean
  /** `RefreshControl` 의 `onRefresh`. */
  onRefresh: () => void
}

export function usePullRefresh(
  /**
   * 당김이 부르는 재조회. 헤더 버튼이 부르는 것과 **같은 것**이어야 한다.
   * 이 훅이 가르는 것은 누가 시작했나 이지 무엇을 하나 가 아니다.
   */
  run: () => Promise<void>,
): PullRefresh {
  const [refreshing, setRefreshing] = useState(false)

  return {
    refreshing,
    onRefresh() {
      setRefreshing(true)
      void run()
        // **`finally` 다.** 실패해도 닫아야 한다. 안 닫으면 실패 경로에서 **상단이 빈 채로
        // 멈춘다** 가 그대로 재현된다.
        .finally(() => {
          setRefreshing(false)
        })
        // 그리고 **여기서 삼킨다.** `finally` 는 원래 사유로 다시 거부하므로 받지 않으면 처리되지
        // 않은 거부가 된다. 실패를 **말하는** 것은 이 훅이 아니라 화면이다. 스토어가 `error` 를
        // 세우고 토스트가 문구를 낸다. 여기서 다시 말하면 같은 실패가 두 번 뜬다.
        .catch(() => undefined)
    },
  }
}

/**
 * 당김 인디케이터의 켜짐. **사용자가 당긴 회차에만 참이다**.
 *
 * ## 무엇이 문제였나
 *
 *  은 `refreshing = status === 'loading'` 으로 배선했다. 그 값은 지금 조회
 * 중인가 이지 사용자가 당겼는가 가 아니고, 조회를 시작하는 자리는 당김 말고도 둘 더 있다.
 * **화면 마운트 하이드레이션**(`loadTrackedOcids` → `refresh(…, { auto: true })`
 * 결정 4)과 헤더 새로고침 버튼.
 *
 * 그래서 **탭을 옮기기만 해도 인디케이터가 프로그램적으로 열렸다.** 사용자 보고(2026-08-22)의
 * *"페이지 이동 시 당겨서 새로고침을 한 것처럼 동작한 뒤 상단이 비어 있는 상태로 멈춰 있다"* 가
 * 그것이다. 이 그 대가를 적어 두긴 했지만(*"헤더 버튼으로 시작한 재조회에도 플랫폼
 * 인디케이터가 뜬다"*) 하이드레이션까지 같은 값을 쓴다는 것은 그때 세지 않은 자리다.
 *
 * ## 잃는 것이 없다
 *
 * 헤더 버튼은 **자기 표시를 이미 갖고 있다**. 아이콘이 돌고(`SPIN_ANIMATION`) 옆에 조회 중...
 * 이 뜬다. 그러니 플랫폼 인디케이터를 당김 전용으로 좁혀도 그 버튼의 되먹임은
 * 한 픽셀도 안 줄어든다. 자동 조회는 원래 조용해야 하는 것이라 표시가 없는 것이 맞다.
 *
 * ## 왜 스토어가 아니라 화면 로컬인가
 *
 * *"사용자가 방금 이 화면에서 당겼는가"* 는 그 화면의 이번 마운트에만 뜻이 있는 사실이다. 스토어에
 * 두면 화면을 떠났다 돌아왔을 때 남아 있을 수 있고(`activeTab` 이 일부러 그렇게 하는 것과 반대다,
 * ), 두 스케줄러가 같은 스토어를 나눠 쓰는 자리에서는 한쪽의 당김이 다른 쪽의
 * 인디케이터를 연다.
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

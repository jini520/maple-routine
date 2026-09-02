/**
 * 화면 진입 자동 재조회 게이트의 두 번째 조건. 이번 실행에서 이미 동기화했는지 드는 플래그.
 *
 * ```
 * 건너뛴다 = 이번 실행에서 이미 동기화함  AND  가장 오래된 syncedAt 이 10분 안
 * ```
 *
 * 앱을 껐다 켜는 것은 지금 상태를 보겠다는 명시적 행동이고 OS 가 프로세스를 죽였다 되살리는 경로와도
 * 겹친다. 그래서 이번 실행의 첫 동기화는 TTL 안이어도 반드시 한 번 나간다.
 *
 * 지키는 것 셋.
 *
 * ① **영속화하지 않는다.** 이 플래그가 프로세스와 함께 사라지는 것이 곧 정책이다. 저장소에 쓰는
 *    순간 앱을 재시작하면 한 번은 다시 받는다가 죽는다.
 * ② **성공이 아니라 시도를 기록한다.** 성공만 기록하면 네트워크가 죽은 동안 탭을 옮길 때마다 실패
 *    호출이 반복된다. 10분 밖이면 신선도 판정이 어차피 다시 시도하게 하므로 복구 경로는 안 닫힌다.
 * ③ 실행당 1회이고 **화면당이 아니다.** 세 화면이 같은 캐시를 받는다.
 */
let syncAttemptedThisRun = false

export function markSyncAttemptedThisRun(): void {
  syncAttemptedThisRun = true
}

export function hasSyncAttemptedThisRun(): boolean {
  return syncAttemptedThisRun
}

// 테스트 전용. 모듈 수준 상태라 테스트끼리 오염되므로 beforeEach 에서 부른다.
// 프로덕션 코드에서 부르지 말 것. 부르는 순간 앱 재시작 강제 조회가 아무 때나 되살아난다.
export function resetSyncRunStateForTests(): void {
  syncAttemptedThisRun = false
}

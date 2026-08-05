// 화면 진입 자동 재조회 게이트의 두 번째 조건이다([[ADR-097]] 결정 3) —
//
//   건너뛴다 = 이번 실행에서 이미 동기화함  AND  가장 오래된 syncedAt 이 10분 안(lib/sync-freshness)
//
// 앱을 껐다 켜는 것은 "지금 상태를 보겠다"는 명시적 행동이고, 모바일에선 OS 가 프로세스를 죽였다
// 되살리는 경로와도 겹친다. 그래서 이번 실행의 첫 동기화는 TTL 안이어도 반드시 한 번 나간다.
//
// **영속화하지 않는다.** 이 플래그가 프로세스와 함께 사라지는 것이 곧 "앱을 재시작하면 한 번은 다시
// 받는다"는 정책이라, 저장소에 쓰는 순간 그 정책이 죽는다. OTA·WebView 리로드는 JS 컨텍스트가 새로
// 서므로 새 실행으로 친다 — 의도한 동작이다.
//
// **성공이 아니라 "시도"를 기록한다.** 성공만 기록하면 네트워크가 죽은 동안 탭을 옮길 때마다 실패
// 호출이 반복된다. 실패했더라도 데이터가 10분 밖이면 신선도 판정이 만료라 다음 진입이 어차피 다시
// 시도하므로 복구 경로는 닫히지 않는다.
//
// 실행당 1회이고 화면당이 아니다 — 세 화면이 같은 캐시를 받으므로 화면마다 강제하면 시작 직후 같은
// 응답을 3번 받게 된다.
let syncAttemptedThisRun = false

export function markSyncAttemptedThisRun(): void {
  syncAttemptedThisRun = true
}

export function hasSyncAttemptedThisRun(): boolean {
  return syncAttemptedThisRun
}

// 테스트 전용. 모듈 수준 상태라 테스트끼리 오염되므로 beforeEach 에서 부른다.
// 프로덕션 코드에서 부르지 말 것 — 부르는 순간 앱 재시작 강제 조회가 아무 때나 되살아난다.
export function resetSyncRunStateForTests(): void {
  syncAttemptedThisRun = false
}

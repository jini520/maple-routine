/**
 * 동기화가 화면을 다시 읽으려고 올린 판을 쓰기 알림과 가르는 표시. 판 알림은 구독자를 곧바로 부르므로, 판을 올리는 동안만 켠다.
 *
 * 가르지 않으면 받은 줄을 넣고 올린 판이 동기화를 다시 깨워 바뀐 것이 없는 받기가 한 번 더 나간다.
 */
let silenced = 0

/** 동기화를 깨우지 않고 도는 일. 안에서 오른 판과 쓰기 알림은 동기화를 깨우지 않는다. */
export function withoutWakingServerSync(work: () => void): void {
  silenced += 1
  try {
    work()
  } finally {
    silenced -= 1
  }
}

/** 지금 오른 판이 동기화가 올린 것인가. */
export function isServerSyncWakeSilenced(): boolean {
  return silenced > 0
}

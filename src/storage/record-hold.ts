/**
 * 1.0.15 기기 변환이 끝날 때까지 기록에 닿지 못하게 막는 약속. 기록 표(`getBossProfitDb()`)와 Preferences 에 든 기록의 저장소가
 * 함께 기다린다.
 *
 * 새 앱 코드는 옛 모양의 기록을 읽지 못한다. 옛 모양을 읽고 다시 적으면 읽지 못한 항목이 사라진다.
 */

/** 기기 변환이 끝나면 풀리는 약속. 부팅이 막기를 걸기 전에는 풀려 있다. */
let released: Promise<void> = Promise.resolve()

/**
 * 기록 접근을 `ready` 가 풀릴 때까지 막는다. 부팅이 저장소를 건드리기 전에 한 번 부른다.
 *
 * @example holdRecordsUntil(conversionDone)
 */
export function holdRecordsUntil(ready: Promise<void>): void {
  released = ready
}

/** 기기 변환이 끝나기를 기다린다. 기록을 읽고 쓰는 저장소가 처음에 부른다. 변환은 이 함수를 거치지 않는다. */
export function whenRecordsReleased(): Promise<void> {
  return released
}

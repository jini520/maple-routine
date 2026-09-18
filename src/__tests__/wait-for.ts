/**
 * 조건이 참이 될 때까지 기다리는 도우미.
 *
 * jest 에는 없다. `@testing-library/*` 의 `waitFor` 가 있지만 그쪽은 렌더 트리를 전제하고,
 * 여기서 기다리는 것은 화면이 아니라 **스토어가 비동기 작업을 마쳤는가** 다.
 *
 * 조건이 던지지 않을 때까지 짧게 폴링한다. 가짜 타이머 위에서도 돌아야 하므로 `setTimeout` 대신
 * 마이크로태스크로 양보한다(실제 시간을 기다리면 `jest.useFakeTimers` 를 쓴 스펙이 멈춘다).
 *
 * **양보 횟수가 곧 예산이다.** 보스 수익 `refresh` 한 회차는 저장소 왕복이 스무 번이 넘어, 50 번은
 * 조회를 하나 더하는 것만으로 모자라진다(실제로 그렇게 여섯 스펙이 한꺼번에 깨졌다). 넉넉히 둔다 -
 * 조건이 참이면 첫 회에 끝나므로 이 수를 올려도 통과하는 테스트는 느려지지 않는다.
 */
export async function waitFor<T>(check: () => T | Promise<T>, tries = 500): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i += 1) {
    try {
      return await check()
    } catch (error) {
      last = error
      await Promise.resolve()
    }
  }
  throw last
}

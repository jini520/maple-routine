/**
 * vitest 의 `vi.waitFor` 짝.
 *
 * jest 에는 없다. `@testing-library/*` 의 `waitFor` 가 있지만 그쪽은 렌더 트리를 전제하고,
 * 여기서 기다리는 것은 화면이 아니라 **스토어가 비동기 작업을 마쳤는가** 다.
 *
 * 조건이 던지지 않을 때까지 짧게 폴링한다. 가짜 타이머 위에서도 돌아야 하므로 `setTimeout` 대신
 * 마이크로태스크로 양보한다(실제 시간을 기다리면 `jest.useFakeTimers` 를 쓴 스펙이 멈춘다).
 */
export async function waitFor<T>(check: () => T | Promise<T>, tries = 50): Promise<T> {
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

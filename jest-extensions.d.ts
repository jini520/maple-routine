/**
 * `jest.setup.js` 가 jest 에 더한 `expect(값, 메시지)` 와 두 매처의 **타입**. 구현은 `jest.setup.js` 에 있다.
 *
 * 둘 다 jest 에는 없어서 setup 에서 만들어 붙였다. 두 번째 인자가 없으면 테스트가 **어느 항목에서
 * 틀렸는지** 를 말하지 못한다. `한 번만, 이 인자로` 를 두 단언으로 쪼개면 **한 번** 이 빠져도 통과한다.
 */
declare namespace jest {
  interface Expect {
    /** 두 번째 인자는 **실패 메시지 앞에 붙는 설명**이다. */
    <T = unknown>(actual: T, message?: string): JestMatchers<T>
  }

  interface Matchers<R> {
    /** 정확히 한 번 호출됐는가. */
    toHaveBeenCalledOnce(): R
    /** 정확히 한 번, 그리고 이 인자로 호출됐는가. */
    toHaveBeenCalledExactlyOnceWith(...expected: unknown[]): R
  }
}

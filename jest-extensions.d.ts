/**
 * vitest 에서 넘어온 두 가지를 **타입에도** 알린다([[ADR-157]]). 구현은 `jest.setup.js` 에 있다.
 *
 * 둘 다 vitest 에는 있고 jest 에는 없어서 setup 에서 만들어 붙였다 — 없으면 옮겨 온 테스트
 * 170곳이 «어느 항목에서 틀렸는지» 를 말할 자리를 잃고(`expect(값, 메시지)`), 「한 번만, 이 인자로」
 * 를 두 단언으로 쪼개게 된다(그러면 «한 번» 이 빠져도 통과한다).
 */
declare namespace jest {
  interface Expect {
    /** 두 번째 인자는 **실패 메시지 앞에 붙는 설명**이다(vitest 와 같은 자리, 같은 뜻). */
    <T = unknown>(actual: T, message?: string): JestMatchers<T>
  }

  interface Matchers<R> {
    /** 정확히 한 번 호출됐는가. */
    toHaveBeenCalledOnce(): R
    /** 정확히 한 번, 그리고 이 인자로 호출됐는가. */
    toHaveBeenCalledExactlyOnceWith(...expected: unknown[]): R
  }
}

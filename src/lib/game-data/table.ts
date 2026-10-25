/**
 * 게임 데이터 표 하나의 현재 값. 번들로 시작하고 기기 사본 · 서버 응답이 덮는다.
 *
 * 조회 모듈은 `get` 으로 읽고, 받는 흐름(`features/game-data/query`)이 `set` 으로 덮는다. 보스의 `catalog.ts` 가
 * 처음 세운 모양을 표 열넷이 같이 쓴다. 표가 서버에서 왔는지 번들인지 부르는 쪽은 모른다.
 */
export interface GameTable<T> {
  get(): T
  /** 표를 통째로 바꾸고 구독자에게 알린다. 같은 객체면 아무 일도 없다. */
  set(next: T): void
  /** @returns 구독을 푸는 함수 */
  subscribe(listener: () => void): () => void
}

export function createTable<T>(initial: T): GameTable<T> {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set(next) {
      if (next === current) return
      current = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * 번들 JSON 으로 표를 세운다. 그 칸의 계약 검사를 통과한 값이 초기값이라 응답의 `null` 은 코드에서 빠진 칸이다.
 *
 * 번들이 계약을 어기면 켜는 순간 던진다. 동기화 스크립트가 쓴 파일이고 `bundled-game-data.spec` 이 같은 검사를
 * 하므로 여기서 던지는 것은 빌드가 깨진 것이다.
 *
 * @param name 칸 이름. 던질 때 어느 파일인지 적는다
 */
export function bundledTable<T>(name: string, raw: unknown, parse: (value: unknown) => T | null): GameTable<T> {
  const value = parse(raw)
  if (value === null) throw new Error(`번들 ${name} 이 계약을 어겼습니다`)
  return createTable(value)
}

/**
 * 표에서 만든 값(Map · 정렬 목록)을 표가 바뀔 때까지 들고 있는 읽기 함수.
 *
 * 모듈 꼭대기에서 한 번 만들던 상수의 자리다. 표 객체가 바뀐 뒤 첫 읽기에서 `build` 를 다시 돈다.
 */
export function derive<T, R>(table: GameTable<T>, build: (value: T) => R): () => R {
  let source: T | undefined
  let result: R | undefined
  let built = false
  return () => {
    const value = table.get()
    if (!built || value !== source) {
      source = value
      result = build(value)
      built = true
    }
    return result as R
  }
}

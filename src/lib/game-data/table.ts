/**
 * 게임 데이터 표 하나의 현재 값. 빈 표로 시작하고 기기 사본 · 서버 응답이 덮는다.
 *
 * 조회 모듈은 `get` 으로 읽고, 받는 흐름(`features/game-data/sync`)이 `set` 으로 덮는다. 보스의 `catalog.ts` 가
 * 처음 세운 모양을 표 열일곱이 같이 쓴다.
 */
import type { GameDataSection } from '../../types/game-data'
// jest 의 moduleNameMapper 는 import 글자를 본다. `./initial` 이면 `/game-data/initial$` 에 안 걸려 fixture 로 바뀌지 않는다.
import { initialTable } from '../game-data/initial'

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
 * 칸 하나의 표. 앱은 빈 표로 켜고, 기기 사본이나 서버 응답이 채운다. 다 받기 전에는 잠금 화면이 화면을 열지 않는다.
 *
 * 첫 값은 `initialTable` 이 정한다. jest 는 그 모듈을 fixture 판으로 바꿔 끼워 테스트가 실제 게임 데이터로 돈다.
 *
 * @param name 칸 이름
 * @param empty 받기 전의 값
 */
export function gameTable<T>(name: GameDataSection, empty: T, parse: (value: unknown) => T | null): GameTable<T> {
  return createTable(initialTable(name, empty, parse))
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

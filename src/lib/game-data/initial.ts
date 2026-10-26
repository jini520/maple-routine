import type { GameDataSection } from '../../types/game-data'

/**
 * 표의 첫 값. 앱에서는 빈 표다.
 *
 * jest 는 `jest.config.js` 의 `moduleNameMapper` 로 이 모듈을 `src/__fixtures__/game-data/initial.ts` 로 바꿔 끼운다.
 * 그래서 테스트는 fixture 에 담긴 실제 게임 데이터로 돈다.
 */
export function initialTable<T>(_name: GameDataSection, empty: T, _parse: (value: unknown) => T | null): T {
  return empty
}

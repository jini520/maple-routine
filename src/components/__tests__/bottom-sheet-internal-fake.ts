/**
 * `@gorhom/bottom-sheet` 를 가짜로 세우는 테스트가 쓰는 `useBottomSheetInternal` 의 가짜.
 *
 * 바텀시트의 바탕 · 내용 층이 이 훅으로 애니메이션 상태와 시트 자리를 읽는다. 가짜 상태는 아무 애니메이션도 없는
 * 자리라 층은 내용 높이 그대로 선다.
 *
 * @example
 * useBottomSheetInternal: () =>
 *   jest.requireActual<typeof import('../../../components/__tests__/bottom-sheet-internal-fake')>(
 *     '../../../components/__tests__/bottom-sheet-internal-fake',
 *   ).fakeBottomSheetInternal(),
 */
import { makeMutable } from 'react-native-reanimated'

export function fakeBottomSheetInternal() {
  return {
    animatedAnimationState: makeMutable({ source: 0, status: 0 }),
    animatedLayoutState: makeMutable({ containerHeight: 844 }),
    animatedPosition: makeMutable(0),
  }
}

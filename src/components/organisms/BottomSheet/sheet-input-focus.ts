/**
 * 시트 안 칸이 초점을 잡고 놓는 것을 시트에 알리는 길.
 *
 * 키보드 리스너는 전역이라 시트는 **누가 올린 키보드인지** 를 스스로 알 수 없다. 입력 카드는
 * 시트 밖(RN `Modal`)에서 키보드를 올리는데, 시트가 그것까지 따라가면 상한이 줄어 시트가
 * 짧아지고 윗변이 내려간다. 그래서 시트는 **자기 칸이 초점을 잡았을 때만** 키보드를 본다.
 *
 * 컴포넌트 파일이 아니라 여기 사는 것은 `useSheetKeyboardTarget` 이 이것만 필요해서다. 시트
 * 컴포넌트를 통째로 가져오면 훅이 시트에 묶인다.
 *
 * 치는 칸이 전부 입력 카드로 옮겨가면 이 파일과 시트의 키보드 배선이 함께 걷힌다.
 */
import { createContext, useContext } from 'react'

export const SheetInputFocusContext = createContext<((focused: boolean) => void) | null>(null)

/** 시트 안 입력 칸이 부른다. 시트 밖이면 `null` 이라 아무 일도 안 한다. */
export function useSheetInputFocusReport(): ((focused: boolean) => void) | null {
  return useContext(SheetInputFocusContext)
}

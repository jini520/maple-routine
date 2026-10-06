/**
 * 입력 카드 판정에 쓰는 키보드 높이. 기기에서 본 가장 높은 값이고, 본 적이 없으면 첫 실행 기본값.
 *
 * 카드를 여는 순간 동기로 읽어야 해서 메모리에 한 벌 들고, 부팅 때 저장소에서 채운다.
 */
import { addKeyboardHeightListener } from '../../native/keyboard'
import { defaultKeyboardPx } from '../../lib/number-pad-metrics'
import { getKeyboardHeight, setKeyboardHeight } from '../../storage/keyboard-height'

let known: number | null = null

/** 저장된 높이를 읽고, 키보드가 뜰 때마다 더 높은 값을 저장한다. 해제 함수를 돌려준다. */
export async function startKeyboardHeightRecorder(): Promise<() => void> {
  const saved = await getKeyboardHeight()
  if (saved !== null && (known === null || saved > known)) known = saved
  return addKeyboardHeightListener((heightPx) => {
    // 가장 높은 값을 남긴다. 모르면 자체 판으로 기우는 규칙이라, 떠 있는 작은 키보드가 값을
    // 낮추면 짧은 화면의 카드가 다시 잘린다.
    if (heightPx <= 0 || (known !== null && heightPx <= known)) return
    known = heightPx
    void setKeyboardHeight(heightPx)
  })
}

/** 판정에 넣을 키보드 높이. */
export function keyboardHeightPx(): number {
  return known ?? defaultKeyboardPx()
}

export function __resetKeyboardHeightForTest(): void {
  known = null
}

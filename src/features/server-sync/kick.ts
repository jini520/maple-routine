/**
 * 대기 표 전송을 깨운다. 앱이 준비를 마치면 부른다.
 *
 * 한 번에 한 회차만 돈다. 도는 중에 다시 깨우면 끝난 뒤 한 번 더 돈다. 두 회차가 겹치면 같은 줄을 두 번 보낸다.
 */
import { runServerSync } from './run'

let running: Promise<unknown> | null = null
let again = false

/** 결과를 기다리지 않는다. 테스트는 돌려받은 약속을 기다린다. */
export function kickServerSync(): Promise<unknown> {
  if (running !== null) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await runServerSync()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

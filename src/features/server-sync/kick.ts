/**
 * 동기화를 깨운다. 앱이 준비를 마치면 부른다.
 *
 * 한 번에 하나만 돈다. 도는 중에 다시 깨우면 끝난 뒤 한 번 더 돈다. 두 동기화가 겹치면 같은 줄을 두 번 보내고, 받은 줄을 넣는 사이에
 * 다른 받기가 번호를 앞질러 적는다.
 */
import { runServerSync } from './run'

let running: Promise<void> | null = null
let again = false
/** 멈춰 둔 수. 0 보다 크면 깨워도 돌지 않고, 모두 풀릴 때 한 번 돈다 */
let holds = 0
/** 깨운 뒤 아직 시작하지 않은 회차를 기다리는 깨우기. 다음 회차가 끝나면 풀린다 */
let waiting: (() => void)[] = []

function start(): void {
  running = (async () => {
    while (again && holds === 0) {
      again = false
      const served = waiting
      waiting = []
      await runServerSync()
      for (const resolve of served) resolve()
    }
  })().finally(() => {
    running = null
    // 회차가 끝나 가는 사이에 깨운 것은 돌던 회차가 받지 못했다. 여기서 다시 시작하지 않으면 그 깨우기는 영영 돌지 않는다.
    if (again && holds === 0) start()
  })
}

/**
 * 결과를 기다리지 않는다. 돌려받은 약속은 깨운 뒤에 시작한 회차가 끝나면 풀린다. 도는 회차는 깨우기 전의 대기 표를 읽었을 수 있다.
 * 로그아웃과 테스트가 기다린다.
 */
export function kickServerSync(): Promise<void> {
  const done = new Promise<void>((resolve) => waiting.push(resolve))
  again = true
  if (running === null && holds === 0) start()
  return done
}

/**
 * 동기화를 멈추는 함수. 도는 동기화가 끝나기를 기다린 뒤 멈춘다. 멈춘 동안 깨운 동기화는 돌려받은 함수로 풀 때 한 번 돈다.
 *
 * 동기화 안에서 부르면 자기가 끝나기를 기다려 돌아오지 않는다. 서버와 기기의 기록을 함께 지우는 일처럼 동기화 밖의 일만 부른다.
 *
 * @example const release = await holdServerSync()
 */
export async function holdServerSync(): Promise<() => void> {
  while (running !== null) await running
  holds += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holds -= 1
    if (holds === 0 && again && running === null) start()
  }
}

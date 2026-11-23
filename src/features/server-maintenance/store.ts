/**
 * 우리 서버가 점검 중인가. `AppShell` 이 이것을 구독해 앱 전체를 잠근다.
 *
 * 넥슨의 점검(`features/nexon-maintenance`)과 다른 것이다. 그쪽은 넥슨 응답으로 켜지고 화면을 막지 않는다. 이쪽은 운영자가
 * 켜고 끄며, 서버의 표를 옮기는 동안 앱을 쓰지 못하게 막는다.
 */
import { focusManager } from '@tanstack/react-query'
import { create } from 'zustand'

import { fetchServerMaintenance } from '../../server/maintenance'
import { getGameDataStatus, refreshGameData, retryGameData } from '../game-data/sync'

/** 잠긴 동안 묻는 간격. 점검이 끝난 뒤 앱이 풀릴 때까지의 상한이다. */
export const LOCKED_CHECK_INTERVAL_MS = 30_000

/** 풀려 있는 동안 묻는 간격. 점검을 켠 뒤 쓰고 있던 앱이 잠길 때까지의 상한이다. */
export const OPEN_CHECK_INTERVAL_MS = 5 * 60_000

export interface ServerMaintenanceState {
  locked: boolean
  /** 종료 예정 시각(ms). 운영자가 적지 않았으면 `null`. */
  until: number | null
  /** 마지막으로 점검 중이라는 답을 받은 때(ms). 종료 예정 시각이 지났는지를 이 값으로 가린다. */
  checkedAt: number
}

const OPEN: ServerMaintenanceState = { locked: false, until: null, checkedAt: 0 }

export const useServerMaintenanceStore = create<ServerMaintenanceState>()(() => OPEN)

/**
 * 잠금 화면에 보일 종료 예정 시각. 지났으면 `null`.
 *
 * 지난 시각이 보이면 점검이 끝났는데 앱이 안 풀린 것으로 읽힌다. 렌더가 시계를 읽지 않게 마지막으로 답을 받은 때와 견준다.
 *
 * @example const until = useServerMaintenanceStore(shownMaintenanceUntil)
 */
export function shownMaintenanceUntil(state: ServerMaintenanceState): number | null {
  return state.until !== null && state.until > state.checkedAt ? state.until : null
}

let running: Promise<void> | null = null

/**
 * 서버에 묻고 잠그거나 푼다. 모르면 지금 상태를 둔다. 겹쳐 부르면 돌고 있는 것을 기다린다.
 *
 * @example void checkServerMaintenance()
 */
export function checkServerMaintenance(): Promise<void> {
  if (running !== null) return running
  running = (async () => {
    try {
      const answer = await fetchServerMaintenance()
      if (answer.state === 'unknown') return
      if (answer.state === 'on') {
        useServerMaintenanceStore.setState({ locked: true, until: answer.until, checkedAt: Date.now() })
        return
      }
      // 잠긴 적이 없으면 풀린 것이 아니다. 여기서 게임 데이터를 물으면 묻는 주기마다 게임 데이터 요청이 나간다.
      if (!useServerMaintenanceStore.getState().locked) return
      useServerMaintenanceStore.setState(OPEN)
      // 점검 중에 처음 켠 기기는 받기가 실패해 있다. 다시 묻기는 사본이 있을 때만 돌아서 그 기기를 못 푼다.
      void (getGameDataStatus().phase === 'failed' ? retryGameData() : refreshGameData())
    } finally {
      running = null
    }
  })()
  return running
}

/**
 * 점검 잠금이 풀려 있으면 끝나는 약속. 한 번 다시 묻고, 잠겨 있으면 풀릴 때 끝난다. 답을 못 받으면 지금 상태를 따른다.
 *
 * 부팅의 확인은 답을 기다리지 않아서, 점검 중에 시작하면 안 되는 일이 시작하기 전에 기다린다.
 *
 * @example await whenServerMaintenanceUnlocked()
 */
export async function whenServerMaintenanceUnlocked(): Promise<void> {
  await checkServerMaintenance()
  if (!useServerMaintenanceStore.getState().locked) return
  await new Promise<void>((resolve) => {
    const unsubscribe = useServerMaintenanceStore.subscribe((state) => {
      if (state.locked) return
      unsubscribe()
      resolve()
    })
  })
}

/**
 * 켜자마자 한 번 묻고 주기로 다시 묻는다. 잠긴 동안은 30초, 아니면 5분마다다.
 *
 * @returns 주기를 멈추는 함수
 * @example useEffect(() => watchServerMaintenance(), [])
 */
export function watchServerMaintenance(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const schedule = (): void => {
    if (timer !== null) clearTimeout(timer)
    if (stopped) return
    const delay = useServerMaintenanceStore.getState().locked ? LOCKED_CHECK_INTERVAL_MS : OPEN_CHECK_INTERVAL_MS
    timer = setTimeout(() => {
      // 화면에 없으면 묻지 않는다. 돌아올 때 `AppShell` 이 따로 묻는다.
      if (!focusManager.isFocused()) schedule()
      else void checkServerMaintenance().then(schedule)
    }, delay)
  }

  // 주기 밖의 확인(복귀)으로 잠기거나 풀리면 간격이 바뀐다. 그대로 두면 풀린 것을 5분 뒤에야 안다.
  const unsubscribe = useServerMaintenanceStore.subscribe((state, previous) => {
    if (state.locked !== previous.locked) schedule()
  })

  void checkServerMaintenance().then(schedule)

  return () => {
    stopped = true
    unsubscribe()
    if (timer !== null) clearTimeout(timer)
  }
}

/** 테스트 전용. 상태를 첫 값으로 되돌린다. */
export function resetServerMaintenanceForTest(): void {
  running = null
  useServerMaintenanceStore.setState(OPEN)
}

/**
 * 로그아웃 · 계정 삭제가 서버 쪽을 거두는 자리.
 *
 * - 계정 삭제는 **기기에서 키를 지우기 전**에 보낸다. 서버가 사람을 찾을 값이 그 키에서 나온다.
 * - 로그아웃은 **세션을 거두기 전**에 동기화를 한 번 돌려 남은 기록을 올린다. 대기 표는 비우지 않는다. 남은 줄은 같은 사람이 다시
 *   로그인하면 올라가고, 다른 사람이 로그인하면 버릴지 묻는다.
 * - 못 보낸 사용 로그는 로그아웃할 때 비운다. 누가 만든 줄인지 적혀 있지 않아, 남기면 다음에 다른 키로 로그인한 사람의 신원으로
 *   나간다.
 */
import { deleteMeOnServer } from '../../server/account-deletion'
import { clearUsageEvents } from '../../storage/usage-events'
import { serverIdentityHeaders } from '../auth/server-identity'
import { kickServerSync } from './kick'

/**
 * 로그아웃이 남은 기록을 올리는 동기화를 기다리는 상한. 요청 하나의 상한과 같다. 처음 동기화의 받기 중이면 100쪽까지 받아 로그아웃이
 * 오래 멈춘다. 넘으면 남은 줄은 대기 표에 남아 다음에 로그인하는 사람이 같은 사람인지 가려 다룬다.
 */
const SIGN_OUT_SYNC_LIMIT_MS = 10_000

/** 계정 삭제를 예약한다. 서버가 받았을 때만 `true` 다. 던지지 않는다. */
export async function requestAccountDeletion(): Promise<boolean> {
  try {
    const headers = await serverIdentityHeaders()
    if (headers === null) return false
    return (await deleteMeOnServer(headers)).outcome === 'sent'
  } catch {
    return false
  }
}

/**
 * 로그아웃하기 전에 동기화를 한 번 돌린다. 누른 뒤에 시작한 회차가 끝나기를 10초까지 기다린다. 던지지 않는다. 로그아웃을 막지 않는다.
 *
 * 기다리기를 그만두어도 회차는 돈다. 세션을 거둔 뒤의 요청은 서버가 요청 전체를 거절해, 회차가 아무것도 세지 않고 멈춘다.
 */
export async function syncBeforeSignOut(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    kickServerSync().catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SIGN_OUT_SYNC_LIMIT_MS)
    }),
  ])
  clearTimeout(timer)
}

/** 못 보낸 사용 로그를 버린다. 던지지 않는다. 로그아웃을 막지 않는다. */
export async function clearUnsentUsageEvents(): Promise<void> {
  await clearUsageEvents().catch(() => undefined)
}

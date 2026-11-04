/**
 * 쌓인 사용 로그를 묶어 서버로 보낸다. **던지지 않고, 실패한 묶음은 버린다.** 대강의 양을 보는 값이라 몇 묶음을 놓쳐도 된다.
 */
import { Platform } from 'react-native'
import packageJson from '../../../package.json'
import type { SendResult } from '../../server/write'
import { sendUsageEvents } from '../../server/usage-events'
import { takeUsageEvents } from '../../storage/usage-events'
import type { UsageEvent, UsageEventBatch } from '../../types/usage-event'
import { serverIdentityHeaders } from '../auth/server-identity'
import { useLiveUpdateStore } from '../live-update/store'

export interface FlushDeps {
  identity: () => Promise<Record<string, string> | null>
  take: () => Promise<UsageEvent[]>
  send: (headers: Record<string, string>, batch: UsageEventBatch) => Promise<SendResult>
  platform: () => UsageEventBatch['platform']
  /** 앱 정보 화면이 보여 주는 버전. 스토어 바이너리와 따로 움직이는 OTA 번들의 버전이다 */
  appVersion: () => string
}

const DEFAULT_DEPS: FlushDeps = {
  identity: serverIdentityHeaders,
  take: takeUsageEvents,
  send: sendUsageEvents,
  platform: () => (Platform.OS === 'android' ? 'android' : 'ios'),
  appVersion: () => useLiveUpdateStore.getState().currentVersion ?? packageJson.version,
}

let inFlight: Promise<void> | null = null

/** 겹쳐 부르면 도는 회차 하나를 함께 기다린다. 따로 돌면 같은 사건을 두 번 꺼내려 한다. */
export function flushUsageEvents(deps: FlushDeps = DEFAULT_DEPS): Promise<void> {
  inFlight ??= run(deps).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function run(deps: FlushDeps): Promise<void> {
  try {
    // 신원이 없으면 꺼내지 않는다. 키를 넣은 뒤 첫 전송에서 함께 나간다.
    const headers = await deps.identity()
    if (headers === null) return
    const events = await deps.take()
    if (events.length === 0) return
    await deps.send(headers, { platform: deps.platform(), appVersion: deps.appVersion(), events })
  } catch {
    // 사용 로그라 다시 보내지 않는다.
  }
}

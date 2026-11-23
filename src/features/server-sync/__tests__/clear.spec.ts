/**
 * 데이터 삭제의 서버 쪽. 기기에서만 지우면 다음 받기가 서버의 기록을 다시 넣는다. 그래서 서버에서 먼저 지우고, 서버가 지운 뒤에만
 * 기기에서 지운다.
 */
import type { SendResult } from '../../../server/write'
import type { CacheDataSelection } from '../../../storage/cache-data'
import { clearRecordGroupsAndReload, type ClearDeps } from '../clear'

const NONE: CacheDataSelection = { manual: false, boss: false, cashbook: false, enhancement: false, cache: false }
const IDENTITY = { 'x-maple-id-hash': 'h' }

function setup(options: { server?: SendResult; identity?: Record<string, string> | null } = {}) {
  const order: string[] = []
  const reload = jest.fn()
  const deps: ClearDeps = {
    hold: jest.fn(async () => {
      order.push('hold')
      return () => order.push('release')
    }),
    identity: jest.fn(async () => (options.identity === undefined ? IDENTITY : options.identity)),
    clearOnServer: jest.fn(async (_headers, groups): Promise<SendResult> => {
      order.push(`server ${groups.join(',')}`)
      return options.server ?? { outcome: 'sent' }
    }),
    clearDeviceAndReload: jest.fn(async () => {
      order.push('device')
    }),
  }
  return { deps, order, reload }
}

it('기록 묶음을 고르면 동기화를 멈추고 서버에서 먼저 지운 뒤 기기에서 지운다', async () => {
  const { deps, order, reload } = setup()
  const selection = { ...NONE, boss: true, cashbook: true, cache: true }

  expect(await clearRecordGroupsAndReload(selection, reload, deps)).toBe(true)

  // 기기에서 지우면 앱을 다시 띄운다. 멈춤을 풀면 미룬 동기화가 닫은 DB 를 다시 연다.
  expect(order).toEqual(['hold', 'server boss,cashbook', 'device'])
  expect(deps.clearOnServer).toHaveBeenCalledWith(IDENTITY, ['boss', 'cashbook'])
  expect(deps.clearDeviceAndReload).toHaveBeenCalledWith(selection, reload)
})

it.each<[string, SendResult]>([
  ['응답이 없으면', { outcome: 'no-response' }],
  ['서버가 거절하면', { outcome: 'rejected', status: 403 }],
])('%s 기기에서 아무것도 지우지 않고 멈춤을 푼다', async (_name, server) => {
  const { deps, order, reload } = setup({ server })

  expect(await clearRecordGroupsAndReload({ ...NONE, manual: true }, reload, deps)).toBe(false)

  expect(order).toEqual(['hold', 'server manual', 'release'])
  expect(deps.clearDeviceAndReload).not.toHaveBeenCalled()
})

// 신원이 없는 기기의 기록은 서버에 올라간 적이 없다.
it('신원이 없으면 서버를 부르지 않고 기기에서 지운다', async () => {
  const { deps, order, reload } = setup({ identity: null })

  expect(await clearRecordGroupsAndReload({ ...NONE, enhancement: true }, reload, deps)).toBe(true)

  expect(order).toEqual(['hold', 'device'])
})

// 캐시는 서버에 올리지 않는 값이다.
it('캐시만 고르면 서버를 부르지 않는다', async () => {
  const { deps, order, reload } = setup()

  expect(await clearRecordGroupsAndReload({ ...NONE, cache: true }, reload, deps)).toBe(true)

  expect(order).toEqual(['hold', 'device'])
  expect(deps.identity).not.toHaveBeenCalled()
})

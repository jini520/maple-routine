/// <reference types="node" />
/**
 * 보스 관리의 `저장` 이 서버 동기화를 한 번만 깨우는지. 진짜 SQLite 와 Preferences 가짜 포트 위에서 저장 함수를 돌리고, 쓰기 알림
 * (`subscribeRecordsWritten`)을 센다. 이 알림이 `features/server-sync/after-write.ts` 를 거쳐 동기화를 깨운다.
 *
 * 저장소 함수는 쓸 때마다 알린다. 감싸지 않으면 첫 쓰기의 알림이 동기화를 시작하고, 도는 동안 난 다음 알림이 끝난 뒤 한 번 더 돌린다.
 */
import { getBossPartySettings } from '../../../storage/boss-party-settings'
import { getManualTrackedContent, setManualTrackedContent } from '../../../storage/manual-tracked-content'
import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { subscribeRecordsWritten } from '../../../storage/server-sync-queue'
import { closeBossProfitDb } from '../../../storage/sqlite/db'
import { createRealSqlite, type RealSqlite } from '../../../storage/sqlite/__tests__/node-sqlite-port'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { useBossSchedulerStore } from '../store'

const EVEN = { crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null }

let real: RealSqlite
let wakes: number
let unsubscribe: () => void

beforeEach(() => {
  installFakePreferences()
  real = createRealSqlite()
  setSqlitePort(real.port)
  wakes = 0
  unsubscribe = subscribeRecordsWritten(() => {
    wakes += 1
  })
})

afterEach(async () => {
  unsubscribe()
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('보스 관리의 저장은 추적 목록과 파티 설정 둘을 써도 쓰기 알림이 한 번이다', async () => {
  await setManualTrackedContent('ocid-1', [{ kind: 'boss', bossKey: 'zakum', difficulty: 'chaos' }])
  wakes = 0

  const result = await useBossSchedulerStore.getState().saveBossManageDraft('ocid-1', {
    tracking: { zakum: null, lotus: 'hard' },
    party: {
      'ocid-1:lotus:hard': { bossKey: 'lotus', difficulty: 'hard', partySize: 2, shares: EVEN },
      'ocid-1:lucid:normal': { bossKey: 'lucid', difficulty: 'normal', partySize: 3, shares: EVEN },
    },
  })

  expect(result).toEqual({ status: 'saved' })
  expect(wakes).toBe(1)
  await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([{ kind: 'boss', bossKey: 'lotus', difficulty: 'hard' }])
  expect((await getBossPartySettings(['ocid-1'])).map((setting) => [setting.bossKey, setting.partySize]).sort()).toEqual([
    ['lotus', 2],
    ['lucid', 3],
  ])
})

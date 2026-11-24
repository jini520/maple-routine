/// <reference types="node" />
/**
 * 컨텐츠 관리의 `저장` 이 서버 동기화를 한 번만 깨우는지. 진짜 SQLite 와 Preferences 가짜 포트 위에서 저장 함수를 돌리고, 쓰기 알림
 * (`subscribeRecordsWritten`)을 센다. 이 알림이 `features/server-sync/after-write.ts` 를 거쳐 동기화를 깨운다.
 *
 * 항목마다 쓰면 그만큼 알림이 나간다. 일간 · 주간을 여럿 바꿔도 추적 목록을 한 번 써야 한다.
 */
import { getManualTrackedContent } from '../../../storage/manual-tracked-content'
import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { subscribeRecordsWritten } from '../../../storage/server-sync-queue'
import { closeBossProfitDb } from '../../../storage/sqlite/db'
import { createRealSqlite, type RealSqlite } from '../../../storage/sqlite/__tests__/node-sqlite-port'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { useContentSchedulerStore } from '../store'

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

it('컨텐츠 관리의 저장은 일간 · 주간을 여럿 바꿔도 추적 목록을 한 번 쓰고 쓰기 알림이 한 번이다', async () => {
  await useContentSchedulerStore.getState().saveManualContentDraft('ocid-1', {
    daily: { monster_park: true, daily_quest_road_of_vanishing: true },
    weekly: { mu_lung_dojo: true },
  })

  expect(wakes).toBe(1)
  await expect(getManualTrackedContent('ocid-1')).resolves.toEqual([
    { contentKey: 'monster_park', kind: 'daily' },
    { contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' },
    { contentKey: 'mu_lung_dojo', kind: 'weekly' },
  ])
})

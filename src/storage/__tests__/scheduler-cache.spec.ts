// 1.0.12 까지의 스케줄 캐시. 이제 읽고 지우기만 한다. 업데이트 뒤 첫 실행이 쿼리 캐시로 옮긴 뒤 지우므로,
// 옮길 수 있는 모양만 읽히는지와 지우기가 실제 키에 닿는지를 본다.
import { installFakePreferences } from './fake-preferences'
import type { SchedulerCharacterState } from '../../types'
import { clearCachedSchedulerState, getCachedSchedulerState, type CachedSchedulerEntry } from '../scheduler-cache'

const sampleState: SchedulerCharacterState = {
  asOf: '2026-07-09T00:00+09:00',
  characterName: '낟낟',
  world: '엘리시움',
  worldKey: 'elysium',
  level: 293,
  jobClass: '렌',
  dailyContents: [],
  weeklyContents: [],
  bossContents: [],
  isDailyStale: false,
  isWeeklyStale: false,
  isWeeklyBossStale: false,
  isMonthlyBossStale: false,
}

const sampleEntry: CachedSchedulerEntry = {
  state: sampleState,
  syncedAt: '2026-07-09T00:05:00.000Z',
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

// 보스 항목이 이름 대신 key 를 드는 모양으로 바뀌었다. 옛 모양은 옮기지 않고 다음 동기화가 다시 받는다.
describe('모양 번호', () => {
  it('모양 번호가 없는 옛 캐시는 없는 것으로 본다', async () => {
    await prefs.set('schedulerCache:ocid-old', JSON.stringify(sampleEntry))
    await expect(getCachedSchedulerState('ocid-old')).resolves.toBeNull()
  })

  // 캐릭터 상태에 월드 key 칸이 생겨 모양 번호가 4 가 됐다. 3 인 캐시는 월드 key 가 없다.
  it('모양 번호가 3 인 캐시도 없는 것으로 본다', async () => {
    await prefs.set('schedulerCache:ocid-old', JSON.stringify({ ...sampleEntry, version: 3 }))
    await expect(getCachedSchedulerState('ocid-old')).resolves.toBeNull()
  })

  it('모양 번호가 4 면 state 와 syncedAt 만 돌려주고, 지우면 없는 것으로 본다', async () => {
    await prefs.set('schedulerCache:ocid-1', JSON.stringify({ ...sampleEntry, version: 4 }))
    await expect(getCachedSchedulerState('ocid-1')).resolves.toEqual(sampleEntry)

    await clearCachedSchedulerState('ocid-1')

    await expect(getCachedSchedulerState('ocid-1')).resolves.toBeNull()
  })
})

describe('손상된 JSON', () => {
  it('저장된 값이 손상된 JSON이면 예외를 던지지 않고 null을 반환한다', async () => {
    await prefs.set('schedulerCache:ocid-broken', 'not-valid-json{')
    await expect(getCachedSchedulerState('ocid-broken')).resolves.toBeNull()
  })
})

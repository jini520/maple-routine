import { runLegacyCleanupOnce } from '../legacy-cleanup'
import { installFakePreferences } from './fake-preferences'

const fake = installFakePreferences()
const DONE_KEY = 'legacyCleanupDone'
const LEGACY_KEYS = [
  'queryCache',
  'bossCatalog',
  'notices',
  'characterBasicCache:index',
  'characterBasicCache:index:account-1',
]

async function seedLegacyKeys(): Promise<void> {
  for (const key of LEGACY_KEYS) await fake.set(key, 'x')
}

beforeEach(() => {
  fake.clear()
  jest.clearAllMocks()
})

it('옛 키를 지우고 표식을 둔다', async () => {
  await seedLegacyKeys()

  await runLegacyCleanupOnce(async () => undefined)

  expect(await fake.keys()).toEqual([DONE_KEY])
})

// 추적하지 않는 캐릭터의 기본 정보 키는 프로필 조회의 마지막 폴백이고, 조회 원장은 13일 창이 읽는다.
it('목록에 없는 키는 남긴다', async () => {
  const kept = ['characterBasicCache:ocid-1', 'schedulerCache:ocid-1', 'scheduleProbe:ocid-1', 'trackedCharacters']
  for (const key of kept) await fake.set(key, 'x')

  await runLegacyCleanupOnce(async () => undefined)

  expect((await fake.keys()).sort()).toEqual([...kept, DONE_KEY].sort())
})

it('옛 값을 쿼리에 심은 뒤에 지운다', async () => {
  await seedLegacyKeys()
  let notices: string | null = null

  await runLegacyCleanupOnce(async () => {
    notices = await fake.get('notices')
  })

  expect(notices).toBe('x')
  expect(await fake.get('notices')).toBeNull()
})

it('표식이 있으면 심지도 훑지도 않는다', async () => {
  await fake.set(DONE_KEY, '1')
  await seedLegacyKeys()
  const seed = jest.fn(async () => undefined)
  fake.keys.mockClear()

  await runLegacyCleanupOnce(seed)

  expect(seed).not.toHaveBeenCalled()
  expect(fake.keys).not.toHaveBeenCalled()
  expect(await fake.get('notices')).toBe('x')
})

it('심기가 던지면 지우지 않고 표식도 안 둔다. 다음 실행이 다시 돈다', async () => {
  await seedLegacyKeys()

  await expect(runLegacyCleanupOnce(async () => Promise.reject(new Error('심기 실패')))).rejects.toThrow('심기 실패')
  expect(await fake.get('notices')).toBe('x')
  expect(await fake.get(DONE_KEY)).toBeNull()

  await runLegacyCleanupOnce(async () => undefined)
  expect(await fake.keys()).toEqual([DONE_KEY])
})

it('지우기가 던지면 표식을 안 둔다', async () => {
  await seedLegacyKeys()
  fake.remove.mockRejectedValueOnce(new Error('지우기 실패'))

  await expect(runLegacyCleanupOnce(async () => undefined)).rejects.toThrow('지우기 실패')

  expect(await fake.get(DONE_KEY)).toBeNull()
})

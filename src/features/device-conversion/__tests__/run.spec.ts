/// <reference types="node" />
jest.mock('../../game-data/sync', () => ({
  __esModule: true,
  whenGameDataReady: jest.fn(),
}))
jest.mock('../../usage-log/flush', () => ({
  __esModule: true,
  reportUsageActionNow: jest.fn(async () => {}),
}))
jest.mock('../../../storage/api-key', () => ({
  __esModule: true,
  getAuthConfig: jest.fn(async () => null),
}))
jest.mock('../../../storage/character-selection', () => ({
  __esModule: true,
  getRepresentativeCharacter: jest.fn(async () => null),
  getTrackedCharacterOcids: jest.fn(async () => null),
}))
jest.mock('../../../storage/sqlite/device-conversion', () => {
  const actual = jest.requireActual('../../../storage/sqlite/device-conversion')
  return { __esModule: true, ...actual, runDeviceConversion: jest.fn() }
})
jest.mock('../../../storage/preferences-conversion', () => {
  const actual = jest.requireActual('../../../storage/preferences-conversion')
  return { __esModule: true, ...actual, runPreferencesConversion: jest.fn() }
})

import { getAuthConfig } from '../../../storage/api-key'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../../storage/character-selection'
import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { closeBossProfitDb, getBossProfitDb } from '../../../storage/sqlite/db'
import { __setMigrationCeilingForTest, DB_VERSION } from '../../../storage/sqlite/migrations'
import { DeviceConversionError, runDeviceConversion } from '../../../storage/sqlite/device-conversion'
import { PreferencesConversionError, runPreferencesConversion } from '../../../storage/preferences-conversion'
import { createRealSqlite, type RealSqlite } from '../../../storage/sqlite/__tests__/node-sqlite-port'
import { whenGameDataReady } from '../../game-data/sync'
import { reportUsageActionNow } from '../../usage-log/flush'
import {
  __resetDeviceConversionForTest,
  getDeviceConversionPhase,
  retryDeviceConversion,
  startDeviceConversion,
} from '../run'

const run = jest.mocked(runDeviceConversion)
const runPreferences = jest.mocked(runPreferencesConversion)
const gameDataReady = jest.mocked(whenGameDataReady)
const report = jest.mocked(reportUsageActionNow)

let real: RealSqlite

/** 끝나지 않은 일이 한 바퀴 돌 시간. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

/** 기록 표 접근이 풀렸는지 본다. */
function watchRecordTables(): { opened: () => boolean } {
  let opened = false
  void getBossProfitDb().then(() => {
    opened = true
  })
  return { opened: () => opened }
}

beforeEach(() => {
  jest.clearAllMocks()
  // 새 DB 는 처음 열 때 변환을 곧바로 돈다. 여기서는 부팅의 변환만 보려고 상한으로 막는다.
  __setMigrationCeilingForTest(DB_VERSION)
  real = createRealSqlite()
  setSqlitePort(real.port)
  gameDataReady.mockResolvedValue()
  run.mockResolvedValue()
  runPreferences.mockResolvedValue()
})

afterEach(async () => {
  __setMigrationCeilingForTest(null)
  __resetDeviceConversionForTest()
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

describe('기기 변환을 돌리는 때', () => {
  // 변환은 줄 id 를 새 게임 데이터에서 찾는다. 받기 전에 돌면 모든 줄을 못 찾아 지운다.
  it('게임 데이터가 준비되기 전에는 돌지 않고 기록 표 접근이 기다린다. 끝나면 풀린다', async () => {
    let ready: () => void = () => {}
    gameDataReady.mockReturnValue(new Promise<void>((resolve) => (ready = resolve)))

    startDeviceConversion()
    const tables = watchRecordTables()
    await settle()

    expect(run).not.toHaveBeenCalled()
    expect(tables.opened()).toBe(false)
    expect(getDeviceConversionPhase()).toBe('running')

    ready()
    await settle()

    expect(run).toHaveBeenCalledTimes(1)
    expect(getDeviceConversionPhase()).toBe('done')
    expect(tables.opened()).toBe(true)
  })

  // 새 앱 코드는 옛 모양의 표를 읽지 못한다. 실패한 채로 기록 표를 열면 읽는 곳마다 던진다.
  it('실패하면 기록 표를 막은 채 던진 단계를 사용 로그로 적어 보내고, 다시 시도가 성공하면 풀린다', async () => {
    run.mockRejectedValueOnce(new DeviceConversionError(3, new Error('줄을 못 옮겼다')))

    startDeviceConversion()
    const tables = watchRecordTables()
    await settle()

    expect(getDeviceConversionPhase()).toBe('failed')
    expect(report).toHaveBeenCalledWith('device-conversion-failed:3')
    expect(tables.opened()).toBe(false)

    await retryDeviceConversion()
    await settle()

    expect(getDeviceConversionPhase()).toBe('done')
    expect(tables.opened()).toBe(true)
  })

  // Preferences 의 기록도 옛 모양을 새 코드가 읽지 못한다. SQLite 단계는 뒤에 더 늘어서 번호를 이어 매기지 않고 따로 적는다.
  it('SQLite 변환이 끝난 뒤 같은 연결로 Preferences 변환을 돌고, 그것이 던지면 막은 채 preferences 로 알린다', async () => {
    runPreferences.mockRejectedValueOnce(new PreferencesConversionError(new Error('disk full')))

    startDeviceConversion()
    const tables = watchRecordTables()
    await settle()

    expect(run.mock.invocationCallOrder[0]).toBeLessThan(runPreferences.mock.invocationCallOrder[0]!)
    expect(runPreferences.mock.calls[0]?.[0]).toBe(run.mock.calls[0]?.[0])
    expect(getDeviceConversionPhase()).toBe('failed')
    expect(report).toHaveBeenCalledWith('device-conversion-failed:preferences')
    expect(tables.opened()).toBe(false)
  })

  // 단계 밖의 실패(DB 열기 등)도 화면을 열지 못하게 하므로 알린다. 단계 번호가 없어 0 으로 적는다.
  it('단계 밖에서 던져도 실패로 남고 단계 번호 0 으로 알린다', async () => {
    run.mockRejectedValueOnce(new Error('DB 를 열지 못했다'))

    startDeviceConversion()
    await settle()

    expect(getDeviceConversionPhase()).toBe('failed')
    expect(report).toHaveBeenCalledWith('device-conversion-failed:0')
  })
})

describe('변환 맥락', () => {
  // 주인을 모르는 옛 손입력을 붙일 값은 Preferences 에 있고 저장소 층의 변환은 Preferences 를 읽지 않는다. 기록 표를 거쳐 읽으면
  // 변환이 끝나기를 기다리다 멈춘다.
  it('Preferences 의 메인 넥슨 계정과 화면이 대표로 세우는 캐릭터를 변환에 넘긴다. 대표를 고르지 않았으면 첫 추적 캐릭터다', async () => {
    jest.mocked(getAuthConfig).mockResolvedValue({ login: { type: 'login', id: 'account-main', session: 'session' }, apiKeys: [], mainKeyId: null })
    jest.mocked(getTrackedCharacterOcids).mockResolvedValue(['ocid-첫째', 'ocid-둘째'])

    startDeviceConversion()
    await settle()

    expect(run.mock.calls[0]?.[1]).toEqual({ context: { mainNexonAccountId: 'account-main', representativeOcid: 'ocid-첫째' } })

    jest.mocked(getRepresentativeCharacter).mockResolvedValue('ocid-둘째')
    run.mockClear()
    await retryDeviceConversion()

    expect(run.mock.calls[0]?.[1]).toEqual({ context: { mainNexonAccountId: 'account-main', representativeOcid: 'ocid-둘째' } })
  })
})

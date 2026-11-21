/// <reference types="node" />
jest.mock('../../game-data/sync', () => ({
  __esModule: true,
  whenGameDataReady: jest.fn(),
}))
jest.mock('../../usage-log/flush', () => ({
  __esModule: true,
  reportUsageActionNow: jest.fn(async () => {}),
}))
jest.mock('../../../storage/sqlite/device-conversion', () => {
  const actual = jest.requireActual('../../../storage/sqlite/device-conversion')
  return { __esModule: true, ...actual, runDeviceConversion: jest.fn() }
})

import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { closeBossProfitDb, getBossProfitDb } from '../../../storage/sqlite/db'
import { __setMigrationCeilingForTest, DB_VERSION } from '../../../storage/sqlite/migrations'
import { DeviceConversionError, runDeviceConversion } from '../../../storage/sqlite/device-conversion'
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

  // 단계 밖의 실패(DB 열기 등)도 화면을 열지 못하게 하므로 알린다. 단계 번호가 없어 0 으로 적는다.
  it('단계 밖에서 던져도 실패로 남고 단계 번호 0 으로 알린다', async () => {
    run.mockRejectedValueOnce(new Error('DB 를 열지 못했다'))

    startDeviceConversion()
    await settle()

    expect(getDeviceConversionPhase()).toBe('failed')
    expect(report).toHaveBeenCalledWith('device-conversion-failed:0')
  })
})

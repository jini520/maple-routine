jest.mock('../../../server/game-data', () => ({
  __esModule: true,
  fetchGameData: jest.fn(),
  assetFileUrl: (file: string) => `https://test/assets/${file}`,
}))
jest.mock('../../../storage/game-data-copy', () => ({
  __esModule: true,
  loadGameDataCopy: jest.fn(),
  saveGameDataCopy: jest.fn(),
  clearGameDataCopy: jest.fn(),
  removeLegacyGameDataCopies: jest.fn(),
}))

import { act, renderHook } from '@testing-library/react-native'

import { assetFilesTable } from '../../../lib/assets/asset-files'
import { GAME_DATA_CONTRACT, INITIAL_GAME_DATA, currentGameData } from '../../../lib/game-data/sections'
import { worldsTable } from '../../../lib/world/worlds'
import { fetchGameData, type GameDataFetch } from '../../../server/game-data'
import {
  clearGameDataCopy,
  loadGameDataCopy,
  removeLegacyGameDataCopies,
  saveGameDataCopy,
} from '../../../storage/game-data-copy'
import { __resetStoragePortsForTest, setAssetFilesPort, type AssetFilesPort } from '../../../storage/ports'
import type { GameData } from '../../../types/game-data'
import {
  __resetGameDataSyncForTest,
  confirmGameData,
  getGameDataStatus,
  refreshGameData,
  retryGameData,
  startGameData,
  useGameTable,
} from '../sync'

const fetchRemote = jest.mocked(fetchGameData)
const loadCopy = jest.mocked(loadGameDataCopy)
const saveCopy = jest.mocked(saveGameDataCopy)
const clearCopy = jest.mocked(clearGameDataCopy)

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const file = (path: string, sha: string, size = 100) => ({ path, file: `${sha}.webp`, sha256: sha, size, width: 1, height: 1 })

/** fixture 칸 전부에 그림 목록만 바꾼 서버 응답. */
function 응답(files: ReturnType<typeof file>[], worldsUpdatedAt = 't1', etag = '"e1"'): GameDataFetch {
  const sections: GameData = {
    ...INITIAL_GAME_DATA,
    worlds: { ...INITIAL_GAME_DATA.worlds, updatedAt: worldsUpdatedAt },
    assets: { updatedAt: 't', files },
  }
  return { kind: 'ok', etag, bytes: 1000, sections, raw: sections as unknown as Record<string, unknown> }
}

function fakeFiles(initial: string[] = []): AssetFilesPort & { names: Set<string>; downloads: string[] } {
  const names = new Set(initial)
  const downloads: string[] = []
  return {
    names,
    downloads,
    directoryUri: () => 'file:///docs/game-assets/',
    list: async () => [...names],
    download: jest.fn(async (url: string, fileName: string) => {
      downloads.push(url)
      names.add(fileName)
      return 100
    }),
    remove: jest.fn(async (fileName: string) => {
      names.delete(fileName)
    }),
    clear: jest.fn(),
    size: jest.fn(),
  }
}

let files: ReturnType<typeof fakeFiles>

/** 확인 패널에 크기가 서면 `확인` 을 누르며 받기가 끝날 때까지 기다리는 도우미. */
async function 확인하며(run: () => Promise<void>): Promise<void> {
  let finished = false
  const done = run().then(() => {
    finished = true
  })
  while (!finished) {
    const now = getGameDataStatus()
    if (now.phase === 'confirm' && now.progress.dataBytes !== null) confirmGameData()
    await new Promise((resolve) => setImmediate(resolve))
  }
  await done
}

beforeEach(() => {
  jest.clearAllMocks()
  __resetGameDataSyncForTest()
  files = fakeFiles()
  setAssetFilesPort(files)
  loadCopy.mockResolvedValue(null)
  saveCopy.mockResolvedValue()
  clearCopy.mockResolvedValue()
  jest.mocked(removeLegacyGameDataCopies).mockResolvedValue()
})

afterAll(() => {
  __resetGameDataSyncForTest()
  __resetStoragePortsForTest()
})

describe('처음 켤 때 (사본 없음)', () => {
  it('게임 데이터만 받고 받을 크기를 보인 채 확인을 기다린다. 확인하기 전에는 그림을 받지 않는다', async () => {
    fetchRemote.mockResolvedValue(응답([file('bosses/a.webp', SHA_A, 300), file('items/b.webp', SHA_B, 700)]))
    files = fakeFiles([`${SHA_A}.webp`])
    setAssetFilesPort(files)

    const started = startGameData()
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve))

    // 이미 있는 그림은 받을 크기에서 뺀다.
    expect(getGameDataStatus()).toEqual({ phase: 'confirm', progress: { dataBytes: 1000, imageBytes: 0, imageTotal: 700 } })
    expect(files.downloads).toEqual([])
    expect(saveCopy).not.toHaveBeenCalled()

    confirmGameData()
    await started
    expect(getGameDataStatus().phase).toBe('ready')
  })

  it('잠그고 받는다. 그림을 다 받은 뒤 사본을 쓰고 표를 바꾸고 풀린다', async () => {
    fetchRemote.mockResolvedValue(응답([file('bosses/a.webp', SHA_A), file('items/b.webp', SHA_B)]))

    await 확인하며(startGameData)

    expect(fetchRemote).toHaveBeenCalledWith(null)
    expect(files.downloads.sort()).toEqual([`https://test/assets/${SHA_A}.webp`, `https://test/assets/${SHA_B}.webp`])
    expect(saveCopy).toHaveBeenCalledWith(expect.objectContaining({ contract: GAME_DATA_CONTRACT, etag: '"e1"' }))
    expect(saveCopy.mock.invocationCallOrder[0]).toBeGreaterThan(jest.mocked(files.download).mock.invocationCallOrder[1]!)
    expect(assetFilesTable.get().files.map((f) => f.path)).toEqual(['bosses/a.webp', 'items/b.webp'])
    expect(getGameDataStatus().phase).toBe('ready')
  })

  it('그림 하나라도 못 받으면 실패로 남고 사본도 표도 그대로다. 다시 시도하면 묻지 않고 받는다', async () => {
    fetchRemote.mockResolvedValue(응답([file('bosses/a.webp', SHA_A)]))
    jest.mocked(files.download).mockRejectedValueOnce(new Error('offline'))
    const before = currentGameData()

    await 확인하며(startGameData)

    expect(getGameDataStatus().phase).toBe('failed')
    expect(saveCopy).not.toHaveBeenCalled()
    expect(currentGameData()).toEqual(before)

    await retryGameData()
    expect(getGameDataStatus().phase).toBe('ready')
  })

  it('응답을 못 받거나 칸 하나라도 계약을 어기면 실패다', async () => {
    fetchRemote.mockResolvedValue(null)
    await startGameData()
    expect(getGameDataStatus().phase).toBe('failed')

    const broken = 응답([file('bosses/a.webp', SHA_A)])
    if (broken.kind === 'ok') broken.sections = { ...broken.sections, mvpGrades: null } as never
    fetchRemote.mockResolvedValue(broken)
    await retryGameData()
    expect(getGameDataStatus().phase).toBe('failed')
  })

  it('받는 동안 진행에 게임 데이터 크기와 받은 그림 바이트가 쌓인다', async () => {
    fetchRemote.mockResolvedValue(응답([file('bosses/a.webp', SHA_A, 300), file('items/b.webp', SHA_B, 700)]))
    files = fakeFiles([`${SHA_A}.webp`])
    setAssetFilesPort(files)

    await 확인하며(startGameData)

    // 이미 있는 그림은 다시 받지 않고 받을 양에서도 뺀다.
    expect(files.downloads).toEqual([`https://test/assets/${SHA_B}.webp`])
    expect(getGameDataStatus().progress).toEqual({ dataBytes: 1000, imageBytes: 700, imageTotal: 700 })
  })
})

describe('사본이 있을 때', () => {
  const copy = (contract = GAME_DATA_CONTRACT) => {
    const sections = { ...INITIAL_GAME_DATA, assets: { updatedAt: 't', files: [file('bosses/a.webp', SHA_A)] } }
    return { contract, etag: '"e0"', sections: sections as unknown as Record<string, unknown> }
  }

  it('잠그지 않고 사본으로 연 뒤 ETag 로 묻고, 304 면 아무것도 쓰지 않는다', async () => {
    loadCopy.mockResolvedValue(copy())
    fetchRemote.mockResolvedValue({ kind: 'not-modified' })

    await startGameData()
    await refreshGameData()

    expect(getGameDataStatus().phase).toBe('ready')
    expect(fetchRemote).toHaveBeenCalledWith('"e0"')
    expect(saveCopy).not.toHaveBeenCalled()
  })

  it('서버 값이 바뀌면 조용히 받아 한 번에 바꾸고, 목록에서 빠진 옛 그림 파일을 지운다', async () => {
    loadCopy.mockResolvedValue(copy())
    files = fakeFiles([`${SHA_A}.webp`])
    setAssetFilesPort(files)
    fetchRemote.mockResolvedValue({ kind: 'not-modified' })
    await startGameData()

    fetchRemote.mockResolvedValue(응답([file('bosses/a.webp', SHA_B)], 't2', '"e2"'))
    await refreshGameData()

    expect(worldsTable.get().updatedAt).toBe('t2')
    expect(saveCopy).toHaveBeenLastCalledWith(expect.objectContaining({ etag: '"e2"' }))
    expect([...files.names]).toEqual([`${SHA_B}.webp`])
    expect(getGameDataStatus().phase).toBe('ready')
  })

  it('조용히 받다 실패하면 알리지 않고 가진 사본을 쓴다', async () => {
    loadCopy.mockResolvedValue(copy())
    fetchRemote.mockResolvedValue(null)

    await startGameData()
    await refreshGameData()

    expect(getGameDataStatus().phase).toBe('ready')
  })

  it('계약 판이 다른 사본은 지우고 잠근 채 처음부터 받는다', async () => {
    loadCopy.mockResolvedValue(copy('옛 판'))
    fetchRemote.mockResolvedValue(응답([file('bosses/a.webp', SHA_A)]))

    await 확인하며(startGameData)

    expect(clearCopy).toHaveBeenCalled()
    expect(fetchRemote).toHaveBeenCalledWith(null)
    expect(getGameDataStatus().phase).toBe('ready')
  })

  it('겹쳐 부른 받기는 한 번만 돈다', async () => {
    loadCopy.mockResolvedValue(copy())
    fetchRemote.mockResolvedValue({ kind: 'not-modified' })
    await startGameData()
    fetchRemote.mockClear()

    await Promise.all([refreshGameData(), refreshGameData()])

    expect(fetchRemote).toHaveBeenCalledTimes(1)
  })
})

describe('useGameTable', () => {
  it('그 칸이 바뀔 때만 다시 그린다', async () => {
    let renders = 0
    const { result } = await renderHook(() => {
      renders += 1
      return useGameTable('worlds')
    })
    const before = renders

    await act(async () => {
      assetFilesTable.set({ updatedAt: 'x', files: [] })
    })
    expect(renders).toBe(before)

    const next = { ...worldsTable.get(), updatedAt: 'changed' }
    await act(async () => {
      worldsTable.set(next)
    })
    expect(result.current).toBe(next)
  })
})

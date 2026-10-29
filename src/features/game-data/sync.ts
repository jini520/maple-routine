/**
 * 게임 데이터와 그림을 받아 기기에 두고 표를 바꾸는 흐름.
 *
 * - 켤 때 기기 사본이 있으면 그것으로 표를 세우고 바로 연다. 그 뒤 ETag 로 서버에 묻고, 바뀌었으면 조용히 받는다.
 * - 사본이 없거나 계약 판이 다르면 잠근다(`phase` 가 `ready` 가 아니다). 게임 데이터를 받아 받을 크기를 보이고, `확인` 뒤에
 *   그림을 받는다. 다 받으면 풀린다.
 * - 데이터와 그림을 다 받은 뒤 사본을 한 트랜잭션으로 쓰고, 그다음 표를 한 번에 바꾼다. 데이터만 새것이고 그림은 옛것인
 *   상태를 화면에 내지 않는다.
 */
import { useSyncExternalStore } from 'react'

import { setAssetBaseUri } from '../../lib/assets/asset-files'
import { GAME_DATA_CONTRACT, INITIAL_GAME_DATA, SECTIONS } from '../../lib/game-data/sections'
import { assetFileUrl, fetchGameData } from '../../server/game-data'
import {
  clearGameDataCopy,
  loadGameDataCopy,
  removeLegacyGameDataCopies,
  saveGameDataCopy,
} from '../../storage/game-data-copy'
import { getAssetFilesPort } from '../../storage/ports'
import { GAME_DATA_SECTIONS, type AssetFilesTable, type GameData, type GameDataSection } from '../../types/game-data'

/** `checking` 은 사본을 읽는 짧은 순간이다. `confirm` 은 받기 전 확인이다. `ready` 가 아니면 화면을 열지 않는다. */
export type GameDataPhase = 'checking' | 'confirm' | 'downloading' | 'failed' | 'ready'

export interface GameDataProgress {
  /** 받은 게임 데이터 바이트. 아직 받는 중이면 `null` */
  dataBytes: number | null
  /** 받은 그림 바이트 */
  imageBytes: number
  /** 받아야 할 그림 바이트. 이미 기기에 있는 그림은 빠진다 */
  imageTotal: number
}

export interface GameDataStatus {
  phase: GameDataPhase
  progress: GameDataProgress
}

const NO_PROGRESS: GameDataProgress = { dataBytes: null, imageBytes: 0, imageTotal: 0 }

/** 동시에 받는 그림 수. 너무 많으면 느린 망에서 하나하나가 늦어져 진행이 멈춘 것처럼 보인다. */
const CONCURRENCY = 4

let status: GameDataStatus = { phase: 'checking', progress: NO_PROGRESS }
const listeners = new Set<() => void>()
let etag: string | null = null
let running: Promise<void> | null = null
/** 한 번 확인하면 `다시 시도` 는 다시 묻지 않는다. */
let confirmed = false
let resolveConfirm: (() => void) | null = null

function setStatus(next: GameDataStatus): void {
  status = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGameDataStatus(): GameDataStatus {
  return status
}

/** 잠금 화면이 구독하는 상태. */
export function useGameDataStatus(): GameDataStatus {
  return useSyncExternalStore(subscribe, getGameDataStatus)
}

/**
 * 표 하나를 구독하는 훅. 그 칸이 바뀔 때만 다시 그린다.
 *
 * 값은 조회 모듈이 읽는 표와 같은 객체다. 화면은 대개 값을 쓰지 않고 다시 그릴 때를 알기 위해 부른다.
 *
 * @example const catalog = useGameTable('bosses')
 */
export function useGameTable<K extends GameDataSection>(section: K): GameData[K] {
  const table = SECTIONS[section].table
  return useSyncExternalStore(table.subscribe, table.get)
}

/** 칸 열일곱이 전부 계약을 지키면 그 값, 하나라도 어기거나 빠지면 `null`. 표 하나가 빈 채로 화면을 열 수 없다. */
function parseAll(sections: Partial<Record<GameDataSection, unknown>>): GameData | null {
  const data: Partial<Record<GameDataSection, unknown>> = {}
  for (const key of GAME_DATA_SECTIONS) {
    const value = SECTIONS[key].parse(sections[key])
    if (value === null) return null
    data[key] = value
  }
  return data as GameData
}

/** 표 열일곱을 한 번에 바꾼다. 사이에 렌더가 끼지 않게 같은 틱에서 돈다. */
function apply(data: GameData): void {
  for (const key of GAME_DATA_SECTIONS) (SECTIONS[key].table as { set(next: unknown): void }).set(data[key])
}

/** 기기에 없는 그림. 같은 파일을 가리키는 경로가 여럿이면 한 번만 센다. */
async function missingImages(assets: AssetFilesTable): Promise<AssetFilesTable['files']> {
  const present = new Set(await getAssetFilesPort().list())
  return [...new Map(assets.files.filter((f) => !present.has(f.file)).map((f) => [f.file, f])).values()]
}

function bytesOf(files: AssetFilesTable['files']): number {
  return files.reduce((sum, f) => sum + f.size, 0)
}

/** 그림을 받는다. 하나라도 실패하면 던진다. */
async function downloadImages(
  needed: AssetFilesTable['files'],
  onBytes: (bytes: number, total: number) => void,
): Promise<void> {
  const port = getAssetFilesPort()
  const total = bytesOf(needed)
  let done = 0
  onBytes(0, total)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < needed.length) {
      const file = needed[next]!
      next += 1
      await port.download(assetFileUrl(file.file), file.file, file.sha256)
      done += file.size
      onBytes(done, total)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, needed.length) }, worker))
}

/** 목록에 없는 파일을 지운다. 실패해도 다음 정리 때 다시 지운다. */
async function pruneImages(assets: AssetFilesTable): Promise<void> {
  const port = getAssetFilesPort()
  const keep = new Set(assets.files.map((f) => f.file))
  for (const name of await port.list()) if (!keep.has(name)) await port.remove(name).catch(() => undefined)
}

/**
 * 받아서 바꾼다. 잠근 채(`locked`)면 진행을 알리고 실패를 `failed` 로 남긴다. 아니면 조용히 돌고 실패해도 가진 사본을 쓴다.
 * 겹쳐 부르면 돌고 있는 것을 기다린다.
 */
function download(locked: boolean): Promise<void> {
  if (running !== null) return running
  running = (async () => {
    if (locked) setStatus({ phase: confirmed ? 'downloading' : 'confirm', progress: NO_PROGRESS })
    try {
      const result = await fetchGameData(locked ? null : etag)
      if (result === null) throw new Error('게임 데이터를 받지 못했습니다')
      if (result.kind === 'not-modified') return
      const data = parseAll(result.sections)
      if (data === null) throw new Error('게임 데이터가 계약을 어겼습니다')
      const needed = await missingImages(data.assets)
      if (locked && !confirmed) {
        setStatus({ phase: 'confirm', progress: { dataBytes: result.bytes, imageBytes: 0, imageTotal: bytesOf(needed) } })
        await new Promise<void>((resolve) => {
          resolveConfirm = resolve
        })
        confirmed = true
      }
      if (locked) setStatus({ phase: 'downloading', progress: { ...NO_PROGRESS, dataBytes: result.bytes } })
      await downloadImages(needed, (imageBytes, imageTotal) => {
        if (locked) setStatus({ phase: 'downloading', progress: { dataBytes: result.bytes, imageBytes, imageTotal } })
      })
      const raw = Object.fromEntries(GAME_DATA_SECTIONS.map((key) => [key, result.raw[key]]))
      await saveGameDataCopy({ contract: GAME_DATA_CONTRACT, etag: result.etag, sections: raw })
      apply(data)
      etag = result.etag
      void pruneImages(data.assets).catch(() => undefined)
      if (locked) setStatus({ phase: 'ready', progress: status.progress })
    } catch {
      if (locked) setStatus({ phase: 'failed', progress: status.progress })
    } finally {
      running = null
    }
  })()
  return running
}

/**
 * 켤 때 한 번. 포트 주입 뒤에 부른다. **던지지 않는다.**
 *
 * 사본이 있으면 열고 나서 조용히 묻는다. 없거나 읽을 수 없으면 잠근 채 받는다.
 */
export async function startGameData(): Promise<void> {
  setAssetBaseUri(getAssetFilesPort().directoryUri())
  await removeLegacyGameDataCopies().catch(() => undefined)
  const copy = await loadGameDataCopy().catch(() => null)
  const data = copy?.contract === GAME_DATA_CONTRACT ? parseAll(copy.sections) : null
  if (copy !== null && data !== null) {
    apply(data)
    etag = copy.etag
    setStatus({ phase: 'ready', progress: NO_PROGRESS })
    void refreshGameData()
    return
  }
  if (copy !== null) await clearGameDataCopy().catch(() => undefined)
  await download(true)
}

/** 받기 전 확인 패널의 `확인`. 크기를 보이기 전에 누르면 아무것도 안 한다. */
export function confirmGameData(): void {
  const resolve = resolveConfirm
  resolveConfirm = null
  resolve?.()
}

/** 잠금 화면의 `다시 시도`. */
export function retryGameData(): Promise<void> {
  return download(true)
}

/** 앱을 켜 둔 동안 서버 값이 바뀌었는지 묻는다. 백그라운드에서 돌아올 때 부른다. 잠겨 있으면 아무것도 안 한다. */
export function refreshGameData(): Promise<void> {
  if (status.phase !== 'ready') return running ?? Promise.resolve()
  return download(false)
}

/** 기억한 ETag 를 버리는 함수. 다음 받기는 바뀌었나를 묻지 않고 전부 받는다. */
export function forgetGameDataEtag(): void {
  etag = null
}

/** 테스트 전용. 상태와 표를 첫 값으로 되돌린다. */
export function __resetGameDataSyncForTest(): void {
  status = { phase: 'checking', progress: NO_PROGRESS }
  listeners.clear()
  etag = null
  running = null
  confirmed = false
  resolveConfirm = null
  apply(INITIAL_GAME_DATA)
}

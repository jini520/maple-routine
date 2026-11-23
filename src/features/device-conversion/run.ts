/**
 * 1.0.15 기기 변환을 부팅에서 한 번 돌리는 흐름. 새 게임 데이터가 준비되고 점검 잠금이 풀려 있으면 변환을 돌리고, 끝날 때까지
 * 기록 표와 Preferences 에 든 기록의 접근을 막는다.
 *
 * 화면은 `useDeviceConversionStatus` 를 구독해 끝나기 전에는 앱을 열지 않는다. 새 앱 코드는 옛 모양의 기록을 읽지 못한다.
 */
import { useSyncExternalStore } from 'react'

import { mainNexonAccountIdOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import {
  isPreferencesConversionDone,
  PreferencesConversionError,
  runPreferencesConversion,
} from '../../storage/preferences-conversion'
import { holdRecordsUntil } from '../../storage/record-hold'
import type { SqliteDbConnection } from '../../storage/ports'
import { getBossProfitDbUngated } from '../../storage/sqlite/db'
import {
  DEVICE_CONVERSION_VERSION,
  DeviceConversionError,
  deviceConversionVersionOf,
  runDeviceConversion,
  type DeviceConversionContext,
} from '../../storage/sqlite/device-conversion'
import { resolveDisplayRepresentative } from '../character-manage/derivations'
import { whenGameDataReady } from '../game-data/sync'
import { whenServerMaintenanceUnlocked } from '../server-maintenance/store'
import { reportUsageActionNow } from '../usage-log/flush'

/** `running` 은 게임 데이터나 점검이 풀리기를 기다리거나 변환하는 중이다. `failed` 면 `다시 시도` 를 기다린다. */
export type DeviceConversionPhase = 'running' | 'failed' | 'done'

let phase: DeviceConversionPhase = 'running'
const listeners = new Set<() => void>()
let release: () => void = () => {}
let attempt: Promise<void> | null = null

function setPhase(next: DeviceConversionPhase): void {
  phase = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDeviceConversionPhase(): DeviceConversionPhase {
  return phase
}

/** 셸이 구독하는 단계. */
export function useDeviceConversionStatus(): DeviceConversionPhase {
  return useSyncExternalStore(subscribe, getDeviceConversionPhase)
}

/**
 * 단계가 쓰는 Preferences 의 값. 메인 넥슨 계정과 화면이 대표로 세우는 캐릭터다. 이 값이 든 키는 변환이 바꾸지 않아 기록 막기와
 * 상관없이 읽힌다. 기록을 거치는 조회(`getBossProfitDb()` · 변환한 키의 저장소)는 변환이 끝나기를 기다려 여기서 부르면 멈춘다.
 */
async function conversionContextOf(): Promise<DeviceConversionContext> {
  const [config, stored, tracked] = await Promise.all([
    getAuthConfig(),
    getRepresentativeCharacter(),
    getTrackedCharacterOcids(),
  ])
  return {
    mainNexonAccountId: mainNexonAccountIdOf(config),
    representativeOcid: resolveDisplayRepresentative(tracked ?? [], stored),
  }
}

/** 돌 것이 남았는가. SQLite 단계와 Preferences 변환 가운데 하나라도 안 돌았으면 참. */
async function hasPendingConversion(db: SqliteDbConnection): Promise<boolean> {
  if ((await deviceConversionVersionOf(db)) < DEVICE_CONVERSION_VERSION) return true
  return !(await isPreferencesConversionDone())
}

/** 사용 로그에 적는 멈춘 단계. SQLite 단계는 번호, Preferences 단계는 `preferences`, 그 밖(사본 · DB 열기)은 0 이다. */
function failedStepOf(error: unknown): number | 'preferences' {
  if (error instanceof DeviceConversionError) return error.step
  return error instanceof PreferencesConversionError ? 'preferences' : 0
}

/**
 * 겹쳐 부르면 도는 것을 기다린다. SQLite 변환이 끝난 뒤 Preferences 변환을 돈다. 실패하면 멈춘 단계를 사용 로그로 곧바로 보낸다.
 * 던지지 않는다.
 *
 * 돌 것이 남았으면 점검 잠금이 풀리기를 기다린다. 점검 중에는 새 서버가 아직 없다. 돌 것이 없으면 묻지 않는다. 부팅마다 점검의
 * 답을 기다리면 느린 망에서 모든 부팅이 늦어진다.
 */
function convert(): Promise<void> {
  attempt ??= (async () => {
    setPhase('running')
    try {
      await whenGameDataReady()
      const db = await getBossProfitDbUngated()
      if (await hasPendingConversion(db)) await whenServerMaintenanceUnlocked()
      const context = await conversionContextOf()
      await runDeviceConversion(db, { context })
      await runPreferencesConversion(db)
      setPhase('done')
      release()
    } catch (error: unknown) {
      setPhase('failed')
      await reportUsageActionNow(`device-conversion-failed:${failedStepOf(error)}`)
    } finally {
      attempt = null
    }
  })()
  return attempt
}

/**
 * 부팅에서 한 번. 기록 접근을 막고, 게임 데이터가 준비되고 점검 잠금이 풀려 있으면 변환을 돌린다. 저장소를 건드리는 어떤 부팅
 * 단계보다 먼저 부른다. 결과를 안 기다린다.
 *
 * @example startDeviceConversion()
 */
export function startDeviceConversion(): void {
  holdRecordsUntil(
    new Promise<void>((resolve) => {
      release = resolve
    }),
  )
  void convert()
}

/** 실패 패널의 `다시 시도`. */
export function retryDeviceConversion(): Promise<void> {
  return convert()
}

/** 테스트 전용. 단계를 처음으로 되돌리고 기록 막기를 푼다. */
export function __resetDeviceConversionForTest(): void {
  phase = 'running'
  listeners.clear()
  attempt = null
  release = () => {}
  holdRecordsUntil(Promise.resolve())
}

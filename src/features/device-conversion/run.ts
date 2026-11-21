/**
 * 1.0.15 기기 변환을 부팅에서 한 번 돌리는 흐름. 새 게임 데이터가 준비되면 변환을 돌리고, 끝날 때까지 기록 표 접근을 막는다.
 *
 * 화면은 `useDeviceConversionStatus` 를 구독해 끝나기 전에는 앱을 열지 않는다. 새 앱 코드는 옛 모양의 기록 표를 읽지 못한다.
 */
import { useSyncExternalStore } from 'react'

import { mainNexonAccountIdOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import { getRepresentativeCharacter, getTrackedCharacterOcids } from '../../storage/character-selection'
import { holdRecordTablesUntil, getBossProfitDbUngated } from '../../storage/sqlite/db'
import {
  DeviceConversionError,
  runDeviceConversion,
  type DeviceConversionContext,
} from '../../storage/sqlite/device-conversion'
import { resolveDisplayRepresentative } from '../character-manage/derivations'
import { whenGameDataReady } from '../game-data/sync'
import { reportUsageActionNow } from '../usage-log/flush'

/** `running` 은 게임 데이터를 기다리거나 변환하는 중이다. `failed` 면 `다시 시도` 를 기다린다. */
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
 * 단계가 쓰는 Preferences 의 값. 메인 넥슨 계정과 화면이 대표로 세우는 캐릭터다. Preferences 는 기록 표 막기와 상관없이 읽힌다.
 * 기록 표를 거치는 조회(`getBossProfitDb()`)는 변환이 끝나기를 기다려 여기서 부르면 멈춘다.
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

/** 겹쳐 부르면 도는 것을 기다린다. 실패하면 단계 번호를 사용 로그로 곧바로 보낸다. 던지지 않는다. */
function convert(): Promise<void> {
  attempt ??= (async () => {
    setPhase('running')
    try {
      await whenGameDataReady()
      const context = await conversionContextOf()
      await runDeviceConversion(await getBossProfitDbUngated(), { context })
      setPhase('done')
      release()
    } catch (error: unknown) {
      setPhase('failed')
      await reportUsageActionNow(`device-conversion-failed:${error instanceof DeviceConversionError ? error.step : 0}`)
    } finally {
      attempt = null
    }
  })()
  return attempt
}

/**
 * 부팅에서 한 번. 기록 표 접근을 막고, 게임 데이터가 준비되면 변환을 돌린다. 저장소를 건드리는 어떤 부팅 단계보다 먼저 부른다.
 * 결과를 안 기다린다.
 *
 * @example startDeviceConversion()
 */
export function startDeviceConversion(): void {
  holdRecordTablesUntil(
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

/** 테스트 전용. 단계를 처음으로 되돌리고 기록 표 막기를 푼다. */
export function __resetDeviceConversionForTest(): void {
  phase = 'running'
  listeners.clear()
  attempt = null
  release = () => {}
  holdRecordTablesUntil(Promise.resolve())
}

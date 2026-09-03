import { closeBossProfitDb } from '../storage/sqlite/db'
import { getLiveUpdatePort, type LiveUpdateCheckResult, type NetworkType } from './ports'
import { showSplashScreen } from './splash-screen'

/**
 * OTA 의 **정책** 층.
 *
 * 여기 있던 것 중 프로토콜에 속한 것. 매니페스트 URL·`parseLiveUpdateManifest`·조회·비교.
 * 은 전부 **어댑터로 갔다**.
 * `expo-updates` 것은 `app-rn/native/adapters/rn-live-update.ts`). 지우는 것이 아니라 **옮긴 것**이라
 * capacitor 앱은 계속 돈다. 전환이 끝날 때까지 스토어에 있는 것은 아직 그 앱이다.
 *
 * 남은 것은 프로토콜을 안 타는 둘뿐이다:
 * - `isNewerVersion`. 순수 버전 비교. 스토어의 완료 안내 판정이 쓴다.
 * - `applyLiveUpdate`. **적용 순서**. 아래 주석 참고.
 */

/**
 * `x.y.z` 세 자리를 비교해 후보가 더 새것인가.
 *
 * 세 자리가 아니거나 숫자가 아니면 `false` 다. 네이티브 `versionName` 이 `1.0` 두 자리면 OTA
 * 가 한 번도 작동하지 않는 버그가 실제로 있었다. 파싱 못 하면 새것이 아니다 로 닫아 둔다.
 * 모르는 값을 새것으로 치면 그 순간 잘못된 번들이 나간다.
 */
export function isNewerVersion(current: string, candidate: string): boolean {
  const parse = (value: string): number[] | null => {
    const parts = value.split('.').map(Number)
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null
    return parts
  }

  const currentParts = parse(current)
  const candidateParts = parse(candidate)
  if (!currentParts || !candidateParts) return false

  for (let i = 0; i < 3; i++) {
    if (candidateParts[i] !== currentParts[i]) return candidateParts[i] > currentParts[i]
  }
  return false
}

export async function notifyLiveUpdateReady(): Promise<void> {
  await getLiveUpdatePort().notifyAppReady()
}

/**
 * 현재 실행 중인 번들 버전. OTA 적용 후 값이 바뀌므로 관찰용 UI에서 반영의 "증거"가 된다.
 * 라이브 업데이트 런타임이 없는 환경(web/개발 서버)에서는 `null` 을 반환한다.
 */
export async function getCurrentBundleVersion(): Promise<string | null> {
  const port = getLiveUpdatePort()
  if (!port.isSupported()) return null
  return port.getCurrentVersion()
}

/** 빌드 시점에 고정된 채널 표시값. */
export function getLiveUpdateChannel(): string {
  return getLiveUpdatePort().getChannel()
}

/**
 * 체크만 하는 조회. 다운로드는 하지 않는다.
 *
 * 지원하지 않는 환경을 **여기서** 거르는 이유는 `isSupported()` 가 동기라서다. 네트워크가 나가기
 * 전에 판정된다.
 */
export async function checkForLiveUpdate(): Promise<LiveUpdateCheckResult> {
  const port = getLiveUpdatePort()
  if (!port.isSupported()) return { kind: 'unsupported' }
  try {
    return await port.check()
  } catch {
    return { kind: 'error' }
  }
}

/**
 * 사용자 동의 후의 번들 다운로드. 진행률(0~100)을 `onProgress` 로 흘린다.
 *
 * **받는 것과 적용하는 것이 갈려 있다는 것이 다**. 받아도 자동으로 적용되지
 * 않고, 적용은 `applyLiveUpdate` 로 사용자가 명시적으로 한다.
 */
export async function downloadLiveUpdate(onProgress: (percent: number) => void): Promise<void> {
  await getLiveUpdatePort().download(onProgress)
}

/**
 * 내려받아 둔 번들의 즉시 적용. 적용은 JS 컨텍스트를 파괴하고 재로드하므로 이후 코드는
 * 실행되지 않는다.
 *
 * 순서는 닫기 → 커버 → 적용이다. 커버가 닫기 뒤인 것이 요점이다. 먼저 올리면 닫기가 매달릴 때
 * 사용자가 브랜드 주황 스플래시에 갇힌다. 커버의 목적은 리로드 동안 네이티브 배경색이 드러나는
 * 것을 덮는 것이지 그 앞의 준비 작업까지 덮는 것이 아니다.
 *
 * 셋을 한 함수가 순서대로 책임진다. 나눠 가지면 순서가 곧 결함이었다 는 사실을 다음 사람이
 * 두 곳에서 읽어야 한다.
 *
 * SQLite 커넥션을 먼저 닫는 것은, 안 닫으면 리로드로 JS 쪽 캐시만 초기화되고 네이티브
 * 커넥션은 stale 하게 남아 재로드 후 첫 쿼리가 응답 없이 멈추기 때문이다. `closeBossProfitDb`
 * 는 던지지 않고 5초 안에 끝난다. 전체를 덮는 12초 타임아웃과 실패 시 화면 복구는 호출부가
 * 한 곳에서 맡는다.
 */
export async function applyLiveUpdate(): Promise<void> {
  await closeBossProfitDb()
  // 커버 표시 실패가 적용을 막으면 안 된다. 시각적 장치 때문에 적용에 도달 못 하면 본말전도다.
  await showSplashScreen().catch(() => {})
  await getLiveUpdatePort().apply()
}

export type { NetworkType, LiveUpdateCheckResult }

/**
 * 현재 네트워크 종류. 셀룰러면 다운로드 전에 데이터 사용 경고를 띄운다.
 * 조회에 실패하면 `'unknown'` 으로 폴백해 경고를 생략한다. 알 수 없다는 이유로 다운로드를 막지 않는다.
 */
export async function getNetworkType(): Promise<NetworkType> {
  try {
    return await getLiveUpdatePort().getNetworkType()
  } catch {
    return 'unknown'
  }
}

/** 스토어 업데이트가 필요할 때 스토어로 보내는 이동. */
export function openStoreForUpdate(): void {
  getLiveUpdatePort().openStore()
}

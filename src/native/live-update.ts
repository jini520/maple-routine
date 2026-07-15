import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { Network } from '@capacitor/network'

// scripts/publish-live-update.mjs가 이 저장소의 "live-update-latest" 릴리스에 latest.json을 올린다(ADR-022).
export const LIVE_UPDATE_MANIFEST_URL =
  'https://github.com/jini520/maple-routine/releases/download/live-update-latest/latest.json'

// 베타 채널은 별도 고정 릴리스 태그("live-update-beta")로 배포된다 — 빌드 시점 분리, 런타임 토글 없음(ADR-024).
export const LIVE_UPDATE_MANIFEST_URL_BETA =
  'https://github.com/jini520/maple-routine/releases/download/live-update-beta/latest.json'

const APP_ID = 'com.mapleroutine.app'
// TODO(출시): 실제 App Store 앱 ID로 교체. 아직 스토어 미출시라 placeholder다(ADR-024/ADR-027).
const APP_STORE_ID = '0000000000'

export interface LiveUpdateManifest {
  version: string
  url: string
  checksum: string
  size: number // zip 바이트 — 다운로드 전 사용자에게 용량을 안내(ADR-027)
  minNativeVersion?: string // 이 번들을 적용하려면 필요한 최소 네이티브 버전(스토어 업데이트 게이트, ADR-027)
}

export function resolveLiveUpdateManifestUrl(channel: string | undefined): string {
  return channel === 'beta' ? LIVE_UPDATE_MANIFEST_URL_BETA : LIVE_UPDATE_MANIFEST_URL
}

// GitHub Releases의 CDN은 자산을 application/octet-stream으로 내려주므로, CapacitorHttp가
// content-type을 보고 JSON으로 자동 파싱하지 않고 response.data를 "문자열" 그대로 준다(iOS 실측, ADR-026).
// 문자열이면 직접 파싱하고, 이미 객체면 그대로 쓴다. 형식이 어긋나면 null을 돌려 조용히 중단한다.
export function parseLiveUpdateManifest(data: unknown): LiveUpdateManifest | null {
  let parsed: unknown
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data
  } catch {
    return null
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as LiveUpdateManifest).version === 'string' &&
    typeof (parsed as LiveUpdateManifest).url === 'string' &&
    typeof (parsed as LiveUpdateManifest).checksum === 'string' &&
    typeof (parsed as LiveUpdateManifest).size === 'number'
  ) {
    const minNativeVersion = (parsed as LiveUpdateManifest).minNativeVersion
    return {
      version: (parsed as LiveUpdateManifest).version,
      url: (parsed as LiveUpdateManifest).url,
      checksum: (parsed as LiveUpdateManifest).checksum,
      size: (parsed as LiveUpdateManifest).size,
      ...(typeof minNativeVersion === 'string' ? { minNativeVersion } : {}),
    }
  }
  return null
}

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
  await CapacitorUpdater.notifyAppReady()
}

// 현재 실행 중인 번들 버전 — OTA 적용 후 값이 바뀌므로 관찰용 UI에서 반영의 "증거"가 된다(ADR-026).
// web/개발 서버에는 네이티브 플러그인이 없으므로 null을 반환한다.
export async function getCurrentBundleVersion(): Promise<string | null> {
  if (Capacitor.getPlatform() === 'web') return null
  const { bundle } = await CapacitorUpdater.current()
  return bundle.version
}

// checkForLiveUpdate 결과 — 부팅/수동 체크가 공유한다. "체크만" 하고 다운로드는 하지 않는다(ADR-027 결정 1).
export type LiveUpdateCheckResult =
  | { kind: 'unsupported' } // web 등 네이티브 미지원 플랫폼
  | { kind: 'error' } // 매니페스트 조회·파싱 실패
  | { kind: 'up-to-date' } // 최신
  | { kind: 'store-required'; version: string; minNativeVersion: string } // 라이브로 못 받음 → 스토어 업데이트 필요
  | { kind: 'update-available'; version: string; size: number; url: string; checksum: string } // 라이브 다운로드 가능

export async function checkForLiveUpdate(manifestUrl: string): Promise<LiveUpdateCheckResult> {
  if (Capacitor.getPlatform() === 'web') return { kind: 'unsupported' }

  try {
    // latest.json은 URL 고정·내용 가변이라 캐시(iOS URLSession·CDN 엣지)가 옛 버전을 돌려줄 수 있다 →
    // 유니크 쿼리 파라미터 + no-cache로 모든 캐시 층 우회(ADR-026). CORS는 CapacitorHttp가 네이티브 요청이라 무관.
    const response = await CapacitorHttp.get({
      url: manifestUrl,
      params: { t: String(Date.now()) },
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (response.status < 200 || response.status >= 300) return { kind: 'error' }
    const manifest = parseLiveUpdateManifest(response.data)
    if (manifest === null) return { kind: 'error' }

    const { bundle, native } = await CapacitorUpdater.current()
    if (!isNewerVersion(bundle.version, manifest.version)) return { kind: 'up-to-date' }

    // 새 번들이 요구하는 네이티브 버전이 설치본보다 높으면 라이브로 못 받는다 → 스토어 업데이트(ADR-027 결정 7).
    if (manifest.minNativeVersion && isNewerVersion(native, manifest.minNativeVersion)) {
      return { kind: 'store-required', version: manifest.version, minNativeVersion: manifest.minNativeVersion }
    }

    return {
      kind: 'update-available',
      version: manifest.version,
      size: manifest.size,
      url: manifest.url,
      checksum: manifest.checksum,
    }
  } catch {
    return { kind: 'error' }
  }
}

// 사용자 동의 후 번들을 내려받는다. 진행률(0~100)을 onProgress로 흘리고, next()로 큐잉하지 않아
// 자동 적용되지 않는다 — 적용은 applyDownloadedLiveUpdate로 사용자가 명시적으로 한다(ADR-027 결정 4).
export async function downloadLiveUpdate(
  params: { url: string; version: string; checksum: string },
  onProgress: (percent: number) => void,
): Promise<{ id: string }> {
  const handle = await CapacitorUpdater.addListener('download', (state) => {
    if (state.bundle?.version === params.version) onProgress(state.percent)
  })
  try {
    const downloaded = await CapacitorUpdater.download(params)
    return { id: downloaded.id }
  } finally {
    await handle.remove()
  }
}

// 내려받아 둔 번들을 즉시 적용한다(set은 JS 컨텍스트를 파괴하고 재로드 — 이후 코드는 실행되지 않음, ADR-027).
export async function applyDownloadedLiveUpdate(id: string): Promise<void> {
  await CapacitorUpdater.set({ id })
}

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown'

// 현재 네트워크 종류 — 셀룰러면 다운로드 전에 데이터 사용 경고를 띄운다(ADR-027 결정 6).
// web/구버전 네이티브 셸엔 플러그인이 없어 'unknown'으로 폴백(경고 생략).
export async function getNetworkType(): Promise<NetworkType> {
  if (Capacitor.getPlatform() === 'web') return 'unknown'
  try {
    const status = await Network.getStatus()
    return status.connectionType as NetworkType
  } catch {
    return 'unknown'
  }
}

// 스토어 업데이트가 필요할 때 스토어로 보낸다(ADR-027 결정 7). window.open(_system)은 Capacitor가
// 외부 앱/브라우저로 넘겨 플러그인이 필요 없다. 아직 미출시라 URL/ID는 placeholder.
export function openStoreForUpdate(): void {
  const url =
    Capacitor.getPlatform() === 'ios'
      ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`
      : `market://details?id=${APP_ID}`
  window.open(url, '_system')
}

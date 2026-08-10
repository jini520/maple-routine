import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { Network } from '@capacitor/network'
import { closeBossProfitDb } from '../storage/sqlite/db'
import { showSplashScreen } from './splash-screen'

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
  // 이 버전의 **핵심 목록** 3~4줄(ADR-119 → ADR-126 결정 2). 원천은 src/data/release-notes.ts 한
  // 벌이고, 배포 스크립트가 배포하는 버전의 highlights 만 뽑아 여기로 파생시킨다 — 여기서 그 파일을
  // 읽지 않는다(원격에서 온 값이다). 항목 전체가 아닌 이유는 이 값을 읽는 자리가 **받기 전 모달**,
  // 즉 "받을까 말까"를 정하는 자리라서다. 전체는 받은 뒤 개발 노트 화면이 번들 안에서 읽는다.
  //
  // minNativeVersion과 같은 이유로 **선택 필드**다: 이미 발행된 옛 매니페스트에는 이 필드가 없고,
  // 필수로 만들면 그것을 읽는 기존 설치본이 전부 파싱 실패(null → check-error)해 업데이트를 못 받는다.
  // 매니페스트는 URL 고정·내용 가변이라 옛 앱이 새 파일을, 새 앱이 옛 파일을 읽는 조합이 둘 다 실재한다.
  // (옛 매니페스트의 notes 필드는 ADR-126 결정 2로 폐기됐다 — 읽는 쪽이 없으므로 싣지 않는다.)
  highlights?: string[]
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
    const highlights = (parsed as LiveUpdateManifest).highlights
    // 빈 배열은 "핵심 목록이 없다"와 같게 다룬다 — 실어 보내면 모달이 빈 목록을 여는 버튼을 그린다.
    const hasHighlights =
      Array.isArray(highlights) && highlights.length > 0 && highlights.every((line) => typeof line === 'string')
    return {
      version: (parsed as LiveUpdateManifest).version,
      url: (parsed as LiveUpdateManifest).url,
      checksum: (parsed as LiveUpdateManifest).checksum,
      size: (parsed as LiveUpdateManifest).size,
      ...(typeof minNativeVersion === 'string' ? { minNativeVersion } : {}),
      ...(hasHighlights ? { highlights } : {}),
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
  // 라이브 다운로드 가능. highlights는 받기 전 모달의 「자세히 보기」가 그리는 핵심 목록이다(ADR-126).
  | {
      kind: 'update-available'
      version: string
      size: number
      url: string
      checksum: string
      highlights?: string[]
    }

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
      ...(manifest.highlights ? { highlights: manifest.highlights } : {}),
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
// set() 호출 전에 SQLite 커넥션을 먼저 정상 종료한다 — 안 그러면 리로드로 JS 쪽 캐시만 초기화되고
// 네이티브 커넥션은 stale하게 남아, 재로드 후 첫 쿼리가 응답 없이 멈추는 문제가 있었다(2026-07-17,
// 앱 업데이트 직후 과거 수익 데이터가 안 불러와지는 증상으로 사용자 보고 — storage/sqlite/db.ts의
// closeBossProfitDb 참고).
//
// 순서는 닫기 → 커버 → set() 이다(ADR-117 결정 1). 커버가 닫기 **뒤**인 것이 요점이다 — 먼저 올리면
// 닫기가 매달릴 때 사용자가 브랜드 주황 스플래시에 갇힌다(이슈 #175). 커버의 목적은 ADR-027
// 2026-07-17 추가가 정한 대로 "리로드 동안 웹뷰 네이티브 배경색이 드러나는 것"을 덮는 것이지 그 앞의
// 준비 작업까지 덮는 것이 아니므로, 커버가 떠 있는 구간을 실제 리로드 직전으로 좁힌다.
// 셋을 한 함수가 순서대로 책임진다 — 나눠 가지면 순서 보장이 두 파일로 흩어진다.
// closeBossProfitDb는 던지지 않고 5초 안에 끝난다(ADR-117 결정 5) — 여기서 또 감싸지 않는다.
// 전체를 덮는 12초 타임아웃과 실패 시 화면 복구는 호출부(store)가 한 곳에서 맡는다(같은 결정).
export async function applyDownloadedLiveUpdate(id: string): Promise<void> {
  await closeBossProfitDb()
  // 커버 표시 실패가 적용을 막으면 안 된다 — 시각적 장치 때문에 set()에 도달 못 하면 본말전도다.
  await showSplashScreen().catch(() => {})
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

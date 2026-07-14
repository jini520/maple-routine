import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

// scripts/publish-live-update.mjs가 이 저장소의 "live-update-latest" 릴리스에 latest.json을 올린다(ADR-022).
export const LIVE_UPDATE_MANIFEST_URL =
  'https://github.com/jini520/maple-routine/releases/download/live-update-latest/latest.json'

// 베타 채널은 별도 고정 릴리스 태그("live-update-beta")로 배포된다 — 빌드 시점 분리, 런타임 토글 없음(ADR-024).
export const LIVE_UPDATE_MANIFEST_URL_BETA =
  'https://github.com/jini520/maple-routine/releases/download/live-update-beta/latest.json'

export interface LiveUpdateManifest {
  version: string
  url: string
  checksum: string
}

export function resolveLiveUpdateManifestUrl(channel: string | undefined): string {
  return channel === 'beta' ? LIVE_UPDATE_MANIFEST_URL_BETA : LIVE_UPDATE_MANIFEST_URL
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

export async function checkForLiveUpdate(manifestUrl: string): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return

  try {
    // GitHub Releases 응답에는 Access-Control-Allow-Origin이 없어 WebView의 일반 fetch()는
    // CORS로 차단된다. CapacitorHttp는 네이티브에서 직접 요청해 CORS 적용 대상이 아니다.
    const response = await CapacitorHttp.get({ url: manifestUrl })
    if (response.status < 200 || response.status >= 300) return
    const manifest = response.data as LiveUpdateManifest

    const { bundle } = await CapacitorUpdater.current()
    if (!isNewerVersion(bundle.version, manifest.version)) return

    const downloaded = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      checksum: manifest.checksum,
    })
    await CapacitorUpdater.next({ id: downloaded.id })
  } catch {
    // 백그라운드 점검 실패는 조용히 무시한다 — ADR-008과 동일하게 마지막 상태 유지, 자동 재시도 없음
  }
}

import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { Network } from '@capacitor/network'
import { isNewerVersion } from '@core/native/live-update'
import type { LiveUpdateCheckResult, LiveUpdatePort, NetworkType } from '@core/native/ports'

/**
 * `LiveUpdatePort` 의 Capacitor(@capgo) 구현.
 *
 * **[[ADR-137]] 결정 6 으로 이 파일이 두꺼워졌다.** 매니페스트 URL·형식·파싱·버전 비교는 원래
 * core 의 `native/live-update.ts` 에 있었는데, 그것들이 전부 **@capgo 프로토콜의 것**이라 RN 과
 * 공유할 수 없다는 것이 드러났다(`expo-updates` 는 주소·체크섬·번들 id 를 우리에게 안 보여준다).
 * 그래서 **옮겨 왔다** — 지운 것이 아니라 옮긴 것이라, 전환이 끝날 때까지 스토어에 있는 이 앱은
 * 지금까지와 똑같이 돈다.
 *
 * core 에 남은 것은 «무엇을 하는가»(확인·받기·적용)와 그 위의 UX 정책뿐이다.
 */

const APP_ID = 'com.mapleroutine.app'
// App Store 앱 ID. placeholder(`'0000000000'`) 였던 것을 실제 값으로 고쳤다([[ADR-154]] 결정 6) —
// 그 탓에 iOS 「스토어로 이동」이 죽은 링크였다(Android 는 `market://` 라 무관했다).
//
// **이 수정은 이 번들에 실려야만 한다.** 스토어 유도 게이트가 켜지면 새 번들은 다운로드 자체가
// 안 되므로, 그 뒤에 고쳐 봐야 사용자 기기에는 영영 안 닿는다.
const APP_STORE_ID = '6797579391'

// scripts/publish-live-update.mjs 가 이 저장소의 "live-update-latest" 릴리스에 latest.json 을 올린다([[ADR-022]]).
export const LIVE_UPDATE_MANIFEST_URL =
  'https://github.com/jini520/maple-routine/releases/download/live-update-latest/latest.json'

/**
 * @capgo 매니페스트([[ADR-022]] 가 형식을 정했다).
 *
 * 이 형식은 **이 앱 전용**이다 — RN 은 Expo Updates 프로토콜의 매니페스트를 쓰고, 두 형식 사이에
 * 공통분모를 만들려 하지 않았다([[ADR-137]] 결정 6: 공통인 것은 형식이 아니라 «앱이 무엇을 할 수
 * 있나» 다).
 */
export interface LiveUpdateManifest {
  version: string
  url: string
  checksum: string
  size: number // zip 바이트 — 다운로드 전 사용자에게 용량을 안내([[ADR-027]])
  minNativeVersion?: string // 이 번들을 적용하려면 필요한 최소 네이티브 버전(스토어 업데이트 게이트, [[ADR-027]])
  // 이 버전의 **핵심 목록** 3~4줄([[ADR-119]] → [[ADR-126]] 결정 2). 원천은
  // packages/core/src/data/release-notes.ts 한 벌이고, 배포 스크립트가 배포하는 버전의 highlights
  // 만 뽑아 여기로 파생시킨다 — 여기서 그 파일을 읽지 않는다(원격에서 온 값이다).
  //
  // minNativeVersion과 같은 이유로 **선택 필드**다: 이미 발행된 옛 매니페스트에는 이 필드가 없고,
  // 필수로 만들면 그것을 읽는 기존 설치본이 전부 파싱 실패(null → check-error)해 업데이트를 못 받는다.
  // 매니페스트는 URL 고정·내용 가변이라 옛 앱이 새 파일을, 새 앱이 옛 파일을 읽는 조합이 둘 다 실재한다.
  highlights?: string[]
  // 이 목록에 든 플랫폼(`Capacitor.getPlatform()` 문자열)은 **스토어로 보낸다**([[ADR-154]]).
  //
  // 이 앱은 RN 바이너리로 대체됐고, 갱신이 끝난 플랫폼에 「최신입니다」를 돌려주는 것은 거짓이다.
  // `minNativeVersion` 과 답하는 질문이 다르다 — 그쪽은 *"이 번들을 적용할 수 있는가"*(번들의
  // 성질)이고 이쪽은 *"이 플랫폼이 아직 이 앱을 쓰는 것이 맞는가"*(앱의 수명)다. 한 필드에 두
  // 뜻을 얹으면 다음에 읽는 사람이 어느 쪽인지 못 가린다.
  //
  // 위 둘과 **같은 이유로 선택 필드**다(아래 파서 참고).
  storeRequiredPlatforms?: string[]
}

// GitHub Releases의 CDN은 자산을 application/octet-stream으로 내려주므로, CapacitorHttp가
// content-type을 보고 JSON으로 자동 파싱하지 않고 response.data를 "문자열" 그대로 준다(iOS 실측, [[ADR-026]]).
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
    // 같은 판정을 스토어 유도 목록에도 쓴다([[ADR-154]] 결정 3). 형식이 어긋나면 매니페스트를
    // 버리는 것이 아니라 **그 필드만** 뺀다 — 유도 하나 때문에 업데이트 경로 전체를 죽이지 않는다.
    const storeRequiredPlatforms = (parsed as LiveUpdateManifest).storeRequiredPlatforms
    const hasStoreRequired =
      Array.isArray(storeRequiredPlatforms) &&
      storeRequiredPlatforms.length > 0 &&
      storeRequiredPlatforms.every((name) => typeof name === 'string')
    return {
      version: (parsed as LiveUpdateManifest).version,
      url: (parsed as LiveUpdateManifest).url,
      checksum: (parsed as LiveUpdateManifest).checksum,
      size: (parsed as LiveUpdateManifest).size,
      ...(typeof minNativeVersion === 'string' ? { minNativeVersion } : {}),
      ...(hasHighlights ? { highlights } : {}),
      ...(hasStoreRequired ? { storeRequiredPlatforms } : {}),
    }
  }
  return null
}

/**
 * 직전 확인이 찾아 놓은 매니페스트. `download()` 가 «무엇을» 받을지는 여기서 온다.
 *
 * 스토어가 이 값을 안 드는 것이 [[ADR-137]] 결정 6 이다 — 주소·체크섬은 @capgo 프로토콜의 것이고
 * `expo-updates` 에는 짝이 없다. 확인 없이 받는 경로가 없다는 것은 스토어 쪽에서도 강제된다
 * (`runDownload` 가 `availableVersion === null` 이면 돌아간다).
 */
let pendingManifest: LiveUpdateManifest | null = null

/** 다음 `apply()` 가 갈아끼울 번들 id. @capgo 는 이것을 우리에게 주고 되받는다. */
let downloadedBundleId: string | null = null

export const capacitorLiveUpdatePort: LiveUpdatePort = {
  // web/개발 서버에는 네이티브 플러그인이 없다.
  isSupported() {
    return Capacitor.getPlatform() !== 'web'
  },

  async notifyAppReady() {
    await CapacitorUpdater.notifyAppReady()
  },

  async getCurrentVersion() {
    const { bundle } = await CapacitorUpdater.current()
    return bundle.version
  },

  // 채널은 빌드 시점에 고정된다([[ADR-024]] 빌드 시점 분리). 이 값을 읽는 자리가 core 였다가
  // 어댑터로 내려온 이유는 [[ADR-137]] 결정 7 에 있다 — `import.meta.env` 는 Vite 전용이라 core 에
  // 두면 RN 이 그 모듈을 평가하는 순간 죽었다.
  getChannel() {
    return import.meta.env.VITE_LIVE_UPDATE_CHANNEL === 'beta' ? 'beta' : 'production'
  },

  /**
   * 매니페스트를 받아 다섯 갈래로 번역한다.
   *
   * latest.json 은 URL 고정·내용 가변이라 캐시(iOS URLSession·CDN 엣지)가 옛 버전을 돌려줄 수 있다 →
   * 유니크 쿼리 파라미터 + no-cache 로 모든 캐시 층을 우회한다([[ADR-026]]).
   */
  async check(): Promise<LiveUpdateCheckResult> {
    const response = await CapacitorHttp.get({
      url: LIVE_UPDATE_MANIFEST_URL,
      params: { t: String(Date.now()) },
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (response.status < 200 || response.status >= 300) return { kind: 'error' }
    const manifest = parseLiveUpdateManifest(response.data)
    if (manifest === null) return { kind: 'error' }

    const { bundle, native } = await CapacitorUpdater.current()

    // 스토어 유도는 **버전 비교보다 앞이다**([[ADR-154]] 결정 2). 두 가지를 한꺼번에 얻는다:
    // ⓐ 갱신이 끝난 플랫폼에 `up-to-date`(= 거짓)를 돌려주지 않는다 ⓑ `manifest.version` 이
    // 사용자의 번들 버전과 **같아도** 게이트가 켜진다 — 그래서 버전을 고정한 채 플랫폼만 늘렸다
    // 줄일 수 있고(2단계 배포), 목록에서 빼면 그대로 되돌아온다.
    if (manifest.storeRequiredPlatforms?.includes(Capacitor.getPlatform())) {
      return { kind: 'store-required', version: manifest.version }
    }

    if (!isNewerVersion(bundle.version, manifest.version)) return { kind: 'up-to-date' }

    // 새 번들이 요구하는 네이티브 버전이 설치본보다 높으면 라이브로 못 받는다 → 스토어([[ADR-027]] 결정 7).
    if (manifest.minNativeVersion && isNewerVersion(native, manifest.minNativeVersion)) {
      return { kind: 'store-required', version: manifest.version, minNativeVersion: manifest.minNativeVersion }
    }

    pendingManifest = manifest
    return {
      kind: 'update-available',
      version: manifest.version,
      size: manifest.size,
      ...(manifest.highlights ? { highlights: manifest.highlights } : {}),
    }
  },

  // next()로 큐잉하지 않아 자동 적용되지 않는다 — 적용은 사용자가 명시적으로 한다([[ADR-027]] 결정 4).
  async download(onProgress) {
    if (pendingManifest === null) throw new Error('확인 없이 다운로드할 수 없습니다.')
    const { url, version, checksum } = pendingManifest
    const handle = await CapacitorUpdater.addListener('download', (state) => {
      if (state.bundle?.version === version) onProgress(state.percent)
    })
    try {
      const downloaded = await CapacitorUpdater.download({ url, version, checksum })
      downloadedBundleId = downloaded.id
    } finally {
      await handle.remove()
    }
  },

  // set은 JS 컨텍스트를 파괴하고 재로드한다 — 이후 코드는 실행되지 않는다([[ADR-027]]).
  // 앞의 순서(닫기 → 커버)는 core 의 applyLiveUpdate 가 소유한다([[ADR-117]] 결정 1).
  async apply() {
    if (downloadedBundleId === null) throw new Error('받아둔 번들이 없습니다.')
    await CapacitorUpdater.set({ id: downloadedBundleId })
  },

  // 셀룰러면 다운로드 전에 데이터 사용 경고를 띄운다([[ADR-027]] 결정 6). web/구버전 네이티브 셸엔
  // 플러그인이 없어 'unknown'으로 폴백하고(경고 생략), 호출 실패의 폴백은 호출부가 맡는다.
  async getNetworkType() {
    if (Capacitor.getPlatform() === 'web') return 'unknown'
    const status = await Network.getStatus()
    return status.connectionType as NetworkType
  },

  // window.open(_system)은 Capacitor가 외부 앱/브라우저로 넘겨 플러그인이 필요 없다([[ADR-027]] 결정 7).
  // 아직 미출시라 URL/ID는 placeholder.
  openStore() {
    const url =
      Capacitor.getPlatform() === 'ios'
        ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`
        : `market://details?id=${APP_ID}`
    window.open(url, '_system')
  },
}

/** 테스트가 어댑터 내부 상태를 되돌린다 — 모듈 스코프 변수라 케이스 사이에 샌다. */
export function resetCapacitorLiveUpdateState(): void {
  pendingManifest = null
  downloadedBundleId = null
}

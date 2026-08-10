import { create } from 'zustand'
import {
  applyDownloadedLiveUpdate,
  checkForLiveUpdate,
  downloadLiveUpdate,
  getCurrentBundleVersion,
  getNetworkType,
  isNewerVersion,
  openStoreForUpdate,
  resolveLiveUpdateManifestUrl,
} from '../../native/live-update'
import { hideSplashScreen } from '../../native/splash-screen'
import {
  getLastRunBundleVersion,
  setLastRunBundleVersion,
} from '../../storage/last-run-bundle-version'

// idle: 확인 전 / checking: 확인 중 / up-to-date: 최신 / update-available: 새 버전 있음(모달)
// store-required: 스토어 업데이트 필요 / confirm-cellular: 셀룰러 데이터 확인 대기 / downloading: 진행 중
// ready-to-apply: 다운로드 완료·적용 대기 / unsupported: web 등 미지원 (ADR-027)
// applying: 적용 진행 중 — 되돌릴 수 없는 구간에 들어갔다([[ADR-117]] 결정 7)
// updated: 적용·재시작이 끝난 직후 1회 — 「업데이트를 마쳤어요」 안내([[ADR-126]] 결정 4).
//          적용 성공 경로에는 상태 전환 코드가 없으므로(set()이 그 자리에서 JS 컨텍스트를 파괴한다)
//          이 상태만은 **부팅 때 뒤늦게** 판정된다.
//
// 실패는 세 종류다([[ADR-065]] 결정 2) — 사용자가 시작했는지로 갈린다.
//   check-error    매니페스트 조회·파싱 실패(자동 확인 포함). 모달을 띄우지 않고 설정 상태 행에만 남긴다.
//   download-error 사용자가 '다운로드'를 눌러 진행하던 중 실패. 모달로 알린다.
//   apply-error    사용자가 '지금 적용'을 눌러 진행하던 중 실패·타임아웃([[ADR-117]] 결정 1).
//                  같은 분류 기준을 그대로 따라 download-error 와 같은 층이라 모달로 알린다.
//                  받아둔 번들은 그대로 살아 있어, 다시 받지 않고 재시도할 수 있다.
export type LiveUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'store-required'
  | 'confirm-cellular'
  | 'downloading'
  | 'ready-to-apply'
  | 'applying'
  | 'updated'
  | 'check-error'
  | 'download-error'
  | 'apply-error'
  | 'unsupported'

// 채널은 빌드 시점에 고정된다([[ADR-024]] 빌드 시점 분리).
const CHANNEL: 'beta' | 'production' =
  import.meta.env.VITE_LIVE_UPDATE_CHANNEL === 'beta' ? 'beta' : 'production'
const MANIFEST_URL = resolveLiveUpdateManifestUrl(import.meta.env.VITE_LIVE_UPDATE_CHANNEL)

// 적용 전체(커넥션 닫기 → 커버 → set())를 덮는 하나의 상한([[ADR-117]] 결정 1). 고리별로 나누지
// 않는다 — 어디서 멈췄는지에 따라 사용자가 볼 화면이 달라질 이유가 없다. 12초인 이유는 닫기 상한
// 5초([[ADR-117]] 결정 5) 위에 커버·set()이 정상적으로 도는 시간을 넉넉히 얹은 값이라서다.
// 목적은 어디서 멈췄는지 정확히 진단하는 것이 아니라 **벽돌이 되지 않는 것**이다.
const APPLY_TIMEOUT_MS = 12_000

interface PendingUpdate {
  version: string
  url: string
  checksum: string
}

export interface LiveUpdateStore {
  currentVersion: string | null
  status: LiveUpdateStatus
  availableVersion: string | null
  availableSize: number | null // bytes
  // 받기 전 모달의 「자세히 보기」가 펼치는 핵심 목록([[ADR-126]] 결정 1). 원격에서 온 값이라
  // 없을 수 있고(옛 매니페스트), 없으면 모달이 버튼째 그리지 않는다(결정 6).
  availableHighlights: string[] | null
  minNativeVersion: string | null // store-required일 때만
  downloadProgress: number // 0~100
  channel: 'beta' | 'production'
  pending: PendingUpdate | null // 내부: 다운로드할 번들 정보
  downloadedBundleId: string | null // 내부: 받아둔 번들 id(적용 대상)
  loadCurrentVersion(): Promise<void>
  check(): Promise<void>
  checkOnBoot(): Promise<void>
  startDownload(): Promise<void>
  confirmCellularDownload(): Promise<void>
  apply(): Promise<void>
  openStore(): void
  dismiss(): void
}

// 새 확인을 시작할 때 비우는 필드들.
const CLEARED = {
  availableVersion: null,
  availableSize: null,
  availableHighlights: null,
  minNativeVersion: null,
  downloadProgress: 0,
  pending: null,
  downloadedBundleId: null,
}

/**
 * *"방금 업데이트했는가"* 를 판정하고, **그 자리에서 기록을 갱신한다**([[ADR-126]] 결정 4).
 * 읽고 나면 소비되므로 같은 사건이 두 번 뜨지 않는다.
 *
 * - 저장값이 없으면 `false` 다 — "모른다"이지 "업데이트했다"가 아니다. 근거 없이 안내하지 않는다.
 * - 판정이 `isNewerVersion` 인 것이 요점이다: "달라졌다"가 아니라 **"올라갔다"** 여야 자동 롤백
 *   (되돌아간 것)이 걸러진다. 되돌아간 것을 "완료"라고 부를 수 없다.
 * - 스토어 업데이트로 내장 번들이 올라가는 것도 같은 신호라 함께 잡힌다 — 사용자에게 OTA 와
 *   스토어 업데이트는 그냥 "업데이트"다.
 * - 저장소 실패는 삼킨다. 완료 안내는 곁가지고, 그것 때문에 **업데이트 확인 자체가 죽으면**
 *   본말전도다(호출부가 이 함수를 await 한 뒤에 check() 를 부른다).
 */
async function consumeJustUpdated(current: string | null): Promise<boolean> {
  if (current === null) return false
  try {
    const last = await getLastRunBundleVersion()
    if (last !== current) await setLastRunBundleVersion(current)
    return last !== null && isNewerVersion(last, current)
  } catch {
    return false
  }
}

export const useLiveUpdateStore = create<LiveUpdateStore>()((set, get) => {
  // 동의 후 실제 다운로드 — 진행률을 흘리고 완료 시 적용 대기로 전환한다(ADR-027). next() 미사용.
  async function runDownload() {
    const pending = get().pending
    if (pending === null) return
    set({ status: 'downloading', downloadProgress: 0 })
    try {
      const { id } = await downloadLiveUpdate(pending, (percent) => set({ downloadProgress: percent }))
      set({ status: 'ready-to-apply', downloadProgress: 100, downloadedBundleId: id })
    } catch {
      // 사용자가 시작한 실패라 모달로 알린다([[ADR-065]] 결정 2).
      set({ status: 'download-error' })
    }
  }

  return {
    currentVersion: null,
    status: 'idle',
    channel: CHANNEL,
    ...CLEARED,

    async loadCurrentVersion() {
      const version = await getCurrentBundleVersion()
      if (version === null) {
        set({ currentVersion: null, status: 'unsupported' })
        return
      }
      set({ currentVersion: version })
    },

    // 체크만 한다 — 다운로드/적용 없음(ADR-027 결정 1). 결과에 따라 모달용 상태로 전환한다.
    async check() {
      set({ status: 'checking', ...CLEARED })
      const result = await checkForLiveUpdate(MANIFEST_URL)
      switch (result.kind) {
        case 'update-available':
          set({
            status: 'update-available',
            availableVersion: result.version,
            availableSize: result.size,
            availableHighlights: result.highlights ?? null,
            pending: { version: result.version, url: result.url, checksum: result.checksum },
          })
          break
        case 'store-required':
          set({
            status: 'store-required',
            availableVersion: result.version,
            minNativeVersion: result.minNativeVersion,
          })
          break
        case 'up-to-date':
          set({ status: 'up-to-date' })
          break
        case 'unsupported':
          set({ status: 'unsupported' })
          break
        case 'error':
          // 자동 확인일 수 있어 모달을 띄우지 않는다 — 설정 상태 행에만 남는다.
          set({ status: 'check-error' })
          break
      }
    },

    // 부팅 시퀀스 — 현재 버전을 싣고 체크만 한다. 업데이트가 있으면 실행 시 모달이 뜬다(자동 다운로드/적용 없음).
    //
    // 여기서 완료 안내([[ADR-126]] 결정 4·5)도 함께 판정한다. 순서가 규칙이다 —
    // **판정(기록 포함)은 체크보다 앞이고, 전환은 체크보다 뒤다.**
    //  · 앞인 이유: 기록을 판정과 같은 자리에서 끝내야 체크 결과에 밀려 안내를 못 띄웠어도
    //    다음 부팅에 되풀이되지 않는다(큐를 만들면 "언젠가 뜨는 안내"라는 지속 상태가 생긴다).
    //  · 뒤인 이유: `check()` 가 첫 문장에서 status 를 'checking' 으로 덮으므로, 먼저 전환하면
    //    그대로 지워진다. 그리고 새 업데이트가 또 있다면 **그쪽이 이겨야** 한다(결정 5) —
    //    회고를 먼저 띄우면 안내를 두 번 닫아야 하고 두 번째가 첫 번째를 무효로 만드는 것처럼 읽힌다.
    async checkOnBoot() {
      await get().loadCurrentVersion()
      if (get().status === 'unsupported') return
      const justUpdated = await consumeJustUpdated(get().currentVersion)
      await get().check()
      // 확인이 실패해도(check-error) 띄운다 — 완료는 네트워크와 무관한 사실이라, 확인이 안 됐다는
      // 이유로 이미 일어난 일을 못 말할 이유가 없다.
      const status = get().status
      if (justUpdated && (status === 'up-to-date' || status === 'check-error')) {
        set({ status: 'updated' })
      }
    },

    // [다운로드] 탭 — 셀룰러면 데이터 경고를 먼저 띄우고, 아니면 바로 받는다(ADR-027 결정 6).
    async startDownload() {
      const network = await getNetworkType()
      if (network === 'cellular') {
        set({ status: 'confirm-cellular' })
        return
      }
      await runDownload()
    },

    // 셀룰러 경고에서 [계속] 탭.
    async confirmCellularDownload() {
      await runDownload()
    },

    // [지금 적용 (재시작)] 탭 — 어댑터가 닫기 → 커버 → set() 순으로 진행한다(ADR-117 결정 1).
    // set()이 성공하면 그 자리에서 JS 컨텍스트가 파괴되므로 아래 코드는 성공 경로에서 실행되지
    // 않는다. 이 함수가 실제로 다루는 것은 반대편 — **실패했을 때 화면을 되돌리는 것**이다.
    async apply() {
      const id = get().downloadedBundleId
      if (id === null) return
      // 재진입 가드 — 커버가 닫기 뒤로 밀리면서 그 구간(최대 5초) 동안 모달과 버튼이 살아 있게
      // 됐다(ADR-117 결정 7). UI가 버튼을 감추더라도 스토어가 자기 불변식을 스스로 지킨다.
      if (get().status === 'applying') return
      // 전환은 어떤 await보다 앞이어야 원자적이다 — 그 사이에 두 번째 탭이 끼면 가드가 무의미해진다.
      set({ status: 'applying' })

      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          applyDownloadedLiveUpdate(id),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('live update apply timeout')), APPLY_TIMEOUT_MS)
          }),
        ])
      } catch {
        // 세 고리(커버 show() 미완료 · 커넥션 닫기 무응답 · set() reject) 중 어느 것이 끊겼든
        // 화면은 돌아와야 한다. hideSplashScreen이 [data-splash-cover]까지 걷는다(ADR-117 결정 4) —
        // 그 하나가 여기 "커버를 걷고"를 실현 가능하게 만든다. 걷기 실패까지 삼켜야 상태 전환에 닿는다.
        await hideSplashScreen().catch(() => {})
        // downloadedBundleId는 비우지 않는다 — 받아둔 번들은 그대로 살아 있고 모달의 '다시 시도'가
        // 다시 부른다. 여기서 CLEARED를 쓰면 재시도가 불가능해진다(download-error 와 다른 점).
        set({ status: 'apply-error' })
      } finally {
        // 성공 경로에서는 컨텍스트가 파괴돼 실질적으로 의미가 없지만, 테스트 환경에서 타이머가 새는 것을 막는다.
        clearTimeout(timer)
      }
    },

    openStore() {
      openStoreForUpdate()
    },

    // [나중에]/[취소] 탭 — 기존 버전 유지, 다운로드/적용 안 함. "매번 물음"이라 다음 실행 때 다시 뜬다.
    dismiss() {
      set({ status: 'idle', ...CLEARED })
    },
  }
})

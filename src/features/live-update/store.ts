import { create } from 'zustand'
import {
  applyDownloadedLiveUpdate,
  checkForLiveUpdate,
  downloadLiveUpdate,
  getCurrentBundleVersion,
  getNetworkType,
  openStoreForUpdate,
  resolveLiveUpdateManifestUrl,
} from '../../native/live-update'

// idle: 확인 전 / checking: 확인 중 / up-to-date: 최신 / update-available: 새 버전 있음(모달)
// store-required: 스토어 업데이트 필요 / confirm-cellular: 셀룰러 데이터 확인 대기 / downloading: 진행 중
// ready-to-apply: 다운로드 완료·적용 대기 / error: 실패 / unsupported: web 등 미지원 (ADR-027)
export type LiveUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'store-required'
  | 'confirm-cellular'
  | 'downloading'
  | 'ready-to-apply'
  | 'error'
  | 'unsupported'

// 채널은 빌드 시점에 고정된다([[ADR-024]] 빌드 시점 분리).
const CHANNEL: 'beta' | 'production' =
  import.meta.env.VITE_LIVE_UPDATE_CHANNEL === 'beta' ? 'beta' : 'production'
const MANIFEST_URL = resolveLiveUpdateManifestUrl(import.meta.env.VITE_LIVE_UPDATE_CHANNEL)

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
  minNativeVersion: null,
  downloadProgress: 0,
  pending: null,
  downloadedBundleId: null,
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
      set({ status: 'error' })
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
          set({ status: 'error' })
          break
      }
    },

    // 부팅 시퀀스 — 현재 버전을 싣고 체크만 한다. 업데이트가 있으면 실행 시 모달이 뜬다(자동 다운로드/적용 없음).
    async checkOnBoot() {
      await get().loadCurrentVersion()
      if (get().status === 'unsupported') return
      await get().check()
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

    // [지금 재시작] 탭 — set()으로 즉시 적용(JS 컨텍스트 파괴·재로드, 이후 코드 실행 안 됨).
    async apply() {
      const id = get().downloadedBundleId
      if (id === null) return
      await applyDownloadedLiveUpdate(id)
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

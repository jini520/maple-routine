import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  applyDownloadedLiveUpdateMock,
  checkForLiveUpdateMock,
  downloadLiveUpdateMock,
  getCurrentBundleVersionMock,
  getNetworkTypeMock,
  openStoreForUpdateMock,
  resolveLiveUpdateManifestUrlMock,
} = vi.hoisted(() => ({
  applyDownloadedLiveUpdateMock: vi.fn(),
  checkForLiveUpdateMock: vi.fn(),
  downloadLiveUpdateMock: vi.fn(),
  getCurrentBundleVersionMock: vi.fn(),
  getNetworkTypeMock: vi.fn(),
  openStoreForUpdateMock: vi.fn(),
  resolveLiveUpdateManifestUrlMock: vi.fn(() => 'https://manifest.test/latest.json'),
}))

vi.mock('../../../native/live-update', () => ({
  applyDownloadedLiveUpdate: applyDownloadedLiveUpdateMock,
  checkForLiveUpdate: checkForLiveUpdateMock,
  downloadLiveUpdate: downloadLiveUpdateMock,
  getCurrentBundleVersion: getCurrentBundleVersionMock,
  getNetworkType: getNetworkTypeMock,
  openStoreForUpdate: openStoreForUpdateMock,
  resolveLiveUpdateManifestUrl: resolveLiveUpdateManifestUrlMock,
}))

const { showSplashScreenMock, hideSplashScreenMock } = vi.hoisted(() => ({
  showSplashScreenMock: vi.fn(),
  hideSplashScreenMock: vi.fn(),
}))

vi.mock('../../../native/splash-screen', () => ({
  showSplashScreen: showSplashScreenMock,
  hideSplashScreen: hideSplashScreenMock,
}))

import { useLiveUpdateStore } from '../store'

const INITIAL = {
  currentVersion: null,
  status: 'idle' as const,
  availableVersion: null,
  availableSize: null,
  minNativeVersion: null,
  downloadProgress: 0,
  pending: null,
  downloadedBundleId: null,
}

const s = () => useLiveUpdateStore.getState()

const AVAILABLE = {
  kind: 'update-available' as const,
  version: '1.0.2',
  size: 8_200_000,
  url: 'https://cdn/1.0.2.zip',
  checksum: 'abc',
}

beforeEach(() => {
  applyDownloadedLiveUpdateMock.mockReset()
  checkForLiveUpdateMock.mockReset()
  downloadLiveUpdateMock.mockReset()
  getCurrentBundleVersionMock.mockReset()
  getNetworkTypeMock.mockReset().mockResolvedValue('wifi')
  openStoreForUpdateMock.mockReset()
  showSplashScreenMock.mockReset().mockResolvedValue(undefined)
  hideSplashScreenMock.mockReset().mockResolvedValue(undefined)
  useLiveUpdateStore.setState(INITIAL)
})

describe('useLiveUpdateStore', () => {
  it('초기 상태는 idle', () => {
    expect(s().status).toBe('idle')
    expect(s().currentVersion).toBeNull()
  })

  describe('loadCurrentVersion', () => {
    it('네이티브 번들 버전을 담고, null이면 unsupported', async () => {
      getCurrentBundleVersionMock.mockResolvedValue('1.0.1')
      await s().loadCurrentVersion()
      expect(s().currentVersion).toBe('1.0.1')

      getCurrentBundleVersionMock.mockResolvedValue(null)
      await s().loadCurrentVersion()
      expect(s().status).toBe('unsupported')
    })
  })

  describe('check', () => {
    it('update-available면 버전·용량·pending을 담고 상태 전환(다운로드 안 함)', async () => {
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await s().check()
      expect(s().status).toBe('update-available')
      expect(s().availableVersion).toBe('1.0.2')
      expect(s().availableSize).toBe(8_200_000)
      expect(s().pending).toEqual({ version: '1.0.2', url: 'https://cdn/1.0.2.zip', checksum: 'abc' })
      expect(downloadLiveUpdateMock).not.toHaveBeenCalled()
    })

    it('store-required면 상태·minNativeVersion을 담는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'store-required', version: '2.0.0', minNativeVersion: '2.0.0' })
      await s().check()
      expect(s().status).toBe('store-required')
      expect(s().minNativeVersion).toBe('2.0.0')
    })

    it('up-to-date / unsupported를 그대로 상태에 반영', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'up-to-date' })
      await s().check()
      expect(s().status).toBe('up-to-date')
    })

    // ADR-065 결정 2: 매니페스트 조회 실패는 자동 확인일 수 있어 모달을 띄우지 않는다 —
    // 다운로드 실패와 종류를 갈라 둔다.
    it('매니페스트 조회 실패는 check-error (모달 대상 아님)', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'error' })
      await s().check()
      expect(s().status).toBe('check-error')
    })
  })

  describe('startDownload (셀룰러 경고)', () => {
    beforeEach(() => {
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
    })

    it('wifi면 바로 다운로드하고 진행률→ready-to-apply', async () => {
      getNetworkTypeMock.mockResolvedValue('wifi')
      downloadLiveUpdateMock.mockImplementation(async (_p, onProgress) => {
        onProgress(50)
        onProgress(100)
        return { id: 'bundle-2' }
      })
      await s().check()
      await s().startDownload()
      expect(s().status).toBe('ready-to-apply')
      expect(s().downloadProgress).toBe(100)
      expect(s().downloadedBundleId).toBe('bundle-2')
    })

    it('셀룰러면 다운로드 전에 confirm-cellular로 멈춘다', async () => {
      getNetworkTypeMock.mockResolvedValue('cellular')
      await s().check()
      await s().startDownload()
      expect(s().status).toBe('confirm-cellular')
      expect(downloadLiveUpdateMock).not.toHaveBeenCalled()
    })

    it('confirm-cellular에서 [계속]하면 다운로드를 진행한다', async () => {
      getNetworkTypeMock.mockResolvedValue('cellular')
      downloadLiveUpdateMock.mockResolvedValue({ id: 'bundle-2' })
      await s().check()
      await s().startDownload()
      await s().confirmCellularDownload()
      expect(downloadLiveUpdateMock).toHaveBeenCalled()
      expect(s().status).toBe('ready-to-apply')
    })

    // 사용자가 시작한 실패라 모달로 알린다.
    it('다운로드 실패면 download-error', async () => {
      downloadLiveUpdateMock.mockRejectedValue(new Error('checksum'))
      await s().check()
      await s().startDownload()
      expect(s().status).toBe('download-error')
    })
  })

  describe('apply', () => {
    it('받아둔 번들 id로 즉시 적용(set)을 호출한다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      applyDownloadedLiveUpdateMock.mockResolvedValue(undefined)
      await s().apply()
      expect(applyDownloadedLiveUpdateMock).toHaveBeenCalledWith('bundle-2')
    })

    it('받아둔 번들이 없으면 아무 것도 안 한다', async () => {
      await s().apply()
      expect(applyDownloadedLiveUpdateMock).not.toHaveBeenCalled()
      expect(s().status).toBe('idle')
    })

    // ADR-117 결정 7: 커버가 닫기 뒤로 밀리며 최대 5초 동안 모달이 살아 있게 됐다. 그 구간에
    // 화면이 "업데이트 준비 완료"라고 말하지 않도록 어댑터를 부르기 **전에** 상태를 옮긴다.
    it('어댑터를 부르기 전에 applying 으로 전환한다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      let statusAtCall: string | null = null
      applyDownloadedLiveUpdateMock.mockImplementation(async () => {
        statusAtCall = s().status
      })

      await s().apply()

      expect(applyDownloadedLiveUpdateMock).toHaveBeenCalledWith('bundle-2')
      expect(statusAtCall).toBe('applying')
      // 성공 경로에서는 set()이 JS 컨텍스트를 파괴하므로 그 뒤 상태를 바꾸지 않는다.
      expect(s().status).toBe('applying')
    })

    // ADR-117 결정 1: 커버는 어댑터(closeBossProfitDb → showSplashScreen → set)가 붙인다.
    // 스토어가 같이 부르면 커버가 두 장 쌓이고 순서 보장이 두 파일로 흩어진다.
    it('스토어는 커버를 직접 붙이지 않는다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      applyDownloadedLiveUpdateMock.mockResolvedValue(undefined)

      await s().apply()

      expect(showSplashScreenMock).not.toHaveBeenCalled()
    })

    it('applying 중에 다시 누르면 어댑터를 두 번 부르지 않는다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      let release: () => void = () => {}
      applyDownloadedLiveUpdateMock.mockReturnValue(
        new Promise<void>((resolve) => {
          release = resolve
        }),
      )

      const first = s().apply()
      await s().apply()
      expect(applyDownloadedLiveUpdateMock).toHaveBeenCalledTimes(1)

      release()
      await first
    })

    // ADR-117 결정 1 — 이 phase 의 핵심. 실패해도 화면이 돌아온다.
    it('적용이 실패하면 커버를 걷고 apply-error 로 되돌아온다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      applyDownloadedLiveUpdateMock.mockRejectedValue(new Error("Update failed, id doesn't exist"))

      await s().apply()

      expect(hideSplashScreenMock).toHaveBeenCalledTimes(1)
      expect(s().status).toBe('apply-error')
    })

    // 다시 받지 않고 재시도할 수 있어야 한다 — download-error 와 다른 점이다.
    it('apply-error 여도 받아둔 번들 id는 남는다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      applyDownloadedLiveUpdateMock.mockRejectedValue(new Error('set failed'))

      await s().apply()

      expect(s().downloadedBundleId).toBe('bundle-2')
    })

    it('12초 안에 끝나지 않으면 커버를 걷고 apply-error (11.9초에는 아직 applying)', async () => {
      vi.useFakeTimers()
      try {
        useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
        applyDownloadedLiveUpdateMock.mockReturnValue(new Promise<void>(() => {}))

        const pending = s().apply()

        await vi.advanceTimersByTimeAsync(11_900)
        expect(s().status).toBe('applying')
        expect(hideSplashScreenMock).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(200)
        await pending
        expect(hideSplashScreenMock).toHaveBeenCalled()
        expect(s().status).toBe('apply-error')
      } finally {
        vi.useRealTimers()
      }
    })

    it('apply-error 에서 다시 시도하면 applying 으로 들어간다(가드가 재시도를 막지 않는다)', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2', status: 'apply-error' })
      applyDownloadedLiveUpdateMock.mockResolvedValue(undefined)

      await s().apply()

      expect(applyDownloadedLiveUpdateMock).toHaveBeenCalledWith('bundle-2')
      expect(s().status).toBe('applying')
    })

    it('커버 걷기가 실패해도 apply-error 로 전환한다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      applyDownloadedLiveUpdateMock.mockRejectedValue(new Error('set failed'))
      hideSplashScreenMock.mockRejectedValue(new Error('hide fail'))

      await s().apply()

      expect(s().status).toBe('apply-error')
    })
  })

  describe('openStore / dismiss', () => {
    it('openStore는 어댑터를 호출한다', () => {
      s().openStore()
      expect(openStoreForUpdateMock).toHaveBeenCalled()
    })

    it('dismiss는 idle로 되돌리고 대기 정보를 비운다(현 버전 유지)', () => {
      useLiveUpdateStore.setState({ status: 'update-available', availableVersion: '1.0.2', pending: { version: '1.0.2', url: 'u', checksum: 'c' } })
      s().dismiss()
      expect(s().status).toBe('idle')
      expect(s().availableVersion).toBeNull()
      expect(s().pending).toBeNull()
    })
  })

  describe('checkOnBoot', () => {
    it('현재 버전을 싣고 체크해 업데이트가 있으면 update-available로 노출', async () => {
      getCurrentBundleVersionMock.mockResolvedValue('1.0.1')
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await s().checkOnBoot()
      expect(s().currentVersion).toBe('1.0.1')
      expect(s().status).toBe('update-available')
      expect(downloadLiveUpdateMock).not.toHaveBeenCalled()
    })

    it('web(unsupported)이면 체크하지 않는다', async () => {
      getCurrentBundleVersionMock.mockResolvedValue(null)
      await s().checkOnBoot()
      expect(s().status).toBe('unsupported')
      expect(checkForLiveUpdateMock).not.toHaveBeenCalled()
    })
  })
})

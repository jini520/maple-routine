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

const { showSplashScreenMock } = vi.hoisted(() => ({
  showSplashScreenMock: vi.fn(),
}))

vi.mock('../../../native/splash-screen', () => ({
  showSplashScreen: showSplashScreenMock,
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

    it('up-to-date / error / unsupported를 그대로 상태에 반영', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'up-to-date' })
      await s().check()
      expect(s().status).toBe('up-to-date')

      checkForLiveUpdateMock.mockResolvedValue({ kind: 'error' })
      await s().check()
      expect(s().status).toBe('error')
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

    it('다운로드 실패면 error', async () => {
      downloadLiveUpdateMock.mockRejectedValue(new Error('checksum'))
      await s().check()
      await s().startDownload()
      expect(s().status).toBe('error')
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
      expect(showSplashScreenMock).not.toHaveBeenCalled()
    })

    it('적용(리로드) 직전에 스플래시를 띄워 리로드 구간의 웹뷰 배경색 노출을 덮는다 (ADR-027)', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      applyDownloadedLiveUpdateMock.mockResolvedValue(undefined)

      await s().apply()

      expect(showSplashScreenMock).toHaveBeenCalled()
      expect(showSplashScreenMock.mock.invocationCallOrder[0]).toBeLessThan(
        applyDownloadedLiveUpdateMock.mock.invocationCallOrder[0],
      )
    })

    it('스플래시 표시가 실패해도 적용은 계속 진행한다', async () => {
      useLiveUpdateStore.setState({ downloadedBundleId: 'bundle-2' })
      showSplashScreenMock.mockRejectedValue(new Error('splash fail'))
      applyDownloadedLiveUpdateMock.mockResolvedValue(undefined)

      await s().apply()

      expect(applyDownloadedLiveUpdateMock).toHaveBeenCalledWith('bundle-2')
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

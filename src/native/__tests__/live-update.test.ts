// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDownloadedLiveUpdate,
  checkForLiveUpdate,
  downloadLiveUpdate,
  getCurrentBundleVersion,
  getNetworkType,
  isNewerVersion,
  LIVE_UPDATE_MANIFEST_URL,
  LIVE_UPDATE_MANIFEST_URL_BETA,
  notifyLiveUpdateReady,
  openStoreForUpdate,
  parseLiveUpdateManifest,
  resolveLiveUpdateManifestUrl,
} from '../live-update'

const { getPlatformMock, httpGetMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
  httpGetMock: vi.fn(),
}))

const { currentMock, downloadMock, setMock, notifyAppReadyMock, addListenerMock } = vi.hoisted(() => ({
  currentMock: vi.fn(),
  downloadMock: vi.fn(),
  setMock: vi.fn(),
  notifyAppReadyMock: vi.fn(),
  addListenerMock: vi.fn(),
}))

const { networkGetStatusMock } = vi.hoisted(() => ({ networkGetStatusMock: vi.fn() }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
  CapacitorHttp: { get: httpGetMock },
}))

vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    current: currentMock,
    download: downloadMock,
    set: setMock,
    notifyAppReady: notifyAppReadyMock,
    addListener: addListenerMock,
  },
}))

vi.mock('@capacitor/network', () => ({ Network: { getStatus: networkGetStatusMock } }))

const manifest = { version: '1.1.0', url: 'https://cdn/1.1.0.zip', checksum: 'abc123', size: 8_200_000 }
const currentAt = (bundleVersion: string, native = '1.0.0') => ({
  bundle: { id: 'builtin', version: bundleVersion, downloaded: '', checksum: '', status: 'success' },
  native,
})

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('android')
  currentMock.mockReset()
  downloadMock.mockReset()
  setMock.mockReset()
  notifyAppReadyMock.mockReset()
  addListenerMock.mockReset().mockResolvedValue({ remove: vi.fn() })
  networkGetStatusMock.mockReset()
  httpGetMock.mockReset()
})

describe('isNewerVersion', () => {
  it('patch/minor/major가 더 크면 true, 같거나 낮으면 false', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true)
    expect(isNewerVersion('1.0.5', '1.1.0')).toBe(true)
    expect(isNewerVersion('1.9.9', '2.0.0')).toBe(true)
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.3', '1.2.2')).toBe(false)
  })

  it('버전 형식이 올바르지 않으면 false를 반환한다', () => {
    expect(isNewerVersion('builtin', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', 'not-a-version')).toBe(false)
  })
})

describe('parseLiveUpdateManifest', () => {
  it('size 포함 유효 객체/문자열을 파싱한다', () => {
    expect(parseLiveUpdateManifest(manifest)).toEqual(manifest)
    expect(parseLiveUpdateManifest(JSON.stringify(manifest))).toEqual(manifest)
  })

  it('minNativeVersion이 있으면 함께 반환한다', () => {
    const withMin = { ...manifest, minNativeVersion: '2.0.0' }
    expect(parseLiveUpdateManifest(withMin)).toEqual(withMin)
  })

  it('size가 없거나 숫자가 아니면 null을 반환한다', () => {
    expect(parseLiveUpdateManifest({ version: '1.1.0', url: 'u', checksum: 'c' })).toBeNull()
    expect(parseLiveUpdateManifest({ version: '1.1.0', url: 'u', checksum: 'c', size: '8' })).toBeNull()
  })

  it('깨진 JSON/누락 필드/ null은 null을 반환한다', () => {
    expect(parseLiveUpdateManifest('{ not json')).toBeNull()
    expect(parseLiveUpdateManifest(null)).toBeNull()
  })
})

describe('getCurrentBundleVersion', () => {
  it('네이티브에선 현재 번들 버전, web에선 null', async () => {
    currentMock.mockResolvedValue(currentAt('1.0.1'))
    expect(await getCurrentBundleVersion()).toBe('1.0.1')

    getPlatformMock.mockReturnValue('web')
    expect(await getCurrentBundleVersion()).toBeNull()
  })
})

describe('checkForLiveUpdate (체크만, 다운로드 안 함)', () => {
  const manifestUrl = 'https://example.com/latest.json'

  it("web이면 'unsupported'", async () => {
    getPlatformMock.mockReturnValue('web')
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({ kind: 'unsupported' })
    expect(httpGetMock).not.toHaveBeenCalled()
  })

  it('매니페스트 요청은 캐시를 우회한다(쿼리 파라미터 + no-cache)', async () => {
    httpGetMock.mockResolvedValue({ status: 200, data: { ...manifest, version: '1.0.0' } })
    currentMock.mockResolvedValue(currentAt('1.0.0'))
    await checkForLiveUpdate(manifestUrl)
    const options = httpGetMock.mock.calls[0][0]
    expect(options.url).toBe(manifestUrl)
    expect(options.params?.t).toBeTruthy()
    expect(options.headers?.['Cache-Control']).toBe('no-cache')
  })

  it("네트워크 오류/비정상 상태/파싱 실패면 'error'", async () => {
    httpGetMock.mockRejectedValueOnce(new Error('net'))
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({ kind: 'error' })
    httpGetMock.mockResolvedValueOnce({ status: 404, data: null })
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({ kind: 'error' })
    httpGetMock.mockResolvedValueOnce({ status: 200, data: 'not-json' })
    currentMock.mockResolvedValue(currentAt('1.0.0'))
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({ kind: 'error' })
  })

  it("최신이면 'up-to-date'", async () => {
    httpGetMock.mockResolvedValue({ status: 200, data: { ...manifest, version: '1.0.0' } })
    currentMock.mockResolvedValue(currentAt('1.0.0'))
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({ kind: 'up-to-date' })
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it("새 버전이 있으면 다운로드 없이 'update-available'(버전·용량·url·checksum)", async () => {
    httpGetMock.mockResolvedValue({ status: 200, data: manifest })
    currentMock.mockResolvedValue(currentAt('1.0.0'))
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({
      kind: 'update-available',
      version: '1.1.0',
      size: 8_200_000,
      url: 'https://cdn/1.1.0.zip',
      checksum: 'abc123',
    })
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it("minNativeVersion이 설치 네이티브보다 높으면 'store-required'", async () => {
    httpGetMock.mockResolvedValue({ status: 200, data: { ...manifest, minNativeVersion: '2.0.0' } })
    currentMock.mockResolvedValue(currentAt('1.0.0', '1.0.0'))
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({
      kind: 'store-required',
      version: '1.1.0',
      minNativeVersion: '2.0.0',
    })
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it('minNativeVersion을 설치 네이티브가 충족하면 update-available', async () => {
    httpGetMock.mockResolvedValue({ status: 200, data: { ...manifest, minNativeVersion: '1.0.0' } })
    currentMock.mockResolvedValue(currentAt('1.0.0', '1.0.0'))
    expect((await checkForLiveUpdate(manifestUrl)).kind).toBe('update-available')
  })
})

describe('downloadLiveUpdate (진행률, next 미사용)', () => {
  it('진행률을 흘리고 번들 id를 반환하며 리스너를 정리한다', async () => {
    const removeMock = vi.fn()
    let listener: ((s: unknown) => void) | undefined
    addListenerMock.mockImplementation((event: string, cb: (s: unknown) => void) => {
      if (event === 'download') listener = cb
      return Promise.resolve({ remove: removeMock })
    })
    downloadMock.mockImplementation(async (params: { version: string }) => {
      listener?.({ percent: 40, bundle: { version: params.version } })
      listener?.({ percent: 100, bundle: { version: params.version } })
      listener?.({ percent: 10, bundle: { version: '9.9.9' } }) // 다른 버전 → 무시
      return { id: 'bundle-2', version: params.version }
    })
    const onProgress = vi.fn()

    const result = await downloadLiveUpdate(
      { url: 'https://cdn/1.1.0.zip', version: '1.1.0', checksum: 'abc123' },
      onProgress,
    )

    expect(result).toEqual({ id: 'bundle-2' })
    expect(downloadMock).toHaveBeenCalledWith({ url: 'https://cdn/1.1.0.zip', version: '1.1.0', checksum: 'abc123' })
    expect(onProgress).toHaveBeenCalledWith(40)
    expect(onProgress).toHaveBeenCalledWith(100)
    expect(onProgress).not.toHaveBeenCalledWith(10)
    expect(removeMock).toHaveBeenCalled()
  })

  it('다운로드가 실패해도 리스너는 정리된다', async () => {
    const removeMock = vi.fn()
    addListenerMock.mockResolvedValue({ remove: removeMock })
    downloadMock.mockRejectedValue(new Error('checksum'))

    await expect(
      downloadLiveUpdate({ url: 'u', version: '1.1.0', checksum: 'c' }, vi.fn()),
    ).rejects.toThrow()
    expect(removeMock).toHaveBeenCalled()
  })
})

describe('applyDownloadedLiveUpdate', () => {
  it('CapacitorUpdater.set(id)로 즉시 적용한다', async () => {
    setMock.mockResolvedValue(undefined)
    await applyDownloadedLiveUpdate('bundle-2')
    expect(setMock).toHaveBeenCalledWith({ id: 'bundle-2' })
  })
})

describe('getNetworkType', () => {
  it('네이티브에선 connectionType을 반환한다', async () => {
    networkGetStatusMock.mockResolvedValue({ connected: true, connectionType: 'cellular' })
    expect(await getNetworkType()).toBe('cellular')
  })

  it('web이면 unknown(플러그인 호출 안 함)', async () => {
    getPlatformMock.mockReturnValue('web')
    expect(await getNetworkType()).toBe('unknown')
    expect(networkGetStatusMock).not.toHaveBeenCalled()
  })

  it('플러그인 오류면 unknown으로 폴백', async () => {
    networkGetStatusMock.mockRejectedValue(new Error('no plugin'))
    expect(await getNetworkType()).toBe('unknown')
  })
})

describe('openStoreForUpdate', () => {
  it('Android면 market:// URL을 외부로 연다', () => {
    getPlatformMock.mockReturnValue('android')
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    openStoreForUpdate()
    expect(openSpy).toHaveBeenCalledWith('market://details?id=com.mapleroutine.app', '_system')
    openSpy.mockRestore()
  })

  it('iOS면 itms-apps:// URL을 외부로 연다', () => {
    getPlatformMock.mockReturnValue('ios')
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    openStoreForUpdate()
    expect(openSpy.mock.calls[0][0]).toMatch(/^itms-apps:\/\//)
    expect(openSpy.mock.calls[0][1]).toBe('_system')
    openSpy.mockRestore()
  })
})

describe('resolveLiveUpdateManifestUrl / notifyLiveUpdateReady', () => {
  it("channel 'beta'면 베타 URL, 그 외엔 프로덕션 URL", () => {
    expect(resolveLiveUpdateManifestUrl('beta')).toBe(LIVE_UPDATE_MANIFEST_URL_BETA)
    expect(resolveLiveUpdateManifestUrl(undefined)).toBe(LIVE_UPDATE_MANIFEST_URL)
    expect(resolveLiveUpdateManifestUrl('production')).toBe(LIVE_UPDATE_MANIFEST_URL)
  })

  it('notifyLiveUpdateReady는 notifyAppReady를 호출한다', async () => {
    notifyAppReadyMock.mockResolvedValue({ bundle: { version: '1.0.0' } })
    await notifyLiveUpdateReady()
    expect(notifyAppReadyMock).toHaveBeenCalled()
  })
})

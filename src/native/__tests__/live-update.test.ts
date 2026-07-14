import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkForLiveUpdate,
  isNewerVersion,
  LIVE_UPDATE_MANIFEST_URL,
  LIVE_UPDATE_MANIFEST_URL_BETA,
  notifyLiveUpdateReady,
  resolveLiveUpdateManifestUrl,
} from '../live-update'

const { getPlatformMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
}))

const { currentMock, downloadMock, nextMock, notifyAppReadyMock } = vi.hoisted(() => ({
  currentMock: vi.fn(),
  downloadMock: vi.fn(),
  nextMock: vi.fn(),
  notifyAppReadyMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}))

vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    current: currentMock,
    download: downloadMock,
    next: nextMock,
    notifyAppReady: notifyAppReadyMock,
  },
}))

const fetchMock = vi.fn()

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('android')
  currentMock.mockReset()
  downloadMock.mockReset()
  nextMock.mockReset()
  notifyAppReadyMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('isNewerVersion', () => {
  it('patch 버전이 더 크면 true', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true)
  })

  it('minor 버전이 더 크면 true', () => {
    expect(isNewerVersion('1.0.5', '1.1.0')).toBe(true)
  })

  it('major 버전이 더 크면 true', () => {
    expect(isNewerVersion('1.9.9', '2.0.0')).toBe(true)
  })

  it('동일 버전이면 false', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
  })

  it('더 낮은 버전이면 false', () => {
    expect(isNewerVersion('1.2.3', '1.2.2')).toBe(false)
  })

  it('버전 형식이 올바르지 않으면 false를 반환한다(builtin 등)', () => {
    expect(isNewerVersion('builtin', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.0', 'not-a-version')).toBe(false)
  })
})

describe('checkForLiveUpdate', () => {
  const manifestUrl = 'https://example.com/latest.json'

  it('web 플랫폼에서는 아무 것도 하지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await checkForLiveUpdate(manifestUrl)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('manifest 조회가 네트워크 오류로 실패하면 조용히 종료한다', async () => {
    fetchMock.mockRejectedValue(new Error('network error'))

    await expect(checkForLiveUpdate(manifestUrl)).resolves.toBeUndefined()
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it('manifest 응답이 실패 상태면 조용히 종료한다', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: vi.fn() })

    await checkForLiveUpdate(manifestUrl)

    expect(downloadMock).not.toHaveBeenCalled()
  })

  it('현재 버전보다 최신이면 다운로드 후 next를 호출한다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '1.1.0', url: 'https://cdn/1.1.0.zip', checksum: 'abc123' }),
    })
    currentMock.mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '', checksum: '', status: 'success' },
      native: '1.0.0',
    })
    downloadMock.mockResolvedValue({ id: 'bundle-2', version: '1.1.0', downloaded: '', checksum: 'abc123', status: 'success' })

    await checkForLiveUpdate(manifestUrl)

    expect(downloadMock).toHaveBeenCalledWith({
      url: 'https://cdn/1.1.0.zip',
      version: '1.1.0',
      checksum: 'abc123',
    })
    expect(nextMock).toHaveBeenCalledWith({ id: 'bundle-2' })
  })

  it('이미 최신 버전이면 다운로드하지 않는다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '1.0.0', url: 'https://cdn/1.0.0.zip', checksum: 'abc123' }),
    })
    currentMock.mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '', checksum: '', status: 'success' },
      native: '1.0.0',
    })

    await checkForLiveUpdate(manifestUrl)

    expect(downloadMock).not.toHaveBeenCalled()
    expect(nextMock).not.toHaveBeenCalled()
  })

  it('다운로드나 체크섬 검증이 실패해도 앱이 죽지 않는다', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: '1.1.0', url: 'https://cdn/1.1.0.zip', checksum: 'abc123' }),
    })
    currentMock.mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '', checksum: '', status: 'success' },
      native: '1.0.0',
    })
    downloadMock.mockRejectedValue(new Error('checksum mismatch'))

    await expect(checkForLiveUpdate(manifestUrl)).resolves.toBeUndefined()
    expect(nextMock).not.toHaveBeenCalled()
  })
})

describe('resolveLiveUpdateManifestUrl', () => {
  it("channel이 'beta'면 베타 매니페스트 URL을 반환한다", () => {
    expect(resolveLiveUpdateManifestUrl('beta')).toBe(LIVE_UPDATE_MANIFEST_URL_BETA)
  })

  it('channel이 undefined면 프로덕션 매니페스트 URL을 반환한다', () => {
    expect(resolveLiveUpdateManifestUrl(undefined)).toBe(LIVE_UPDATE_MANIFEST_URL)
  })

  it("channel이 'beta'가 아닌 다른 문자열이면 프로덕션 매니페스트 URL을 반환한다", () => {
    expect(resolveLiveUpdateManifestUrl('production')).toBe(LIVE_UPDATE_MANIFEST_URL)
  })
})

describe('notifyLiveUpdateReady', () => {
  it('CapacitorUpdater.notifyAppReady를 호출한다', async () => {
    notifyAppReadyMock.mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '', checksum: '', status: 'success' },
    })

    await notifyLiveUpdateReady()

    expect(notifyAppReadyMock).toHaveBeenCalled()
  })
})

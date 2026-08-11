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

const { closeBossProfitDbMock } = vi.hoisted(() => ({ closeBossProfitDbMock: vi.fn() }))

const { showSplashScreenMock } = vi.hoisted(() => ({ showSplashScreenMock: vi.fn() }))

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

vi.mock('../../storage/sqlite/db', () => ({ closeBossProfitDb: closeBossProfitDbMock }))

vi.mock('../splash-screen', () => ({ showSplashScreen: showSplashScreenMock }))

// 포트 역전([[ADR-127]]) 후에도 검사 대상은 그대로다 — 플러그인 호출과 플랫폼 가드가 어댑터로
// 옮겨갔으므로 실제 Capacitor(@capgo) 구현을 주입해 한 단위로 본다. 매니페스트 형식·버전 비교·
// 적용 순서는 여전히 `live-update.ts` 에 있고, 그것이 이 파일이 검사하는 대부분이다.
const { setLiveUpdatePort } = await import('../ports')
const { capacitorLiveUpdatePort } = await import('../adapters/capacitor-live-update')
setLiveUpdatePort(capacitorLiveUpdatePort)

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
  closeBossProfitDbMock.mockReset().mockResolvedValue(undefined)
  showSplashScreenMock.mockReset().mockResolvedValue(undefined)
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

  // ADR-119 결정 5(ADR-126 결정 2가 필드 이름만 바꿔 승계) — 이미 발행된 옛 매니페스트에는
  // highlights가 없다. 필수 검사에 넣으면 그 순간 기존 설치본의 업데이트 확인이 전부
  // check-error가 된다. 이 케이스가 그 회귀의 유일한 가드다.
  it('highlights가 없는 매니페스트를 그대로 통과시킨다', () => {
    expect(parseLiveUpdateManifest(manifest)).toEqual(manifest)
    expect(parseLiveUpdateManifest(JSON.stringify(manifest))).toEqual(manifest)
    expect(parseLiveUpdateManifest(manifest)).not.toHaveProperty('highlights')
  })

  // 옛 매니페스트에 실려 있던 notes(평문 한 덩어리)는 ADR-126 결정 2로 폐기됐다 — 읽는 쪽이
  // 사라졌으므로 파서도 싣지 않는다. 그래도 그 필드가 있는 옛 파일을 **버리지는 않는다**.
  it('폐기된 notes 필드가 있어도 매니페스트를 버리지 않고 그 필드만 뺀다', () => {
    const withNotes = { ...manifest, notes: '[기능] 개발 노트 추가' }
    expect(parseLiveUpdateManifest(withNotes)).toEqual(manifest)
    expect(parseLiveUpdateManifest(JSON.stringify(withNotes))).toEqual(manifest)
  })

  it('highlights가 문자열 배열이면 함께 반환한다', () => {
    const withHighlights = { ...manifest, highlights: ['보스 카드에서 인원 변경', '아이템 가격 입력'] }
    expect(parseLiveUpdateManifest(withHighlights)).toEqual(withHighlights)
    expect(parseLiveUpdateManifest(JSON.stringify(withHighlights))).toEqual(withHighlights)
  })

  it('highlights가 문자열 배열이 아니면 매니페스트를 버리지 않고 그 필드만 뺀다', () => {
    for (const highlights of [42, 'a\nb', { text: 'x' }, null, ['ok', 7]]) {
      expect(parseLiveUpdateManifest({ ...manifest, highlights })).toEqual(manifest)
      expect(parseLiveUpdateManifest(JSON.stringify({ ...manifest, highlights }))).toEqual(manifest)
    }
  })

  // 빈 배열은 "핵심 목록이 없다"와 같다 — 실어 보내면 모달이 빈 아코디언을 여는 버튼을 그린다.
  it('highlights가 빈 배열이면 필드를 뺀다', () => {
    expect(parseLiveUpdateManifest({ ...manifest, highlights: [] })).toEqual(manifest)
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

  // ADR-126 결정 1: 받기 전 모달이 보여줄 유일한 재료다 — 매니페스트에서 여기까지 오지 못하면
  // 모달은 다시 "버전 + 용량"만 말하는 자리로 돌아간다.
  it('highlights가 있으면 update-available 결과에 그대로 실린다', async () => {
    const highlights = ['보스 카드에서 인원 변경', '아이템 가격 입력']
    httpGetMock.mockResolvedValue({ status: 200, data: { ...manifest, highlights } })
    currentMock.mockResolvedValue(currentAt('1.0.0'))
    expect(await checkForLiveUpdate(manifestUrl)).toEqual({
      kind: 'update-available',
      version: '1.1.0',
      size: 8_200_000,
      url: 'https://cdn/1.1.0.zip',
      checksum: 'abc123',
      highlights,
    })
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

  // set()이 JS 컨텍스트를 파괴하고 리로드하기 전에, 아직 살아있는 SQLite 커넥션을 먼저 정상
  // 종료해둬야 한다 — 안 그러면 네이티브 쪽에 stale 커넥션이 남아 리로드 후 첫 쿼리가 멈춘다
  // (2026-07-17, 앱 업데이트 직후 과거 수익 데이터가 안 불러와지는 증상으로 사용자 보고).
  it('set()으로 리로드하기 전에 SQLite 커넥션을 먼저 정상 종료한다', async () => {
    setMock.mockResolvedValue(undefined)
    const callOrder: string[] = []
    closeBossProfitDbMock.mockImplementation(async () => {
      callOrder.push('close')
    })
    setMock.mockImplementation(async () => {
      callOrder.push('set')
    })

    await applyDownloadedLiveUpdate('bundle-2')

    expect(callOrder).toEqual(['close', 'set'])
  })

  // 커버는 실패 가능한 준비 작업(닫기)보다 **뒤에** 올라가야 한다 — 먼저 올리면 닫기가 매달릴 때
  // 사용자가 주황 스플래시에 갇힌다(이슈 #175). 커버가 떠 있는 구간을 실제 리로드 직전으로 좁힌다
  // (ADR-117 결정 1). 순서 자체가 이 결정이므로 호출 순서를 단언한다.
  it('닫기 → 커버 → set() 순으로 진행한다(커버는 닫기 뒤에 올라간다)', async () => {
    const callOrder: string[] = []
    closeBossProfitDbMock.mockImplementation(async () => {
      callOrder.push('close')
    })
    showSplashScreenMock.mockImplementation(async () => {
      callOrder.push('cover')
    })
    setMock.mockImplementation(async () => {
      callOrder.push('set')
    })

    await applyDownloadedLiveUpdate('bundle-2')

    expect(callOrder).toEqual(['close', 'cover', 'set'])
  })

  // 커버는 시각적 장치일 뿐이다 — 그것 때문에 set()에 도달하지 못하면 본말이 전도된다(ADR-027).
  it('커버 표시가 실패해도 적용은 계속 진행한다', async () => {
    showSplashScreenMock.mockRejectedValue(new Error('splash'))
    setMock.mockResolvedValue(undefined)

    await expect(applyDownloadedLiveUpdate('bundle-2')).resolves.toBeUndefined()
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


// isNewerVersion 은 실물을 그대로 쓴다. 완료 안내가 자동 롤백을 거르는 근거가 바로 이 비교라
// 가짜로 바꾸면 그 규칙을 검사하지 못한다.
jest.mock('../../../native/live-update', () => ({
  ...jest.requireActual<typeof import('../../../native/live-update')>('../../../native/live-update'),
  applyLiveUpdate: jest.fn(),
  checkForLiveUpdate: jest.fn(),
  downloadLiveUpdate: jest.fn(),
  getCurrentBundleVersion: jest.fn(),
  getNetworkType: jest.fn(),
  openStoreForUpdate: jest.fn(),
  getLiveUpdateChannel: jest.fn(),
}))
const { applyLiveUpdate: applyLiveUpdateMock, checkForLiveUpdate: checkForLiveUpdateMock, downloadLiveUpdate: downloadLiveUpdateMock, getCurrentBundleVersion: getCurrentBundleVersionMock, getNetworkType: getNetworkTypeMock } = jest.requireMock('../../../native/live-update') as Record<string, jest.Mock>

jest.mock('../../../storage/last-run-bundle-version', () => ({
  getLastRunBundleVersion: jest.fn(),
  setLastRunBundleVersion: jest.fn(),
}))
const { getLastRunBundleVersion: getLastRunBundleVersionMock, setLastRunBundleVersion: setLastRunBundleVersionMock } = jest.requireMock('../../../storage/last-run-bundle-version') as Record<string, jest.Mock>

jest.mock('../../../native/splash-screen', () => ({
  showSplashScreen: jest.fn(),
  hideSplashScreen: jest.fn(),
}))
const { showSplashScreen: showSplashScreenMock, hideSplashScreen: hideSplashScreenMock } = jest.requireMock('../../../native/splash-screen') as Record<string, jest.Mock>

import { useLiveUpdateStore } from '../store'

const INITIAL = {
  currentVersion: null,
  status: 'idle' as const,
  availableVersion: null,
  availableSize: null,
  availableHighlights: null,
  minNativeVersion: null,
  downloadProgress: 0,
  hasDownloadedBundle: false,
  justUpdated: false,
  holdingSplash: true,
}

const s = () => useLiveUpdateStore.getState()

/** 사본이 있어 잠그지 않고 연 부팅. 이때 앱은 확인을 기다리지 않는다. */
const OPENED = { locked: false, firstRun: false }

/** 기다리지 않는 부팅 확인을 부르고 그 안의 await 들이 다 돌 때까지 흘린다. */
async function bootOpened(): Promise<void> {
  void s().checkOnBoot(OPENED)
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

const AVAILABLE = {
  kind: 'update-available' as const,
  version: '1.0.2',
  size: 8_200_000,
}

beforeEach(() => {
  applyLiveUpdateMock.mockReset()
  checkForLiveUpdateMock.mockReset()
  downloadLiveUpdateMock.mockReset()
  getCurrentBundleVersionMock.mockReset()
  getNetworkTypeMock.mockReset().mockResolvedValue('wifi')
  showSplashScreenMock.mockReset().mockResolvedValue(undefined)
  hideSplashScreenMock.mockReset().mockResolvedValue(undefined)
  // 기본은 "적어 둔 적 없음"완료 안내가 뜨지 않는 쪽이라 다른 테스트를 오염시키지 않는다.
  getLastRunBundleVersionMock.mockReset().mockResolvedValue(null)
  setLastRunBundleVersionMock.mockReset().mockResolvedValue(undefined)
  useLiveUpdateStore.setState(INITIAL)
})

describe('useLiveUpdateStore', () => {
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
    it('update-available면 버전·용량을 담고 상태 전환(다운로드 안 함)', async () => {
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await s().check()
      expect(s().status).toBe('update-available')
      expect(s().availableVersion).toBe('1.0.2')
      expect(s().availableSize).toBe(8_200_000)
      expect(downloadLiveUpdateMock).not.toHaveBeenCalled()
    })

    // 받기 전 모달의 `자세히 보기`가 그리는 재료는 이것뿐이다.
    it('highlights가 오면 담고, 없으면 null이다. 없으면 모달이 버튼째 안 그린다', async () => {
      const highlights = ['보스 카드에서 인원 변경', '아이템 가격 입력']
      checkForLiveUpdateMock.mockResolvedValue({ ...AVAILABLE, highlights })
      await s().check()
      expect(s().availableHighlights).toEqual(highlights)

      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await s().check()
      expect(s().availableHighlights).toBeNull()
    })

    it('store-required면 상태·minNativeVersion을 담는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'store-required', version: '2.0.0', minNativeVersion: '2.0.0' })
      await s().check()
      expect(s().status).toBe('store-required')
      expect(s().minNativeVersion).toBe('2.0.0')
    })

    // 매니페스트 조회 실패는 자동 확인일 수 있어 모달을 띄우지 않는다.
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
      downloadLiveUpdateMock.mockImplementation(async (onProgress) => {
        onProgress(50)
        onProgress(100)
      })
      await s().check()
      await s().startDownload()
      expect(s().status).toBe('ready-to-apply')
      expect(s().downloadProgress).toBe(100)
      expect(s().hasDownloadedBundle).toBe(true)
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
      downloadLiveUpdateMock.mockResolvedValue(undefined)
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
    it('받아둔 번들이 없으면 아무 것도 안 한다', async () => {
      await s().apply()
      expect(applyLiveUpdateMock).not.toHaveBeenCalled()
      expect(s().status).toBe('idle')
    })

    // 커버가 닫기 뒤로 밀리며 최대 5초 동안 모달이 살아 있게 됐다. 그 구간에
    // 화면이 "업데이트 준비 완료"라고 말하지 않도록 어댑터를 부르기 **전에** 상태를 옮긴다.
    it('어댑터를 부르기 전에 applying 으로 전환한다', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true })
      let statusAtCall: string | null = null
      applyLiveUpdateMock.mockImplementation(async () => {
        statusAtCall = s().status
      })

      await s().apply()

      expect(applyLiveUpdateMock).toHaveBeenCalled()
      expect(statusAtCall).toBe('applying')
      // 성공 경로에서는 set이 JS 컨텍스트를 파괴하므로 그 뒤 상태를 바꾸지 않는다.
      expect(s().status).toBe('applying')
    })

    // 커버는 어댑터(closeBossProfitDb → showSplashScreen → set)가 붙인다.
    // 스토어가 같이 부르면 커버가 두 장 쌓이고 순서 보장이 두 파일로 흩어진다.
    it('스토어는 커버를 직접 붙이지 않는다', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true })
      applyLiveUpdateMock.mockResolvedValue(undefined)

      await s().apply()

      expect(showSplashScreenMock).not.toHaveBeenCalled()
    })

    it('applying 중에 다시 누르면 어댑터를 두 번 부르지 않는다', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true })
      let release: () => void = () => {}
      applyLiveUpdateMock.mockReturnValue(
        new Promise<void>((resolve) => {
          release = resolve
        }),
      )

      const first = s().apply()
      await s().apply()
      expect(applyLiveUpdateMock).toHaveBeenCalledTimes(1)

      release()
      await first
    })

    // 이 phase 의 핵심. 실패해도 화면이 돌아온다.
    it('적용이 실패하면 커버를 걷고 apply-error 로 되돌아온다', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true })
      applyLiveUpdateMock.mockRejectedValue(new Error("Update failed, id doesn't exist"))

      await s().apply()

      expect(hideSplashScreenMock).toHaveBeenCalledTimes(1)
      expect(s().status).toBe('apply-error')
    })

    // 다시 받지 않고 재시도할 수 있어야 한다. download-error 와 다른 점이다.
    it('apply-error 여도 받아둔 번들 id는 남는다', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true })
      applyLiveUpdateMock.mockRejectedValue(new Error('set failed'))

      await s().apply()

      expect(s().hasDownloadedBundle).toBe(true)
    })

    it('12초 안에 끝나지 않으면 커버를 걷고 apply-error (11.9초에는 아직 applying)', async () => {
      jest.useFakeTimers()
      try {
        useLiveUpdateStore.setState({ hasDownloadedBundle: true })
        applyLiveUpdateMock.mockReturnValue(new Promise<void>(() => {}))

        const pending = s().apply()

        await jest.advanceTimersByTimeAsync(11_900)
        expect(s().status).toBe('applying')
        expect(hideSplashScreenMock).not.toHaveBeenCalled()

        await jest.advanceTimersByTimeAsync(200)
        await pending
        expect(hideSplashScreenMock).toHaveBeenCalled()
        expect(s().status).toBe('apply-error')
      } finally {
        jest.useRealTimers()
      }
    })

    it('apply-error 에서 다시 시도하면 applying 으로 들어간다(가드가 재시도를 막지 않는다)', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true, status: 'apply-error' })
      applyLiveUpdateMock.mockResolvedValue(undefined)

      await s().apply()

      expect(applyLiveUpdateMock).toHaveBeenCalled()
      expect(s().status).toBe('applying')
    })

    it('커버 걷기가 실패해도 apply-error 로 전환한다', async () => {
      useLiveUpdateStore.setState({ hasDownloadedBundle: true })
      applyLiveUpdateMock.mockRejectedValue(new Error('set failed'))
      hideSplashScreenMock.mockRejectedValue(new Error('hide fail'))

      await s().apply()

      expect(s().status).toBe('apply-error')
    })
  })

  describe('dismiss', () => {
    it('dismiss는 idle로 되돌리고 대기 정보를 비운다(현 버전 유지)', () => {
      useLiveUpdateStore.setState({
        status: 'update-available',
        availableVersion: '1.0.2',
        hasDownloadedBundle: true,
      })
      s().dismiss()
      expect(s().status).toBe('idle')
      expect(s().availableVersion).toBeNull()
      expect(s().hasDownloadedBundle).toBe(false)
    })
  })

  describe('checkOnBoot', () => {
    it('현재 버전을 싣고 체크해 업데이트가 있으면 update-available로 노출', async () => {
      getCurrentBundleVersionMock.mockResolvedValue('1.0.1')
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await bootOpened()
      expect(s().currentVersion).toBe('1.0.1')
      expect(s().status).toBe('update-available')
      expect(downloadLiveUpdateMock).not.toHaveBeenCalled()
    })

    it('web(unsupported)이면 체크하지 않는다', async () => {
      getCurrentBundleVersionMock.mockResolvedValue(null)
      await bootOpened()
      expect(s().status).toBe('unsupported')
      expect(checkForLiveUpdateMock).not.toHaveBeenCalled()
      expect(setLastRunBundleVersionMock).not.toHaveBeenCalled()
    })
  })

  // 적용 성공 경로에는 상태 전환 코드가 없으므로 "방금
  // 업데이트했다"는 재시작 뒤에 알아내야 한다. 판정 근거는 `마지막으로 실행된 번들 버전` 하나다.
  describe("checkOnBoot: 적용 완료 안내('updated')", () => {
    beforeEach(() => {
      getCurrentBundleVersionMock.mockResolvedValue('1.0.4')
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'up-to-date' })
    })

    it('저장된 버전보다 올라갔으면 완료 안내를 켠다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.3')
      await bootOpened()
      expect(s().justUpdated).toBe(true)
      expect(s().currentVersion).toBe('1.0.4')
    })

    // 저장값 없음 = "모른다"이지 "업데이트했다"가 아니다. 근거 없이 안내하지 않는다.
    it('저장된 적이 없으면 안내하지 않고 기록만 한다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue(null)
      await bootOpened()
      expect(s().status).toBe('up-to-date')
      expect(setLastRunBundleVersionMock).toHaveBeenCalledWith('1.0.4')
    })

    it('같은 버전으로 다시 실행한 것뿐이면 안내하지 않는다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.4')
      await bootOpened()
      expect(s().status).toBe('up-to-date')
    })

    // 같은 버전의 버그 수정 OTA 는 패치 번호를 붙인다(`1.0.10+1`). semver 는 `+n` 을 비교에서 빼지만
    // 그러면 패치를 받아도 안내가 안 뜬다.
    it.each([
      ['1.0.4', '1.0.4+1'],
      ['1.0.4+1', '1.0.4+2'],
      ['1.0.4+2', '1.0.5'],
    ])('패치 번호가 올라가도 안내한다: %s → %s', async (last, current) => {
      getCurrentBundleVersionMock.mockResolvedValue(current)
      getLastRunBundleVersionMock.mockResolvedValue(last)
      await bootOpened()
      expect(s().justUpdated).toBe(true)
    })

    it('패치 번호가 내려갔으면 안내하지 않는다', async () => {
      getCurrentBundleVersionMock.mockResolvedValue('1.0.4+1')
      getLastRunBundleVersionMock.mockResolvedValue('1.0.4+2')
      await bootOpened()
      expect(s().status).toBe('up-to-date')
    })

    // 되돌아간 것을 "완료"라고 부를 수 없다. 판정이 "달라졌다"가 아니라 "올라갔다"인 이유다.
    it('자동 롤백으로 버전이 내려갔으면 안내하지 않는다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.5')
      await bootOpened()
      expect(s().status).toBe('up-to-date')
    })

    // 완료 안내는 확인을 기다리지 않는다. 새 업데이트가 또 있어도 두 사실이 함께 남고, 모달이 완료 안내를 먼저 그린다.
    it('새 업데이트가 또 있어도 완료 안내가 켜진다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.3')
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await bootOpened()
      expect(s().justUpdated).toBe(true)
      expect(s().status).toBe('update-available')
    })

    it('확인이 끝나기 전에 완료 안내가 켜진다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.3')
      checkForLiveUpdateMock.mockReturnValue(new Promise(() => {}))
      await bootOpened()
      expect(s().status).toBe('checking')
      expect(s().justUpdated).toBe(true)
    })

    it('확인이 실패해도(check-error) 완료 안내는 켜진다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.3')
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'error' })
      await bootOpened()
      expect(s().justUpdated).toBe(true)
    })

    // 처음 실행에서 받아 적용한 뒤의 부팅이다. 방금 설치한 사용자에게 업데이트했다는 말은 의미가 없다.
    it('처음 실행이면 올라갔어도 완료 안내를 켜지 않는다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.3')
      await s().checkOnBoot({ locked: true, firstRun: true })
      expect(s().justUpdated).toBe(false)
      expect(setLastRunBundleVersionMock).toHaveBeenCalledWith('1.0.4')
    })

    it('dismissUpdated 는 완료 안내만 끄고 기다리던 상태는 남긴다', async () => {
      useLiveUpdateStore.setState({ justUpdated: true, status: 'ready-to-apply', hasDownloadedBundle: true })
      s().dismissUpdated()
      expect(s().justUpdated).toBe(false)
      expect(s().status).toBe('ready-to-apply')
      expect(s().hasDownloadedBundle).toBe(true)
    })

    // 기록은 판정과 같은 자리에서 끝난다. 확인 결과에 밀려 안내를 못 띄웠어도 다음 부팅에
    // 되풀이되지 않는다(큐를 만들면 "언젠가 뜨는 안내"라는 지속 상태가 생긴다).
    it('안내를 띄우지 못한 경우에도 기록은 갱신한다', async () => {
      getLastRunBundleVersionMock.mockResolvedValue('1.0.3')
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      await bootOpened()
      expect(setLastRunBundleVersionMock).toHaveBeenCalledWith('1.0.4')
    })

    // 완료 안내는 곁가지다. 저장소가 실패했다고 업데이트 확인 자체가 죽으면 본말전도다.
    it('저장소 조회가 실패해도 확인은 그대로 진행된다', async () => {
      getLastRunBundleVersionMock.mockRejectedValue(new Error('preferences unavailable'))
      await bootOpened()
      expect(checkForLiveUpdateMock).toHaveBeenCalled()
      expect(s().status).toBe('up-to-date')
    })
  })

  // 5MB 이하는 묻지 않고 받는다. 사용자가 시작하지 않은 받기라 실패해도 모달 대상이 아니다.
  describe('check: 묻지 않고 받기', () => {
    const SMALL = { ...AVAILABLE, size: 3_000_000 }

    it('5MB 이하면 바로 받고 ready-to-apply 가 된다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(SMALL)
      downloadLiveUpdateMock.mockResolvedValue(undefined)
      await s().check()
      expect(downloadLiveUpdateMock).toHaveBeenCalledTimes(1)
      expect(s().status).toBe('ready-to-apply')
      expect(s().hasDownloadedBundle).toBe(true)
    })

    it('받는 동안은 background-downloading 이다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(SMALL)
      downloadLiveUpdateMock.mockReturnValue(new Promise(() => {}))
      void s().check()
      await Promise.resolve()
      await Promise.resolve()
      expect(s().status).toBe('background-downloading')
    })

    it('딱 5MB 까지 받고, 넘으면 묻는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ ...AVAILABLE, size: 5_000_000 })
      downloadLiveUpdateMock.mockResolvedValue(undefined)
      await s().check()
      expect(s().status).toBe('ready-to-apply')

      downloadLiveUpdateMock.mockClear()
      checkForLiveUpdateMock.mockResolvedValue({ ...AVAILABLE, size: 5_000_001 })
      await s().check()
      expect(s().status).toBe('update-available')
      expect(downloadLiveUpdateMock).not.toHaveBeenCalled()
    })

    it('묻지 않고 받다가 실패하면 background-download-error 다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(SMALL)
      downloadLiveUpdateMock.mockRejectedValue(new Error('network'))
      await s().check()
      expect(s().status).toBe('background-download-error')
      expect(s().hasDownloadedBundle).toBe(false)
    })

    it('처음 실행이 아니면 받은 뒤 적용하지 않는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(SMALL)
      downloadLiveUpdateMock.mockResolvedValue(undefined)
      await bootOpened()
      expect(applyLiveUpdateMock).not.toHaveBeenCalled()
      expect(s().status).toBe('ready-to-apply')
    })
  })

  // 잠근 채 켜지면 게임 데이터가 이 약속을 기다린다. 끝나는 때가 곧 게임 데이터 받기를 시작하는 때다.
  describe('checkOnBoot: 게임 데이터가 기다리는 약속', () => {
    const LOCKED = { locked: true, firstRun: false }
    const FIRST_RUN = { locked: true, firstRun: true }

    beforeEach(() => {
      jest.useFakeTimers()
      getCurrentBundleVersionMock.mockResolvedValue('1.0.1')
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    /** 약속이 끝났는지 돌려준다. 시간을 흘리지 않고 마이크로태스크만 흘린다. */
    async function settledAfter(promise: Promise<void>): Promise<boolean> {
      let done = false
      void promise.then(() => {
        done = true
      })
      for (let i = 0; i < 20; i += 1) await Promise.resolve()
      return done
    }

    it('최신이면 바로 끝난다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'up-to-date' })
      expect(await settledAfter(s().checkOnBoot(LOCKED))).toBe(true)
    })

    it('확인이 5초 안에 안 끝나면 기다리지 않는다 (4.9초에는 아직 기다린다)', async () => {
      checkForLiveUpdateMock.mockReturnValue(new Promise(() => {}))
      const boot = s().checkOnBoot(LOCKED)
      expect(await settledAfter(boot)).toBe(false)
      jest.advanceTimersByTime(4_900)
      expect(await settledAfter(boot)).toBe(false)
      jest.advanceTimersByTime(100)
      expect(await settledAfter(boot)).toBe(true)
    })

    it('받아서 적용을 묻는 동안 기다리고, 나중에 를 누르면 끝난다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ ...AVAILABLE, size: 3_000_000 })
      downloadLiveUpdateMock.mockResolvedValue(undefined)
      const boot = s().checkOnBoot(LOCKED)
      expect(await settledAfter(boot)).toBe(false)
      expect(s().status).toBe('ready-to-apply')
      jest.advanceTimersByTime(60_000)
      expect(await settledAfter(boot)).toBe(false)
      s().dismiss()
      expect(await settledAfter(boot)).toBe(true)
    })

    it('묻지 않고 받다가 실패하면 끝난다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ ...AVAILABLE, size: 3_000_000 })
      downloadLiveUpdateMock.mockRejectedValue(new Error('network'))
      expect(await settledAfter(s().checkOnBoot(LOCKED))).toBe(true)
    })

    it('처음 실행이 아니면 스플래시를 붙들지 않는다', async () => {
      checkForLiveUpdateMock.mockReturnValue(new Promise(() => {}))
      void s().checkOnBoot(LOCKED)
      expect(s().holdingSplash).toBe(false)
    })

    it('처음 실행이면 크기와 상관없이 받아 바로 적용하고, 그동안 스플래시를 붙든다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      downloadLiveUpdateMock.mockResolvedValue(undefined)
      applyLiveUpdateMock.mockReturnValue(new Promise(() => {}))
      const boot = s().checkOnBoot(FIRST_RUN)
      expect(await settledAfter(boot)).toBe(false)
      expect(applyLiveUpdateMock).toHaveBeenCalledTimes(1)
      expect(s().holdingSplash).toBe(true)
      expect(s().status).not.toBe('ready-to-apply')
      expect(s().status).not.toBe('applying')
    })

    it('처음 실행에서 적용이 실패하면 모달 없이 끝나고 스플래시를 놓는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      downloadLiveUpdateMock.mockResolvedValue(undefined)
      applyLiveUpdateMock.mockRejectedValue(new Error('reload failed'))
      expect(await settledAfter(s().checkOnBoot(FIRST_RUN))).toBe(true)
      expect(s().status).toBe('idle')
      expect(s().holdingSplash).toBe(false)
    })

    it('처음 실행에서 20초 안에 못 받으면 놓고, 다 받은 뒤에는 적용을 묻는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue(AVAILABLE)
      let finish: () => void = () => {}
      downloadLiveUpdateMock.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      )
      const boot = s().checkOnBoot(FIRST_RUN)
      expect(await settledAfter(boot)).toBe(false)
      jest.advanceTimersByTime(19_900)
      expect(await settledAfter(boot)).toBe(false)
      jest.advanceTimersByTime(100)
      expect(await settledAfter(boot)).toBe(true)
      expect(s().holdingSplash).toBe(false)

      finish()
      for (let i = 0; i < 20; i += 1) await Promise.resolve()
      expect(applyLiveUpdateMock).not.toHaveBeenCalled()
      expect(s().status).toBe('ready-to-apply')
    })

    it('처음 실행이고 최신이면 바로 끝나고 스플래시를 놓는다', async () => {
      checkForLiveUpdateMock.mockResolvedValue({ kind: 'up-to-date' })
      expect(await settledAfter(s().checkOnBoot(FIRST_RUN))).toBe(true)
      expect(s().holdingSplash).toBe(false)
    })
  })
})

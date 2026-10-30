import { create } from 'zustand'
import {
  applyLiveUpdate,
  checkForLiveUpdate,
  downloadLiveUpdate,
  getCurrentBundleVersion,
  getLiveUpdateChannel,
  getNetworkType,
  isNewerVersion,
  openStoreForUpdate,
} from '../../native/live-update'
import { hideSplashScreen } from '../../native/splash-screen'
import {
  getLastRunBundleVersion,
  setLastRunBundleVersion,
} from '../../storage/last-run-bundle-version'

// idle: 확인 전 / checking: 확인 중 / up-to-date: 최신 / update-available: 새 버전 있음(모달)
// store-required: 스토어 업데이트 필요 / confirm-cellular: 셀룰러 데이터 확인 대기 / downloading: 진행 중
// background-downloading: 묻지 않고 받는 중(모달 없음) / ready-to-apply: 다운로드 완료·적용 대기
// unsupported: web 등 미지원
// applying: 적용 진행 중. 되돌릴 수 없는 구간에 들어갔다
//
// 실패는 넷이다. 사용자가 시작했는지로 갈린다.
//   check-error               매니페스트 조회·파싱 실패(자동 확인 포함). 모달 없이 설정 상태 행에만 남긴다.
//   background-download-error 묻지 않고 받던 중 실패. 같은 이유로 모달이 없다. 다음 부팅에 다시 받는다.
//   download-error            사용자가 '다운로드'를 눌러 진행하던 중 실패. 모달로 알린다.
//   apply-error               사용자가 '지금 적용'을 눌러 진행하던 중 실패·타임아웃. 모달로 알린다.
//                             받아둔 번들은 그대로 살아 있어, 다시 받지 않고 재시도할 수 있다.
export type LiveUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'store-required'
  | 'confirm-cellular'
  | 'downloading'
  | 'background-downloading'
  | 'ready-to-apply'
  | 'applying'
  | 'check-error'
  | 'background-download-error'
  | 'download-error'
  | 'apply-error'
  | 'unsupported'

/** 부팅 때 게임 데이터가 알려 주는 것. 잠근 채 켜졌는지와 기기 사본이 아예 없는지. */
export interface LiveUpdateBootContext {
  locked: boolean
  firstRun: boolean
}

// 채널은 빌드 시점에 고정되지만 그 값을 읽는 것은 어댑터다. 모듈 최상위에서 `import.meta.env`
// 를 읽으면 RN 런타임에서 `undefined` 라 이 파일을 import 하는 것만으로 죽는다.

// 적용 전체(커넥션 닫기 → 커버 → set())를 덮는 하나의 상한. 고리별로 나누지 않는다. 어디서
// 멈췄는지에 따라 사용자가 볼 화면이 달라질 이유가 없다. 12초는 닫기 상한 5초 위에 커버·set()
// 이 정상적으로 도는 시간을 넉넉히 얹은 값이다. 목적은 진단이 아니라 벽돌이 되지 않는 것이다.
const APPLY_TIMEOUT_MS = 12_000

/** 묻지 않고 받는 번들 크기의 상한. 압축한 크기로 잰다. 넘으면 `다운로드` 를 묻는다. */
export const AUTO_DOWNLOAD_MAX_BYTES = 5_000_000

/** 잠근 채 켜졌을 때 게임 데이터가 OTA 확인을 기다리는 상한. 확인이 멈추면 잠금 화면에 갇힌다. */
export const BOOT_CHECK_WAIT_MS = 5_000

/** 처음 실행에서 스플래시를 붙들어 두는 상한. 망이 느리면 받기를 뒤로 돌리고 게임 데이터로 넘어간다. */
export const FIRST_RUN_HOLD_MS = 20_000

// 게임 데이터 받기가 기다려도 되는 상태. 이 중 하나가 되면 OTA 가 할 일을 마쳤거나 사용자가 미뤘다.
const SETTLED: ReadonlySet<LiveUpdateStatus> = new Set([
  'idle',
  'up-to-date',
  'check-error',
  'background-download-error',
  'unsupported',
])

export interface LiveUpdateStore {
  currentVersion: string | null
  status: LiveUpdateStatus
  availableVersion: string | null
  availableSize: number | null // bytes
  // 받기 전 모달의 자세히 보기 가 펼치는 핵심 목록. 원격에서 온 값이라 없을 수 있고, 없으면
  // 모달이 버튼째 그리지 않는다.
  availableHighlights: string[] | null
  // store-required 일 때만. 없을 수 있다. `expo-updates` 의 runtimeVersion 은 fingerprint 해시라
  // 사용자에게 보여 줄 이름이 아니다. 그때 모달은 그 줄을 안 그린다.
  minNativeVersion: string | null
  downloadProgress: number // 0~100
  channel: string
  /** 방금 업데이트를 마쳤는가. `업데이트를 마쳤어요` 모달이 이 값을 본다. 다른 상태와 겹칠 수 있어 상태와 따로 둔다. */
  justUpdated: boolean
  /** 처음 실행에서 OTA 를 받아 적용할 때까지 스플래시를 붙들어야 하는가. `BootSplash` 가 본다. */
  holdingSplash: boolean
  /**
   * 내부: 받아둔 번들이 있는가(적용 대상).
   *
   * `expo-updates` 는 번들 id 를 안 보여주고 마지막으로 받은 것 을 런타임이 안다. 스토어가 이
   * 값으로 하는 일은 둘뿐이다. `apply()` 의 진입 판정과, `apply-error` 가 재시도할 것이 남아
   * 있다는 표시.
   */
  hasDownloadedBundle: boolean
  loadCurrentVersion(): Promise<void>
  check(): Promise<void>
  /**
   * 부팅 확인. 게임 데이터 받기를 시작해도 될 때 끝난다. 잠그지 않고 열 때는 기다리지 않고 부른다.
   *
   * @example await useLiveUpdateStore.getState().checkOnBoot({ locked: true, firstRun: true })
   */
  checkOnBoot(context: LiveUpdateBootContext): Promise<void>
  startDownload(): Promise<void>
  confirmCellularDownload(): Promise<void>
  apply(): Promise<void>
  openStore(): void
  dismiss(): void
  /** `업데이트를 마쳤어요` 의 `확인`. 뒤에 기다리던 모달이 있으면 그것이 뜬다. */
  dismissUpdated(): void
}

// 새 확인을 시작할 때 비우는 필드들.
const CLEARED = {
  availableVersion: null,
  availableSize: null,
  availableHighlights: null,
  minNativeVersion: null,
  downloadProgress: 0,
  hasDownloadedBundle: false,
}

/**
 * 방금 업데이트했는지의 판정. 그 자리에서 기록도 갱신한다. 읽고 나면 소비되므로 같은 사건이
 * 두 번 뜨지 않는다.
 *
 * - 저장값이 없으면 `false` 다. 모른다 이지 업데이트했다 가 아니다.
 * - 판정이 `isNewerVersion` 인 것이 요점이다. 달라졌다 가 아니라 올라갔다 여야 자동 롤백이
 *   걸러진다. 되돌아간 것을 완료라고 부를 수 없다.
 * - 스토어 업데이트로 내장 번들이 올라가는 것도 같은 신호라 함께 잡힌다.
 * - 저장소 실패는 삼킨다. 완료 안내 때문에 업데이트 확인 자체가 죽으면 본말전도다.
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
  // 처음 실행에서 아직 스플래시를 붙들고 있는가. 상한이 지나거나 게임 데이터가 넘어가면 꺼진다.
  // 꺼진 뒤에 받기가 끝나면 그 자리에서 재시작하지 않는다. 이미 게임 데이터를 받는 중일 수 있다.
  let firstRunApplying = false
  // 마지막으로 시작한 부팅 확인. 앞선 확인이 늦게 끝나도 지금 확인의 스플래시 붙들기를 건드리지 않게 한다.
  let bootId = 0

  // 동의 후 실제 다운로드. 진행률을 흘리고 완료 시 적용 대기로 전환한다. 받아도 자동으로
  // 적용되지 않는다. 적용은 apply() 로 사용자가 명시적으로 한다.
  //
  // 무엇을 받을지를 안 넘긴다. 그 정보(주소·체크섬·id)는 프로토콜마다 모양이 달라 어댑터가
  // 자기 안에서 든다. 스토어가 아는 것은 직전 확인이 찾아 놓은 것을 받는다 는 사실뿐이고,
  // 그래서 확인 없이 받는 경로가 원천적으로 없다.
  async function runDownload() {
    if (get().availableVersion === null) return
    set({ status: 'downloading', downloadProgress: 0 })
    try {
      await downloadLiveUpdate((percent) => set({ downloadProgress: percent }))
      set({ status: 'ready-to-apply', downloadProgress: 100, hasDownloadedBundle: true })
    } catch {
      // 사용자가 시작한 실패라 모달로 알린다.
      set({ status: 'download-error' })
    }
  }

  // 묻지 않고 받는 다운로드. 사용자가 시작하지 않았으므로 실패해도 모달을 띄우지 않는다.
  // 처음 실행에서 아직 스플래시를 붙들고 있으면 받자마자 적용한다.
  async function runBackgroundDownload() {
    set({ status: 'background-downloading', downloadProgress: 0 })
    try {
      await downloadLiveUpdate((percent) => set({ downloadProgress: percent }))
    } catch {
      set({ status: 'background-download-error' })
      return
    }
    set({ downloadProgress: 100, hasDownloadedBundle: true })
    if (!firstRunApplying) {
      set({ status: 'ready-to-apply' })
      return
    }
    // 성공하면 그 자리에서 JS 가 새로 시작해 아래는 돌지 않는다. 실패는 모달 없이 넘긴다. 받아 둔
    // 번들은 남아 있어 다음에 앱을 새로 켤 때 그것으로 시작한다.
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        applyLiveUpdate(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('live update apply timeout')), APPLY_TIMEOUT_MS)
        }),
      ])
    } catch {
      set({ status: 'idle', ...CLEARED })
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    currentVersion: null,
    status: 'idle',
    // 초기값은 비어 있고 `loadCurrentVersion()` 이 채운다. 여기서 어댑터에 물으면 안 된다.
    // zustand 는 이 초기화 함수를 `create()` 시점, 즉 모듈 평가 중에 부르는데 그때는 포트가
    // 아직 주입되기 전이라 슬롯이 던진다.
    channel: '',
    justUpdated: false,
    // 처음 실행인지는 게임 데이터가 사본을 읽어야 안다. 그 전에 스플래시가 걷히면 안 되므로 켠 채로 시작한다.
    holdingSplash: true,
    ...CLEARED,

    async loadCurrentVersion() {
      const version = await getCurrentBundleVersion()
      if (version === null) {
        set({ currentVersion: null, status: 'unsupported' })
        return
      }
      set({ currentVersion: version, channel: getLiveUpdateChannel() })
    },

    // 체크만 한다. 다운로드/적용 없음. 결과에 따라 모달용 상태로 전환한다.
    async check() {
      set({ status: 'checking', ...CLEARED })
      const result = await checkForLiveUpdate()
      switch (result.kind) {
        case 'update-available':
          set({
            status: 'update-available',
            availableVersion: result.version,
            availableSize: result.size,
            availableHighlights: result.highlights ?? null,
          })
          // 처음 실행은 크기와 상관없이 받는다. 스토어에서 막 받은 앱이라 따로 묻지 않는다.
          if (firstRunApplying || result.size <= AUTO_DOWNLOAD_MAX_BYTES) await runBackgroundDownload()
          break
        case 'store-required':
          set({
            status: 'store-required',
            availableVersion: result.version,
            minNativeVersion: result.minNativeVersion ?? null,
          })
          break
        case 'up-to-date':
          set({ status: 'up-to-date' })
          break
        case 'unsupported':
          set({ status: 'unsupported' })
          break
        case 'error':
          // 자동 확인일 수 있어 모달을 띄우지 않는다. 설정 상태 행에만 남는다.
          set({ status: 'check-error' })
          break
      }
    },

    // 부팅 시퀀스. 완료 안내를 판정하고 확인한다. 작은 업데이트는 확인이 그 자리에서 받는다.
    //
    // 완료 판정(기록 포함)은 확인보다 앞이다. 기록을 판정과 같은 자리에서 끝내야 안내를 못 띄웠어도
    // 다음 부팅에 되풀이되지 않는다. 안내는 확인을 기다리지 않는다. 완료는 네트워크와 무관한 사실이다.
    //
    // 돌려주는 약속은 게임 데이터 받기를 시작해도 될 때 끝난다. 확인이 5초를 넘거나, OTA 가 할 일을
    // 마쳤거나, 사용자가 미뤘을 때다.
    async checkOnBoot(context) {
      const id = (bootId += 1)
      firstRunApplying = context.firstRun
      set({ holdingSplash: context.firstRun })
      await get().loadCurrentVersion()
      if (get().status === 'unsupported') {
        firstRunApplying = false
        set({ holdingSplash: false })
        return
      }
      const justUpdated = await consumeJustUpdated(get().currentVersion)
      // 처음 실행의 적용 뒤에는 띄우지 않는다. 방금 설치한 사용자에게 업데이트는 의미가 없다.
      if (justUpdated && !context.firstRun) set({ justUpdated: true })

      await new Promise<void>((resolve) => {
        const timers: ReturnType<typeof setTimeout>[] = []
        let unsubscribe = (): void => {}
        const settle = (): void => {
          timers.forEach(clearTimeout)
          unsubscribe()
          if (id === bootId) {
            firstRunApplying = false
            set({ holdingSplash: false })
          }
          resolve()
        }
        timers.push(
          setTimeout(() => {
            if (get().status === 'checking') settle()
          }, BOOT_CHECK_WAIT_MS),
        )
        if (context.firstRun) timers.push(setTimeout(settle, FIRST_RUN_HOLD_MS))
        unsubscribe = useLiveUpdateStore.subscribe((state) => {
          if (SETTLED.has(state.status)) settle()
        })
        void get().check()
      })
    },

    // [다운로드] 탭. 셀룰러면 데이터 경고를 먼저 띄우고, 아니면 바로 받는다.
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

    // [지금 적용 (재시작)] 탭. 어댑터가 닫기 → 커버 → set() 순으로 진행한다. set() 이 성공하면
    // 그 자리에서 JS 컨텍스트가 파괴되므로 아래 코드는 성공 경로에서 실행되지 않는다. 이 함수가
    // 실제로 다루는 것은 실패했을 때 화면을 되돌리는 일이다.
    async apply() {
      if (!get().hasDownloadedBundle) return
      // 재진입 가드. 커버가 닫기 뒤로 밀리면서 그 구간(최대 5초) 동안 모달과 버튼이 살아 있게
      // 됐다. UI가 버튼을 감추더라도 스토어가 자기 불변식을 스스로 지킨다.
      if (get().status === 'applying') return
      // 전환은 어떤 await보다 앞이어야 원자적이다. 그 사이에 두 번째 탭이 끼면 가드가 무의미해진다.
      set({ status: 'applying' })

      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          applyLiveUpdate(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('live update apply timeout')), APPLY_TIMEOUT_MS)
          }),
        ])
      } catch {
        // 세 고리(커버 show() 미완료 · 커넥션 닫기 무응답 · set() reject) 중 어느 것이 끊겼든
        // 화면은 돌아와야 한다. `hideSplashScreen` 이 커버까지 걷는다. 걷기 실패까지 삼켜야
        // 상태 전환에 닿는다.
        await hideSplashScreen().catch(() => {})
        // hasDownloadedBundle 은 비우지 않는다. 받아둔 번들은 그대로 살아 있고 모달의 다시 시도가
        // 다시 부른다. 여기서 비우면 재시도가 불가능해진다(download-error 와 다른 점).
        set({ status: 'apply-error' })
      } finally {
        // 성공 경로에서는 컨텍스트가 파괴돼 실질적으로 의미가 없지만, 테스트 환경에서 타이머가 새는 것을 막는다.
        clearTimeout(timer)
      }
    },

    openStore() {
      openStoreForUpdate()
    },

    // [나중에]/[취소] 탭. 기존 버전 유지, 다운로드/적용 안 함. "매번 물음"이라 다음 실행 때 다시 뜬다.
    dismiss() {
      set({ status: 'idle', ...CLEARED })
    },

    dismissUpdated() {
      set({ justUpdated: false })
    },
  }
})

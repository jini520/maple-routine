// 부팅 **순서** — 이 step 의 실질이 화면이 아니라 순서라서 있는 파일이다.
//
// 웹 `AppShell`(573줄)이 하던 것과 RN 이 하는 것의 전수 대조표는 `docs/migration/README.md`
// «4-0단계 결과» 에 있고, 여기서는 그 표 중 **틀려도 조용히 넘어가는 칸**만 코드로 붙든다. 순서가
// 어긋났을 때 드러나는 모습이 *"흰 화면"* · *"스플래시가 안 걷힘"* 이라 어느 것도 스택 트레이스를
// 남기지 않는다.
//
// 셋으로 나뉜다.
//
// ① **셸이 무엇을 언제 하는가** — 렌더해서 실제 호출 순서를 본다.
// ② **진입점이 무엇을 먼저 하는가** — 포트 주입과 스플래시 붙들기는 React 트리 **밖**이라 렌더로는
//    못 본다. `index.ts` 를 소스로 읽어 순서만 본다.
// ③ **OTA 가 아직 아무 데도 안 이어져 있는가** — [[ADR-128]] 결정 7 이 프로토콜 재설계를 별도 ADR
//    로 미뤄 뒀다. `LiveUpdatePort` 는 던지고, 그보다 앞서 core 의 live-update 스토어는 **import
//    하는 것만으로** 죽는다(`import.meta.env` — 실측 2026-08-12). 그래서 계약이 "부르지 않는다"가
//    아니라 **"값으로 가져오지도 않는다"** 이고, 그건 호출 관측으로는 못 지킨다 — 값 import 가
//    하나 생기면 그 순간 앱도 테스트도 안 뜨므로 **그 전에** 여기가 빨개져야 한다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { act } from '@testing-library/react-native'

/** 관측한 호출을 부른 순서대로 쌓는다 — 무엇을 했는지가 아니라 **언제** 했는지가 계약이다. */
const mockCalls: string[] = []

/** 온보딩 상태만 케이스마다 갈아 끼운다(선하이드레이션 게이트가 이 값 하나로 갈린다). */
const mockOnboarding = { status: 'completed' }

jest.mock('@core/features/onboarding/store', () => ({
  __esModule: true,
  useOnboardingStore: (selector: (state: unknown) => unknown) =>
    selector({
      status: mockOnboarding.status,
      restoreFromStorage: async () => {
        mockCalls.push('restore:onboarding')
      },
      // `ApiKeyNoticeModal` 이 읽는 둘 — 이 파일의 관심사가 아니라 꺼진 상태로 둔다.
      apiKeyNotice: null,
      confirmApiKeyNotice: async () => {},
    }),
}))

jest.mock('@core/features/theme/store', () => ({
  __esModule: true,
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({
      restoreFromStorage: async () => {
        mockCalls.push('restore:theme')
      },
    }),
}))

jest.mock('@core/features/tracking-mode/store', () => ({
  __esModule: true,
  useTrackingModeStore: (selector: (state: unknown) => unknown) =>
    selector({
      restoreFromStorage: async () => {
        mockCalls.push('restore:trackingMode')
      },
    }),
}))

jest.mock('@core/features/drop-effect/store', () => ({
  __esModule: true,
  useDropEffectStore: (selector: (state: unknown) => unknown) =>
    selector({
      restoreFromStorage: async () => {
        mockCalls.push('restore:dropEffect')
      },
    }),
}))

// 동적 `import()` 를 가둔 셸 옆 모듈(`app/prehydrate.ts`)을 대체한다 — jest 에서 그 import 는
// **동기적으로 던져** 마운트를 통째로 죽인다(실측). 그 파일이 경계로 있는 이유가 이것이다.
jest.mock('../app/prehydrate', () => ({
  __esModule: true,
  prehydrateTabStores: async () => {
    mockCalls.push('prehydrate')
  },
}))

// OTA 부팅 확인도 포트를 거친다([[ADR-137]]). 다른 스토어와 같은 방식으로 대체해 **순서만** 본다 —
// 확인이 실제로 무엇을 하는지는 어댑터·스토어 테스트의 몫이다.
jest.mock('@core/features/live-update/store', () => ({
  __esModule: true,
  useLiveUpdateStore: {
    getState: () => ({
      checkOnBoot: async () => {
        mockCalls.push('checkOnBoot')
      },
    }),
  },
}))

// 키보드 구독은 포트를 거친다(`app/use-keyboard-visible.ts`). 주입 없이 렌더하면 슬롯이 던지고,
// 그 던짐이 이 파일에서는 배선 문제가 아니라 **관측 대상이 아닌 것**이다(어댑터는 자기 테스트가 있다).
jest.mock('@core/native/keyboard', () => ({
  __esModule: true,
  addKeyboardVisibilityListener: async () => () => {},
}))

jest.mock('@core/native/splash-screen', () => ({
  __esModule: true,
  hideSplashScreen: async () => {
    mockCalls.push('hideSplash')
  },
  showSplashScreen: async () => {},
}))

// 내비게이터는 이 파일의 관심사가 아니다(자기 테스트가 따로 있다). 진짜로 띄우면 순서 관측에
// react-navigation 의 마운트 이펙트가 섞인다.
jest.mock('../navigation/AppNavigation', () => {
  const { Text } = jest.requireActual('react-native') as typeof import('react-native')
  return {
    __esModule: true,
    AppNavigation: () => <Text>navigation</Text>,
  }
})

import { AppShell } from '../app/AppShell'
import { renderOverlay } from '../components/__tests__/render-atom'

const RN_ROOT = path.resolve(__dirname, '../..')

describe('① 셸이 무엇을 언제 하는가', () => {
  beforeEach(() => {
    mockCalls.length = 0
    mockOnboarding.status = 'completed'
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  async function mountShell(): Promise<void> {
    await renderOverlay(<AppShell />)
    // 복원 넷·예열은 마이크로태스크(그리고 예열은 동적 import)라 이펙트 뒤 한 번 흘려보내야 관측된다.
    await act(async () => {})
  }

  // 여기에 `startAds`(광고 SDK 초기화 + 사전 로드)가 다섯 번째 항목으로 있었다 — [[ADR-150]] 이
  // 전면광고를 걷으며 셸에서 사라졌다.
  it('복원 넷이 첫 렌더에 전부 시작된다', async () => {
    await mountShell()

    // 넷 사이에는 순서가 없다 — 서로 독립이고, 웹도 각자 자기 이펙트를 갖는다(하나가 던져도
    // 나머지가 돈다). 그래서 "전부 있었다"까지만 본다.
    expect(mockCalls).toEqual(
      expect.arrayContaining([
        'restore:onboarding',
        'restore:theme',
        'restore:trackingMode',
        'restore:dropEffect',
      ]),
    )
  })

  // [[ADR-101]] 결정 2·6. **완료 상태에서만** 도는 것이 계약이다 — `syncSchedules` 는 API 키·계정이
  // 없으면 던지므로, 온보딩 중에 돌리면 스토어가 error 로 시작하고 토스트까지 울린다.
  it('탭 스토어 선하이드레이션은 온보딩이 완료됐을 때만 돈다', async () => {
    await mountShell()
    expect(mockCalls).toContain('prehydrate')

    mockCalls.length = 0
    mockOnboarding.status = 'awaitingApiKey'
    await mountShell()

    expect(mockCalls).not.toContain('prehydrate')
  })

  // [[ADR-025]]: 네이티브 스플래시가 순식간에 지나가 깜빡이지 않게 최소 표시 시간을 채운다.
  // **첫 렌더에 곧바로 내리지 않는 것**이 그 결정이고, 이걸 잃으면 화면으로는 안 보인다
  // (콘텐츠가 빨리 준비될수록 스플래시가 번쩍이고 끝난다).
  it('스플래시는 최소 표시 시간을 채운 뒤에, 그리고 복원·예열보다 뒤에 내려간다', async () => {
    await mountShell()
    expect(mockCalls).not.toContain('hideSplash')

    await act(async () => {
      jest.advanceTimersByTime(1000)
    })

    expect(mockCalls).toContain('hideSplash')
    expect(mockCalls.indexOf('hideSplash')).toBeGreaterThan(mockCalls.indexOf('restore:theme'))
    expect(mockCalls.indexOf('hideSplash')).toBeGreaterThan(mockCalls.indexOf('prehydrate'))
  })
})

describe('② 진입점이 무엇을 먼저 하는가', () => {
  // 포트 주입은 저장소·네이티브를 만지는 **어떤 코드보다** 먼저다([[ADR-128]] 결정 4). 스플래시
  // 붙들기가 그다음인 것은 취향이 아니라 의존이다 — 실패 안전 타이머가 `SplashScreenPort` 를 거친다
  // ([[ADR-117]] 결정 3·4).
  it('installPorts() → holdSplashUntilAppReady() → registerRootComponent 순이다', () => {
    const entry = readFileSync(path.join(RN_ROOT, 'index.ts'), 'utf8')
    const order = ['installPorts()', 'holdSplashUntilAppReady()', 'registerRootComponent(App)'].map(
      (call) => entry.indexOf(`\n${call}`),
    )

    expect(order.every((index) => index > 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('③ OTA 배선 — 벽이 사라졌고, 사라진 채로 있어야 한다', () => {
  /** `packages/app-rn` 의 **제품 소스** 전부(테스트·스냅샷 제외). */
  const sources = ((): string[] => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) {
          return entry === '__tests__' || entry === '__snapshots__' ? [] : walk(full)
        }
        return /\.tsx?$/.test(entry) ? [full] : []
      })

    return [
      path.join(RN_ROOT, 'App.tsx'),
      path.join(RN_ROOT, 'index.ts'),
      ...walk(path.join(RN_ROOT, 'src')),
    ]
  })()

  const relative = (file: string): string => path.relative(RN_ROOT, file)

  // 여기 있던 세 케이스는 **«아직 안 이어져 있다»를 고정**하고 있었다(스토어를 타입으로만 import ·
  // `@core/native/live-update` 호출 0 · 모달 마운트 0). [[ADR-137]] 이 셋 다 뒤집었으므로 그대로
  // 두면 «구현하면 실패하는 테스트»가 된다. [[ADR-129]] 가 글롭 고정 테스트를 「0이어야 한다」로
  // 뒤집었을 때와 같은 처리다 — 감시 대상이 사라진 게 아니라 **묻는 질문이 바뀐 것**이다.
  //
  // 이제 묻는 것은 «벽이 정말 사라졌는가» 다. 벽은 core 가 **Vite 전용 API** 를 쓰는 것이었고,
  // 그것이 되살아나면 RN 은 다시 «import 하는 것만으로 죽는» 상태로 돌아간다. 그때 실패해야 하는
  // 자리는 이 모듈을 쓰는 화면 하나가 아니라 여기다.
  it('core 의 live-update 스토어에 `import.meta` 가 없다 — 그것이 벽이었다', () => {
    const store = readFileSync(
      path.join(RN_ROOT, '..', 'core', 'src', 'features', 'live-update', 'store.ts'),
      'utf8',
    )

    // 주석에서 그 이름을 **설명**하는 것은 막지 않는다(이 저장소는 왜 없앴는지를 코드 옆에 적는다).
    const codeLines = store.split('\n').filter((line) => !line.trimStart().startsWith('//'))

    expect(codeLines.filter((line) => line.includes('import.meta'))).toEqual([])
  })

  // 배선이 실제로 있는가 — 없으면 모달은 «그릴 줄은 알지만 아무것도 안 뜨는» 상태로 조용히
  // 되돌아간다(그 상태가 정상처럼 보이는 것이 원래 이 describe 가 걱정하던 것이다).
  it('`UpdatePromptModal` 이 마운트돼 있다', () => {
    const importers = sources.filter((file) =>
      /from '[^']*UpdatePromptModal'/.test(readFileSync(file, 'utf8')),
    )

    expect(importers.map(relative)).toEqual(['src/navigation/AppNavigation.tsx'])
  })
})

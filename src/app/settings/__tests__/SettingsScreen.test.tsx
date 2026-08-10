// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '../SettingsScreen'
import { useThemeStore } from '../../../features/theme/store'
import { useLiveUpdateStore } from '../../../features/live-update/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { loadCacheDataSizes } from '../../../features/settings/cache-data'

vi.mock('../../../features/theme/store', () => ({
  useThemeStore: vi.fn(),
}))

vi.mock('../../../features/live-update/store', () => ({
  useLiveUpdateStore: vi.fn(),
}))

vi.mock('../../../features/tracking-mode/store', () => ({
  useTrackingModeStore: vi.fn(),
}))

// 본화면이 대표값으로 캐시 총 용량을 읽는다(ADR-118 결정 5) — 화면은 `features/` 를 거치고
// 저장소·SQLite 는 그 아래가 맡는다(CLAUDE.md CRITICAL).
vi.mock('../../../features/settings/cache-data', () => ({
  loadCacheDataSizes: vi.fn(),
}))

const mockedUseThemeStore = vi.mocked(useThemeStore)
const mockedUseLiveUpdateStore = vi.mocked(useLiveUpdateStore)
const mockedUseTrackingModeStore = vi.mocked(useTrackingModeStore)
const mockedLoadCacheDataSizes = vi.mocked(loadCacheDataSizes)

function mockThemeStore(overrides: Partial<ReturnType<typeof useThemeStore>> = {}): void {
  mockedUseThemeStore.mockReturnValue({
    theme: '렌',
    restoreFromStorage: vi.fn(),
    selectTheme: vi.fn(),
    ...overrides,
  })
}

function mockTrackingModeStore(
  overrides: Partial<ReturnType<typeof useTrackingModeStore>> = {},
): void {
  mockedUseTrackingModeStore.mockReturnValue({
    mode: 'auto',
    restoreFromStorage: vi.fn(),
    setMode: vi.fn(),
    ...overrides,
  })
}

function mockLiveUpdateStore(overrides: Partial<ReturnType<typeof useLiveUpdateStore>> = {}): void {
  mockedUseLiveUpdateStore.mockReturnValue({
    currentVersion: '1.0.0',
    status: 'idle',
    availableVersion: null,
    availableSize: null,
    minNativeVersion: null,
    downloadProgress: 0,
    channel: 'production',
    pending: null,
    downloadedBundleId: null,
    loadCurrentVersion: vi.fn(),
    check: vi.fn(),
    checkOnBoot: vi.fn(),
    startDownload: vi.fn(),
    confirmCellularDownload: vi.fn(),
    apply: vi.fn(),
    openStore: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  })
}

// 하위 페이지 셋은 형제 라우트다(ADR-118 결정 2) — 여기서는 목적지에 프로브를 세워 이동만 본다.
// 실제 화면이 뜨는 것과 뒤로 돌아오는 것은 App.test.tsx 의 라우팅 통합 테스트가 본다.
function renderSettings(): void {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/release-notes" element={<div>개발 노트 프로브</div>} />
        <Route path="/settings/account-data" element={<div>계정 및 데이터 프로브</div>} />
        <Route path="/settings/about" element={<div>앱 정보 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockLiveUpdateStore()
  mockTrackingModeStore()
  mockThemeStore()
  // 기본은 "영원히 조회 중" — 자리표시(`- KB`)가 기본 상태라, 값이 필요한 케이스만 따로 세운다.
  mockedLoadCacheDataSizes.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsScreen', () => {
  // [[ADR-120]] 딸림 작업 — 문서 스크롤에 얹혀 있던 **마지막 탭 화면**이 자기 스크롤을 소유하게
  // 됐다([[ADR-099]]). 이것이 성립해야 [[ADR-098]] 결정 1(이동 전 `scrollTo(0, 0)`)을 지운 것이
  // 안전하고, 하위 페이지를 열었다 닫아도 보던 자리가 남는다. 되돌리지 말 것.
  it('자기 스크롤 컨테이너를 소유한다', () => {
    renderSettings()

    expect(screen.getByTestId('screen-scroll')).toBeInTheDocument()
  })

  // 이 화면에는 고정 헤더가 없어([[ADR-098]] 결정 3) `--sa-top` 을 넣어 줄 `PageHeader` 가 없고,
  // `ScreenScroll` 안쪽 래퍼가 콘텐츠를 화면 y=0 으로 끌어올린다. 그래서 **이 블록이 직접 가져야**
  // 제목이 노치 아래에 깔리지 않는다(실기기 보고 2026-08-09 — 계측: 제목 top 16px, 기대 63px).
  it('콘텐츠 블록이 상단 안전영역을 직접 갖는다', () => {
    renderSettings()

    // `screen-scroll` > 안쪽 래퍼(-mt) > 콘텐츠 블록
    const content = screen.getByTestId('screen-scroll').firstElementChild?.firstElementChild
    expect(content).toHaveClass('pt-[calc(1rem+var(--sa-top))]')
  })

  // ADR-118 결정 1 — 본화면은 카드 둘. **행은 5 → 6이 됐다**([[ADR-125]] 결정 1 정정,
  // 2026-08-10): 사용법 설명의 원천이 기능 카탈로그로 옮겨오면서 그 입구가 필요해졌다.
  // 「기능 설명」이 「개발 노트」 **위**인 것은 *"이 앱을 어떻게 쓰나"* 가 *"무엇이 바뀌었나"*
  // 보다 자주 묻는 질문이기 때문이다.
  it('행이 정확히 6개이고 순서가 값 카드 → 이동 카드다', () => {
    renderSettings()

    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(6)
    expect(rows.map((row) => row.textContent)).toEqual([
      '스케줄 관리 방법자동',
      '테마렌',
      '기능 설명',
      '개발 노트',
      '계정 및 데이터- KB',
      '앱 정보1.0.0',
    ])
  })

  // **이 step 의 핵심.** 두 무리를 가르는 것은 카드 경계뿐이다(결정 1) — 한 카드에 5행을 넣는
  // 시안 A 는 "성격이 다른 것이 한 덩어리로 읽힌다"는 이 개편의 문제를 그대로 둔다.
  it('값을 고르는 두 행과 화면이 넘어가는 네 행이 서로 다른 카드에 있다', () => {
    renderSettings()

    const cards = screen.getAllByTestId('settings-card')
    expect(cards).toHaveLength(2)

    expect(within(cards[0]).getAllByRole('button').map((row) => row.textContent)).toEqual([
      '스케줄 관리 방법자동',
      '테마렌',
    ])
    expect(within(cards[1]).getAllByRole('button').map((row) => row.textContent)).toEqual([
      '기능 설명',
      '개발 노트',
      '계정 및 데이터- KB',
      '앱 정보1.0.0',
    ])
  })

  // ADR-118 결정 4: 화살표가 "값이 있는가"가 아니라 "누르면 무언가 열린다"를 말한다.
  it.each(['스케줄 관리 방법', '테마'])('"%s" 행에 현재값 배지와 chevron 이 함께 있다', (label) => {
    mockThemeStore({ theme: '레테' })
    mockTrackingModeStore({ mode: 'manual' })
    renderSettings()

    const row = screen.getByRole('button', { name: new RegExp(label) })
    expect(within(row).getByTestId('settings-row-chevron')).toBeInTheDocument()
    expect(within(row).getByText(label === '테마' ? '레테' : '수동')).toBeInTheDocument()
  })

  it.each([
    ['개발 노트', '개발 노트 프로브'],
    ['계정 및 데이터', '계정 및 데이터 프로브'],
    ['앱 정보', '앱 정보 프로브'],
  ])('"%s" 행을 누르면 하위 페이지로 이동한다', async (label, probe) => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: new RegExp(label) }))

    expect(screen.getByText(probe)).toBeInTheDocument()
  })

  // ADR-118 결정 5 — 들어가지 않고도 안을 짐작하게 하는 값 하나.
  it('"계정 및 데이터" 우측에 캐시 총 용량(두 그룹의 합)을 표시한다', async () => {
    mockedLoadCacheDataSizes.mockResolvedValue({ general: 1024 * 1024, bossRecords: 1024 * 512 })
    renderSettings()

    const row = screen.getByRole('button', { name: /계정 및 데이터/ })
    expect(await within(row).findByText('1.5MB')).toBeInTheDocument()
  })

  // ADR-061 결정 7: 조회 전에도 값과 같은 자리를 잡는다(빈 문자열이면 값이 툭 나타나며 행이 밀린다).
  it('캐시 용량 조회 전에는 "- KB" 로 자리를 잡는다', () => {
    renderSettings()

    expect(
      within(screen.getByRole('button', { name: /계정 및 데이터/ })).getByText('- KB'),
    ).toBeInTheDocument()
  })

  it('"앱 정보" 우측에 실행 중인 번들 버전을 표시한다', () => {
    mockLiveUpdateStore({ currentVersion: '1.0.5' })
    renderSettings()

    expect(
      within(screen.getByRole('button', { name: /앱 정보/ })).getByText('1.0.5'),
    ).toBeInTheDocument()
  })

  // 결정 5: 후보가 전부 틀린 말을 한다 — "최신 버전"은 아래 `앱 정보` 행과 중복이고 "n개"는
  // 뜻이 없다. 없는 대표값을 지어내지 않는다.
  it('"개발 노트" 행에는 대표값을 두지 않는다', () => {
    renderSettings()

    expect(screen.getByRole('button', { name: /개발 노트/ })).toHaveTextContent(/^개발 노트$/)
  })

  it('"스케줄 관리 방법" 클릭 시 트래킹 모드 모달이 열린다', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: /스케줄 관리 방법/ }))

    expect(screen.getByTestId('tracking-mode-modal-overlay')).toBeInTheDocument()
  })

  it('"테마" 클릭 시 테마 선택 모달이 열린다', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: /테마/ }))

    expect(screen.getByTestId('theme-modal-overlay')).toBeInTheDocument()
  })

  // 행에는 이름 배지만 둔다 — 색 표식은 없앴다(ADR-104 결정 5, 본론은 유효).
  it('테마 행에 대표 컬러 표식이 없다', () => {
    mockThemeStore({ theme: '레테' })
    renderSettings()

    const row = screen.getByRole('button', { name: /테마/ })
    expect(within(row).queryByTestId('theme-swatch-dot')).not.toBeInTheDocument()
    expect(row.querySelectorAll('[style*="background"]')).toHaveLength(0)
  })

  // ADR-118 결정 3: 셋 다 `/settings/account-data` 로 내려갔다 — 되돌아오면 결정 1 의
  // "값을 고르는 카드"가 다시 혼종이 된다.
  it.each(['계정 변경', '연결 해제', '캐시 데이터 삭제', 'API 키 재입력'])(
    '"%s" 행을 본화면에 두지 않는다',
    (label) => {
      renderSettings()

      expect(screen.queryByRole('button', { name: new RegExp(label) })).not.toBeInTheDocument()
    },
  )

  it('하단에 앱 버전·카피라이트·NEXON Open API 출처 문구·비제휴 고지를 표시한다', () => {
    renderSettings()

    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
    expect(screen.getByText(/©\s*\d{4}\s*메이플 루틴/)).toBeInTheDocument()
    expect(screen.getByText('Data based on NEXON Open API')).toBeInTheDocument()
    expect(screen.getByText('Maple Routine is not associated with NEXON Korea')).toBeInTheDocument()
  })

  // ADR-118 결정 7·8: 개인정보 처리방침은 `/settings/about` 의 행으로 옮겼고, 고지 블록은
  // 전부 읽고 끝나는 정적 문구만 남는다 — 링크가 여기로 되돌아오면 그 균일함이 다시 깨진다.
  it('고지 블록은 4줄이고 링크를 두지 않는다', () => {
    renderSettings()

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('settings-footer').querySelectorAll('p')).toHaveLength(4)
  })

  it('하단 앱 버전은 빌드 시점 package.json이 아니라 현재 실행 중인 OTA 번들 버전을 표시한다', () => {
    mockLiveUpdateStore({ currentVersion: '1.0.5' })
    renderSettings()

    expect(screen.getByText('v1.0.5')).toBeInTheDocument()
  })

  it('현재 번들 버전을 알 수 없으면(web 등) package.json 버전으로 폴백한다', () => {
    mockLiveUpdateStore({ currentVersion: null, status: 'unsupported' })
    renderSettings()

    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
  })
})

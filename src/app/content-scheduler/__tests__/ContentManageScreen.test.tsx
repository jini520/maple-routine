// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentManageScreen } from '../ContentManageScreen'
import { useContentSchedulerStore, type ContentCharacterView } from '../../../features/content-scheduler/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'

vi.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: vi.fn(),
}))

const mockedUseContentSchedulerStore = vi.mocked(useContentSchedulerStore)

function mockStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore>>): void {
  mockedUseContentSchedulerStore.mockReturnValue({
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: ['ocid-1'],
    selectedOcid: 'ocid-1',
    manualTrackedByOcid: {},
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    addManualContent: vi.fn(),
    removeManualContent: vi.fn(),
    ...overrides,
  })
}

function character(overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    dailyContents: [],
    weeklyContents: [],
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

function renderManageScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/content/manage']}>
      <Routes>
        <Route path="/content/manage" element={<ContentManageScreen />} />
        <Route path="/content" element={<div>스케줄러 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('ContentManageScreen', () => {
  it('자동 모드에서 진입하면 /content로 리다이렉트된다', () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({ characters: [character()] })

    renderManageScreen()

    expect(screen.getByText('스케줄러 프로브')).toBeInTheDocument()
  })

  it('타이틀·대상 캐릭터 칩과 일간 탭의 템플릿 전체가 표시되고, 추적 중인 항목만 선택 상태다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '몬스터파크', kind: 'daily' }] },
    })

    renderManageScreen()

    expect(screen.getByText('컨텐츠 관리')).toBeInTheDocument()
    expect(screen.getByText('낟낟')).toBeInTheDocument()

    // 템플릿 전체가 항상 보인다 — 추적 중(몬스터파크)은 선택 상태, 나머지는 미선택
    expect(screen.getByRole('button', { name: /몬스터파크/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /소멸의 여로 조사/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('일간 몬스터파크는 "월드 당 최대 14회" 참고 태그를 표시한다 (사용자 지정 오버라이드)', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()

    expect(screen.getByText('월드 당 최대 14회')).toBeInTheDocument()
    // 기본 "최대 14회"는 더 이상 쓰지 않는다
    expect(screen.queryByText('최대 14회')).not.toBeInTheDocument()
  })

  it('주간 태그 오버라이드: 에픽 던전 ID당 1회·익스트림 몬스터파크 ID당 2회, 아케인리버 최대 1회 태그 제거', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getAllByText('ID당 1회')).toHaveLength(3) // 에픽 던전 3종
    expect(screen.getByText('ID당 2회')).toBeInTheDocument() // 익스트림 몬스터파크
    // 아케인리버 결계(에르다 스펙트럼 등)의 "최대 1회" 태그는 제거됨
    expect(screen.queryByText('최대 1회')).not.toBeInTheDocument()
  })

  it('반복 접두사를 그룹 헤더로 묶고, 행에는 접두사를 뗀 이름만 보여준다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()

    // "[일일 퀘스트]"는 헤더로 한 번만, 행 버튼 이름은 접두사가 빠진 알맹이다
    expect(screen.getByText('일일 퀘스트')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '소멸의 여로 조사' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /\[일일 퀘스트\]/ })).not.toBeInTheDocument()
  })

  it('주간 탭으로 전환하면 주간 템플릿이 표시된다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('button', { name: /무릉도장/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^몬스터파크/ })).not.toBeInTheDocument()
  })

  it('미추적 항목을 탭하면 현재 탭의 kind로 addManualContent가 즉시 호출된다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const addManualContent = vi.fn()
    mockStore({ characters: [character()], addManualContent })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: /몬스터파크/ }))

    expect(addManualContent).toHaveBeenCalledWith('ocid-1', '몬스터파크', 'daily')
  })

  it('추적 중 항목을 탭하면 removeManualContent가 즉시 호출된다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const removeManualContent = vi.fn()
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '무릉도장', kind: 'weekly' }] },
      removeManualContent,
    })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    fireEvent.click(screen.getByRole('button', { name: /무릉도장/ }))

    expect(removeManualContent).toHaveBeenCalledWith('ocid-1', '무릉도장', 'weekly')
  })

  it('뒤로 버튼을 누르면 컨텐츠 스케줄러로 돌아간다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))

    expect(screen.getByText('스케줄러 프로브')).toBeInTheDocument()
  })

  it('표시할 캐릭터가 없으면 안내 문구를 보여준다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [], trackedOcids: [] })

    renderManageScreen()

    expect(screen.getByText(/캐릭터를 먼저 선택/)).toBeInTheDocument()
  })
})

// ADR-055(이슈 #32): 요구 레벨 미달 항목은 선택할 수 없다. 보스와 판정 로직을 공유하고
// (lib/required-level) 표현만 이 화면 규칙을 따른다.
describe('ContentManageScreen — 요구 레벨 미달 잠금 (ADR-055)', () => {
  it('레벨이 모자란 항목은 토글을 비활성화하고 요구 레벨을 표시한다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    // 기어드락 일일퀘는 295 요구 — 레벨 200 캐릭터는 잠긴다.
    mockStore({ characters: [character({ level: 200 })] })

    renderManageScreen()

    const locked = screen.getByRole('button', { name: /기어드락/ })
    expect(locked).toBeDisabled()
    expect(locked).toHaveTextContent('Lv.295')
  })

  it('레벨을 충족하는 항목은 잠기지 않는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ level: 200 })] })

    renderManageScreen()

    expect(screen.getByRole('button', { name: /몬스터파크/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /소멸의 여로 조사/ })).not.toBeDisabled()
  })

  it('캐릭터 레벨을 모르면(캐시 미스) 잠그지 않는다 — 결정 5', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ level: null })] })

    renderManageScreen()

    expect(screen.getByRole('button', { name: /기어드락/ })).not.toBeDisabled()
  })

  it('요구 레벨이 없는 항목(레벨 제한 없음)은 잠그지 않는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ level: 10 })] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('button', { name: /지하 수로/ })).not.toBeDisabled()
  })

  it('이미 추적 중인 항목이 레벨 미달이 되어도 해제할 수 있어야 하므로 활성 상태를 유지한다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const removeManualContent = vi.fn()
    mockStore({
      characters: [character({ level: 200 })],
      manualTrackedByOcid: {
        'ocid-1': [{ contentName: '[일일 퀘스트] 기어드락 크로노스의 잔재 수집', kind: 'daily' }],
      },
      removeManualContent,
    })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: /기어드락/ }))

    expect(removeManualContent).toHaveBeenCalledWith(
      'ocid-1',
      '[일일 퀘스트] 기어드락 크로노스의 잔재 수집',
      'daily',
    )
  })
})

// ADR-057: 길드 콘텐츠는 길드에 가입한 캐릭터만 선택할 수 있다.
describe('ContentManageScreen — 길드 미가입 잠금 (ADR-057)', () => {
  it('길드가 있으면 길드 콘텐츠를 선택할 수 있다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ guildName: '메이플길드' })] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('button', { name: /지하 수로/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /플래그 레이스/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /주간 미션 포인트/ })).not.toBeDisabled()
  })

  it('길드 미가입(guildName: null)이면 길드 콘텐츠 3종을 모두 비활성화하고 "길드 필요"를 표시한다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ guildName: null })] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    const waterway = screen.getByRole('button', { name: /지하 수로/ })
    expect(waterway).toBeDisabled()
    expect(waterway).toHaveTextContent('길드 필요')
    expect(screen.getByRole('button', { name: /플래그 레이스/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /주간 미션 포인트/ })).toBeDisabled()
  })

  it('길드 미가입이어도 길드 외 콘텐츠는 잠그지 않는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ guildName: null })] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('button', { name: /무릉도장/ })).not.toBeDisabled()
  })

  it('길드 정보를 모르면(guildName: undefined) 잠그지 않는다 — 모름을 미가입으로 취급하지 않는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ guildName: undefined })] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))

    expect(screen.getByRole('button', { name: /지하 수로/ })).not.toBeDisabled()
  })

  it('이미 추적 중인 길드 콘텐츠는 길드를 나가도 해제할 수 있어야 하므로 활성 상태를 유지한다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const removeManualContent = vi.fn()
    mockStore({
      characters: [character({ guildName: null })],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '[길드] 지하 수로', kind: 'weekly' }] },
      removeManualContent,
    })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    fireEvent.click(screen.getByRole('button', { name: /지하 수로/ }))

    expect(removeManualContent).toHaveBeenCalledWith('ocid-1', '[길드] 지하 수로', 'weekly')
  })
})

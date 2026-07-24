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

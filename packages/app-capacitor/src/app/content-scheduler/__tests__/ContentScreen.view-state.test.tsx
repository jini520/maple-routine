// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentScreen } from '../ContentScreen'
import { ContentManageScreen } from '../ContentManageScreen'
import {
  useContentSchedulerStore,
  type ContentCharacterView,
} from '@core/features/content-scheduler/store'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'

// [[ADR-096]] 이슈 #143 — 탭 선택이 화면 로컬 state 라 ① 다른 탭에 다녀오면 초기화되고
// ② 스케줄러와 관리 페이지가 서로의 탭을 몰랐다. 두 증상 모두 **화면이 사라졌다 다시 그려지는**
// 순간에만 드러나므로, 한 번 렌더해서 보는 테스트로는 잡히지 않는다. 그래서 이 파일은 다른
// 화면 테스트와 달리 **스토어를 모킹하지 않고 실물을 쓰고**, 언마운트 후 재마운트를 직접 한다.
// 네트워크를 타는 loadTrackedOcids 만 setState 로 무력화한다.

vi.mock('@core/features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))

vi.mock('@core/features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@core/features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: vi.fn(async (onUpdate: (entries: []) => void) => {
    onUpdate([])
  }),
}))

function character(overrides: Partial<ContentCharacterView> = {}): ContentCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    world: '스카니아',
    dailyContents: [],
    weeklyContents: [],
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

const selectCharacterSpy = vi.fn()

function seedStore(overrides: Partial<ReturnType<typeof useContentSchedulerStore.getState>> = {}): void {
  useContentSchedulerStore.setState({
    status: 'loaded',
    characters: [character()],
    error: null,
    trackedOcids: ['ocid-1'],
    selectedOcid: 'ocid-1',
    manualTrackedByOcid: {},
    activeTab: 'daily',
    // 마운트마다 도는 초기 로드는 저장소·네트워크를 타므로 무력화한다. 이 테스트가 보는 것은
    // 탭 상태의 수명이지 로딩 경로가 아니다.
    loadTrackedOcids: vi.fn(async () => {}),
    selectCharacter: selectCharacterSpy,
    ...overrides,
  })
}

function renderScheduler(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/content']}>
      <Routes>
        <Route path="/content" element={<ContentScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderManage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/content/manage']}>
      <Routes>
        <Route path="/content/manage" element={<ContentManageScreen />} />
        <Route path="/content" element={<div>스케줄러 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  seedStore()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('ADR-096: 컨텐츠 스케줄러 탭 상태', () => {
  it('주간 탭을 고르고 화면을 벗어났다 돌아와도 주간 탭이다', () => {
    const first = renderScheduler()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    expect(screen.getByText('등록된 주간 컨텐츠가 없습니다')).toBeInTheDocument()

    // 탭 이동 = 라우트 언마운트. 화면 로컬 state 였다면 여기서 값이 사라진다.
    first.unmount()
    renderScheduler()

    expect(screen.getByText('등록된 주간 컨텐츠가 없습니다')).toBeInTheDocument()
    expect(screen.queryByText('등록된 일간 컨텐츠가 없습니다')).not.toBeInTheDocument()
  })

  it('주간에서 컨텐츠 관리로 들어가면 주간 관리 페이지가 열린다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    const scheduler = renderScheduler()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    scheduler.unmount()

    renderManage()

    // 무릉도장은 주간 템플릿에만 있다 — 일간으로 열렸다면 없다.
    expect(screen.getByRole('button', { name: /무릉도장/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /소멸의 여로 조사/ })).not.toBeInTheDocument()
  })

  it('일간에서 컨텐츠 관리로 들어가면 일간 관리 페이지가 열린다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    const scheduler = renderScheduler()
    scheduler.unmount()

    renderManage()

    expect(screen.getByRole('button', { name: /소멸의 여로 조사/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /무릉도장/ })).not.toBeInTheDocument()
  })

  // ADR-096 결정 2: 이어받기는 스케줄러 → 관리 한 방향뿐이다. 되돌리면 관리 페이지에서 잠깐
  // 다른 탭을 뒤져본 것 때문에 돌아갔을 때 보던 화면이 바뀌어, 이 이슈가 고치려던 문제를
  // 반대 방향으로 다시 만든다.
  it('관리 페이지에서 탭을 바꿔도 스케줄러는 진입 시점 탭 그대로다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    const manage = renderManage()
    // 진입 시점은 일간(seedStore 기본값). 여기서 주간으로 옮겨 본다.
    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    expect(screen.getByRole('button', { name: /무릉도장/ })).toBeInTheDocument()
    manage.unmount()

    renderScheduler()

    expect(screen.getByText('추적할 일간 컨텐츠가 없습니다')).toBeInTheDocument()
    expect(screen.queryByText('추적할 주간 컨텐츠가 없습니다')).not.toBeInTheDocument()
  })

  it('관리 페이지를 다시 열면 그때의 스케줄러 탭을 새로 이어받는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    // 관리 페이지에서 주간으로 옮겼다 나온다 — 스케줄러는 일간 그대로다.
    const firstVisit = renderManage()
    fireEvent.click(screen.getByRole('button', { name: '주간' }))
    firstVisit.unmount()

    // 다시 들어가면 직전 방문의 주간이 아니라 스케줄러의 일간을 이어받는다.
    renderManage()

    expect(screen.getByRole('button', { name: /소멸의 여로 조사/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /무릉도장/ })).not.toBeInTheDocument()
  })
})

describe('ADR-096 결정 4: 관리 페이지 캐릭터 드롭다운', () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
    seedStore({
      characters: [
        character(),
        character({ ocid: 'ocid-2', characterName: '캐릭터2', world: '베라' }),
      ],
    })
  })

  it('읽기 전용 칩이 아니라 캐릭터를 고를 수 있는 드롭다운이다', () => {
    renderManage()

    const dropdown = screen.getByRole('combobox')
    expect(dropdown).toHaveValue('ocid-1')
    expect(screen.getByRole('option', { name: '캐릭터2' })).toBeInTheDocument()
  })

  it('드롭다운으로 캐릭터를 바꾸면 스케줄러와 같은 selectCharacter를 호출한다', () => {
    renderManage()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ocid-2' } })

    expect(selectCharacterSpy).toHaveBeenCalledWith('ocid-2')
  })
})

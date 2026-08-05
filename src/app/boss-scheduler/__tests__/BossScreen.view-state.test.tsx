// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BossScreen } from '../BossScreen'
import { BossManageScreen } from '../BossManageScreen'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'

// [[ADR-096]] 이슈 #143 — 컨텐츠 쪽과 같은 결함이다. 양쪽 기본값이 모두 'weekly' 라 증상이
// 월간 탭에서만 드러났을 뿐 구조는 동일했다. 솔로/파티 필터도 같은 로컬 state 라 함께 옮긴다
// (결정 1 — 탭만 살리면 "탭은 기억하는데 필터만 초기화"되는 반쪽 상태가 된다).
// 컨텐츠 view-state 테스트와 같은 이유로 스토어를 모킹하지 않고 실물을 쓴다.

vi.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }) },
}))

vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: vi.fn(async (onUpdate: (entries: []) => void) => {
    onUpdate([])
  }),
}))

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    world: '스카니아',
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

const selectCharacterSpy = vi.fn()

function seedStore(overrides: Partial<ReturnType<typeof useBossSchedulerStore.getState>> = {}): void {
  useBossSchedulerStore.setState({
    status: 'loaded',
    characters: [character()],
    error: null,
    trackedOcids: ['ocid-1'],
    selectedOcid: 'ocid-1',
    partySizes: {},
    manualTrackedByOcid: {},
    activeTab: 'weekly',
    weeklyFilter: 'all',
    monthlyFilter: 'all',
    loadTrackedOcids: vi.fn(async () => {}),
    selectCharacter: selectCharacterSpy,
    ...overrides,
  })
}

function renderScheduler(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/boss']}>
      <Routes>
        <Route path="/boss" element={<BossScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderManage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/boss/manage']}>
      <Routes>
        <Route path="/boss/manage" element={<BossManageScreen />} />
        <Route path="/boss" element={<div>스케줄러 프로브</div>} />
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

describe('ADR-096: 보스 스케줄러 탭 상태', () => {
  it('월간 탭을 고르고 화면을 벗어났다 돌아와도 월간 탭이다', () => {
    const first = renderScheduler()
    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    expect(screen.getByText('등록된 월간 보스가 없습니다')).toBeInTheDocument()

    first.unmount()
    renderScheduler()

    expect(screen.getByText('등록된 월간 보스가 없습니다')).toBeInTheDocument()
    expect(screen.queryByText('등록된 주간 보스가 없습니다')).not.toBeInTheDocument()
  })

  it('월간에서 보스 관리로 들어가면 월간 관리 페이지가 열린다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    const scheduler = renderScheduler()
    fireEvent.click(screen.getByRole('button', { name: '월간' }))
    scheduler.unmount()

    renderManage()

    // 검은마법사는 월간 목록에만 있다 — 주간으로 열렸다면 없다.
    expect(screen.getByRole('button', { name: /검은마법사/ })).toBeInTheDocument()
  })

  it('주간에서 보스 관리로 들어가면 주간 관리 페이지가 열린다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })

    const scheduler = renderScheduler()
    scheduler.unmount()

    renderManage()

    expect(screen.queryByRole('button', { name: /검은마법사/ })).not.toBeInTheDocument()
  })
})

describe('ADR-096 결정 1: 솔로/파티 필터도 함께 유지된다', () => {
  it('필터를 고르고 화면을 벗어났다 돌아와도 그 필터다', () => {
    const first = renderScheduler()
    fireEvent.click(screen.getByRole('button', { name: '솔로' }))
    first.unmount()

    renderScheduler()

    expect(useBossSchedulerStore.getState().weeklyFilter).toBe('solo')
    expect(screen.getByRole('button', { name: '솔로' })).toHaveClass('font-semibold')
  })

  it('두 탭의 필터는 서로 독립이다 — 주간 필터를 바꿔도 월간은 전체다', () => {
    renderScheduler()

    fireEvent.click(screen.getByRole('button', { name: '솔로' }))
    fireEvent.click(screen.getByRole('button', { name: '월간' }))

    expect(screen.getByRole('button', { name: '전체' })).toHaveClass('font-semibold')
    expect(useBossSchedulerStore.getState().weeklyFilter).toBe('solo')
    expect(useBossSchedulerStore.getState().monthlyFilter).toBe('all')
  })
})

describe('ADR-096 결정 4: 보스 관리 페이지 캐릭터 드롭다운', () => {
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

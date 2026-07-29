// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BossManageScreen } from '../BossManageScreen'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { useToastStore } from '../../../features/toast/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import type { MatchedBoss } from '../../../lib/boss-matching'

vi.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: vi.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

const mockedUseBossSchedulerStore = vi.mocked(useBossSchedulerStore)

function mockStore(overrides: Partial<ReturnType<typeof useBossSchedulerStore>>): void {
  mockedUseBossSchedulerStore.mockReturnValue({
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: ['ocid-1'],
    selectedOcid: 'ocid-1',
    partySizes: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: vi.fn(),
    saveTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    selectCharacter: vi.fn(),
    loadPartySizes: vi.fn(),
    setPartySize: vi.fn(),
    addManualBoss: vi.fn(),
    removeManualBoss: vi.fn(),
    ...overrides,
  })
}

function registeredBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    apiName: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    matchedBossName: '자쿰',
    portraitSlug: null,
    isSeasonBoss: false,
    ...overrides,
  }
}

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
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

function renderManageScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/boss/manage']}>
      <Routes>
        <Route path="/boss/manage" element={<BossManageScreen />} />
        <Route path="/boss" element={<div>스케줄러 프로브</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function bossRow(bossName: string): HTMLElement {
  const row = screen.getByText(bossName).closest('li')
  if (row === null) throw new Error(`${bossName} 행을 찾지 못했습니다`)
  return row
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('BossManageScreen — 공통', () => {
  it('타이틀·캐릭터 칩이 표시되고, 뒤로 버튼으로 보스 스케줄러로 돌아간다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()

    expect(screen.getByText('보스 관리')).toBeInTheDocument()
    expect(screen.getByText('낟낟')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByText('스케줄러 프로브')).toBeInTheDocument()
  })

  it('표시할 캐릭터가 없으면 안내 문구를 보여준다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ status: 'loaded', characters: [], trackedOcids: [] })

    renderManageScreen()

    expect(screen.getByText(/캐릭터를 먼저 선택/)).toBeInTheDocument()
  })

  // ADR-060/ADR-061 결정 10: 로딩을 빈 상태로 위장하지 않는다.
  it('조회가 끝나기 전에는 빈 상태 문구 대신 로딩 카드를 보여준다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ status: 'loading', characters: [], trackedOcids: null })

    renderManageScreen()

    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
    expect(screen.queryByText(/캐릭터를 먼저 선택/)).not.toBeInTheDocument()
  })
})

describe('BossManageScreen — 수동 모드', () => {
  it('주간 탭에 전체 보스(주간+시즌 주간)가 나오고, 추적 중인 보스만 선택 상태다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({
      // 시즌 보스는 챌린저스 월드에서만 나온다(ADR-056) — 전체 목록을 보려면 그 월드여야 한다.
      characters: [character({ world: '챌린저스' })],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] },
    })

    renderManageScreen()

    expect(screen.getByRole('button', { name: '자쿰' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '루시드' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '시즌 보스 메이린' })).toBeInTheDocument()
    // 월간 보스는 주간 탭에 없다
    expect(screen.queryByRole('button', { name: '검은마법사' })).not.toBeInTheDocument()
  })

  it('월간 탭으로 전환하면 월간 보스가 나온다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character()] })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '월간' }))

    expect(screen.getByRole('button', { name: '검은마법사' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '자쿰' })).not.toBeInTheDocument()
  })

  it('추적 중인 행에만 난이도 뱃지와 파티 스테퍼가 펼쳐진다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] },
    })

    renderManageScreen()

    expect(within(bossRow('자쿰')).getByRole('button', { name: '자쿰 파티원 수 증가' })).toBeInTheDocument()
    expect(within(bossRow('루시드')).queryByRole('button', { name: '루시드 파티원 수 증가' })).not.toBeInTheDocument()
  })

  it('미추적 보스를 탭하면 기본 난이도(등록 난이도 우선, 없으면 첫 난이도)로 addManualBoss가 호출된다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const addManualBoss = vi.fn()
    mockStore({
      characters: [
        character({
          weeklyBosses: [
            registeredBoss({ apiName: '루시드', matchedBossName: '루시드', difficulty: '하드' }),
          ],
        }),
      ],
      addManualBoss,
    })

    renderManageScreen()

    // 루시드는 이 캐릭터가 하드로 등록해둠 → 첫 난이도(이지)가 아니라 하드로 추가
    fireEvent.click(screen.getByRole('button', { name: '루시드' }))
    expect(addManualBoss).toHaveBeenCalledWith('ocid-1', '루시드', '하드')

    // 자쿰은 미등록 → 첫 지원 난이도(카오스)로 추가
    fireEvent.click(screen.getByRole('button', { name: '자쿰' }))
    expect(addManualBoss).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
  })

  it('추적 중인 보스를 탭하면 추적 난이도로 removeManualBoss가 호출된다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const removeManualBoss = vi.fn()
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '루시드', kind: 'boss', difficulty: '이지' }] },
      removeManualBoss,
    })

    renderManageScreen()
    fireEvent.click(screen.getByRole('button', { name: '루시드' }))

    expect(removeManualBoss).toHaveBeenCalledWith('ocid-1', '루시드', '이지')
  })

  it('추적 중인 보스의 다른 난이도 뱃지를 누르면 (보스,난이도) 멤버십이 교체된다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const addManualBoss = vi.fn().mockResolvedValue(undefined)
    const removeManualBoss = vi.fn().mockResolvedValue(undefined)
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '루시드', kind: 'boss', difficulty: '이지' }] },
      addManualBoss,
      removeManualBoss,
    })

    renderManageScreen()
    fireEvent.click(within(bossRow('루시드')).getByRole('button', { name: '하드' }))

    await vi.waitFor(() => {
      expect(removeManualBoss).toHaveBeenCalledWith('ocid-1', '루시드', '이지')
      expect(addManualBoss).toHaveBeenCalledWith('ocid-1', '루시드', '하드')
    })
  })

  it('파티 스테퍼를 누르면 즉시 setPartySize가 호출되고, 경계에서 버튼이 비활성화된다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const setPartySize = vi.fn().mockResolvedValue(undefined)
    mockStore({
      characters: [character()],
      manualTrackedByOcid: { 'ocid-1': [{ contentName: '자쿰', kind: 'boss', difficulty: '카오스' }] },
      partySizes: { 'ocid-1:자쿰:카오스': 6 },
      setPartySize,
    })

    renderManageScreen()
    const row = within(bossRow('자쿰'))

    // 자쿰 카오스 최대 6인 — 현재 6이라 증가는 비활성, 감소는 동작
    expect(row.getByRole('button', { name: '자쿰 파티원 수 증가' })).toBeDisabled()
    fireEvent.click(row.getByRole('button', { name: '자쿰 파티원 수 감소' }))
    expect(setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 5)
  })
})

describe('BossManageScreen — 자동 모드', () => {
  it('안내 문구가 보이고, 기본(등록된 보스만 보기 ON)으로 등록 보스만 나오며 체크 토글이 없다', () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({
      characters: [character({ weeklyBosses: [registeredBoss()] })],
    })

    renderManageScreen()

    expect(screen.getByText(/파티 인원만 설정할 수 있어요/)).toBeInTheDocument()

    const toggle = screen.getByRole('switch', { name: '등록된 보스만 보기' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    // 등록된 자쿰만 행으로 나온다 — 행은 체크 토글 버튼이 아니다(aria-pressed 없음)
    expect(screen.getByText('자쿰')).toBeInTheDocument()
    expect(screen.queryByText('루시드')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '자쿰' })).not.toBeInTheDocument()
  })

  it('토글을 끄면 전체 보스가 나와 미등록 보스도 파티를 미리 설정할 수 있다', () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    const setPartySize = vi.fn().mockResolvedValue(undefined)
    mockStore({
      characters: [character({ weeklyBosses: [registeredBoss()] })],
      setPartySize,
    })

    renderManageScreen()
    fireEvent.click(screen.getByRole('switch', { name: '등록된 보스만 보기' }))

    fireEvent.click(within(bossRow('루시드')).getByRole('button', { name: '루시드 파티원 수 증가' }))
    // 루시드 미등록 → 첫 지원 난이도(이지) 기준으로 저장
    expect(setPartySize).toHaveBeenCalledWith('ocid-1', '루시드', '이지', 2)
  })

  it('등록된 보스가 하나도 없으면 토글이 ON이어도 전체 보스 목록으로 대체된다', () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({ characters: [character()] })

    renderManageScreen()

    expect(screen.getByText('자쿰')).toBeInTheDocument()
    expect(screen.getByText('루시드')).toBeInTheDocument()
  })

  it('등록 난이도가 기본 선택되고, 스테퍼는 그 난이도 기준으로 저장한다', () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    const setPartySize = vi.fn().mockResolvedValue(undefined)
    mockStore({
      characters: [
        character({
          weeklyBosses: [registeredBoss({ apiName: '루시드', matchedBossName: '루시드', difficulty: '하드' })],
        }),
      ],
      partySizes: { 'ocid-1:루시드:하드': 2 },
      setPartySize,
    })

    renderManageScreen()
    const row = within(bossRow('루시드'))

    // 루시드의 첫 난이도(이지)가 아니라 등록 난이도(하드)가 선택돼 있고 그 파티원 수(2)를 보여준다
    expect(row.getByRole('button', { name: '하드' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(row.getByRole('button', { name: '루시드 파티원 수 증가' }))
    expect(setPartySize).toHaveBeenCalledWith('ocid-1', '루시드', '하드', 3)
  })
})

// ADR-055(이슈 #62): 수동 선택 가드 — 주간 보스 12개 한도.
describe('BossManageScreen — 주간 12개 한도 (ADR-055)', () => {
  // weekly-bosses.json 주간 섹션 앞부분 12종 — 실재 이름이어야 주기·시즌 판정이 통한다.
  const TWELVE_WEEKLY_BOSSES = [
    '자쿰',
    '매그너스',
    '파풀라투스',
    '반반',
    '피에르',
    '블러디 퀸',
    '벨룸',
    '스우',
    '데미안',
    '가디언 엔젤 슬라임',
    '루시드',
    '윌',
  ]

  function trackedBosses(bossNames: string[]): Array<{ contentName: string; kind: 'boss'; difficulty: string }> {
    return bossNames.map((contentName) => ({ contentName, kind: 'boss' as const, difficulty: '노멀' }))
  }

  describe('주간 12개 한도 (#62)', () => {
    it('주간 탭 헤더에 n/12 카운터를 표시한다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(['자쿰', '스우']) },
      })

      renderManageScreen()

      expect(screen.getByText('2/12')).toBeInTheDocument()
    })

    it('시즌 보스·월간 보스는 카운터에 포함하지 않는다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: {
          'ocid-1': [
            ...trackedBosses(['자쿰']),
            { contentName: '시즌 보스 메이린', kind: 'boss', difficulty: '노멀' },
            { contentName: '검은마법사', kind: 'boss', difficulty: '하드' },
          ],
        },
      })

      renderManageScreen()

      expect(screen.getByText('1/12')).toBeInTheDocument()
    })

    it('월간 탭에는 카운터를 표시하지 않는다 — 12는 주간 한도다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(['자쿰', '스우']) },
      })

      renderManageScreen()
      fireEvent.click(screen.getByRole('button', { name: '월간' }))

      expect(screen.queryByText('2/12')).not.toBeInTheDocument()
    })

    it('한도에 도달해도 미선택 보스의 토글을 비활성화하지 않는다 — 눌러야 이유를 알릴 수 있다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(TWELVE_WEEKLY_BOSSES) },
      })

      renderManageScreen()

      expect(screen.getByRole('button', { name: '더스크' })).not.toBeDisabled()
      // 대신 행을 흐리게 둬 "지금은 고를 수 없다"를 먼저 보여준다
      expect(bossRow('더스크').className).toContain('opacity-40')
      expect(bossRow('자쿰').className).not.toContain('opacity-40')
    })

    it('한도가 찬 상태에서 미선택 보스를 누르면 토스트로 이유를 알린다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      useToastStore.setState({ toasts: [], queue: [] })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(TWELVE_WEEKLY_BOSSES) },
        addManualBoss: vi.fn().mockResolvedValue('limitReached'),
      })

      renderManageScreen()
      fireEvent.click(screen.getByRole('button', { name: '더스크' }))

      // 실패가 아니라 규칙 안내이므로 error가 아닌 자동 소멸 토스트(info)여야 한다.
      await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
      const [toast] = useToastStore.getState().toasts
      expect(toast.message).toBe('주간 12개를 모두 선택했어요')
      expect(toast.variant).toBe('info')
      expect(toast.duration).not.toBeNull()
    })

    it('한도에 걸리지 않은 추가는 토스트를 띄우지 않는다', async () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      useToastStore.setState({ toasts: [], queue: [] })
      mockStore({
        characters: [character()],
        addManualBoss: vi.fn().mockResolvedValue('added'),
      })

      renderManageScreen()
      fireEvent.click(screen.getByRole('button', { name: '자쿰' }))

      await waitFor(() => expect(useToastStore.getState().toasts).toEqual([]))
    })

    it('한도에 도달해도 이미 선택된 보스는 해제할 수 있어야 하므로 활성 상태를 유지한다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      const removeManualBoss = vi.fn()
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(TWELVE_WEEKLY_BOSSES) },
        removeManualBoss,
      })

      renderManageScreen()
      fireEvent.click(screen.getByRole('button', { name: '자쿰' }))

      expect(removeManualBoss).toHaveBeenCalledWith('ocid-1', '자쿰', '노멀')
    })

    it('한도에 도달해도 시즌 보스는 선택할 수 있다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        characters: [character({ world: '챌린저스' })],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(TWELVE_WEEKLY_BOSSES) },
      })

      renderManageScreen()

      expect(screen.getByRole('button', { name: '시즌 보스 메이린' })).not.toBeDisabled()
    })

    it('한도에 도달해도 월간 탭의 보스는 선택할 수 있다', () => {
      useTrackingModeStore.setState({ mode: 'manual' })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(TWELVE_WEEKLY_BOSSES) },
      })

      renderManageScreen()
      fireEvent.click(screen.getByRole('button', { name: '월간' }))

      expect(screen.getByRole('button', { name: '검은마법사' })).not.toBeDisabled()
    })

    it('자동 모드에는 카운터를 표시하지 않는다 — 선택 자체가 없다', () => {
      useTrackingModeStore.setState({ mode: 'auto' })
      mockStore({
        characters: [character()],
        manualTrackedByOcid: { 'ocid-1': trackedBosses(['자쿰', '스우']) },
      })

      renderManageScreen()

      expect(screen.queryByText('2/12')).not.toBeInTheDocument()
    })
  })
})

// ADR-056: 목록 구성 규칙 — 미출시 보스 제외, 시즌 보스는 챌린저스 월드 전용.
describe('BossManageScreen — 목록 구성 (ADR-056)', () => {
  it('미출시 보스(벨로나)는 목록에 나오지 않는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ world: '스카니아' })] })

    renderManageScreen()

    expect(screen.queryByRole('button', { name: '벨로나' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '자쿰' })).toBeInTheDocument()
  })

  it('챌린저스 월드 캐릭터에게는 시즌 보스가 나온다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ world: '챌린저스2' })] })

    renderManageScreen()

    expect(screen.getByRole('button', { name: '시즌 보스 메이린' })).toBeInTheDocument()
  })

  it('일반 월드 캐릭터에게는 시즌 보스가 나오지 않는다', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ world: '스카니아' })] })

    renderManageScreen()

    expect(screen.queryByRole('button', { name: '시즌 보스 메이린' })).not.toBeInTheDocument()
  })

  it('월드를 모르면(구버전 캐시) 시즌 보스를 숨긴다 — 보스 스케줄러의 시즌 배지와 같은 판정', () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ characters: [character({ world: undefined })] })

    renderManageScreen()

    expect(screen.queryByRole('button', { name: '시즌 보스 메이린' })).not.toBeInTheDocument()
  })

  it('자동 모드에서도 같은 규칙이 적용된다', () => {
    useTrackingModeStore.setState({ mode: 'auto' })
    mockStore({ characters: [character({ world: '스카니아' })] })

    renderManageScreen()

    expect(screen.queryByText('시즌 보스 메이린')).not.toBeInTheDocument()
    expect(screen.queryByText('벨로나')).not.toBeInTheDocument()
  })
})

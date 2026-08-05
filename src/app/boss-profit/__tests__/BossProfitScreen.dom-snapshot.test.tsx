// @vitest-environment jsdom
//
// ADR-094 결정 4의 안전장치 — 3단계 리팩터링(atoms 치환 · compound 전환 · 순수 함수 분리 ·
// 디렉터리 이동) 동안 **렌더 결과 DOM 이 1:1 로 같은지** 대조한다.
//
// 이 화면을 첫 대상으로 삼은 이유: ADR 언급 117개(15줄당 1회) · 레이아웃 실측 7곳 ·
// isolate/sticky/z-* 참조 65개로 저장소에서 가장 취약하고, 그 값들이 ADR-077·080·084·085 에서
// 실기기로 여러 번 틀린 끝에 얻은 것이기 때문이다. jsdom 은 레이아웃을 계산하지 않아
// 기존 141케이스가 이 영역만 못 잡는다.
//
// 잡는 것: 클래스 문자열, DOM 중첩, 형제 순서, 속성.
// 못 잡는 것: 실제 흡착·스태킹 결과(그건 실기기 몫이다). 다만 **입력이 같으면 결과도 같다**는
// 성질에 기대는 것이라, DOM 이 보존되는 한 그 결정들은 깨질 수 없다.
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCountUpMemory } from '../../../lib/use-count-up'
import { domSnapshot } from '../../../__tests__/dom-snapshot.helper'
import { BossProfitScreen } from '../BossProfitScreen'
import {
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitWeeklySubtotal,
} from '../../../features/boss-profit/store'

vi.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }),
  },
}))

vi.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: vi.fn(),
  dropRowKey: (ocid: string, boss: string, difficulty: string, periodKey: string) =>
    `${ocid}|${boss}|${difficulty}|${periodKey}`,
}))

const mockedUseBossProfitStore = vi.mocked(useBossProfitStore)

// 기간 키는 **고정값**을 쓴다 — 현재 기간에서 파생하면 실행 날짜에 따라 스냅샷이 흔들려
// 안전장치가 아니라 소음이 된다. 새로고침 버튼 노출 같은 "현재 기간 한정" 동작은 이미
// BossProfitScreen.test.tsx 가 다루므로 여기서 재현할 필요가 없다.
const PERIOD_KEY = '2026-07-09'

function mockStore(overrides: Partial<ReturnType<typeof useBossProfitStore>>): void {
  mockedUseBossProfitStore.mockReturnValue({
    status: 'idle',
    tab: 'weekly',
    periodKey: PERIOD_KEY,
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodState: 'confirmedEmpty' as const,
    previousPeriodTotalMeso: 0,
    canGoPreviousPeriod: true,
    error: null,
    staleCharacterNames: [],
    characterIssues: {},
    trackedOcids: null,
    lastSyncedAt: null,
    loadTrackedOcids: vi.fn(),
    refresh: vi.fn(),
    setTab: vi.fn(),
    goToPreviousPeriod: vi.fn(),
    goToNextPeriod: vi.fn(),
    retryPeriod: vi.fn(),
    setPartySize: vi.fn(),
    setBossDrops: vi.fn(),
    ...overrides,
  })
}

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: null,
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: PERIOD_KEY,
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 2,
    payoutMeso: 5_000_000,
    isComplete: true,
    ...overrides,
  }
}

function subtotal(overrides: Partial<BossProfitWeeklySubtotal> = {}): BossProfitWeeklySubtotal {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    periodKey: PERIOD_KEY,
    totalMeso: 5_000_000,
    state: 'recorded',
    ...overrides,
  }
}

function renderScreen(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/profit']}>
      <BossProfitScreen />
    </MemoryRouter>,
  )
}

// 이 화면의 DOM 은 **시스템 시각의 함수**다 — 헤더 동기화 영역(마지막 동기화 시각 + 새로고침
// 버튼)은 `isPeriodRefreshable(tab, periodKey, now)` 일 때만 렌더되고([[ADR-076]]), 그 값은
// "지금이 몇 주차인가"로 갈린다. 시각을 고정하지 않으면 스냅샷이 **찍은 날에만 맞는다** — 실제로
// '월간 탭' 케이스(periodKey '2026-07')가 7월 5주차(7/30~8/5)가 닫히는 순간 깨졌다.
// 2026-08-05 은 그 주 안이라 7월 화면이 아직 새로고침 가능한 시점이다(이번 주 키 2026-07-30).
// 타이머는 진짜를 그대로 둔다(`toFake: ['Date']`) — 카운트업(rAF)·RTL 이 실제 타이머에 기댄다.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-05T12:00:00+09:00'))
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  vi.clearAllMocks()
  clearCountUpMemory()
})

describe('BossProfitScreen DOM 스냅샷 (ADR-094 결정 4)', () => {
  it('빈 상태 — 페이지 헤더·탭·기간 네비게이터의 기하', () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'] })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  // 추적 캐릭터가 없으면 화면 위쪽에서 **조기 반환**해 완전히 다른 트리를 그린다
  // (`trackedOcids === null || length === 0`). 이 분기를 빼먹으면 그 경로의 DOM 변경이
  // 스냅샷을 그대로 통과한다 — 실제로 검증 중에 그 공백을 밟아서 이 케이스를 넣었다.
  it('추적 캐릭터 없음 — 조기 반환 경로(주 렌더와 다른 트리)', () => {
    mockStore({ status: 'loaded', trackedOcids: [] })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('주간 탭 · 카드 접힘 — sticky 헤더와 카드 층 순서', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      periodState: 'recorded',
      rows: [row(), row({ boss: '반 레온', difficulty: '하드', payoutMeso: 3_000_000 })],
      weeklySubtotals: [subtotal()],
    })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('주간 탭 · 카드 펼침 — 카드 안 sticky 헤더(ADR-047)와 보스 행', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      periodState: 'recorded',
      rows: [row(), row({ boss: '반 레온', difficulty: '하드', payoutMeso: 3_000_000 })],
      weeklySubtotals: [subtotal()],
    })

    const { container } = renderScreen()
    // 카드 헤더가 곧 아코디언 토글이다.
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('여러 캐릭터 · 펼침 — 형제 카드가 섞였을 때의 순서와 z 층', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1', 'ocid-2'],
      periodState: 'recorded',
      rows: [
        row(),
        row({ ocid: 'ocid-2', characterName: '두번째', boss: '스우', difficulty: '하드' }),
      ],
      weeklySubtotals: [
        subtotal(),
        subtotal({ ocid: 'ocid-2', characterName: '두번째', totalMeso: 7_000_000 }),
      ],
    })

    const { container } = renderScreen()
    fireEvent.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(domSnapshot(container)).toMatchSnapshot()
  })

  it('월간 탭 — 주간과 다른 본문 구조', () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      periodState: 'recorded',
      tab: 'monthly',
      periodKey: '2026-07',
      rows: [row({ cycle: 'monthly', boss: '검은 마법사', difficulty: '하드', periodKey: '2026-07' })],
    })

    const { container } = renderScreen()

    expect(domSnapshot(container)).toMatchSnapshot()
  })
})

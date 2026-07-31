// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DropHistoryScreen } from '../DropHistoryScreen'
import { useDropHistoryStore } from '../../../features/boss-profit/drop-history-store'
import { formatBossProfitPeriodLabel } from '../../../lib/boss-profit-period'
import {
  formatValuableDroughtHeadline,
  VALUABLE_DROUGHT_LATE_HEADLINE_COUNT,
  WORD_JOINER,
  type DropHistoryRecord,
} from '../../../lib/drop-history'

// 문장에는 줄바꿈 금지용 zero-width 문자가 섞여 있다(ADR-071 결정 8) — 사람이 읽는 문장으로 비교한다.
function sentenceOf(element: HTMLElement): string {
  return (element.textContent ?? '').replaceAll(WORD_JOINER, '')
}

vi.mock('../../../features/boss-profit/drop-history-store', () => ({
  useDropHistoryStore: vi.fn(),
}))

const mockedUseDropHistoryStore = vi.mocked(useDropHistoryStore)
const loadMock = vi.fn()

function record(overrides: Partial<DropHistoryRecord>): DropHistoryRecord {
  return {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드',
    periodKey: '2026-07-09',
    category: 'equipment',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    quantity: 1,
    ...overrides,
  }
}

function mockStore(overrides: Partial<ReturnType<typeof useDropHistoryStore>>): void {
  mockedUseDropHistoryStore.mockReturnValue({
    status: 'ready',
    groups: [],
    drought: null,
    charactersByOcid: {
      'ocid-1': { ocid: 'ocid-1', characterName: '메이플영웅', imageUrl: null },
    },
    load: loadMock,
    ...overrides,
  })
}

function LocationProbe(): React.JSX.Element {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function renderScreen(): void {
  render(
    <MemoryRouter initialEntries={['/profit/drops']}>
      <Routes>
        <Route path="/profit/drops" element={<DropHistoryScreen />} />
        <Route path="/profit" element={<span>보스 수익 화면</span>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  loadMock.mockReset()
  mockedUseDropHistoryStore.mockReset()
})

describe('DropHistoryScreen', () => {
  it('마운트하면 전 기간 기록을 불러온다', () => {
    mockStore({ status: 'idle' })
    renderScreen()

    expect(loadMock).toHaveBeenCalled()
  })

  it('조회 중에는 로딩을 보여준다', () => {
    mockStore({ status: 'loading' })
    renderScreen()

    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  it('실패하면 빈 상태가 아니라 실패 상태와 다시 시도를 보여준다 (ADR-062)', () => {
    mockStore({ status: 'failed' })
    renderScreen()

    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(loadMock).toHaveBeenCalledTimes(2) // 마운트 1 + 클릭 1
  })

  it('기록이 없으면 빈 상태에서 보스 수익 화면으로 보낸다', () => {
    mockStore({ status: 'ready', groups: [] })
    renderScreen()

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '보스 수익으로' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/profit')
  })

  // 사용자 지정 형식(2026-07-31) — 한 기록이 목록에서 큰 비중을 차지하지 않도록 아이콘·난이도 배지·
  // 2단 레이아웃 없이 한 줄 문장으로만 둔다.
  it('고가가 아닌 기록은 한 줄 문장으로만 보여준다', () => {
    mockStore({
      status: 'ready',
      groups: [
        {
          periodKey: '2026-07-09',
          cycle: 'weekly',
          records: [
            record({
              boss: '가디언 엔젤 슬라임',
              difficulty: '카오스',
              itemName: '가디언 엔젤링',
              slot: undefined,
            }),
          ],
        },
      ],
    })
    renderScreen()

    const entry = screen.getByTestId('drop-history-entry')
    expect(sentenceOf(entry)).toBe(
      '메이플영웅님이 가디언 엔젤 슬라임(카오스)에서 가디언 엔젤링을 획득하였습니다.',
    )
    // 꾸밈 없음: 골드 강조도, 아이템 아이콘도 붙지 않는다
    expect(entry).not.toHaveAttribute('data-valuable')
    expect(entry.querySelector('.valuable-drop-badge')).toBeNull()
    expect(entry.querySelector('img')).toBeNull()

    // 다만 아이템명은 배경·색 없이 굵기만 올린다 — 고가 pill(font-bold)보다 한 단계 낮다
    const itemName = within(entry).getByText('가디언 엔젤링')
    expect(itemName.className).toContain('font-semibold')
    expect(itemName.className).not.toContain('valuable-drop-badge')
  })

  it('고가 기록만 골드로 꾸민다 — 아이템명 pill + 아이템 아이콘', () => {
    mockStore({
      status: 'ready',
      groups: [
        {
          periodKey: '2026-07-09',
          cycle: 'weekly',
          // 루즈 컨트롤 머신 마크 = 칠흑의 보스 세트(고가)
          records: [record({ itemName: '루즈 컨트롤 머신 마크' })],
        },
      ],
    })
    renderScreen()

    const entry = screen.getByTestId('drop-history-entry')
    expect(entry).toHaveAttribute('data-valuable', 'true')
    expect(within(entry).getByText('루즈 컨트롤 머신 마크').className).toContain('valuable-drop-badge')
    expect(entry.querySelector('img')).not.toBeNull()
  })

  // 사용자 지정(2026-07-31): 배경 없음 · 줄간격 좁힘 · 띄어쓰기 단위 줄바꿈 · 가운데 정렬.
  it('문장은 배경 없이 가운데 정렬하고 띄어쓰기에서만 줄바꿈한다', () => {
    mockStore({
      status: 'ready',
      groups: [
        {
          periodKey: '2026-07-09',
          cycle: 'weekly',
          records: [record({ itemName: '루즈 컨트롤 머신 마크' })], // 고가여도 줄 배경은 없다
        },
      ],
    })
    renderScreen()

    const entry = screen.getByTestId('drop-history-entry')
    // 줄 배경·구분선 없음 — 고가 줄도 `.valuable-drop-row` 를 쓰지 않는다
    expect(entry.className).not.toContain('valuable-drop-row')
    expect(entry.className).not.toContain('border-b')
    expect(entry.className).not.toContain('bg-')

    const sentence = entry.querySelector('p') as HTMLElement
    // 한국어 기본값은 음절 단위로 아무 데서나 끊긴다 — keep-all이 띄어쓰기만 줄바꿈 지점으로 만든다
    expect(sentence.className).toContain('break-keep')
    expect(sentence.className).toContain('text-center')
    expect(sentence.className).toContain('leading-snug')
  })

  it('기록 목록에 카드 셸을 두지 않는다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
    })
    renderScreen()

    const list = screen.getByRole('list')
    expect(list.className).not.toContain('bg-surface')
    expect(list.className).not.toContain('border')
  })

  it('수량이 2 이상일 때만 개수를 말한다', () => {
    mockStore({
      status: 'ready',
      groups: [
        {
          periodKey: '2026-07-09',
          cycle: 'weekly',
          records: [
            record({ itemName: '주문의 흔적', category: 'fixed', slot: undefined, quantity: 240 }),
            record({ itemName: '가디언 엔젤링', slot: undefined, quantity: 1 }),
          ],
        },
      ],
    })
    renderScreen()

    const entries = screen.getAllByTestId('drop-history-entry')
    expect(sentenceOf(entries[0])).toContain('주문의 흔적 240개를 획득하였습니다.')
    expect(sentenceOf(entries[1])).toContain('가디언 엔젤링을 획득하였습니다.')
    expect(sentenceOf(entries[1])).not.toContain('개')
  })

  it('상자 개봉 결과는 상자와 등급을 함께 말한다', () => {
    mockStore({
      status: 'ready',
      groups: [
        {
          periodKey: '2026-07-09',
          cycle: 'weekly',
          records: [
            record({
              itemName: '리스트레인트 링',
              category: 'consumable',
              slot: undefined,
              boxOrigin: '홍옥의 보스 반지 상자',
              ringLevel: 3,
            }),
          ],
        },
      ],
    })
    renderScreen()

    const entry = screen.getByTestId('drop-history-entry')
    expect(sentenceOf(entry)).toBe(
      '메이플영웅님이 스우(하드)에서 홍옥의 보스 반지 상자를 열어 리스트레인트 링 3레벨을 획득하였습니다.',
    )

    // 상자명도 아이템과 같은 굵기로 강조한다 — "무엇을 열었는지"가 정보의 절반이다(ADR-010).
    // 단 pill(고가)은 결과에만 붙는다 — 둘 다 골드면 어느 쪽이 값인지 흐려진다.
    const boxName = within(entry).getByText('홍옥의 보스 반지 상자')
    expect(boxName.className).toContain('font-semibold')
    expect(boxName.className).not.toContain('valuable-drop-badge')
  })

  it('기간 라벨 아래에 날짜 구간을 작게 붙인다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
    })
    renderScreen()

    const expected = formatBossProfitPeriodLabel('weekly', '2026-07-09', new Date())
    const range = within(screen.getByTestId('drop-history-period')).getByTestId(
      'drop-history-period-range',
    )
    expect(range).toHaveTextContent(expected.secondary)
    // 라벨(text-xs)보다 작고 줄간격도 좁게 붙는다
    expect(range.className).toContain('text-[10px]')
    expect(range.className).toContain('leading-tight')
  })

  // 월간 폴백은 primary가 곧 secondary라("2026년 7월") 그대로 두면 같은 글자가 두 줄로 겹친다.
  it('날짜 구간이 라벨과 같은 값이면 렌더하지 않는다', () => {
    // 지난 달·이번 달이 아닌 과거 월간 기간 — primary === secondary
    const pastMonthKey = '2020-03'
    const label = formatBossProfitPeriodLabel('monthly', pastMonthKey, new Date())
    expect(label.primary).toBe(label.secondary) // 전제 확인

    mockStore({
      status: 'ready',
      groups: [
        { periodKey: pastMonthKey, cycle: 'monthly', records: [record({ periodKey: pastMonthKey })] },
      ],
    })
    renderScreen()

    expect(screen.queryByTestId('drop-history-period-range')).not.toBeInTheDocument()
    expect(screen.getByTestId('drop-history-period')).toHaveTextContent(label.primary)
  })

  it('기간 라벨은 양옆 구분선 사이에 놓이고 글자는 본문보다 물러난다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
    })
    renderScreen()

    const header = screen.getByTestId('drop-history-period')
    // 구분이 글자 굵기가 아니라 선에서 나온다 — 양옆 flex-1 헤어라인이 라벨을 가운데로 밀어낸다.
    // items-center가 선을 "라벨 줄"이 아니라 "라벨+날짜 두 줄 블록"의 세로 중앙에 맞춘다.
    expect(header.className).toContain('items-center')
    const rules = within(header).getAllByTestId('drop-history-period-rule')
    expect(rules).toHaveLength(2)
    for (const rule of rules) {
      expect(rule.className).toContain('h-px')
      expect(rule.className).toContain('flex-1')
    }

    const label = within(header).getByRole('heading', { level: 2 })
    expect(label.className).toContain('text-text-muted')
    expect(label.className).not.toContain('font-bold')
  })

  it('기간 그룹마다 기간 라벨을 보여준다', () => {
    mockStore({
      status: 'ready',
      groups: [
        { periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] },
        { periodKey: '2026-07', cycle: 'monthly', records: [record({ periodKey: '2026-07' })] },
      ],
    })
    renderScreen()

    // 라벨은 실행 시점에 따라 "이번 주"/"지난 주"/"N월 M주차"로 갈리므로 화면과 같은 소스에서 기대값을
    // 얻는다(BossProfitScreen 테스트가 현재 기간을 실제 계산으로 쓰는 것과 같은 이유).
    const weekly = formatBossProfitPeriodLabel('weekly', '2026-07-09', new Date())
    const monthly = formatBossProfitPeriodLabel('monthly', '2026-07', new Date())

    const headers = screen.getAllByTestId('drop-history-period')
    expect(headers).toHaveLength(2)
    expect(headers[0]).toHaveTextContent(weekly.primary)
    expect(headers[0]).toHaveTextContent(weekly.secondary)
    expect(headers[1]).toHaveTextContent(monthly.primary)
  })

  // ADR-071 결정 8 후속(사용자 확정 2026-08-01, 시안 W4): 제목이 슬픔 단계를 말하고, 아래 줄이
  // "마지막 에픽 빔! {기간} · {아이템}" 이다.
  it('요약은 제목에 슬픔 단계, 아래 줄에 마지막 에픽 빔 정보를 담는다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
      drought: { periodKey: '2026-07-09', cycle: 'weekly', weeksSince: 3, records: [record({})] },
    })
    renderScreen()

    const summary = screen.getByTestId('valuable-drought')
    expect(summary).toHaveTextContent('선넘네?!') // 3주 미획득 = 사용자 지정 4주차 문구
    expect(summary).toHaveTextContent('마지막 에픽 빔!')
    expect(summary).toHaveTextContent('루즈 컨트롤 머신 마크')
  })

  it('기간이 길어질수록 단계가 올라간다 — 잎 색·기울기가 그 단계를 따른다', () => {
    // 문구는 사용자 지정(2026-08-01) — 0~3주는 고정, 4주 이상은 풀에서 무작위라 문구를 단정하지 않고
    // 단계만 본다.
    for (const [weeks, tier, headline] of [
      [0, '0', '와따리! ㅇㄱㄱㄷ'],
      [1, '1', '그래, 그럴 수 있지'],
      [2, '2', '어?! 슬슬 쫌 그래!?'],
      [3, '3', '선넘네?!'],
    ] as const) {
      cleanup()
      mockStore({
        status: 'ready',
        groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
        drought: { periodKey: '2026-07-09', cycle: 'weekly', weeksSince: weeks, records: [record({})] },
      })
      renderScreen()

      const summary = screen.getByTestId('valuable-drought')
      expect(summary).toHaveAttribute('data-drought-tier', tier)
      expect(summary).toHaveTextContent(headline)
    }
  })

  // 아직 진행 중인 주를 "마지막"이라 부르면 어색하다.
  it('이번 주에 먹었으면 "마지막"이라 말하지 않는다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
      drought: { periodKey: '2026-07-09', cycle: 'weekly', weeksSince: 0, records: [record({})] },
    })
    renderScreen()

    const summary = screen.getByTestId('valuable-drought')
    expect(summary).toHaveTextContent('와따리! ㅇㄱㄱㄷ')
    expect(summary).not.toHaveTextContent('마지막')
  })

  // 4주 이상은 문구가 풀에서 무작위로 나온다 — 단, 화면에 머무는 동안에는 고정이어야 한다(리렌더마다
  // 새로 뽑으면 문구가 깜빡인다).
  it('4주 이상은 풀 문구 중 하나가 나오고 리렌더에도 바뀌지 않는다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
      drought: { periodKey: '2026-07-09', cycle: 'weekly', weeksSince: 9, records: [record({})] },
    })
    renderScreen()

    const pool = Array.from({ length: VALUABLE_DROUGHT_LATE_HEADLINE_COUNT }, (_, index) =>
      formatValuableDroughtHeadline(9, index),
    )
    const shown = screen.getByTestId('valuable-drought').querySelector('p')?.textContent ?? ''
    expect(pool).toContain(shown)

    // 같은 인스턴스를 다시 렌더해도 문구가 유지된다
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    expect(screen.getByTestId('valuable-drought').querySelector('p')?.textContent).toBe(shown)
  })

  it('요약에도 배경·카드를 두지 않는다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
      drought: { periodKey: '2026-07-09', cycle: 'weekly', weeksSince: 3, records: [record({})] },
    })
    renderScreen()

    const summary = screen.getByTestId('valuable-drought')
    expect(summary.className).not.toContain('bg-surface')
    expect(summary.className).not.toContain('border')
    expect(summary.className).not.toContain('rounded')
  })

  it('그 주에 고가를 여럿 먹었으면 첫 항목 + 외 N개로 줄인다', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
      drought: {
        periodKey: '2026-07-09',
        cycle: 'weekly',
        weeksSince: 3,
        records: [
          record({ itemName: '루즈 컨트롤 머신 마크' }),
          record({ itemName: '창세의 뱃지', slot: undefined }),
        ],
      },
    })
    renderScreen()

    expect(screen.getByTestId('valuable-drought')).toHaveTextContent('루즈 컨트롤 머신 마크 외 1개')
  })

  it('고가 기록이 없으면 요약 요소를 렌더하지 않는다 — "∞주째"를 만들지 않는다 (ADR-071 결정 4)', () => {
    mockStore({
      status: 'ready',
      groups: [{ periodKey: '2026-07-09', cycle: 'weekly', records: [record({})] }],
      drought: null,
    })
    renderScreen()

    expect(screen.queryByTestId('valuable-drought')).not.toBeInTheDocument()
  })

  it('캐릭터 캐시가 없는 기록은 ocid를 노출하지 않고 이름 부분만 비운다', () => {
    mockStore({
      status: 'ready',
      groups: [
        {
          periodKey: '2026-07-09',
          cycle: 'weekly',
          records: [record({ ocid: 'ocid-unknown', itemName: '가디언 엔젤링', slot: undefined })],
        },
      ],
      charactersByOcid: {},
    })
    renderScreen()

    const entry = screen.getByTestId('drop-history-entry')
    expect(sentenceOf(entry)).not.toContain('ocid-unknown')
    expect(sentenceOf(entry)).toBe('스우(하드)에서 가디언 엔젤링을 획득하였습니다.')
  })
})

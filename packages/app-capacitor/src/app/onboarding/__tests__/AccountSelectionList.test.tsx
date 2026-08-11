// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '@core/types'
import { AccountSelectionList } from '../AccountSelectionList'
import { useAccountProbes } from '@core/features/onboarding/use-account-probes'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import { worldEmblemUrl } from '@core/lib/world-emblem'

vi.mock('@core/features/onboarding/use-account-probes', () => ({
  useAccountProbes: vi.fn(),
}))

// ADR-116 결정 3: 429 판정 불가의 출구는 안내 모달이다(ADR-115 결정 10 의 사슬). 여기서는 그
// 진입점이 불렸는지만 본다 — 모달 자체는 ApiKeyNoticeModal 테스트가 본다.
vi.mock('@core/features/onboarding/use-api-key-notice', () => ({
  useApiKeyNotice: vi.fn(),
}))

vi.mock('@core/lib/world-emblem', () => ({
  worldEmblemUrl: vi.fn(),
}))

const mockedUseAccountProbes = vi.mocked(useAccountProbes)
const mockedUseApiKeyNotice = vi.mocked(useApiKeyNotice)
const mockedWorldEmblemUrl = vi.mocked(worldEmblemUrl)

const QUERYABLE = { kind: 'queryable' } as const
const ALL_UNAVAILABLE = { kind: 'allUnavailable' } as const
const retryMock = vi.fn()

// ADR-113 결정 3: 목록은 프로브가 settle 한 뒤에만 그려진다. 목록 렌더링을 보는 케이스는 전부
// 이 헬퍼로 "프로브가 끝난 뒤"를 만든다.
function settled(probes: ReturnType<typeof useAccountProbes>['probes']): ReturnType<
  typeof useAccountProbes
> {
  const total = accounts.reduce((sum, account) => sum + account.characters.length, 0)
  return { probes, isSettled: true, progress: { completed: total, total }, retry: retryMock }
}

function waiting(progress: { completed: number; total: number }): ReturnType<
  typeof useAccountProbes
> {
  return { probes: {}, isSettled: false, progress, retry: retryMock }
}

beforeEach(() => {
  mockedUseAccountProbes.mockReturnValue(settled({}))
  // 매핑된 월드는 URL을, 미매핑 월드('리부트')는 null을 돌려 폴백을 테스트한다.
  mockedWorldEmblemUrl.mockImplementation((world) =>
    world === '리부트' ? null : `/emblems/${world}.png`,
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const accounts: MapleAccount[] = [
  {
    accountId: 'da9b2f2-account-hash-1',
    characters: [
      { ocid: 'ocid-1', name: '내옆에최성일', world: '베라', jobClass: '아크메이지(썬,콜)', level: 211 },
    ],
  },
  {
    accountId: '69e3525-account-hash-2',
    characters: [
      { ocid: 'ocid-2', name: '낟낟', world: '엘리시움', jobClass: '렌', level: 293 },
      { ocid: 'ocid-3', name: '부캐', world: '엘리시움', jobClass: '나이트로드', level: 150 },
    ],
  },
]

describe('AccountSelectionList', () => {
  it('각 계정을 "월드 · 닉네임 · Lv.레벨" + "캐릭터 N개" 2줄로 렌더링하고 직업은 표시하지 않는다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getByText('베라 · 내옆에최성일 · Lv.211')).toBeInTheDocument()
    expect(screen.getByText('캐릭터 1개')).toBeInTheDocument()
    expect(screen.getByText('엘리시움 · 낟낟 · Lv.293')).toBeInTheDocument()
    expect(screen.getByText('캐릭터 2개')).toBeInTheDocument()

    // 직업(아크메이지/렌)은 더 이상 표시하지 않는다
    expect(screen.queryByText(/아크메이지/)).not.toBeInTheDocument()
    expect(screen.queryByText(/렌/)).not.toBeInTheDocument()
  })

  it('월드 엠블럼 이미지를 월드명과 함께 표시한다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    const emblem = screen.getByAltText('엘리시움')
    expect(emblem.tagName).toBe('IMG')
    expect(emblem).toHaveAttribute('src', '/emblems/엘리시움.png')
  })

  it('매핑에 없는 월드는 엠블럼 없이 월드명 텍스트만 표시한다', () => {
    const rebootAccount: MapleAccount[] = [
      {
        accountId: 'reboot-account-hash',
        characters: [{ ocid: 'ocid-r', name: '리부트캐릭', world: '리부트', jobClass: '히어로', level: 260 }],
      },
    ]

    render(
      <AccountSelectionList accounts={rebootAccount} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getByText('리부트 · 리부트캐릭 · Lv.260')).toBeInTheDocument()
    expect(screen.queryByAltText('리부트')).not.toBeInTheDocument()
  })

  it('계정이 2개 이상이면 초기에 하이라이트된 항목이 없고 "계속하기"가 비활성화 상태다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    for (const button of screen.getAllByRole('button', { name: /캐릭터 \d+개/ })) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('계정이 2개 이상일 때 다른 항목을 누르면 하이라이트가 옮겨간다', async () => {
    const user = userEvent.setup()
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    const first = screen.getByText('베라 · 내옆에최성일 · Lv.211').closest('button')
    const second = screen.getByText('엘리시움 · 낟낟 · Lv.293').closest('button')

    await user.click(second as HTMLElement)
    expect(second).toHaveAttribute('aria-pressed', 'true')
    expect(first).toHaveAttribute('aria-pressed', 'false')

    await user.click(first as HTMLElement)
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(second).toHaveAttribute('aria-pressed', 'false')
  })

  // ADR-051 결정 3: 계정이 1개면 고를 것이 없으므로 항목 선택 탭은 생략하고
  // "계속하기" 확정 행위만 남긴다.
  it('계정이 1개면 그 항목이 초기 하이라이트이고 "계속하기"가 곧바로 활성화된다', () => {
    render(
      <AccountSelectionList
        accounts={[accounts[0]]}
        isSubmitting={false}
       
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('베라 · 내옆에최성일 · Lv.211').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()
  })

  it('계정이 1개여도 렌더만으로는 onSelect가 호출되지 않고 "계속하기"를 눌러야 확정된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccountSelectionList
        accounts={[accounts[0]]}
        isSubmitting={false}
       
        onSelect={onSelect}
      />,
    )

    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSelect).toHaveBeenCalledWith('da9b2f2-account-hash-1')
  })

  it('isSubmitting이면 계정 수와 무관하게 항목과 "계속하기"가 모두 비활성화된다', () => {
    const { unmount } = render(
      <AccountSelectionList
        accounts={[accounts[0]]}
        isSubmitting={true}
       
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('베라 · 내옆에최성일 · Lv.211').closest('button')).toBeDisabled()
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()

    unmount()

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={true} onSelect={vi.fn()} />,
    )

    for (const button of screen.getAllByRole('button', { name: /캐릭터 \d+개/ })) {
      expect(button).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('카드를 클릭해도 onSelect가 즉시 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={onSelect} />,
    )

    await user.click(screen.getByText('엘리시움 · 낟낟 · Lv.293'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('카드를 클릭해 하이라이트한 뒤 "계속하기"를 클릭해야 해당 accountId로 onSelect가 호출된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={onSelect} />,
    )

    await user.click(screen.getByText('엘리시움 · 낟낟 · Lv.293'))
    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSelect).toHaveBeenCalledWith('69e3525-account-hash-2')
  })

  it('accountId 원본 해시 문자열을 화면에 노출하지 않는다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.queryByText(/da9b2f2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/69e3525/)).not.toBeInTheDocument()
  })

  it('대표 캐릭터의 초상화 URL이 있으면 이미지를 렌더링한다', () => {
    mockedUseAccountProbes.mockReturnValue(
      settled({
        'da9b2f2-account-hash-1': {
          representative: accounts[0].characters[0],
          portraitUrl: 'https://example.com/portrait.png',
          verdict: QUERYABLE,
        },
        '69e3525-account-hash-2': { representative: null, portraitUrl: null, verdict: QUERYABLE },
      }),
    )

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getByAltText('내옆에최성일')).toHaveAttribute('src', 'https://example.com/portrait.png')
  })

  it('초상화를 찾지 못한 계정은 "?"로 대체 표시한다', () => {
    mockedUseAccountProbes.mockReturnValue(
      settled({
        'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: QUERYABLE },
        '69e3525-account-hash-2': { representative: null, portraitUrl: null, verdict: QUERYABLE },
      }),
    )

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getAllByText('?')).toHaveLength(2)
    // 초상화(캐릭터명 alt)는 없고, 월드 엠블럼(월드명 alt)만 존재한다
    expect(screen.queryByAltText('내옆에최성일')).not.toBeInTheDocument()
    expect(screen.queryByAltText('낟낟')).not.toBeInTheDocument()
  })

  // ADR-068 결정 4: 전원 조회 불가를 고르기 **전에** 알린다. 전에는 고른 뒤 예열이 전부 실패해
  // 피커가 빈 목록이 되고 아무 설명이 없었다(이슈 #78).
  describe('전원 조회 불가 계정', () => {
    it('그 계정에만 경고를 붙인다', () => {
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: ALL_UNAVAILABLE },
          '69e3525-account-hash-2': {
            representative: accounts[1].characters[0],
            portraitUrl: null,
            verdict: QUERYABLE,
          },
        }),
      )

      render(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
      )

      expect(screen.getAllByText('이 계정의 캐릭터를 조회할 수 없습니다')).toHaveLength(1)
    })

    // ADR-086 결정 8: 경고만으로는 부족하다 — 고르면 후보가 0명이라 "최소 1명"(결정 7)을
    // 만족할 수 없어 온보딩이 진행 불가 상태로 멈춘다. 들어갈 수 없는 문은 잠근다.
    it('그 계정은 고를 수 없다', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: ALL_UNAVAILABLE },
          '69e3525-account-hash-2': {
            representative: accounts[1].characters[0],
            portraitUrl: null,
            verdict: QUERYABLE,
          },
        }),
      )

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={onSelect} />)

      const unavailableOption = screen.getByRole('button', { name: /내옆에최성일/ })
      expect(unavailableOption).toBeDisabled()

      await user.click(screen.getByRole('button', { name: /낟낟/ }))
      expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()
    })

    it('계정이 1개라 초기 하이라이트된 항목이 조회 불가면 "계속하기"도 막는다', () => {
      const single = [accounts[0]]
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: ALL_UNAVAILABLE },
        }),
      )

      render(<AccountSelectionList accounts={single} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
    })

  })

  // ADR-113 결정 3: settle 전에는 목록을 그리지 않는다. 전에는 잠정 대표로 카드를 먼저 그린 뒤
  // 결과가 오면 경고를 붙이고 비활성으로 바꿨는데(ADR-086 결정 8 "프로브 도착 전에는 선택 가능"),
  // 그것은 고를 수 없는 카드를 고를 수 있는 것처럼 보여주고 나서 뺏는 것이었다.
  describe('프로브 settle 전 대기', () => {
    it('계정 카드도 "계속하기"도 안내 문구도 렌더하지 않는다', () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 0, total: 3 }))

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.queryByRole('button', { name: /캐릭터 \d+개/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '계속하기' })).not.toBeInTheDocument()
      expect(screen.queryByText('사용할 메이플 ID를 선택해주세요.')).not.toBeInTheDocument()
      expect(screen.queryByText('베라 · 내옆에최성일 · Lv.211')).not.toBeInTheDocument()
    })

    // ADR-113 결정 5: 대기 표현은 진행률 바 + (완료/전체) 뿐이고 설명 문구를 붙이지 않는다 —
    // 직후 `verifying` 단계와 마크가 달라지면 두 번의 대기로 읽힌다.
    it('진행률 바와 (완료/전체) 표기만 그린다', () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 1, total: 3 }))

      const { container } = render(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(container.textContent).toBe('(1/3)')
    })

    // 이 대기는 화면에 자기 혼자뿐이라 온보딩의 다른 두 전체 대기(prefetching·seedingTracking)와
    // 같은 자리 — 세로 중앙 — 에 서야 한다(사용자 보고 2026-08-09: 상단에 붙어 나온다).
    // 자동 여백으로 세우는 이유는 이 컴포넌트가 설정 계정 변경 모달에서도 쓰이기 때문이다.
    // 부모가 남는 세로 공간을 줄 때만 작동하므로 카드 안에서는 아무 일도 일어나지 않는다.
    it('프로브 대기는 자동 여백으로 세로 중앙에 선다', () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 1, total: 3 }))

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.getByTestId('account-probe-wait')).toHaveClass('m-auto')
    })

    it('진행률은 progress 를 그대로 반영한다', () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 12, total: 40 }))

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    })

    it('settle 하면 목록과 "계속하기"가 나타난다', () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 0, total: 3 }))
      const { rerender } = render(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
      )

      expect(screen.queryByRole('button', { name: '계속하기' })).not.toBeInTheDocument()

      mockedUseAccountProbes.mockReturnValue(settled({}))
      rerender(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
      )

      expect(screen.getByRole('button', { name: '계속하기' })).toBeInTheDocument()
      expect(screen.getByText('베라 · 내옆에최성일 · Lv.211')).toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })

  // ADR-116 결정 3: 003이 아닌 실패는 "판정 불가"이고, 판정 못 한 계정이 하나라도 있으면 목록
  // 자체를 그리지 않는다 — 결정 3("모르는 동안은 보여주지도 않는다")을 429에도 적용한 것이다.
  // 전에는 429가 조용히 삼켜져 못 쓰는 계정이 정상으로 보이고 선택됐다(이슈 #177 → #176 인과).
  describe('판정 불가 계정 (ADR-116 결정 3)', () => {
    function withUndetermined(kind: 'rateLimited' | 'network'): void {
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': {
            representative: null,
            portraitUrl: null,
            verdict: { kind: 'undetermined', error: { kind } },
          },
          // 나머지 계정을 확인했더라도 부분 판정으로 목록을 그리지 않는다.
          '69e3525-account-hash-2': {
            representative: accounts[1].characters[0],
            portraitUrl: null,
            verdict: QUERYABLE,
          },
        }),
      )
    }

    it('목록도 "계속하기"도 안내 문구도 그리지 않는다', () => {
      withUndetermined('rateLimited')

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.queryByRole('button', { name: /캐릭터 \d+개/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '계속하기' })).not.toBeInTheDocument()
      expect(screen.queryByText('사용할 메이플 ID를 선택해주세요.')).not.toBeInTheDocument()
      // 확인이 끝난 계정이 있어도 그리지 않는다 — 부분 판정으로 목록을 만들지 않는다.
      expect(screen.queryByText('엘리시움 · 낟낟 · Lv.293')).not.toBeInTheDocument()
    })

    it('429는 안내 모달 경로로 보낸다 — 그 자리의 출구는 키 재입력이다', () => {
      withUndetermined('rateLimited')

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(mockedUseApiKeyNotice).toHaveBeenCalledWith({ kind: 'rateLimited' })
      // 429는 눌러도 또 429라 액션을 주지 않는다(ADR-114 결정 2) — 출구는 모달이 쥔다.
      expect(screen.getByTestId('error-state-title')).toHaveTextContent('호출 한도를 초과했습니다')
      expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    })

    it('429가 아닌 원인은 모달로 보내지 않고 이 자리에서 다시 시도한다', async () => {
      const user = userEvent.setup()
      withUndetermined('network')

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(mockedUseApiKeyNotice).toHaveBeenCalledWith(null)

      await user.click(screen.getByRole('button', { name: '다시 시도' }))
      expect(retryMock).toHaveBeenCalledTimes(1)
    })

    it('판정 불가가 없으면 모달 경로를 타지 않는다', () => {
      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(mockedUseApiKeyNotice).toHaveBeenCalledWith(null)
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument()
    })
  })

  // ADR-068 결정 4: character/list의 최고 레벨이 조회 불가일 수 있으므로, 대표는 프로브가
  // 확인한 "조회 가능한 캐릭터 중 최고 레벨"이다.
  it('프로브가 고른 대표 캐릭터를 표기한다', () => {
    const second = accounts[1].characters[1] ?? accounts[1].characters[0]
    mockedUseAccountProbes.mockReturnValue(
      settled({
        '69e3525-account-hash-2': { representative: second, portraitUrl: null, verdict: QUERYABLE },
      }),
    )

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getByText(new RegExp(second.name))).toBeInTheDocument()
  })
})

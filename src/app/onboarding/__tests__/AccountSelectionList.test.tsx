// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import { AccountSelectionList } from '../AccountSelectionList'
import { useAccountProbes } from '../../../features/onboarding/use-account-probes'
import { worldEmblemUrl } from '../../../lib/world-emblem'

vi.mock('../../../features/onboarding/use-account-probes', () => ({
  useAccountProbes: vi.fn(),
}))

vi.mock('../../../lib/world-emblem', () => ({
  worldEmblemUrl: vi.fn(),
}))

const mockedUseAccountProbes = vi.mocked(useAccountProbes)
const mockedWorldEmblemUrl = vi.mocked(worldEmblemUrl)

beforeEach(() => {
  mockedUseAccountProbes.mockReturnValue({})
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
    mockedUseAccountProbes.mockReturnValue({
      'da9b2f2-account-hash-1': {
        representative: accounts[0].characters[0],
        portraitUrl: 'https://example.com/portrait.png',
        allUnavailable: false,
      },
      '69e3525-account-hash-2': { representative: null, portraitUrl: null, allUnavailable: false },
    })

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getByAltText('내옆에최성일')).toHaveAttribute('src', 'https://example.com/portrait.png')
  })

  it('초상화를 찾지 못한 계정은 "?"로 대체 표시한다', () => {
    mockedUseAccountProbes.mockReturnValue({
      'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, allUnavailable: false },
      '69e3525-account-hash-2': { representative: null, portraitUrl: null, allUnavailable: false },
    })

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
      mockedUseAccountProbes.mockReturnValue({
        'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, allUnavailable: true },
        '69e3525-account-hash-2': {
          representative: accounts[1].characters[0],
          portraitUrl: null,
          allUnavailable: false,
        },
      })

      render(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
      )

      expect(screen.getAllByText('이 계정의 캐릭터를 조회할 수 없습니다')).toHaveLength(1)
    })

    it('프로브가 끝나기 전에는 경고를 띄우지 않는다 — 모르는 상태를 단정하지 않는다', () => {
      mockedUseAccountProbes.mockReturnValue({})

      render(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
      )

      expect(screen.queryByText('이 계정의 캐릭터를 조회할 수 없습니다')).not.toBeInTheDocument()
    })

    // ADR-086 결정 8: 경고만으로는 부족하다 — 고르면 후보가 0명이라 "최소 1명"(결정 7)을
    // 만족할 수 없어 온보딩이 진행 불가 상태로 멈춘다. 들어갈 수 없는 문은 잠근다.
    it('그 계정은 고를 수 없다', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      mockedUseAccountProbes.mockReturnValue({
        'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, allUnavailable: true },
        '69e3525-account-hash-2': {
          representative: accounts[1].characters[0],
          portraitUrl: null,
          allUnavailable: false,
        },
      })

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={onSelect} />)

      const unavailableOption = screen.getByRole('button', { name: /내옆에최성일/ })
      expect(unavailableOption).toBeDisabled()

      await user.click(screen.getByRole('button', { name: /낟낟/ }))
      expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()
    })

    it('계정이 1개라 초기 하이라이트된 항목이 조회 불가면 "계속하기"도 막는다', () => {
      const single = [accounts[0]]
      mockedUseAccountProbes.mockReturnValue({
        'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, allUnavailable: true },
      })

      render(<AccountSelectionList accounts={single} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
    })

    it('프로브가 도착하기 전에는 고를 수 있다 — 모르는 것을 단정하지 않는다', () => {
      mockedUseAccountProbes.mockReturnValue({})

      render(<AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />)

      expect(screen.getByRole('button', { name: /내옆에최성일/ })).toBeEnabled()
    })
  })

  // ADR-068 결정 4: character/list의 최고 레벨이 조회 불가일 수 있으므로, 대표는 프로브가
  // 확인한 "조회 가능한 캐릭터 중 최고 레벨"로 교체된다.
  it('프로브가 고른 대표 캐릭터로 표기를 교체한다', () => {
    const second = accounts[1].characters[1] ?? accounts[1].characters[0]
    mockedUseAccountProbes.mockReturnValue({
      '69e3525-account-hash-2': { representative: second, portraitUrl: null, allUnavailable: false },
    })

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={vi.fn()} />,
    )

    expect(screen.getByText(new RegExp(second.name))).toBeInTheDocument()
  })
})

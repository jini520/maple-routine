// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import { AccountSelectionList } from '../AccountSelectionList'
import { useRepresentativePortraits } from '../../../features/onboarding/use-representative-portraits'
import { worldEmblemUrl } from '../../../lib/world-emblem'

vi.mock('../../../features/onboarding/use-representative-portraits', () => ({
  useRepresentativePortraits: vi.fn(),
}))

vi.mock('../../../lib/world-emblem', () => ({
  worldEmblemUrl: vi.fn(),
}))

const mockedUseRepresentativePortraits = vi.mocked(useRepresentativePortraits)
const mockedWorldEmblemUrl = vi.mocked(worldEmblemUrl)

beforeEach(() => {
  mockedUseRepresentativePortraits.mockReturnValue({})
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
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
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
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
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
      <AccountSelectionList accounts={rebootAccount} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
    )

    expect(screen.getByText('리부트 · 리부트캐릭 · Lv.260')).toBeInTheDocument()
    expect(screen.queryByAltText('리부트')).not.toBeInTheDocument()
  })

  it('"계속하기" 버튼은 초기에 비활성화 상태다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('카드를 클릭해도 onSelect가 즉시 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={onSelect} />,
    )

    await user.click(screen.getByText('엘리시움 · 낟낟 · Lv.293'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('카드를 클릭해 하이라이트한 뒤 "계속하기"를 클릭해야 해당 accountId로 onSelect가 호출된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={onSelect} />,
    )

    await user.click(screen.getByText('엘리시움 · 낟낟 · Lv.293'))
    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSelect).toHaveBeenCalledWith('69e3525-account-hash-2')
  })

  it('accountId 원본 해시 문자열을 화면에 노출하지 않는다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
    )

    expect(screen.queryByText(/da9b2f2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/69e3525/)).not.toBeInTheDocument()
  })

  it('errorMessage가 있으면 화면에 표시한다', () => {
    render(
      <AccountSelectionList
        accounts={accounts}
        isSubmitting={false}
        errorMessage="기기에 저장하지 못했습니다. 다시 시도해주세요"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).toBeInTheDocument()
  })

  it('대표 캐릭터의 초상화 URL이 있으면 이미지를 렌더링한다', () => {
    mockedUseRepresentativePortraits.mockReturnValue({
      'da9b2f2-account-hash-1': 'https://example.com/portrait.png',
      '69e3525-account-hash-2': null,
    })

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
    )

    expect(screen.getByAltText('내옆에최성일')).toHaveAttribute('src', 'https://example.com/portrait.png')
  })

  it('초상화를 찾지 못한 계정은 "?"로 대체 표시한다', () => {
    mockedUseRepresentativePortraits.mockReturnValue({
      'da9b2f2-account-hash-1': null,
      '69e3525-account-hash-2': null,
    })

    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
    )

    expect(screen.getAllByText('?')).toHaveLength(2)
    // 초상화(캐릭터명 alt)는 없고, 월드 엠블럼(월드명 alt)만 존재한다
    expect(screen.queryByAltText('내옆에최성일')).not.toBeInTheDocument()
    expect(screen.queryByAltText('낟낟')).not.toBeInTheDocument()
  })
})

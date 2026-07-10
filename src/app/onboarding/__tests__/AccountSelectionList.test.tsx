// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MapleAccount } from '../../../types'
import { AccountSelectionList } from '../AccountSelectionList'

afterEach(() => {
  cleanup()
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
  it('각 계정을 대표 캐릭터 "닉네임 · 직업 Lv.레벨" 형식으로 렌더링한다', () => {
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={vi.fn()} />,
    )

    expect(screen.getByText('내옆에최성일 · 아크메이지(썬,콜) Lv.211')).toBeInTheDocument()
    expect(screen.getByText('낟낟 · 렌 Lv.293')).toBeInTheDocument()
  })

  it('클릭 시 해당 계정의 accountId로 onSelect를 호출한다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AccountSelectionList accounts={accounts} isSubmitting={false} errorMessage={null} onSelect={onSelect} />,
    )

    await user.click(screen.getByText('낟낟 · 렌 Lv.293'))

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
})

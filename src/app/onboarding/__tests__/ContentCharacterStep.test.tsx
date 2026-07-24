// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterPickerEntry } from '../../../types'

const { getCharacterPickerRosterMock } = vi.hoisted(() => ({
  getCharacterPickerRosterMock: vi.fn(),
}))

vi.mock('../../../features/schedule-sync/schedule-sync', () => ({
  getCharacterPickerRoster: getCharacterPickerRosterMock,
}))

import { ContentCharacterStep } from '../ContentCharacterStep'

const entries: CharacterPickerEntry[] = [
  { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: null, world: '엘리시움' },
  { ocid: 'ocid-2', name: '내옆에최성일', level: 211, imageUrl: null, world: '베라' },
]

beforeEach(() => {
  // 마운트되면 후보 목록을 즉시 채운다(ContentScreen과 동일하게 onUpdate 스트리밍).
  getCharacterPickerRosterMock.mockImplementation((onUpdate: (e: CharacterPickerEntry[]) => void) => {
    onUpdate(entries)
    return Promise.resolve()
  })
})

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('ContentCharacterStep', () => {
  it('아무도 선택하지 않으면 계속하기 버튼이 비활성화된다', () => {
    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('한 명 이상 선택하면 계속하기 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()
  })

  it('계속하기를 누르면 선택된 ocid 배열로 onSubmit이 호출된다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ContentCharacterStep isSubmitting={false} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSubmit).toHaveBeenCalledWith(['ocid-1'])
  })

  it('선택을 해제해 0명이 되면 계속하기가 다시 비활성화된다', async () => {
    const user = userEvent.setup()
    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('isSubmitting이면 계속하기 버튼이 스피너로 바뀌고 비활성화된다', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    rerender(<ContentCharacterStep isSubmitting={true} onSubmit={vi.fn()} />)

    const button = screen.getByRole('button', { name: '저장 중' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('maple-spinner')).toBeInTheDocument()
  })
})

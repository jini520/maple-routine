// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiKeyForm } from '../ApiKeyForm'

afterEach(() => {
  cleanup()
})

describe('ApiKeyForm', () => {
  it('입력 후 제출하면 onSubmit이 입력값으로 호출된다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ApiKeyForm isSubmitting={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/API 키/), 'test-api-key-123')
    await user.click(screen.getByRole('button', { name: /확인|제출|시작/ }))

    expect(onSubmit).toHaveBeenCalledWith('test-api-key-123')
  })

  it('isSubmitting이면 제출 버튼이 비활성화된다', () => {
    render(<ApiKeyForm isSubmitting={true} onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: /확인|제출|시작/ })).toBeDisabled()
  })

  it('isSubmitting이면 버튼이 로딩 스피너로 바뀌고 "확인" 텍스트는 감춘다', () => {
    render(<ApiKeyForm isSubmitting={true} onSubmit={vi.fn()} />)

    const button = screen.getByRole('button', { name: '확인 중' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(screen.queryByText('확인')).not.toBeInTheDocument()
  })

  it('isSubmitting이면 Enter 제출로 onSubmit이 다시 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ApiKeyForm isSubmitting={true} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/API 키/), 'test-api-key-123{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('openapi.nexon.com 링크를 안내로 제공한다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('openapi.nexon.com'))
  })
})

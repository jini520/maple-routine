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
    render(<ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/API 키/), 'test-api-key-123')
    await user.click(screen.getByRole('button', { name: /확인|제출|시작/ }))

    expect(onSubmit).toHaveBeenCalledWith('test-api-key-123')
  })

  it('isSubmitting이면 제출 버튼이 비활성화된다', () => {
    render(<ApiKeyForm isSubmitting={true} errorMessage={null} onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: /확인|제출|시작/ })).toBeDisabled()
  })

  it('errorMessage가 있으면 화면에 표시한다', () => {
    render(
      <ApiKeyForm isSubmitting={false} errorMessage="API 키가 유효하지 않습니다" onSubmit={vi.fn()} />,
    )

    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('errorMessage가 없으면 에러 텍스트를 렌더링하지 않는다', () => {
    render(<ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={vi.fn()} />)

    expect(screen.queryByText('API 키가 유효하지 않습니다')).not.toBeInTheDocument()
  })

  it('openapi.nexon.com 링크를 안내로 제공한다', () => {
    render(<ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={vi.fn()} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('openapi.nexon.com'))
  })

  it('API 키 발급 화면 예시 샘플 이미지 자리표시자를 렌더링한다', () => {
    render(<ApiKeyForm isSubmitting={false} errorMessage={null} onSubmit={vi.fn()} />)

    expect(screen.getByText(/API 키 발급 화면 예시/)).toBeInTheDocument()
  })
})

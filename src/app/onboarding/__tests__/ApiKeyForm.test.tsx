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

  // ADR-110 후속(이슈 #61): 발급 절차는 안내 사이트가 담당하고 앱은 링크만 준다. 처음 쓰는
  // 사용자를 넥슨 첫 화면에 떨궈 놓지 않도록 가이드가 1차 경로다.
  it('API 키 발급 가이드 링크를 1차 경로로 제공한다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const guide = screen.getByRole('link', { name: 'API 키 발급 방법' })
    expect(guide).toHaveAttribute('href', 'https://mapleroutine.store/api-key')
  })

  // 이미 키를 발급받은 사용자에게 7단계 안내를 경유시키지 않는다 — 가이드와 별개의 진입점.
  it('openapi.nexon.com 바로 가기 링크도 함께 제공한다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const direct = screen.getByRole('link', { name: 'openapi.nexon.com' })
    expect(direct).toHaveAttribute('href', 'https://openapi.nexon.com')
  })

  // 하이브리드 앱이라 외부 브라우저로 나간다 — 설정의 개인정보 처리방침 링크와 같은 패턴.
  it('외부 링크는 새 탭으로 열고 rel 로 opener 를 끊는다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiKeyForm } from '../ApiKeyForm'
import { BUTTON_VARIANT_CLASS } from '../../../components/atoms/Button/variants'

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

    const guide = screen.getByRole('link', { name: 'API 키 발급 방법 보기' })
    expect(guide).toHaveAttribute('href', 'https://mapleroutine.store/api-key')
  })

  // 갈림길 레이아웃: 가이드는 구분선 뒤에서 '누를 수 있는 크기'가 되지만, 외부 URL로 나가는
  // 이동이라 <button> 이 아니라 <a> 다 — 겉모습만 outline 변형을 입는다.
  it('가이드는 링크 시맨틱을 유지한 채 outline 버튼 외형을 입는다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const guide = screen.getByRole('link', { name: 'API 키 발급 방법 보기' })
    expect(guide.className).toContain(BUTTON_VARIANT_CLASS.outline)
  })

  // 이미 키를 발급받은 사용자에게 7단계 안내를 경유시키지 않는다 — 가이드와 별개의 진입점.
  it('openapi.nexon.com 바로 가기 링크도 함께 제공한다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const direct = screen.getByRole('link', { name: 'openapi.nexon.com에서 확인' })
    expect(direct).toHaveAttribute('href', 'https://openapi.nexon.com')
  })

  // 온보딩 다섯 단계 중 이 화면에만 제목이 없었다 — TrackingModeStep 과 같은 블록을 쓴다.
  it('제목과 보조문을 보여준다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '넥슨 API 키를 입력해주세요' })).toBeInTheDocument()
    expect(screen.getByText('스케줄러 API를 사용하려면 개인 API 키가 필요해요')).toBeInTheDocument()
  })

  // 요청은 "수집하거나 저장하지 않는다"였으나 키는 기기에 저장된다(storage/api-key, ADR-007).
  // 사실인 것은 "우리가 수집하지 않는다"뿐이라 지킬 수 있는 약속만 적는다.
  it('키가 기기 밖으로 나가지 않는다는 안내를 보여준다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    expect(
      screen.getByText('입력한 키는 이 기기에만 저장되고 넥슨 외 어디로도 전송되지 않아요'),
    ).toBeInTheDocument()
  })

  it('아직 키가 없는 사용자를 위한 구분선 안내를 보여준다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    expect(screen.getByText('아직 API 키가 없나요?')).toBeInTheDocument()
    expect(screen.getByText('넥슨 오픈 API에서 키를 받는 7단계 안내')).toBeInTheDocument()
  })

  // 키는 손으로 치는 값이 아니라 붙여넣는 긴 문자열이라, 가려 두면 잘못 붙여넣었는지 확인할
  // 방법이 없다(실패해도 401 토스트만 뜬다).
  it('기본은 키를 가리고, 토글하면 보여준다', async () => {
    const user = userEvent.setup()
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText(/API 키/)
    expect(input).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: '키 표시' }))
    expect(input).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: '키 숨기기' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  // type 이 text 가 되는 구간이 생기므로 — 모바일 키보드가 첫 글자를 대문자로 바꾸면
  // 조용히 틀린 키가 된다.
  it('키 입력란은 자동 대문자·자동 수정·맞춤법 검사를 끈다', () => {
    render(<ApiKeyForm isSubmitting={false} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText(/API 키/)
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })

  // 토글은 폼 안의 보조 버튼이다 — Button atom 의 type 기본값과 같은 이유로 submit 이면 안 된다.
  it('표시 토글은 폼을 제출하지 않는다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ApiKeyForm isSubmitting={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/API 키/), 'test-api-key-123')
    await user.click(screen.getByRole('button', { name: '키 표시' }))

    expect(onSubmit).not.toHaveBeenCalled()
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

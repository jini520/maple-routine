// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsRow } from '../SettingsRow'

afterEach(() => {
  cleanup()
})

describe('SettingsRow', () => {
  it('label을 렌더링하고 클릭 시 onClick이 호출된다', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<SettingsRow label="API 키 재입력" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: /API 키 재입력/ }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('rightContent를 안 주면 기본 chevron 아이콘이 보인다', () => {
    render(<SettingsRow label="계정 변경" onClick={vi.fn()} />)

    expect(screen.getByTestId('settings-row-chevron')).toBeInTheDocument()
  })

  it('rightContent를 주면 chevron 대신 그 내용이 보인다', () => {
    render(<SettingsRow label="테마" onClick={vi.fn()} rightContent={<span>렌</span>} />)

    expect(screen.getByText('렌')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
  })

  it('danger가 true면 label이 error 톤으로 렌더링된다', () => {
    render(<SettingsRow label="연결 해제" onClick={vi.fn()} danger />)

    expect(screen.getByText('연결 해제')).toHaveClass('text-error')
  })

  it('showChevron이 false이고 rightContent도 없으면 chevron이 보이지 않는다', () => {
    render(<SettingsRow label="연결 해제" onClick={vi.fn()} danger showChevron={false} />)

    expect(screen.queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
  })
})

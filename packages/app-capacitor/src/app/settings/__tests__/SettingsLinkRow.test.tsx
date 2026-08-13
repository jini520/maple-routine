// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsLinkRow } from '../SettingsLinkRow'

afterEach(() => {
  cleanup()
})

describe('SettingsLinkRow', () => {
  it('label을 링크로 렌더링하고 href를 그대로 붙인다', () => {
    render(<SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />)

    const link = screen.getByRole('link', { name: /개인정보 처리방침/ })
    expect(link).toHaveAttribute('href', 'https://mapleroutine.store/privacy')
  })

  // 이 행은 다음 화면을 여는 것이 아니라 앱을 떠나 시스템 브라우저로 간다(ADR-118 결정 7).
  it('새 컨텍스트로 열고 opener를 넘기지 않는다', () => {
    render(<SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />)

    const link = screen.getByRole('link', { name: /개인정보 처리방침/ })
    expect(link).toHaveAttribute('target', '_blank')
    // 하이브리드 앱이라 새 컨텍스트가 window.opener 로 원래 문서를 만질 수 있으면 안 된다.
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  // chevron 이 아니라 외부 링크 표식이다 — chevron 을 쓰면 다른 이동 행과 같은 약속을 하고
  // 다른 일을 한다(ADR-118 결정 4 의 넷째 종류).
  it('chevron이 아니라 외부 링크 아이콘을 보여준다', () => {
    render(<SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />)

    expect(screen.getByTestId('settings-row-external')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
  })

  it('label 타이포는 SettingsRow의 비-danger 라벨과 같다', () => {
    render(<SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />)

    expect(screen.getByText('개인정보 처리방침')).toHaveClass('text-sm', 'font-medium', 'text-text')
  })
})

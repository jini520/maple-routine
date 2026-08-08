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

  // 이동 행 — 대표값이 없으면 chevron 하나만 남는다(ADR-118 결정 4).
  it('rightContent를 안 주면 기본 chevron 아이콘이 보인다', () => {
    render(<SettingsRow label="계정 변경" onClick={vi.fn()} />)

    expect(screen.getByTestId('settings-row-chevron')).toBeInTheDocument()
  })

  // 이 step 의 핵심 — 옛 배타(`rightContent ?? chevron`)에서는 값이 있으면 화살표가 사라져
  // 화살표가 "동작이 아니라 값의 유무"를 말했다(ADR-118 결정 4).
  it('rightContent를 주면 그 내용과 chevron이 함께 보인다', () => {
    render(<SettingsRow label="테마" onClick={vi.fn()} rightContent={<span>렌</span>} />)

    expect(screen.getByText('렌')).toBeInTheDocument()
    expect(screen.getByTestId('settings-row-chevron')).toBeInTheDocument()
  })

  // 실행 행 — 위험 색 라벨 + 보조 수치, chevron 없음. 화살표가 붙으면 "다음 화면이 있다"로
  // 읽혀 확인 모달이 의외가 된다.
  it('showChevron이 false면 rightContent만 남고 chevron은 없다', () => {
    render(
      <SettingsRow
        label="캐시 데이터 삭제"
        onClick={vi.fn()}
        danger
        showChevron={false}
        rightContent={<span>1.2 MB</span>}
      />,
    )

    expect(screen.getByText('1.2 MB')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
  })

  it('danger가 true면 label이 error 톤으로 렌더링된다', () => {
    render(<SettingsRow label="연결 해제" onClick={vi.fn()} danger />)

    expect(screen.getByText('연결 해제')).toHaveClass('text-error-ink')
  })

  it('showChevron이 false이고 rightContent도 없으면 chevron이 보이지 않는다', () => {
    render(<SettingsRow label="연결 해제" onClick={vi.fn()} danger showChevron={false} />)

    expect(screen.queryByTestId('settings-row-chevron')).not.toBeInTheDocument()
  })
})

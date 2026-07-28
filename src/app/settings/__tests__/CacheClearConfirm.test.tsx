// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CacheClearConfirm } from '../CacheClearConfirm'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

// 안내 문구는 storage/cache-data.ts의 실제 범위와 같아야 한다(ADR-052 결정 3) — 어긋나면 사용자가
// 잘못된 정보로 되돌릴 수 없는 삭제를 승인한다. 행 라벨로 해당 행을 잡아 항목 포함 여부를 본다.
function rowText(label: '삭제됨' | '유지됨'): string {
  return screen.getByText(label).closest('div')?.textContent ?? ''
}

describe('CacheClearConfirm', () => {
  it('isOpen이 false면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <CacheClearConfirm isOpen={false} isClearing={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('삭제됨 행에 실제로 지워지는 항목(드롭 기록 포함)을 모두 적는다', () => {
    render(<CacheClearConfirm isOpen={true} isClearing={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    const deleted = rowText('삭제됨')
    expect(deleted).toContain('스케줄 캐시')
    expect(deleted).toContain('추적 캐릭터')
    expect(deleted).toContain('보스 수익 기록')
    expect(deleted).toContain('드롭 기록')
  })

  it('유지됨 행에 KEEP_KEYS 5개를 사용자에게 보이는 이름으로 적는다', () => {
    render(<CacheClearConfirm isOpen={true} isClearing={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    const kept = rowText('유지됨')
    expect(kept).toContain('API 키')
    expect(kept).toContain('메이플 ID')
    expect(kept).toContain('테마')
    expect(kept).toContain('스케줄 관리 방법')
    expect(kept).toContain('드롭 연출')
  })

  it('복구할 수 없다는 안내를 보여준다', () => {
    render(<CacheClearConfirm isOpen={true} isClearing={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText(/복구할 수 없습니다/)).toBeInTheDocument()
  })

  it('isClearing이 true면 취소·삭제 버튼이 모두 비활성화된다', () => {
    render(<CacheClearConfirm isOpen={true} isClearing={true} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('button', { name: '삭제 중...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  })

  it('삭제 버튼 클릭 시 onConfirm이 호출된다', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<CacheClearConfirm isOpen={true} isClearing={false} onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(onConfirm).toHaveBeenCalled()
  })

  it('취소 버튼 클릭 시 onCancel이 호출된다', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<CacheClearConfirm isOpen={true} isClearing={false} onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(onCancel).toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualContentPickerModal } from '../ManualContentPickerModal'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ManualContentPickerModal', () => {
  it('daily 탭 템플릿 항목을 후보로 보여주되 이미 추적 중인 항목은 제외한다', () => {
    render(
      <ManualContentPickerModal tab="daily" alreadyTracked={['몬스터파크']} onAdd={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.queryByRole('button', { name: '몬스터파크' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '[일일 퀘스트] 소멸의 여로 조사' })).toBeInTheDocument()
  })

  it('항목을 탭하면 onAdd가 정확한 content_name으로 호출되고 모달이 닫힌다', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const onClose = vi.fn()

    render(<ManualContentPickerModal tab="daily" alreadyTracked={[]} onAdd={onAdd} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '몬스터파크' }))

    expect(onAdd).toHaveBeenCalledWith('몬스터파크')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('weekly 탭은 주간 템플릿 항목을 보여준다', () => {
    render(<ManualContentPickerModal tab="weekly" alreadyTracked={[]} onAdd={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: '에픽 던전 : 하이마운틴' })).toBeInTheDocument()
    // daily 전용 항목은 weekly 탭에 나타나지 않는다
    expect(screen.queryByRole('button', { name: '몬스터파크' })).not.toBeInTheDocument()
  })

  it('자유 텍스트 입력 없이 고정 템플릿에서만 고른다(ADR-035 결정 11)', () => {
    render(<ManualContentPickerModal tab="daily" alreadyTracked={[]} onAdd={vi.fn()} onClose={vi.fn()} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualBossPickerModal } from '../ManualBossPickerModal'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ManualBossPickerModal', () => {
  it('보스를 고르고 난이도 뱃지를 누르면 onAdd가 (보스, 난이도)로 호출되고 모달이 닫힌다', () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()

    render(<ManualBossPickerModal alreadyTracked={[]} onAdd={onAdd} onClose={onClose} />)

    // 루시드는 이지/노멀/하드를 지원한다 — 보스를 바꾸면 그 보스의 난이도 뱃지로 바뀐다.
    fireEvent.change(screen.getByLabelText('보스'), { target: { value: '루시드' } })
    fireEvent.click(screen.getByRole('button', { name: '루시드 하드 추가' }))

    expect(onAdd).toHaveBeenCalledWith('루시드', '하드')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('보스를 바꾸면 그 보스가 지원하는 난이도 뱃지만 보인다', () => {
    render(<ManualBossPickerModal alreadyTracked={[]} onAdd={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('보스'), { target: { value: '루시드' } })

    expect(screen.getByRole('button', { name: '루시드 이지 추가' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '루시드 노멀 추가' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '루시드 하드 추가' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '루시드 카오스 추가' })).not.toBeInTheDocument()
  })

  it('이미 추적 중인 (보스, 난이도)의 난이도 뱃지는 비활성화된다', () => {
    render(
      <ManualBossPickerModal
        alreadyTracked={[{ contentName: '자쿰', difficulty: '카오스' }]}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // 기본 선택 보스는 첫 보스(자쿰) — 자쿰은 카오스 하나만 지원하고, 이미 추적 중이라 비활성.
    expect(screen.getByLabelText('보스')).toHaveValue('자쿰')
    expect(screen.getByRole('button', { name: '자쿰 카오스 추가' })).toBeDisabled()
  })

  it('자유 텍스트 입력 없이 고정 보스 목록에서만 고른다(ADR-035 결정 11)', () => {
    render(<ManualBossPickerModal alreadyTracked={[]} onAdd={vi.fn()} onClose={vi.fn()} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})

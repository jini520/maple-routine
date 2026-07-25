// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BossDropSheet } from '../BossDropSheet'

// vitest globals 미설정이라 자동 cleanup이 없다 — 포털 시트가 body에 누적되지 않도록 수동 정리.
afterEach(cleanup)

describe('BossDropSheet', () => {
  it('일반 아이템을 토글하고 추가 완료 시 onSave에 기록이 담긴다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        initialDrops={[]}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    expect(screen.getByTestId('boss-drop-sheet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it('반지 상자를 탭하면 드릴다운에서 등급+반지를 골라 기록한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        initialDrops={[]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    // 상자 탭 → 드릴다운
    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    // 등급 + 반지 선택 전에는 기록 버튼 비활성
    const confirm = screen.getByRole('button', { name: '이 결과로 기록' })
    expect(confirm).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '3레벨' }))
    await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    // 다시 메인 → 추가 완료
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      {
        category: 'consumable',
        itemName: '리스트레인트 링',
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
        quantity: 1,
      },
    ])
  })

  it('고가 아이템(칠흑 세트)을 추가하면 드롭 이펙트 오버레이가 뜬다', async () => {
    const user = userEvent.setup()

    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    expect(screen.getByTestId('drop-effect-overlay')).toBeInTheDocument()
  })

  it('비고가 아이템은 이펙트를 띄우지 않는다', async () => {
    const user = userEvent.setup()

    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /소형 경험 축적의 비약/ }))
    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
  })
})

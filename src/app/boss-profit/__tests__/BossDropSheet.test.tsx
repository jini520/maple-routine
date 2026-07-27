// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDropEffectStore } from '../../../features/drop-effect/store'
import { BossDropSheet } from '../BossDropSheet'

// vitest globals 미설정이라 자동 cleanup이 없다 — 포털 시트가 body에 누적되지 않도록 수동 정리.
afterEach(cleanup)
// 연출 토글은 전역 스토어라 테스트 간 오염을 막기 위해 매번 기본값(연출 표시)으로 되돌린다.
beforeEach(() => {
  useDropEffectStore.setState({ enabled: true })
})

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
    // 드릴다운에는 제거 버튼이 없다(재탭 제거로 대체, ADR-040)
    expect(screen.queryByRole('button', { name: '제거' })).not.toBeInTheDocument()
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

  // ADR-040
  it('결과가 지정된 상자를 다시 탭하면 드릴다운 없이 선택을 제거한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    // 상자 선택 → 드릴다운에서 결과 기록
    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    await user.click(screen.getByRole('button', { name: '3레벨' }))
    await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
    await user.click(screen.getByRole('button', { name: '이 결과로 기록' }))

    // 이제 타일은 지정된 반지를 표시 — 다시 탭하면 드릴다운이 열리지 않고 제거된다
    await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
    expect(screen.queryByRole('button', { name: '이 결과로 기록' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /추가 완료/ }))
    expect(onSave).toHaveBeenCalledWith([])
  })

  // ADR-041: 백옥 밖 저가치 반지는 '기타'로 묶여 레벨과 함께 기록된다
  it("반지 상자에서 '기타'를 고르면 레벨과 함께 '기타'로 기록된다", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    await user.click(screen.getByRole('button', { name: '기타' }))
    await user.click(screen.getByRole('button', { name: '3레벨' }))
    await user.click(screen.getByRole('button', { name: '이 결과로 기록' }))
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      {
        category: 'consumable',
        itemName: '기타',
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
        quantity: 1,
      },
    ])
  })

  // ADR-041: 생명 상자의 연마석은 레벨이 없어 레벨 선택이 비활성이고 레벨 없이 기록된다
  it('연마석을 고르면 레벨 선택이 비활성이고 레벨 없이 기록 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="카링" difficulty="하드" initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /생명의 보스 반지 상자/ }))
    await user.click(screen.getByRole('button', { name: /생명의 연마석/ }))

    // 연마석은 레벨이 없어 레벨 버튼 비활성
    expect(screen.getByRole('button', { name: '3레벨' })).toBeDisabled()
    // 레벨 없이도 기록 가능
    const confirm = screen.getByRole('button', { name: '이 결과로 기록' })
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      {
        category: 'consumable',
        itemName: '생명의 연마석',
        boxOrigin: '생명의 보스 반지 상자',
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

    // 데이브레이크 펜던트(여명 세트)는 비고가·비박스 일반 아이템
    render(
      <BossDropSheet boss="진 힐라" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /데이브레이크 펜던트/ }))
    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
  })

  // ADR-040
  it('고정 드롭은 읽기 전용이라 토글 버튼이 아니고 기록에 담기지 않는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    // 고정 아이템(주문의 흔적)은 아이콘으로만 표시되고 버튼(선택 대상)이 아니다
    expect(screen.getAllByRole('img', { name: '주문의 흔적' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /주문의 흔적/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /추가 완료/ }))
    expect(onSave).toHaveBeenCalledWith([])
  })

  it('선택 타일에 등장 난이도를 약자 칩으로 표시한다 (루즈 컨트롤: 하드+익스트림)', () => {
    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const tile = screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ })
    expect(tile.textContent).toContain('하')
    expect(tile.textContent).toContain('익')
  })

  it('연출 끄기를 활성화하면(enabled=false) 고가 아이템을 추가해도 이펙트가 뜨지 않는다', async () => {
    const user = userEvent.setup()
    useDropEffectStore.setState({ enabled: false })

    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
  })

  it("'연출 끄기' 토글은 연출이 켜져 있을 때 꺼짐 상태다(반전 회귀 방지)", () => {
    useDropEffectStore.setState({ enabled: true })
    const { rerender } = render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    // 연출 표시 중 → '연출 끄기'는 활성(체크)이 아니어야 한다
    expect(screen.getByRole('switch', { name: '연출 끄기' })).toHaveAttribute('aria-checked', 'false')

    // 연출을 끄면(enabled=false) → '연출 끄기'가 활성(체크)이 된다
    useDropEffectStore.setState({ enabled: false })
    rerender(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('switch', { name: '연출 끄기' })).toHaveAttribute('aria-checked', 'true')
  })

  // 하단 고정 바가 iOS 홈 인디케이터·Android 제스처 영역을 침범하지 않도록, 프로젝트 컨벤션인
  // var(--sa-bottom)(index.css)로 안전영역만큼 여백을 둔다. env() 직접 사용은 구형 Android WebView에서
  // 어긋나므로 금지.
  it('메인 "추가 완료" 바 하단에 안전영역 패딩이 적용된다', () => {
    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const footer = screen.getByRole('button', { name: /추가 완료/ }).parentElement
    expect(footer).toHaveClass('pb-[calc(0.75rem+var(--sa-bottom))]')
  })

  it('상자 드릴다운 "이 결과로 기록" 바 하단에 안전영역 패딩이 적용된다', async () => {
    const user = userEvent.setup()
    render(
      <BossDropSheet boss="스우" difficulty="하드" initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    const footer = screen.getByRole('button', { name: '이 결과로 기록' }).parentElement
    expect(footer).toHaveClass('pb-[calc(0.75rem+var(--sa-bottom))]')
  })
})

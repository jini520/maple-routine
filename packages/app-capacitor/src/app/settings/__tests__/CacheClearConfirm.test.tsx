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

const SIZES = { general: 1536, bossRecords: 512 }

function renderConfirm(overrides: Partial<React.ComponentProps<typeof CacheClearConfirm>> = {}) {
  return render(
    <CacheClearConfirm
      isOpen={true}
      isClearing={false}
      sizes={SIZES}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  )
}

// 그룹 행은 다중 선택이므로 checkbox 역할이다(선택 카드의 aria-pressed 아님).
function groupToggle(name: RegExp): HTMLElement {
  return screen.getByRole('checkbox', { name })
}

describe('CacheClearConfirm', () => {
  it('isOpen이 false면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <CacheClearConfirm
        isOpen={false}
        isClearing={false}
        sizes={SIZES}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(container.firstChild).toBeNull()
  })

  // ADR-058 결정 1: 사용자가 실제로 겪는 갈등("용량은 비우고 싶은데 복구 불가능한 기록은 남기고
  // 싶다")을 가르는 최소 분할이 2그룹이다.
  it('삭제 대상을 2그룹 체크리스트로 보여준다', () => {
    renderConfirm()

    expect(groupToggle(/일반 데이터/)).toBeInTheDocument()
    expect(groupToggle(/보스 수익·드롭 기록/)).toBeInTheDocument()
  })

  // ADR-058 결정 6: 열고 바로 삭제하면 선택 삭제 도입 전과 같은 전체 삭제여야 한다.
  it('기본값은 두 그룹 모두 선택된 상태다', () => {
    renderConfirm()

    expect(groupToggle(/일반 데이터/)).toHaveAttribute('aria-checked', 'true')
    expect(groupToggle(/보스 수익·드롭 기록/)).toHaveAttribute('aria-checked', 'true')
  })

  it('각 그룹 행에 그 그룹의 용량을 보여준다', () => {
    renderConfirm()

    expect(groupToggle(/일반 데이터/)).toHaveTextContent('1.5KB')
    expect(groupToggle(/보스 수익·드롭 기록/)).toHaveTextContent('512B')
  })

  // ADR-061 결정 7: 용량 span을 아예 안 그리면 값이 들어올 때 레이아웃이 점프한다 —
  // 조회 전에도 같은 자리에 "- KB" 자리표시를 둔다.
  it('용량을 아직 모르면(null) 각 그룹에 "- KB" 자리표시를 보여준다', () => {
    renderConfirm({ sizes: null })

    expect(groupToggle(/일반 데이터/)).toHaveTextContent('- KB')
    expect(groupToggle(/보스 수익·드롭 기록/)).toHaveTextContent('- KB')
  })

  it('선택한 그룹의 용량 합계를 삭제 버튼에 보여준다', async () => {
    const user = userEvent.setup()
    renderConfirm()

    expect(screen.getByRole('button', { name: /삭제 \(2\.0KB\)/ })).toBeInTheDocument()

    await user.click(groupToggle(/보스 수익·드롭 기록/))

    expect(screen.getByRole('button', { name: /삭제 \(1\.5KB\)/ })).toBeInTheDocument()
  })

  it('그룹을 누르면 선택이 토글된다', async () => {
    const user = userEvent.setup()
    renderConfirm()

    await user.click(groupToggle(/일반 데이터/))

    expect(groupToggle(/일반 데이터/)).toHaveAttribute('aria-checked', 'false')
    expect(groupToggle(/보스 수익·드롭 기록/)).toHaveAttribute('aria-checked', 'true')
  })

  it('아무 그룹도 선택하지 않으면 삭제 버튼이 비활성화된다', async () => {
    const user = userEvent.setup()
    renderConfirm()

    await user.click(groupToggle(/일반 데이터/))
    await user.click(groupToggle(/보스 수익·드롭 기록/))

    expect(screen.getByRole('button', { name: /^삭제/ })).toBeDisabled()
  })

  it('삭제 버튼 클릭 시 선택한 그룹을 onConfirm에 넘긴다', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderConfirm({ onConfirm })

    await user.click(groupToggle(/보스 수익·드롭 기록/))
    await user.click(screen.getByRole('button', { name: /^삭제/ }))

    expect(onConfirm).toHaveBeenCalledWith({ general: true, bossRecords: false })
  })

  it('닫았다 다시 열면 선택이 기본값(전체)으로 돌아온다', async () => {
    const user = userEvent.setup()
    const { rerender } = renderConfirm()

    await user.click(groupToggle(/일반 데이터/))
    rerender(
      <CacheClearConfirm
        isOpen={false}
        isClearing={false}
        sizes={SIZES}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    rerender(
      <CacheClearConfirm
        isOpen={true}
        isClearing={false}
        sizes={SIZES}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(groupToggle(/일반 데이터/)).toHaveAttribute('aria-checked', 'true')
  })

  // 행 문구는 대표 항목만 적은 요약("… 등")이지만, 적힌 항목은 전부 그 그룹이 실제로 지우는
  // 것이어야 한다(ADR-052 결정 3의 원칙) — 어긋나면 사용자가 잘못된 정보로 되돌릴 수 없는
  // 삭제를 승인한다. 범위의 기준은 이 문구가 아니라 storage/cache-data.ts의 그룹 매핑이다.
  it('일반 데이터 행에 그 그룹이 지우는 대표 항목을 적는다', () => {
    renderConfirm()

    const general = groupToggle(/일반 데이터/).textContent ?? ''
    expect(general).toContain('캐릭터 정보')
    expect(general).toContain('수동 선택 항목')
    expect(general).toContain('파티 보스 설정')
  })

  it('수익·드롭 기록 행에 그 그룹이 지우는 대표 항목을 적는다', () => {
    renderConfirm()

    const bossRecords = groupToggle(/보스 수익·드롭 기록/).textContent ?? ''
    expect(bossRecords).toContain('처치 기록')
    expect(bossRecords).toContain('수익')
    expect(bossRecords).toContain('드롭 아이템 정보')
  })

  // ADR-058 결정 3·5: 이 그룹은 수익·드롭·기간 체크가 함께 움직인다.
  it('수익·드롭 기록 행에 복구 불가 경고를 붙인다', () => {
    renderConfirm()

    expect(groupToggle(/보스 수익·드롭 기록/)).toHaveTextContent(/복구할 수 없습니다/)
  })

  it('isClearing이 true면 취소·삭제 버튼과 그룹 선택이 모두 비활성화된다', () => {
    renderConfirm({ isClearing: true })

    // ADR-061 결정 5·9: 버튼 안은 스피너 + 말줄임표 없는 '~중' 라벨.
    expect(screen.getByRole('button', { name: '삭제 중' })).toBeDisabled()
    expect(screen.getByTestId('maple-spinner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
    expect(groupToggle(/일반 데이터/)).toBeDisabled()
    expect(groupToggle(/보스 수익·드롭 기록/)).toBeDisabled()
  })

  it('취소 버튼 클릭 시 onCancel이 호출된다', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderConfirm({ onCancel })

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(onCancel).toHaveBeenCalled()
  })
})

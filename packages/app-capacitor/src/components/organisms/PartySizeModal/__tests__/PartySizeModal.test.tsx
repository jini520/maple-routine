// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PartySizeModal } from '../PartySizeModal'

afterEach(cleanup)

function open(overrides: Partial<React.ComponentProps<typeof PartySizeModal>> = {}) {
  const props: React.ComponentProps<typeof PartySizeModal> = {
    bossName: '스우',
    cycleLabel: '주간 보스',
    portraitSlug: 'lotus',
    difficulties: ['노멀', '하드', '익스트림'],
    difficulty: '하드',
    partySize: 4,
    maxPartySize: 6,
    onSelectDifficulty: vi.fn(),
    onChangePartySize: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<PartySizeModal {...props} />)
  return props
}

describe('PartySizeModal', () => {
  it('보스명과 주기를 헤더에 그린다', () => {
    open()

    expect(screen.getByText('스우')).toBeInTheDocument()
    expect(screen.getByText('주간 보스')).toBeInTheDocument()
  })

  it('난이도 세그먼트에 지원 난이도를 모두 그리고 현재 난이도만 선택 상태다', () => {
    open()

    expect(screen.getByRole('button', { name: '하드' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '노멀' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '익스트림' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('다른 난이도를 누르면 onSelectDifficulty 를 부른다', async () => {
    const props = open()

    await userEvent.click(screen.getByRole('button', { name: '익스트림' }))

    expect(props.onSelectDifficulty).toHaveBeenCalledWith('익스트림')
  })

  // 파티 인원은 (보스 + 난이도)에 붙어 있다 — 스우는 하드 6인, 익스트림 2인.
  it('현재 인원과 상한을 n / max 로 함께 보여준다', () => {
    open()
    expect(screen.getByText('4 / 6')).toBeInTheDocument()

    cleanup()
    open({ difficulty: '익스트림', partySize: 1, maxPartySize: 2 })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('스테퍼로 인원을 바꾸면 onChangePartySize 를 부른다', async () => {
    const props = open()

    await userEvent.click(screen.getByRole('button', { name: '스우 파티원 수 증가' }))

    expect(props.onChangePartySize).toHaveBeenCalledWith(5)
  })

  it('상한에서 + 가 비활성이다', () => {
    open({ difficulty: '익스트림', partySize: 2, maxPartySize: 2 })

    expect(screen.getByRole('button', { name: '스우 파티원 수 증가' })).toBeDisabled()
  })

  it('닫기 버튼을 누르면 onClose 를 부른다', async () => {
    const props = open()

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    expect(props.onClose).toHaveBeenCalled()
  })

  // ADR-121 결정 3: 자동 모드에서도 세그먼트를 그리되 멤버십을 바꾸지 않는다 — 편집 대상 전환이다.
  // 그리는 것 자체는 같으므로 컴포넌트에 모드 분기가 없다(호출부가 핸들러로 뜻을 정한다).
  it('일러스트가 없는 보스면 히어로를 비우고 이름만 남긴다', () => {
    open({ portraitSlug: null })

    expect(screen.getByText('스우')).toBeInTheDocument()
    expect(screen.queryByTestId('party-size-modal-art')).not.toBeInTheDocument()
  })

  it('일러스트가 있으면 카드와 같은 필터·불투명도로 그린다', () => {
    open()

    const art = screen.getByTestId('party-size-modal-art')
    expect(art).toHaveStyle({ filter: 'saturate(.85) brightness(.8)', opacity: '0.65' })
  })

  it('난이도가 하나뿐인 보스도 세그먼트를 그린다', () => {
    open({ difficulties: ['카오스'], difficulty: '카오스' })

    expect(within(screen.getByTestId('party-size-modal')).getByRole('button', { name: '카오스' })).toBeInTheDocument()
  })
})

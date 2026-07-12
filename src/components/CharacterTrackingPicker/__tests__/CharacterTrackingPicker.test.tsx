// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterTrackingPicker } from '../CharacterTrackingPicker'
import type { CharacterPickerEntry } from '../../../types'

afterEach(() => {
  cleanup()
})

const entries: CharacterPickerEntry[] = [
  { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png' },
  { ocid: 'ocid-2', name: '내옆에최성일', level: 211, imageUrl: null },
  { ocid: 'ocid-3', name: '테스트캐릭터', level: 165, imageUrl: null },
]

describe('CharacterTrackingPicker', () => {
  it('trackedOcids에 포함된 캐릭터가 초기에 선택(즐겨찾기) 상태로 표시된다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1', 'ocid-3']}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /낟낟/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /내옆에최성일/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /테스트캐릭터/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('카드를 클릭해도 즉시 onSave가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={['ocid-1']} onSave={onSave} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('저장 버튼 클릭 시 그 시점의 선택 상태로 onSave를 호출한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={['ocid-1']} onSave={onSave} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))
    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(onSave).toHaveBeenCalledWith(['ocid-2'])
  })

  it('닫기 버튼 클릭 시 onSave 없이 onClose만 호출된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={['ocid-1']} onSave={onSave} onClose={onClose} />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))
    await user.click(screen.getByRole('button', { name: '닫기' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('오버레이 클릭 시 onSave 없이 onClose만 호출된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={['ocid-1']} onSave={onSave} onClose={onClose} />,
    )

    await user.click(screen.getByTestId('character-tracking-picker-overlay'))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('imageUrl이 있으면 캐릭터 이미지를 렌더링한다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('img', { name: '낟낟' })).toHaveAttribute('src', 'https://example.com/1.png')
  })

  it('imageUrl이 null이면 이미지 대신 플레이스홀더를 표시한다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const card = screen.getByRole('button', { name: /내옆에최성일/ })
    expect(within(card).queryByRole('img')).not.toBeInTheDocument()
  })

  it('즐겨찾기한 캐릭터가 레벨이 낮아도 그룹 맨 앞으로 재정렬된다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /테스트캐릭터/ }))

    const buttons = screen.getAllByRole('button', { name: /낟낟|내옆에최성일|테스트캐릭터/ })
    expect(buttons[0]).toHaveTextContent('테스트캐릭터')
    expect(buttons[1]).toHaveTextContent('낟낟')
    expect(buttons[2]).toHaveTextContent('내옆에최성일')
  })

  it('즐겨찾기를 다시 해제하면 원래 순서(레벨 내림차순)로 되돌아간다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /테스트캐릭터/ }))
    await user.click(screen.getByRole('button', { name: /테스트캐릭터/ }))

    const buttons = screen.getAllByRole('button', { name: /낟낟|내옆에최성일|테스트캐릭터/ })
    expect(buttons[0]).toHaveTextContent('낟낟')
    expect(buttons[1]).toHaveTextContent('내옆에최성일')
    expect(buttons[2]).toHaveTextContent('테스트캐릭터')
  })
})

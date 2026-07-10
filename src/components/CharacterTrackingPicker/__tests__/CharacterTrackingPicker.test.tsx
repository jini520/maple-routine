// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterTrackingPicker } from '../CharacterTrackingPicker'

afterEach(() => {
  cleanup()
})

const allCharacters = [
  { ocid: 'ocid-1', characterName: '낟낟' },
  { ocid: 'ocid-2', characterName: '내옆에최성일' },
  { ocid: 'ocid-3', characterName: '테스트캐릭터' },
]

describe('CharacterTrackingPicker', () => {
  it('trackedOcids에 포함된 캐릭터의 체크박스가 초기에 체크돼 있다', () => {
    render(
      <CharacterTrackingPicker
        allCharacters={allCharacters}
        trackedOcids={['ocid-1', 'ocid-3']}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('checkbox', { name: '낟낟' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '내옆에최성일' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '테스트캐릭터' })).toBeChecked()
  })

  it('체크박스를 토글해도 즉시 onSave가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker
        allCharacters={allCharacters}
        trackedOcids={['ocid-1']}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: '내옆에최성일' }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('저장 버튼 클릭 시 그 시점의 체크 상태로 onSave를 호출한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker
        allCharacters={allCharacters}
        trackedOcids={['ocid-1']}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: '내옆에최성일' }))
    await user.click(screen.getByRole('checkbox', { name: '낟낟' }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(onSave).toHaveBeenCalledWith(['ocid-2'])
  })

  it('닫기 버튼 클릭 시 onSave 없이 onClose만 호출된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker
        allCharacters={allCharacters}
        trackedOcids={['ocid-1']}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: '내옆에최성일' }))
    await user.click(screen.getByRole('button', { name: '닫기' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('오버레이 클릭 시 onSave 없이 onClose만 호출된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker
        allCharacters={allCharacters}
        trackedOcids={['ocid-1']}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByTestId('character-tracking-picker-overlay'))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})

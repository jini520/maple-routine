// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterSelectDropdown } from '../CharacterSelectDropdown'

afterEach(() => {
  cleanup()
})

const characters = [
  { ocid: 'ocid-1', characterName: '낟낟' },
  { ocid: 'ocid-2', characterName: '내옆에최성일' },
]

describe('CharacterSelectDropdown', () => {
  it('캐릭터 수만큼 옵션을 렌더링한다', () => {
    render(<CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={vi.fn()} />)

    expect(screen.getByRole('option', { name: '낟낟' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '내옆에최성일' })).toBeInTheDocument()
  })

  it('selectedOcid에 해당하는 옵션이 선택된 값으로 표시된다', () => {
    render(<CharacterSelectDropdown characters={characters} selectedOcid="ocid-2" onSelect={vi.fn()} />)

    expect(screen.getByRole('combobox')).toHaveValue('ocid-2')
  })

  it('값을 바꾸면 해당 ocid로 onSelect를 호출한다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={onSelect} />)

    await user.selectOptions(screen.getByRole('combobox'), 'ocid-2')

    expect(onSelect).toHaveBeenCalledWith('ocid-2')
  })
})

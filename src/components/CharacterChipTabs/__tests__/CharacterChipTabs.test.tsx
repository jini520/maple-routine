// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterChipTabs } from '../CharacterChipTabs'

afterEach(() => {
  cleanup()
})

const characters = [
  { ocid: 'ocid-1', characterName: '낟낟' },
  { ocid: 'ocid-2', characterName: '내옆에최성일' },
]

describe('CharacterChipTabs', () => {
  it('캐릭터 수만큼 칩을 렌더링한다', () => {
    render(<CharacterChipTabs characters={characters} selectedOcid="ocid-1" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '낟낟' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내옆에최성일' })).toBeInTheDocument()
  })

  it('selectedOcid와 일치하는 칩에만 활성 상태를 표시한다', () => {
    render(<CharacterChipTabs characters={characters} selectedOcid="ocid-1" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '낟낟' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '내옆에최성일' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('칩 클릭 시 해당 캐릭터의 ocid로 onSelect를 호출한다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CharacterChipTabs characters={characters} selectedOcid="ocid-1" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: '내옆에최성일' }))

    expect(onSelect).toHaveBeenCalledWith('ocid-2')
  })

  it('캐릭터가 1명이어도 칩 1개를 렌더링한다', () => {
    render(
      <CharacterChipTabs
        characters={[{ ocid: 'ocid-1', characterName: '낟낟' }]}
        selectedOcid="ocid-1"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})

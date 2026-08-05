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
  { ocid: 'ocid-1', characterName: '낟낟', world: '엘리시움' },
  { ocid: 'ocid-2', characterName: '내옆에최성일', world: '베라' },
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

  it('선택된 캐릭터의 월드 엠블럼만 표시한다', () => {
    render(<CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={vi.fn()} />)

    const emblem = screen.getByAltText('엘리시움')
    expect(emblem.tagName).toBe('IMG')
    // 선택되지 않은 캐릭터(베라)의 엠블럼은 표시하지 않는다
    expect(screen.queryByAltText('베라')).not.toBeInTheDocument()
  })

  it('선택된 캐릭터의 월드가 매핑에 없으면 엠블럼을 표시하지 않는다(폴백)', () => {
    render(
      <CharacterSelectDropdown
        characters={[{ ocid: 'o', characterName: '리부트캐릭', world: '리부트' }]}
        selectedOcid="o"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByAltText('리부트')).not.toBeInTheDocument()
  })

  // ADR-096 결정 5: 관리 화면은 제목 줄 우측의 작은 자리라, 그 자리에 있던 읽기 전용 칩과 같은
  // 크기감이어야 한다. 스케줄러용 기본 크기를 그대로 넣으면 헤더가 두꺼워진다.
  describe('size 변형', () => {
    it('기본값은 스케줄러용 크기다', () => {
      render(<CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={vi.fn()} />)

      expect(screen.getByRole('combobox')).toHaveClass('min-w-[160px]', 'py-3', 'text-sm')
    })

    it('compact는 칩과 같은 크기감(rounded-full·text-xs)이고 폭을 강제하지 않는다', () => {
      render(
        <CharacterSelectDropdown
          characters={characters}
          selectedOcid="ocid-1"
          onSelect={vi.fn()}
          size="compact"
        />,
      )

      const combobox = screen.getByRole('combobox')
      expect(combobox).toHaveClass('rounded-full', 'py-1', 'text-xs')
      expect(combobox).not.toHaveClass('min-w-[160px]')
    })

    // 2026-08-05 브라우저 실측: 네이티브 <select> 의 화살표는 오른쪽 테두리에 붙어 함께 움직여
    // padding-right 로는 안쪽으로 못 옮긴다(pr 12/16/32/64px 전부 테두리와의 간격 동일 — 상자만
    // 넓어진다). 화살표를 원하는 자리에 두려면 UA 화살표를 끄고 직접 그리는 수밖에 없다.
    // 게다가 UA 화살표는 Android WebView와 iOS WKWebView에서 모양이 달라(ADR-001 하이브리드)
    // 그대로 두면 같은 화면이 기기마다 다르게 보인다. 그래서 **두 크기 모두** 직접 그린다.
    it.each([
      ['compact' as const, 'right-2.5'],
      ['default' as const, 'right-3.5'],
    ])('%s는 네이티브 화살표를 끄고 chevron을 직접 그린다', (size, rightClass) => {
      render(
        <CharacterSelectDropdown
          characters={characters}
          selectedOcid="ocid-1"
          onSelect={vi.fn()}
          size={size}
        />,
      )

      expect(screen.getByRole('combobox')).toHaveClass('appearance-none')
      expect(screen.getByTestId('character-select-chevron')).toHaveClass('absolute', rightClass)
    })

    it('size를 안 주면 기본 크기로 그리고 chevron도 함께 그린다', () => {
      render(<CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={vi.fn()} />)

      expect(screen.getByRole('combobox')).toHaveClass('appearance-none', 'min-w-[160px]')
      expect(screen.getByTestId('character-select-chevron')).toHaveClass('right-3.5')
    })

    it('compact에서도 월드 엠블럼과 선택 동작은 같다', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(
        <CharacterSelectDropdown
          characters={characters}
          selectedOcid="ocid-1"
          onSelect={onSelect}
          size="compact"
        />,
      )

      expect(screen.getByAltText('엘리시움')).toBeInTheDocument()
      await user.selectOptions(screen.getByRole('combobox'), 'ocid-2')
      expect(onSelect).toHaveBeenCalledWith('ocid-2')
    })
  })
})

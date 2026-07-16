// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterTrackingPicker } from '../CharacterTrackingPicker'
import type { CharacterPickerEntry } from '../../../types'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

const entries: CharacterPickerEntry[] = [
  { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', world: '엘리시움' },
  { ocid: 'ocid-2', name: '내옆에최성일', level: 211, imageUrl: null, world: '베라' },
  // 리부트는 world-emblems 매핑에 없어 엠블럼 폴백(생략)을 테스트한다
  { ocid: 'ocid-3', name: '테스트캐릭터', level: 165, imageUrl: null, world: '리부트' },
]

describe('CharacterTrackingPicker', () => {
  it('제목과 설명을 보여준다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: '캐릭터 관리' })).toBeInTheDocument()
    expect(screen.getByText('체크한 캐릭터만 스케줄러 목록에 표시됩니다.')).toBeInTheDocument()
  })

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

  it('오버레이(바깥 영역)를 클릭해도 닫히지 않는다 — 닫기 버튼으로만 닫는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={['ocid-1']} onSave={onSave} onClose={onClose} />,
    )

    await user.click(screen.getByTestId('character-tracking-picker-overlay'))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('각 캐릭터 카드에 서버(월드) 엠블럼을 표시한다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const emblem = screen.getByAltText('엘리시움')
    expect(emblem.tagName).toBe('IMG')
    expect(emblem).toHaveAttribute('src')
  })

  it('매핑에 없는 월드는 엠블럼을 표시하지 않는다(폴백)', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.queryByAltText('리부트')).not.toBeInTheDocument()
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
    // 아바타(캐릭터명 alt)는 없고 '?' 플레이스홀더. 서버 엠블럼(월드명 alt)은 별개로 존재할 수 있다.
    expect(within(card).queryByRole('img', { name: '내옆에최성일' })).not.toBeInTheDocument()
    expect(within(card).getByText('?')).toBeInTheDocument()
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

  it('열려 있는 동안 뒷 페이지(body) 스크롤을 막는다', () => {
    const { unmount } = render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('')
  })
})

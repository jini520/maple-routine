// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterPickerEntry } from '../../../types'

const { getCharacterPickerRosterMock } = vi.hoisted(() => ({
  getCharacterPickerRosterMock: vi.fn(),
}))

// ADR-062: 화면이 toScheduleSyncError로 reject를 원인으로 변환하므로, 그 매핑은 실물을 쓰고
// getCharacterPickerRoster만 대체한다(부분 모킹).
vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: getCharacterPickerRosterMock,
}))

import { ContentCharacterStep } from '../ContentCharacterStep'

const entries: CharacterPickerEntry[] = [
  { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: null, world: '엘리시움' },
  { ocid: 'ocid-2', name: '내옆에최성일', level: 211, imageUrl: null, world: '베라' },
]

beforeEach(() => {
  // 마운트되면 후보 목록을 즉시 채운다(ContentScreen과 동일하게 onUpdate 스트리밍).
  getCharacterPickerRosterMock.mockImplementation((onUpdate: (e: CharacterPickerEntry[]) => void) => {
    onUpdate(entries)
    return Promise.resolve()
  })
})

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('ContentCharacterStep', () => {
  it('아무도 선택하지 않으면 계속하기 버튼이 비활성화된다', () => {
    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('한 명 이상 선택하면 계속하기 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('button', { name: '계속하기' })).toBeEnabled()
  })

  it('계속하기를 누르면 선택된 ocid 배열로 onSubmit이 호출된다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ContentCharacterStep isSubmitting={false} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSubmit).toHaveBeenCalledWith(['ocid-1'])
  })

  it('선택을 해제해 0명이 되면 계속하기가 다시 비활성화된다', async () => {
    const user = userEvent.setup()
    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('isSubmitting이면 계속하기 버튼이 스피너로 바뀌고 비활성화된다', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    rerender(<ContentCharacterStep isSubmitting={true} onSubmit={vi.fn()} />)

    const button = screen.getByRole('button', { name: '저장 중' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('maple-spinner')).toBeInTheDocument()
  })
})

// ADR-053 결정 3: 이 단계는 모달이 아니라 온보딩 페이지라 그리드 자리에 직접 스피너/안내를 그린다.
// 정상 경로는 직전 예열(ADR-016)로 캐시가 따뜻하지만, 예열이 통째로 실패하면 이 경로를 밟는다 —
// 그때 "조회 실패"를 빈 상태로 위장하면 CTA가 비활성인 채로 온보딩이 멈춘다.
describe('ContentCharacterStep — 후보 목록 로딩 (ADR-053)', () => {
  // resolve/reject 시점을 테스트가 제어할 수 있도록 미해결 Promise를 반환하는 모의 구현.
  function deferRoster(): {
    emit: (entries: CharacterPickerEntry[]) => void
    resolve: () => Promise<void>
    reject: (error: unknown) => Promise<void>
  } {
    let onUpdateRef: (entries: CharacterPickerEntry[]) => void = () => {}
    let resolveRef: () => void = () => {}
    let rejectRef: (error: unknown) => void = () => {}

    getCharacterPickerRosterMock.mockImplementation((onUpdate: (e: CharacterPickerEntry[]) => void) => {
      onUpdateRef = onUpdate
      return new Promise<void>((resolve, reject) => {
        resolveRef = resolve
        rejectRef = reject
      })
    })

    return {
      emit: (entries) => act(() => onUpdateRef(entries)),
      resolve: () => act(async () => resolveRef()),
      reject: (error) => act(async () => rejectRef(error)),
    }
  }

  it('조회 중이고 보여줄 항목이 없으면 그리드 자리에 스피너를 보여준다', () => {
    deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)

    expect(screen.getByTestId('maple-sweep-spinner')).toBeInTheDocument()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
  })

  it('콜드 스타트: 조회가 끝나면 스피너가 사라지고 목록이 보인다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    roster.emit(entries)
    await roster.resolve()

    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('ADR-016 웜 캐시: 조회가 끝나기 전에 항목이 도착하면 스피너 없이 바로 목록을 보여준다', () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    roster.emit(entries)

    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('조회가 끝났는데 항목이 0건이면 빈 상태 안내를 보여준다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    roster.emit([])
    await roster.resolve()

    expect(screen.getByText('표시할 캐릭터가 없어요')).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  // ADR-086 결정 8: 고른 계정에 고를 수 있는 캐릭터가 하나도 없으면 "최소 1명"을 만족할 수 없어
  // CTA가 영영 비활성이다 — 온보딩에는 설정 화면이 없으므로 계정 선택으로 되돌아가는 길을 준다.
  it('빈 상태에서 탈출구(계정 다시 선택)를 주면 그 버튼을 함께 보여준다', async () => {
    const roster = deferRoster()
    const onEscape = vi.fn()

    render(
      <ContentCharacterStep
        isSubmitting={false}
        onSubmit={vi.fn()}
        emptyAction={{ label: '계정 다시 선택', onClick: onEscape }}
      />,
    )
    roster.emit([])
    await roster.resolve()

    await userEvent.click(screen.getByRole('button', { name: '계정 다시 선택' }))
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('목록이 있으면 탈출구를 보여주지 않는다', async () => {
    const roster = deferRoster()

    render(
      <ContentCharacterStep
        isSubmitting={false}
        onSubmit={vi.fn()}
        emptyAction={{ label: '계정 다시 선택', onClick: vi.fn() }}
      />,
    )
    roster.emit(entries)
    await roster.resolve()

    expect(screen.queryByRole('button', { name: '계정 다시 선택' })).not.toBeInTheDocument()
  })

  it('전역 실패(401/429)로 reject되면 스피너가 걷히고 실패 안내를 보여준다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    await roster.reject(new Error('401'))

    expect(screen.getByText('캐릭터 목록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).not.toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })
})

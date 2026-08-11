// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NexonAuthError, NexonRateLimitError } from '@core/nexon/errors'
import type { CharacterPickerEntry } from '@core/types'

const { getCharacterPickerRosterMock, noticeApiKeyIssueMock } = vi.hoisted(() => ({
  getCharacterPickerRosterMock: vi.fn(),
  noticeApiKeyIssueMock: vi.fn(),
}))

// ADR-116 결정 2: 이 화면의 429는 키 재입력 진입점으로 넘어간다(#176 하드 잠금의 유일한 출구).
vi.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: noticeApiKeyIssueMock }) },
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

// ADR-116 결정 2: 이 화면의 429는 출구가 다섯 방향 전부 막힌 **하드 잠금**이다(이슈 #176) —
// 계속하기는 고를 캐릭터가 없어 영구 비활성, 다시 시도는 같은 키로 또 429, 탈출구는 확정된 빈
// 상태 가지에만 붙고, 뒤로 가기도 재시작도 같은 단계로 되돌아온다. 그 자리를 여는 것이 이 배선이다.
describe('ContentCharacterStep — 429 배선 (ADR-116, 이슈 #176)', () => {
  it('429로 실패하면 키 재입력 경로로 넘긴다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    await roster.reject(new NexonRateLimitError('rate limited'))

    expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited')
  })

  // ADR-116 결정 2: 넘기는 것은 429뿐이다. 이 자리의 401은 "방금 입력한 키가 나쁘다"는 뜻이라
  // 성질이 다르고, 그래서 계속 폼 자체의 실패로 남는다(ADR-115 의도적 미배선 유지).
  it('401은 넘기지 않고 종전대로 재시도가 있는 실패 안내로 남는다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    await roster.reject(new NexonAuthError('401'))

    expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('네트워크 실패도 넘기지 않는다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    await roster.reject(new Error('boom'))

    expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
  })

  // ADR-116 결정 4(이슈 #178): 이 자리의 진행 경로가 **무엇인지**를 고정한다. ErrorState 안에는
  // 버튼이 없고(429에 재시도는 틀린 처방이다 — ADR-114 결정 2 유지), "계속하기"는 고를 캐릭터가
  // 없어 비활성이며, 온보딩 페이지라 감쌀 껍데기(모달의 닫기·취소)도 없다. 그래서 **이 화면에서
  // 유일하게 남는 길이 위 진입점이 띄우는 안내 모달**이다 — 액션 없는 ErrorState 가 잠금이 아닌
  // 근거가 그 호출 하나뿐이라, 배선이 빠지면 조작 가능한 요소가 0개가 된다(#176 의 하드 잠금).
  it('429의 진행 경로는 ErrorState 버튼이 아니라 모달이다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    await roster.reject(new NexonRateLimitError('rate limited'))

    const errorState = screen.getByRole('alert')
    expect(within(errorState).getByText('호출 한도를 초과했습니다')).toBeInTheDocument()
    expect(within(errorState).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계속하기' })).toBeDisabled()
    expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited')
  })
})

// ADR-114 결정 3: 항목이 남은 채 실패하면 그리드 위에 스탈 배너를 얹는데(ADR-062 결정 4), 그
// 문구도 액션도 원인별로 갈린다. 액션을 뺄 수 있는 근거는 자리다 — 배너 아래에 목록이 그대로
// 남아 있어 액션이 없어도 막다른 길이 아니다(같은 401이 위 ErrorState 경로에서는 재시도를
// 유지하는 것이 그 근거의 뒷면이다).
//
// 이 화면은 모달이 아니라 페이지라 "계속하기"가 항상 있으므로, 버튼 유무는 배너 안에서만 단언한다.
describe('ContentCharacterStep — 스탈 배너 (ADR-114)', () => {
  it('429는 서비스 단계 키를 확인하라 말하고 액션을 주지 않는다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    roster.emit(entries)
    await roster.reject(new NexonRateLimitError('429'))

    const banner = screen.getByTestId('stale-banner')
    expect(within(banner).getByText('호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요')).toBeInTheDocument()
    // 눌러도 또 429인 버튼은 "고칠 수 있다"는 잘못된 신호다(ADR-114 결정 2).
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument()
    // 목록은 그대로 남는다 — 그것이 액션을 뺄 수 있는 근거다.
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  // 온보딩에는 설정으로 보낼 길이 없고(피커는 '설정 열기'를 준다), 재시도는 같은 키를 다시 써서
  // 또 401이다 — 그래서 이 자리의 401은 액션이 없다.
  it('401 배너는 사실만 말하고 액션을 주지 않는다', async () => {
    const roster = deferRoster()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    roster.emit(entries)
    await roster.reject(new NexonAuthError('401'))

    const banner = screen.getByTestId('stale-banner')
    expect(within(banner).getByText('API 키가 유효하지 않아 목록을 갱신하지 못했습니다')).toBeInTheDocument()
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  // ADR-114 결정 3: network 계열은 폐기가 아니라 좁혀진 것이다 — 문구·액션이 현행 그대로다.
  it('네트워크 실패는 현행대로 "목록이 최신이 아닙니다" + 다시 시도이고, 누르면 재조회한다', async () => {
    const roster = deferRoster()
    const user = userEvent.setup()

    render(<ContentCharacterStep isSubmitting={false} onSubmit={vi.fn()} />)
    roster.emit(entries)
    await roster.reject(new Error('boom'))

    const banner = screen.getByTestId('stale-banner')
    expect(within(banner).getByText('목록이 최신이 아닙니다')).toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: '다시 시도' }))

    expect(getCharacterPickerRosterMock).toHaveBeenCalledTimes(2)
  })
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountFlowStatus } from '../AccountFlowStatus'
import { NexonRateLimitError } from '@core/nexon/errors'
import type { MapleAccount } from '@core/types'

// selectingCharacters 단계는 ContentCharacterStep(온보딩과 같은 컴포넌트)이라 마운트 즉시
// 로스터를 조회한다. ADR-062: 원인 매핑(toScheduleSyncError)은 실물을 쓰고 조회만 대체한다.
const { getCharacterPickerRosterMock, noticeApiKeyIssueMock } = vi.hoisted(() => ({
  getCharacterPickerRosterMock: vi.fn(),
  noticeApiKeyIssueMock: vi.fn(),
}))
vi.mock('../../../features/schedule-sync/schedule-sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/schedule-sync/schedule-sync')>()),
  getCharacterPickerRoster: getCharacterPickerRosterMock,
}))
vi.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: noticeApiKeyIssueMock }) },
}))

// ADR-113 결정 3: AccountSelectionList는 프로브가 settle 하기 전에는 목록 대신 진행률만 그린다.
// 이 파일이 보는 것은 "어느 status에서 무엇이 오는가"와 카드 감싸기이므로 기본값은 끝난 것으로 두고,
// 대기가 이어지는지 보는 케이스만 settle 전으로 덮는다.
const useAccountProbesMock = vi.hoisted(() => vi.fn())
vi.mock('../../../features/onboarding/use-account-probes', () => ({
  useAccountProbes: useAccountProbesMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
  getCharacterPickerRosterMock.mockResolvedValue(undefined)
  useAccountProbesMock.mockReturnValue({
    probes: {},
    isSettled: true,
    progress: { completed: 2, total: 2 },
  })
})

afterEach(() => {
  cleanup()
})

const accounts: MapleAccount[] = [
  { accountId: 'a1', characters: [{ ocid: 'o1', name: '낟낟', world: '스카니아', jobClass: '렌', level: 293 }] },
  { accountId: 'a2', characters: [{ ocid: 'o2', name: '부캐', world: '스카니아', jobClass: '전사', level: 100 }] },
]

describe('AccountFlowStatus', () => {
  it('idle이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <AccountFlowStatus
        status="idle"
        accounts={[]}
        error={null}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  // ADR-113 결정 5: verifying 은 문구가 아니라 진행률 바 0% 다. character/list 한 번이라 총량이
  // 없으므로 숫자도 붙이지 않는다 — 0% 바는 "시작했다"는 사실만 말한다.
  it('verifying이면 문구 없이 진행률 바 0%만 보여준다', () => {
    const { container } = render(
      <AccountFlowStatus
        status="verifying"
        accounts={[]}
        error={null}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.queryByText(/확인하고 있어요/)).toBeNull()
    // 문구도 (n/total) 숫자도 없다 — 텍스트가 한 글자도 없어야 한다.
    expect(container.textContent).toBe('')
  })

  // ADR-113 결정 5: 두 대기(verifying → 프로브)가 하나의 연속된 로딩으로 읽히려면 마크가
  // 중간에 바뀌지 않아야 한다.
  it('verifying에서 selectingAccount로 넘어가도 같은 진행률 바가 이어진다', () => {
    useAccountProbesMock.mockReturnValue({
      probes: {},
      isSettled: false,
      progress: { completed: 0, total: 2 },
    })
    const { rerender } = render(
      <AccountFlowStatus
        status="verifying"
        accounts={accounts}
        error={null}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    rerender(
      <AccountFlowStatus
        status="selectingAccount"
        accounts={accounts}
        error={null}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '계속하기' })).toBeNull()
  })

  it('selectingAccount이면 계정 목록을 보여주고 선택 시 onSelectAccount가 호출된다', async () => {
    const user = userEvent.setup()
    const onSelectAccount = vi.fn()
    render(
      <AccountFlowStatus
        status="selectingAccount"
        accounts={accounts}
        error={null}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={onSelectAccount}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText(/메이플 ID를 선택해주세요/)).toBeInTheDocument()

    // AccountSelectionList가 자체 카드를 잃은 뒤로(온보딩 페이지형 개편), 설정 모달(card=false)에서
    // 배경 없이 뜨지 않도록 이 케이스가 직접 surface 카드로 감싸야 한다.
    expect(screen.getByText(/메이플 ID를 선택해주세요/).closest('.bg-surface')).not.toBeNull()

    await user.click(screen.getByText(/낟낟/))
    await user.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSelectAccount).toHaveBeenCalledWith('a1')
  })

  it('prefetching이면 진행률 바를 보여준다', () => {
    render(
      <AccountFlowStatus
        status="prefetching"
        accounts={accounts}
        error={null}
        prefetchProgress={{ completed: 3, total: 10 }}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '30')
  })

  // error 픽스처가 network인 것이 중요하다 — ADR-114 결정 2로 버튼이 빠지는 것은 429뿐이라
  // 나머지 원인에서는 이 계약이 그대로다.
  it('error면 메시지와 다시 시도 버튼을 보여주고 클릭 시 onRetry가 호출된다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <AccountFlowStatus
        status="error"
        accounts={[]}
        error={{ kind: 'network' }}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('네트워크 오류가 발생했습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // ADR-114 결정 1·2: 여기는 모달 본문 인라인이라 처방까지 담고(토스트는 원인만), 처방이
  // 재시도가 아니라 "키 단계 확인"이므로 버튼을 주지 않는다 — 있으면 화면이 두 말을 한다.
  it('error가 rateLimited면 처방까지 담은 문구를 보여주고 다시 시도 버튼을 주지 않는다', () => {
    render(
      <AccountFlowStatus
        status="error"
        accounts={[]}
        error={{ kind: 'rateLimited' }}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByText('호출 한도를 초과했습니다. 입력하신 API 키가 서비스 단계 키인지 확인해주세요'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
  })

  // 회귀 가드: 갈린 것은 429 하나다. 다른 원인까지 버튼을 잃으면 여기서 잡힌다.
  it('error가 rateLimited가 아니면 다시 시도 버튼이 남는다', () => {
    render(
      <AccountFlowStatus
        status="error"
        accounts={[]}
        error={{ kind: 'network' }}
        prefetchProgress={null}
        pendingAccountId={null}
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  // ADR-116 결정 4(이슈 #178): 이 흐름에서 `ErrorState` 가 그려지는 자리는 error 카드가 아니라
  // selectingCharacters 다(그 단계가 온보딩과 같은 ContentCharacterStep 을 재사용한다). 온보딩과
  // 다른 것은 **껍데기** — 여기는 모달이라 "취소"가 항상 남고, 그 위에 안내 모달까지 덮인다.
  it('selectingCharacters에서 로스터가 429여도 취소와 모달 경로가 남는다', async () => {
    getCharacterPickerRosterMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    render(
      <AccountFlowStatus
        status="selectingCharacters"
        accounts={accounts}
        error={null}
        prefetchProgress={null}
        pendingAccountId="a1"
        isCommitting={false}
        onCommitCharacters={vi.fn()}
        onCancel={vi.fn()}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    const errorState = await screen.findByRole('alert')
    expect(within(errorState).getByText('호출 한도를 초과했습니다')).toBeInTheDocument()
    expect(within(errorState).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    await waitFor(() => expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited'))
  })
})

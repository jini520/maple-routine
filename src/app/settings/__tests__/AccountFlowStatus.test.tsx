// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountFlowStatus } from '../AccountFlowStatus'
import type { MapleAccount } from '../../../types'

// ADR-113 결정 3: AccountSelectionList는 프로브가 settle 하기 전에는 목록 대신 진행률만 그린다.
// 이 파일이 보는 것은 "어느 status에서 무엇이 오는가"와 카드 감싸기이므로 기본값은 끝난 것으로 두고,
// 대기가 이어지는지 보는 케이스만 settle 전으로 덮는다.
const useAccountProbesMock = vi.hoisted(() => vi.fn())
vi.mock('../../../features/onboarding/use-account-probes', () => ({
  useAccountProbes: useAccountProbesMock,
}))

beforeEach(() => {
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
})

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountFlowStatus } from '../AccountFlowStatus'
import type { MapleAccount } from '../../../types'

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
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('verifying이면 안내 문구를 보여준다', () => {
    render(
      <AccountFlowStatus
        status="verifying"
        accounts={[]}
        error={null}
        prefetchProgress={null}
        onSelectAccount={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText(/확인하고 있어요/)).toBeInTheDocument()
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
        onSelectAccount={onSelectAccount}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText(/메이플 ID를 선택해주세요/)).toBeInTheDocument()

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
        onSelectAccount={vi.fn()}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('네트워크 오류가 발생했습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

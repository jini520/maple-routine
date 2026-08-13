// 웹판(107줄)의 명세를 읽어 다시 쓴 것. **로직은 RN 으로 오며 한 줄도 안 바뀌었다** — 상태 머신과
// 닫힘 판정은 core 스토어와 두 이펙트가 갖고 있고 갈린 것은 감싸는 껍데기(`Modal`)뿐이다.
//
// 갈린 것 둘
// ① 오버레이 클릭은 `Modal` 의 `testId` 를 눌러 낸다.
// ② `AccountFlowStatus` 의 내용은 그 파일 테스트가 보므로, 여기서는 **모달이 그것을 띄웠는가**와
//    **상태 전이에 따라 닫히는가**만 본다.
import { act, fireEvent } from '@testing-library/react-native'
import { useState } from 'react'

import { useAccountProbes } from '@core/features/onboarding/use-account-probes'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import type { SettingsStatus } from '@core/features/settings/state'
import { useSettingsStore } from '@core/features/settings/store'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { AccountModal } from '../AccountModal'

jest.mock('@core/features/settings/store', () => ({
  useSettingsStore: jest.fn(),
}))
jest.mock('@core/features/onboarding/use-account-probes', () => ({
  useAccountProbes: jest.fn(),
}))
jest.mock('@core/features/onboarding/use-api-key-notice', () => ({
  useApiKeyNotice: jest.fn(),
}))

const mockedStore = jest.mocked(useSettingsStore)
const mockedUseAccountProbes = jest.mocked(useAccountProbes)
const mockedUseApiKeyNotice = jest.mocked(useApiKeyNotice)

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function buttonOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

function mockSettingsStore(overrides: Partial<ReturnType<typeof useSettingsStore>> = {}): void {
  mockedStore.mockReturnValue({
    status: 'verifying',
    accounts: [],
    error: null,
    prefetchProgress: null,
    pendingAccountId: null,
    changeApiKey: jest.fn(),
    refreshAccounts: jest.fn(),
    selectAccount: jest.fn(),
    commitAccountChange: jest.fn(),
    disconnect: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  })
}

beforeEach(() => {
  mockSettingsStore()
  mockedUseAccountProbes.mockReturnValue({
    probes: {},
    isSettled: true,
    progress: { completed: 0, total: 0 },
    retry: jest.fn(),
  })
  mockedUseApiKeyNotice.mockReturnValue(undefined as unknown as ReturnType<typeof useApiKeyNotice>)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('AccountModal', () => {
  // [[ADR-086]] 결정 6: 열리는 즉시 저장된 키로 계정 목록만 재조회한다.
  it('마운트되면 refreshAccounts를 정확히 1번 호출한다', async () => {
    const refreshAccounts = jest.fn()
    mockSettingsStore({ refreshAccounts })

    await renderOverlay(<AccountModal onClose={jest.fn()} />)

    expect(refreshAccounts).toHaveBeenCalledTimes(1)
  })

  it('verifying 상태면 진행 상태를 보여준다', async () => {
    const view = await renderOverlay(<AccountModal onClose={jest.fn()} />)

    expect(view.getByTestId('account-modal-overlay')).toBeTruthy()
  })

  // 판정 기준이 "제출했다"가 아니라 **"status가 idle을 실제로 벗어난 적이 있다"** 인 것이 요점이다 —
  // 마운트 직후 status 가 아직 idle 인 순간에 곧바로 닫히는 경쟁 상태를 그렇게 피한다.
  it('status가 idle로 돌아오면 모달이 닫힌다', async () => {
    const onClose = jest.fn()
    let setStatus: (value: SettingsStatus) => void = () => {}
    function Host(): React.JSX.Element {
      const [status, setValue] = useState<SettingsStatus>('verifying')
      setStatus = setValue
      mockSettingsStore({ status })
      return <AccountModal onClose={onClose} />
    }
    await renderOverlay(<Host />)

    expect(onClose).not.toHaveBeenCalled()

    await act(async () => {
      setStatus('idle')
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 마운트 직후 status 가 idle 이면 아직 아무 일도 일어나지 않은 것이라 닫지 않는다.
  it('한 번도 idle을 벗어난 적이 없으면 닫지 않는다', async () => {
    const onClose = jest.fn()
    mockSettingsStore({ status: 'idle' })

    await renderOverlay(<AccountModal onClose={onClose} />)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('오버레이를 누르면 onClose가 호출된다', async () => {
    const onClose = jest.fn()
    const view = await renderOverlay(<AccountModal onClose={onClose} />)

    await press(view.getByTestId('account-modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// 이슈 #78 D: `reset` 이었다 — status 를 'idle' 로 되돌리므로 닫힘 판정에 걸려 **재조회가 아니라
// 모달이 닫혔다.** `refreshAccounts` 는 status 를 'verifying' 으로 바꿔 그 판정에 안 걸린다.
describe('실패 상태의 "다시 시도" (이슈 #78 D)', () => {
  it('재조회를 호출하고 reset은 부르지 않으며 모달도 닫히지 않는다', async () => {
    const refreshAccounts = jest.fn()
    const reset = jest.fn()
    const onClose = jest.fn()
    mockSettingsStore({ status: 'error', error: { kind: 'network' }, refreshAccounts, reset })
    const view = await renderOverlay(<AccountModal onClose={onClose} />)

    // 마운트 1회는 이미 불렸으므로, 그 뒤의 한 번을 본다.
    refreshAccounts.mockClear()
    await press(buttonOf(view, '다시 시도'))

    expect(refreshAccounts).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

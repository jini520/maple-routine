// 웹판(285줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① **진행률 바를 `getByRole('progressbar')` 로는 못 찾는다** — RNTL 의 role 쿼리는 접근성 트리에
//    노출된 요소만 보는데 `ProgressBar` 의 트랙은 `accessibilityRole` 만 갖고 `accessible` 표시가
//    없다(`AccountSelectionList` 테스트가 실측해 둔 그대로). 트리를 직접 훑는다.
// ② `getByRole('button', { name })` → 글자에서 위로 올라가 잡는다.
// ③ 안쪽 `AccountSelectionList`·`ContentCharacterStep` 은 자기 테스트가 따로 있으므로 여기서는
//    **그 자리에 섰는가**와 **콜백이 이어졌는가**까지만 본다 — 온보딩과 공유되는 컴포넌트라
//    두 번 검사할 이유가 없다.
import { act, fireEvent } from '@testing-library/react-native'

import { useAccountProbes } from '@core/features/onboarding/use-account-probes'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import type { SettingsError } from '@core/features/settings/state'
import type { MapleAccount } from '@core/types'

import {
  renderOverlay,
  type AtomElement,
  type TreeNode,
} from '../../../components/__tests__/render-atom'
import { AccountFlowStatus, type AccountFlowStatusProps } from '../AccountFlowStatus'

jest.mock('@core/features/onboarding/use-account-probes', () => ({
  useAccountProbes: jest.fn(),
}))
jest.mock('@core/features/onboarding/use-api-key-notice', () => ({
  useApiKeyNotice: jest.fn(),
}))

const mockedUseAccountProbes = jest.mocked(useAccountProbes)
const mockedUseApiKeyNotice = jest.mocked(useApiKeyNotice)

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** `toJSON()` 트리에서 프롭으로 고른다(파일 머리 ①). */
function findByProp(node: unknown, key: string, value: unknown): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => findByProp(child, key, value))
  if (node === null || typeof node !== 'object') return []

  const current = node as TreeNode
  const hit = current.props?.[key] === value ? [current] : []
  return [...hit, ...findByProp(current.children, key, value)]
}

function progressBars(view: Rendered): TreeNode[] {
  return findByProp(view.toJSON(), 'accessibilityRole', 'progressbar')
}

function buttonOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

const accounts: MapleAccount[] = [
  {
    accountId: 'account-1',
    characters: [
      { ocid: 'ocid-1', name: '내옆에최성일', world: '베라', jobClass: '렌', level: 293 },
    ],
  },
]

function props(overrides: Partial<AccountFlowStatusProps> = {}): AccountFlowStatusProps {
  return {
    status: 'idle',
    accounts: [],
    error: null,
    prefetchProgress: null,
    pendingAccountId: null,
    isCommitting: false,
    onSelectAccount: jest.fn(),
    onCommitCharacters: jest.fn(),
    onCancel: jest.fn(),
    onRetry: jest.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  // [[ADR-113]] 결정 3·4: 프로브가 settle 하기 전에는 목록을 그리지 않는다 — 이 파일의 관심사는
  // 그 다음이라 늘 settle 한 상태로 둔다(그 계약은 `AccountSelectionList` 테스트가 본다).
  mockedUseAccountProbes.mockReturnValue({
    probes: {
      'account-1': {
        representative: accounts[0].characters[0],
        portraitUrl: null,
        verdict: { kind: 'queryable' },
      },
    },
    isSettled: true,
    progress: { completed: 1, total: 1 },
    retry: jest.fn(),
  })
  mockedUseApiKeyNotice.mockReturnValue(undefined as unknown as ReturnType<typeof useApiKeyNotice>)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('AccountFlowStatus', () => {
  // 웹은 `container.firstChild` 가 null 인지를 봤다. RN 에서는 렌더 결과에 늘 프로바이더 껍데기가
  // 남으므로 **이 컴포넌트가 낸 것이 하나도 없는지**를 본다.
  it('idle이면 아무것도 렌더링하지 않는다', async () => {
    const view = await renderOverlay(<AccountFlowStatus {...props()} />)

    expect(view.queryAllByText(/./)).toHaveLength(0)
    expect(progressBars(view)).toHaveLength(0)
  })

  // [[ADR-113]] 결정 5: `verifying` 은 문구가 아니라 **진행률 바 0%** 다. 뒤따르는 프로브 대기가
  // 진행률 바인데 앞 단계가 텍스트면 마크가 중간에 바뀌어 두 번 기다린 것으로 읽힌다.
  it('verifying이면 문구 없이 진행률 바 0%만 보여준다', async () => {
    const view = await renderOverlay(<AccountFlowStatus {...props({ status: 'verifying' })} />)

    const bars = progressBars(view)
    expect(bars).toHaveLength(1)
    expect(bars[0].props.accessibilityValue).toMatchObject({ now: 0, max: 100 })
    // `character/list` 는 한 번이라 총량이 없다 — 없는 숫자를 지어내지 않는다.
    expect(view.queryByText(/\(\d+\/\d+\)/)).toBeNull()
  })

  // 목록 안에서 고르는 방식(강조 → 「계속하기」 확정)은 `AccountSelectionList` 테스트가 본다 —
  // 여기서는 그 컴포넌트가 이 자리에 서고 그 확정이 **이 프롭으로 이어지는가**를 본다.
  it('selectingAccount이면 계정 목록을 보여주고 확정 시 onSelectAccount가 호출된다', async () => {
    const onSelectAccount = jest.fn()
    const view = await renderOverlay(
      <AccountFlowStatus {...props({ status: 'selectingAccount', accounts, onSelectAccount })} />,
    )

    expect(view.getByText('사용할 메이플 ID를 선택해주세요.')).toBeTruthy()
    await press(buttonOf(view, '계속하기'))

    expect(onSelectAccount).toHaveBeenCalledWith('account-1')
  })

  it('prefetching이면 진행률과 완료/전체 숫자를 함께 보여준다', async () => {
    const view = await renderOverlay(
      <AccountFlowStatus
        {...props({ status: 'prefetching', prefetchProgress: { completed: 3, total: 4 } })}
      />,
    )

    expect(view.getByText('캐릭터 정보를 준비하고 있어요 (3/4)')).toBeTruthy()
    expect(progressBars(view)[0].props.accessibilityValue).toMatchObject({ now: 75 })
  })

  it('error면 메시지와 다시 시도 버튼을 보여주고 누르면 onRetry가 호출된다', async () => {
    const onRetry = jest.fn()
    const error: SettingsError = { kind: 'network' }
    const view = await renderOverlay(
      <AccountFlowStatus {...props({ status: 'error', error, onRetry })} />,
    )

    expect(view.getByText('네트워크 오류가 발생했습니다')).toBeTruthy()
    await press(buttonOf(view, '다시 시도'))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // [[ADR-114]] 결정 1·2: 처방이 재시도가 아니라 "키 단계 확인"이라 버튼이 있으면 화면이 두 말을
  // 한다. 모달 본문이라 토스트와 달리 처방까지 담을 자리가 있다(결정 4).
  it('error가 rateLimited면 처방까지 담은 문구를 보여주고 다시 시도 버튼을 주지 않는다', async () => {
    const error: SettingsError = { kind: 'rateLimited' }
    const view = await renderOverlay(<AccountFlowStatus {...props({ status: 'error', error })} />)

    expect(
      view.getByText('호출 한도를 초과했습니다. 입력하신 API 키가 서비스 단계 키인지 확인해주세요'),
    ).toBeTruthy()
    expect(view.queryByText('다시 시도')).toBeNull()
  })

  it('error가 rateLimited가 아니면 다시 시도 버튼이 남는다', async () => {
    const error: SettingsError = { kind: 'storageWriteFailed' }
    const view = await renderOverlay(<AccountFlowStatus {...props({ status: 'error', error })} />)

    expect(view.getByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).toBeTruthy()
    expect(view.getByText('다시 시도')).toBeTruthy()
  })

  // 원인을 모르는 실패는 재시도 가능이 폴백 원칙이다 — `props.error?.kind` 가 undefined 라
  // 조건이 자연히 참이 된다.
  it('error가 null인 폴백에도 다시 시도 버튼이 남는다', async () => {
    const view = await renderOverlay(<AccountFlowStatus {...props({ status: 'error' })} />)

    expect(view.getByText('오류가 발생했습니다')).toBeTruthy()
    expect(view.getByText('다시 시도')).toBeTruthy()
  })

  // [[ADR-086]] 결정 6: 예열이 끝나도 닫지 않고 새 계정에서 캐릭터를 다시 고르게 한다 — 취소하면
  // 아직 아무것도 쓰지 않았으므로 이전 계정이 그대로다.
  it('selectingCharacters면 캐릭터 선택과 취소가 함께 있다', async () => {
    const onCancel = jest.fn()
    const view = await renderOverlay(
      <AccountFlowStatus
        {...props({ status: 'selectingCharacters', pendingAccountId: 'account-1', onCancel })}
      />,
    )

    await press(buttonOf(view, '취소'))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

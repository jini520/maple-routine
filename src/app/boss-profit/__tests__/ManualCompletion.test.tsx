// 직접 완료의 세 자리. **단추는 서버가 연 보스의 미완료 행에만 서고**, 직접 적은 행에는 표식과
// 수정이 붙는다.
//
// 단추가 잘못 서면 사용자가 **넥슨이 주는데 내가 또 적는** 길로 간다. 그래서 자격 판정 넷(서버 목록 ·
// 미완료 · 지금 기간 · 조회 가능)을 각각 잡는다.
import type { ReactNode } from 'react'

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, props),
    useBottomSheetInternal: () => null,
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

// 파티 관리의 인원은 기기 저장소에서 온다. 시트가 그 값으로 열리는지를 이 목으로 가른다.
jest.mock('../../../features/manual-completion/record', () => ({
  ...jest.requireActual('../../../features/manual-completion/record'),
  loadConfiguredPartySize: jest.fn(),
}))

import { act, fireEvent } from '@testing-library/react-native'
import type { render } from '@testing-library/react-native'

import { useBossProfitStore } from '../../../features/boss-profit/store'
import { useManualCompletionStore } from '../../../features/manual-completion/store'
import { BossProfitBossRow } from '../BossProfitBossRow'
import { loadConfiguredPartySize } from '../../../features/manual-completion/record'
import { 보스행, 컨텍스트값, renderProfit, 주간보스, 주간보스이름, PERIOD, NOW } from './harness'

const saveManualCompletion = jest.fn().mockResolvedValue(undefined)
const cancelManualCompletion = jest.fn().mockResolvedValue(undefined)

/** 그 보스가 이번 주부터 열려 있다. `PERIOD` 는 하네스가 고정한 이번 주다. */
function 서버가열었다(): void {
  useManualCompletionStore.setState({
    bosses: [{ boss: 주간보스, from: PERIOD }],
    dismissedWeek: null,
    visible: true,
  })
}

// 자쿰은 카오스 하나뿐이다. 가격이 없는 난이도로 두면 저장 단추가 꺼져 시트를 못 본다.
const 미완료행 = () =>
  보스행({ difficulty: 'chaos', isComplete: false, partySize: null, payoutMeso: 0, periodKey: PERIOD })

const mockedPartySize = jest.mocked(loadConfiguredPartySize)

beforeEach(() => {
  jest.clearAllMocks()
  // 파티 관리에 설정이 없는 것이 기본이다. 그때 시트는 1 인으로 연다.
  mockedPartySize.mockResolvedValue(null)
  useManualCompletionStore.setState({ bosses: null, dismissedWeek: null, visible: false })
  useBossProfitStore.setState({
    characterIssues: {},
    rows: [],
    saveManualCompletion,
    cancelManualCompletion,
  } as never)
})

type Rendered = Awaited<ReturnType<typeof render>>

async function press(view: Rendered, label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(label))
  })
}

describe('단추가 서는 자리', () => {
  it('서버가 연 보스의 미완료 행에 두 줄 단추가 선다', async () => {
    서버가열었다()

    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    expect(view.getByText('직접 완료할 수 있는 보스예요')).toBeTruthy()
    expect(view.getByText('완료 상태로 변경하기')).toBeTruthy()
    // 단추가 그 줄을 통째로 쓰므로 `미완료` 배지는 사라진다.
    expect(view.queryByText('미완료')).toBeNull()
  })

  it('서버가 안 연 보스에는 안 선다', async () => {
    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    expect(view.queryByText('완료 상태로 변경하기')).toBeNull()
    expect(view.getByText('미완료')).toBeTruthy()
  })

  it('이미 완료인 행에는 안 선다', async () => {
    서버가열었다()

    const view = await renderProfit(<BossProfitBossRow row={보스행({ periodKey: PERIOD })} drops={[]} />, 컨텍스트값({ now: NOW }))

    expect(view.queryByText('완료 상태로 변경하기')).toBeNull()
  })

  // 지난 기간은 지금 못 적는다. 그 자리는 수익 수동 입력의 몫이고 아직 없다.
  it('지난 기간 행에는 안 선다', async () => {
    서버가열었다()

    const view = await renderProfit(
      <BossProfitBossRow row={미완료행()} drops={[]} />,
      컨텍스트값({ now: new Date('2026-09-11T12:00:00+09:00') }),
    )

    expect(view.queryByText('완료 상태로 변경하기')).toBeNull()
  })

  it('조회 불가 캐릭터에는 안 선다', async () => {
    서버가열었다()
    useBossProfitStore.setState({ characterIssues: { 'ocid-1': 'unavailable' } } as never)

    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    expect(view.queryByText('완료 상태로 변경하기')).toBeNull()
  })
})

describe('시트', () => {
  it('단추를 누르면 완료 기록 시트가 열린다', async () => {
    서버가열었다()
    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    await press(view, `${주간보스이름} 완료 상태로 변경`)

    expect(view.getByText('완료 기록')).toBeTruthy()
    expect(view.getByLabelText('잡은 날 고르기')).toBeTruthy()
  })

  it('저장하면 고른 값이 스토어로 간다', async () => {
    서버가열었다()
    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))
    await press(view, `${주간보스이름} 완료 상태로 변경`)

    await press(view, '파티 인원 늘리기')
    await press(view, '완료 상태로 변경')

    expect(saveManualCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ bossKey: 주간보스 }),
      expect.objectContaining({ partySize: 2, difficulty: 'chaos' }),
    )
  })
})

/**
 * 파티 인원은 **파티 관리에 설정된 그 보스 · 그 난이도의 인원**으로 시작한다.
 *
 * 미완료 행은 `partySize` 가 비어 있어, 그 값으로 시작하면 늘 1 로 열렸다(사용자 지적). 사용자가
 * 매주 같은 파티로 잡는다는 것을 이미 파티 관리에 적어 뒀는데 다시 올려야 했다.
 */
describe('파티 인원의 시작값', () => {
  it('파티 관리에 설정된 인원으로 연다', async () => {
    서버가열었다()
    mockedPartySize.mockResolvedValue(3)
    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    await press(view, `${주간보스이름} 완료 상태로 변경`)
    await act(async () => {})
    await press(view, '완료 상태로 변경')

    expect(mockedPartySize).toHaveBeenCalledWith('ocid-1', 주간보스, 'chaos')
    expect(saveManualCompletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partySize: 3 }),
    )
  })

  it('설정이 없으면 1 인이다', async () => {
    서버가열었다()
    const view = await renderProfit(<BossProfitBossRow row={미완료행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    await press(view, `${주간보스이름} 완료 상태로 변경`)
    await act(async () => {})
    await press(view, '완료 상태로 변경')

    expect(saveManualCompletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partySize: 1 }),
    )
  })

  // 고칠 때는 **적어 둔 값**이 시작이다. 그 기록에 사용자가 이미 인원을 정했다.
  it('수정은 기록의 인원으로 연다', async () => {
    mockedPartySize.mockResolvedValue(3)
    const 직접기록행 = 보스행({ difficulty: 'chaos', source: 'manual', periodKey: PERIOD, defeatedOn: PERIOD, partySize: 1 })
    const view = await renderProfit(<BossProfitBossRow row={직접기록행} drops={[]} />, 컨텍스트값({ now: NOW }))

    await press(view, `${주간보스이름} 기록 수정`)
    await act(async () => {})
    await press(view, '수정')

    expect(saveManualCompletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ partySize: 1 }),
    )
  })
})

describe('직접 적은 행', () => {
  const 직접기록행 = () =>
    보스행({ difficulty: 'chaos', source: 'manual', periodKey: PERIOD, defeatedOn: PERIOD, partySize: 1 })

  it('이름 옆 표식을 누르면 설명이 뜬다', async () => {
    const view = await renderProfit(<BossProfitBossRow row={직접기록행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    await press(view, `${주간보스이름} 직접 기록 설명`)

    expect(view.getByText('직접 완료로 작성된 기록이에요')).toBeTruthy()
  })

  it('금액 왼쪽 수정을 누르면 시트가 수정으로 열린다', async () => {
    const view = await renderProfit(<BossProfitBossRow row={직접기록행()} drops={[]} />, 컨텍스트값({ now: NOW }))

    await press(view, `${주간보스이름} 기록 수정`)

    expect(view.getByText('완료 기록 수정')).toBeTruthy()
    expect(view.getByLabelText('완료 취소')).toBeTruthy()
  })

  // 취소는 되돌릴 수 없고 드롭까지 지우므로 확인 창을 거친다.
  it('완료 취소는 확인 창을 거쳐 스토어를 부른다', async () => {
    const view = await renderProfit(<BossProfitBossRow row={직접기록행()} drops={[]} />, 컨텍스트값({ now: NOW }))
    await press(view, `${주간보스이름} 기록 수정`)

    await press(view, '완료 취소')
    expect(view.getByText('완료 기록을 취소할까요?')).toBeTruthy()

    // 확인 창의 파괴 동작은 알약이 아니라 글자 버튼이라 글자로 찾는다(시트는 이미 닫혔다).
    await act(async () => {
      fireEvent.press(view.getByText('완료 취소'))
    })

    expect(cancelManualCompletion).toHaveBeenCalled()
  })

  it('자동 기록 행에는 표식도 수정도 없다', async () => {
    const view = await renderProfit(<BossProfitBossRow row={보스행({ periodKey: PERIOD })} drops={[]} />, 컨텍스트값({ now: NOW }))

    expect(view.queryByLabelText(`${주간보스이름} 직접 기록 설명`)).toBeNull()
    expect(view.queryByLabelText(`${주간보스이름} 기록 수정`)).toBeNull()
  })
})

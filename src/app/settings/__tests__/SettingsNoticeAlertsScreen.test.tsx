// 소식 알림 스위치 넷. 목록에서 떼어 낸 화면이다 - 분류마다 목록이 생겨 스위치를 어느
// 목록에 둬도 나머지 셋이 안 보인다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useNoticeStore } from '../../../features/notice/store'
import { NOTICE_TOPICS } from '../../../features/notice/topics'
import { NO_SUBSCRIPTIONS } from '../../../types/notice'
import { SettingsNoticeAlertsScreen } from '../SettingsNoticeAlertsScreen'

jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}))

/** 전체 스위치가 켜진 상태. 넷 중 하나라도 켜져 있으면 켜진 것으로 파생된다. */
const 켜짐 = { ...NO_SUBSCRIPTIONS, app: true }

beforeEach(() => {
  jest.clearAllMocks()
  useNoticeStore.setState({
    subscriptions: 켜짐,
    blockedByPermission: false,
    setSubscribed: jest.fn().mockResolvedValue(undefined),
    setAllSubscribed: jest.fn().mockResolvedValue(undefined),
  })
})

// **저장하지 않고 파생한다.** 저장하면 `전체는 켜졌는데 넷은 다 꺼진` 상태가 생기고, 그때
// 화면은 스위치가 켜졌다고 말하면서 알림은 안 온다.
describe('전체 스위치', () => {
  it('아무것도 안 켜져 있으면 꺼진 것으로 그린다', async () => {
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByLabelText('알림 받기').props.accessibilityState.checked).toBe(false)
  })

  it('하나라도 켜져 있으면 켜진 것으로 그린다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByLabelText('알림 받기').props.accessibilityState.checked).toBe(true)
  })

  // 못 쓰는 스위치를 흐리게 세워 두면 사용자가 눌러 보고 나서야 못 쓴다는 것을 안다.
  it('꺼져 있으면 하위 넷을 아예 안 그린다', async () => {
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    for (const topic of NOTICE_TOPICS) {
      expect(view.queryByLabelText(`${topic.label} 알림`)).toBeNull()
    }
  })

  it('켜면 하위 넷이 나온다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    for (const topic of NOTICE_TOPICS) {
      expect(view.getByLabelText(`${topic.label} 알림`)).toBeTruthy()
    }
  })

  it('끄는 쪽으로 부른다', async () => {
    const setAllSubscribed = jest.fn().mockResolvedValue(undefined)
    useNoticeStore.setState({ subscriptions: 켜짐, setAllSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(setAllSubscribed).toHaveBeenCalledWith(false)
  })

  it('켜는 쪽으로 부른다', async () => {
    const setAllSubscribed = jest.fn().mockResolvedValue(undefined)
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, setAllSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(setAllSubscribed).toHaveBeenCalledWith(true)
  })
})

describe('구독 스위치', () => {
  it('네 토글이 다 있다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    for (const topic of NOTICE_TOPICS) {
      expect(view.getByLabelText(`${topic.label} 알림`)).toBeTruthy()
    }
  })

  // 전체가 켜져 있어야 하위가 보인다. 그래서 앱 공지만 켠 상태에서 시작한다.
  it('꺼져 있으면 켜는 쪽으로 부른다', async () => {
    const setSubscribed = jest.fn().mockResolvedValue(undefined)
    useNoticeStore.setState({ subscriptions: 켜짐, setSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('게임 공지 사항 알림'))
    })

    expect(setSubscribed).toHaveBeenCalledWith('game', true)
  })

  it('켜져 있으면 끄는 쪽으로 부른다', async () => {
    const setSubscribed = jest.fn().mockResolvedValue(undefined)
    useNoticeStore.setState({
      subscriptions: { ...NO_SUBSCRIPTIONS, cashshop: true },
      setSubscribed,
    })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })

    expect(setSubscribed).toHaveBeenCalledWith('cashshop', false)
  })
})

describe('권한이 없어 막혔을 때', () => {
  // 조용히 두면 사용자는 스위치가 안 켜지는 것을 고장으로 읽는다.
  // 전체를 켜려다 막히면 넷은 안 켜지고 전체 스위치도 꺼진 채다. 안내가 그 안에 있으면
  // 화면이 아무 말도 안 하고 사용자는 스위치가 안 켜지는 것만 본다.
  it('전체가 꺼진 채로 막혀도 길을 준다', async () => {
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, blockedByPermission: true })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByLabelText('알림 권한 설정 열기')).toBeTruthy()
  })

  it('막히면 설정으로 가는 길을 준다', async () => {
    useNoticeStore.setState({ blockedByPermission: true })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByLabelText('알림 권한 설정 열기')).toBeTruthy()
  })

  it('안 막혔으면 안 그린다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.queryByLabelText('알림 권한 설정 열기')).toBeNull()
  })
})


// 구독은 FCM 왕복이라 실패하는 길이 여럿이다(APNs 토큰이 아직 없다 · 망이 끊겼다 · 토픽 이름이
// 틀렸다). 삼키면 스위치가 그냥 안 켜지고 사용자는 `눌러도 반응이 없다` 로 본다.
describe('스위치가 실패할 때', () => {
  it('못 켠 이유를 화면에 적는다', async () => {
    const setAllSubscribed = jest.fn().mockRejectedValue(new Error('APNs 토큰이 없다'))
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, setAllSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(view.getByText('알림을 켜지 못했어요')).toBeTruthy()
    expect(view.getByText('APNs 토큰이 없다')).toBeTruthy()
  })

  it('성공하면 남아 있던 사유를 지운다', async () => {
    const setAllSubscribed = jest
      .fn()
      .mockRejectedValueOnce(new Error('망 끊김'))
      .mockResolvedValue(undefined)
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, setAllSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(view.queryByText('알림을 켜지 못했어요')).toBeNull()
  })
})

// 구독은 FCM 왕복이라 수백 밀리초에서 몇 초가 걸린다. 스토어 값만 그리면 그동안 스위치가 안
// 움직여서 사용자는 `눌러도 반응이 없다` 로 읽고 한 번 더 누른다.
describe('왕복을 기다리지 않고 먼저 그린다', () => {
  /** 끝나지 않는 구독. 그동안 화면이 무엇을 그리는지 본다. */
  function 멈춘구독(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
    let resolve!: () => void
    let reject!: (e: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  it('누르면 왕복이 끝나기 전에 켜진 것으로 그린다', async () => {
    const 대기 = 멈춘구독()
    useNoticeStore.setState({
      subscriptions: NO_SUBSCRIPTIONS,
      setAllSubscribed: jest.fn(() => 대기.promise),
    })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(view.getByLabelText('알림 받기').props.accessibilityState.checked).toBe(true)
    // 기본 묶음이 켜진 모양으로 하위도 함께 나온다.
    expect(view.getByLabelText('게임 공지 사항 알림').props.accessibilityState.checked).toBe(true)
    expect(view.getByLabelText('캐시 아이템 업데이트 알림').props.accessibilityState.checked).toBe(false)

    await act(async () => {
      대기.resolve()
    })
  })

  // 미리 그린 값이 실패한 채로 남으면 스위치는 켜져 있는데 알림은 안 오는 상태가 된다.
  it('실패하면 제자리로 돌아가고 이유를 말한다', async () => {
    const 대기 = 멈춘구독()
    useNoticeStore.setState({
      subscriptions: NO_SUBSCRIPTIONS,
      setAllSubscribed: jest.fn(() => 대기.promise),
    })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })
    await act(async () => {
      대기.reject(new Error('망 끊김'))
      await 대기.promise.catch(() => undefined)
    })

    expect(view.getByLabelText('알림 받기').props.accessibilityState.checked).toBe(false)
    expect(view.getByText('망 끊김')).toBeTruthy()
  })

  it('하위 스위치도 먼저 그린다', async () => {
    const 대기 = 멈춘구독()
    useNoticeStore.setState({
      subscriptions: 켜짐,
      setSubscribed: jest.fn(() => 대기.promise),
    })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })

    expect(view.getByLabelText('캐시 아이템 업데이트 알림').props.accessibilityState.checked).toBe(true)

    await act(async () => {
      대기.resolve()
    })
  })
})

// 스위치가 즉시 움직여도 실제 구독은 몇 초 걸린다. 그 사이 여러 번 누르면 요청이 겹치고,
// 겹치면 나중에 끝난 것이 이겨 마지막으로 누른 것과 다른 상태로 끝날 수 있다.
describe('도는 중에는 터치를 무시한다', () => {
  function 멈춘구독(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void
    const promise = new Promise<void>((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  it('전체 스위치를 연달아 눌러도 한 번만 부른다', async () => {
    const 대기 = 멈춘구독()
    const setAllSubscribed = jest.fn(() => 대기.promise)
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, setAllSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
      fireEvent.press(view.getByLabelText('알림 받기'))
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(setAllSubscribed).toHaveBeenCalledTimes(1)

    await act(async () => {
      대기.resolve()
    })
  })

  // 다섯이 같은 값 하나를 고쳐 쓴다. 하나가 도는 동안 다른 것이 끼면 서로를 덮는다.
  it('하나가 도는 동안 다른 스위치도 막는다', async () => {
    const 대기 = 멈춘구독()
    const setSubscribed = jest.fn(() => 대기.promise)
    useNoticeStore.setState({ subscriptions: 켜짐, setSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
      fireEvent.press(view.getByLabelText('게임 공지 사항 알림'))
    })

    expect(setSubscribed).toHaveBeenCalledTimes(1)
    expect(setSubscribed).toHaveBeenCalledWith('cashshop', true)

    await act(async () => {
      대기.resolve()
    })
  })

  it('끝나면 다시 받는다', async () => {
    const 대기 = 멈춘구독()
    const setAllSubscribed = jest.fn(() => 대기.promise)
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, setAllSubscribed })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })
    await act(async () => {
      대기.resolve()
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(setAllSubscribed).toHaveBeenCalledTimes(2)
  })
})

// 자리를 미리 세우는 이유는 이 화면이 `알림으로 무엇을 받을 수 있는가` 를 말하는 자리이고,
// 목록에서 빠져 있으면 없는 기능인지 못 찾는 기능인지 모르기 때문이다.
describe('스케줄러 알림', () => {
  it('두 줄이 구역 이름 아래 선다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByText('일반')).toBeTruthy()
    expect(view.getByText('스케줄러')).toBeTruthy()
    expect(view.getByText('미완료 스케줄 알림')).toBeTruthy()
    expect(view.getByText('주간 결산 알림')).toBeTruthy()
  })

  // 못 켜는 스위치를 그려 두면 사용자가 눌러 보고 나서야 못 쓴다는 것을 알고, 그 사이 화면은
  // 고장으로 읽힌다.
  it('스위치 대신 준비 중이라고 적는다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getAllByText('준비 중')).toHaveLength(2)
    expect(view.queryByLabelText('미완료 스케줄 알림 알림')).toBeNull()
  })

  it('전체가 꺼져 있으면 구역째 안 그린다', async () => {
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.queryByText('스케줄러')).toBeNull()
    expect(view.queryByText('미완료 스케줄 알림')).toBeNull()
  })
})

// 소식 알림 스위치 넷. 목록에서 떼어 낸 화면이다 - 분류마다 목록이 생겨 스위치를 어느
// 목록에 둬도 나머지 셋이 안 보인다.
import { act, fireEvent } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useNoticeStore } from '../../../features/notice/store'
import { NOTICE_TOPICS } from '../../../features/notice/topics'
import { NO_SUBSCRIPTIONS } from '../../../types/notice'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { setHapticsPort, setNotificationsPort, setPushPort } from '../../../native/ports'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { openNotificationSettings } from '../notification-settings-link'
import { SettingsNoticeAlertsScreen } from '../SettingsNoticeAlertsScreen'

jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}))

jest.mock('../notification-settings-link', () => ({
  __esModule: true,
  openNotificationSettings: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@react-navigation/native', () => ({
  // 통째로 갈아 끼우면 이 패키지가 내보내는 컨텍스트까지 사라진다. 실물을 깔고 필요한 것만 덮는다.
  ...jest.requireActual('@react-navigation/native'),
  // `useFocusEffect` 는 내비게이션 컨텍스트를 요구한다. 마운트를 첫 포커스로 흉내 낸다.
  useFocusEffect: (callback: () => void | (() => void)) => {
    const react = require('react') as typeof import('react')
    react.useEffect(callback, [callback])
  },
}))

/** 전체 스위치가 켜진 상태. 넷 중 하나라도 켜져 있으면 켜진 것으로 파생된다. */
const 켜짐 = { ...NO_SUBSCRIPTIONS, app: true }

/** 스토어의 진짜 동작. 아래 `beforeEach` 가 목으로 덮기 전에 붙잡아 둔다. */
const 진짜 = useNoticeStore.getState()

/** 화면이 들어올 때마다 부르는 권한 읽기. 네이티브를 안 타게 목으로 둔다. */
const refreshPermission = jest.fn().mockResolvedValue(undefined)

beforeEach(() => {
  jest.clearAllMocks()
  useNoticeStore.setState({
    subscriptions: 켜짐,
    pending: {},
    blockedByPermission: false,
    permissionGranted: true,
    refreshPermission,
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

// 아래 권한 카드와 가는 곳이 같지만 그 카드는 켜려다 막혔을 때만 나온다. 막힌 적 없이 기기
// 쪽에서 알림을 끄거나 채널을 손보러 가려는 사용자에게는 앱 안에 길이 없었다.
describe('헤더의 기기 설정', () => {
  it('막히지 않았어도 늘 서 있다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByLabelText('OS 알림 설정 열기')).toBeTruthy()
  })

  // 가는 길은 플랫폼마다 다르고 그 분기는 `notification-settings-link` 가 잰다. 여기서 재는
  // 것은 누름이 거기로 이어지는가뿐이다.
  it('누르면 OS 알림 설정을 연다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('OS 알림 설정 열기'))
    })

    expect(openNotificationSettings).toHaveBeenCalledWith(Platform.OS)
  })
})

// 권한을 받아 켜 둔 뒤 나중에 기기에서 끈 사용자는 켜기를 누른 적이 없어 `blockedByPermission`
// 이 거짓이다. 그러면 스위치는 켜져 있고 알림은 안 오는데 화면이 아무 말도 안 했다.
describe('앱은 켜져 있는데 기기가 꺼져 있을 때', () => {
  it('들어올 때 권한을 읽는다', async () => {
    await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(refreshPermission).toHaveBeenCalled()
  })

  it('꺼져 있으면 말해 준다', async () => {
    useNoticeStore.setState({ subscriptions: 켜짐, permissionGranted: false })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.getByText('기기에서 알림이 꺼져 있어요')).toBeTruthy()
    expect(view.getByLabelText('알림 권한 설정 열기')).toBeTruthy()
  })

  it('허용돼 있으면 안 그린다', async () => {
    useNoticeStore.setState({ subscriptions: 켜짐, permissionGranted: true })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.queryByText('기기에서 알림이 꺼져 있어요')).toBeNull()
  })

  // 알림을 안 쓰기로 한 사용자에게는 잔소리다. iOS 는 한 번도 안 물으면 설정에 그 앱의 알림
  // 항목을 아예 안 만들어서, 그 상태로 설정에 보내면 갈 곳이 없는 막다른 길이다.
  it('켜 둔 것이 없으면 말하지 않는다', async () => {
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS, permissionGranted: false })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.queryByText('기기에서 알림이 꺼져 있어요')).toBeNull()
  })

  // 못 읽었는데 꺼진 것으로 그리면 멀쩡한 기기를 꺼졌다고 말한다.
  it('아직 못 읽었으면 말하지 않는다', async () => {
    useNoticeStore.setState({ subscriptions: 켜짐, permissionGranted: null })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    expect(view.queryByText('기기에서 알림이 꺼져 있어요')).toBeNull()
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

  // 헤더 버튼과 가는 곳이 같아야 한다. 카드만 `openSettings()` 를 쓰면 안드로이드에서 한 화면의
  // 두 문이 다른 곳으로 간다.
  it('헤더 버튼과 같은 길로 간다', async () => {
    useNoticeStore.setState({ blockedByPermission: true })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 권한 설정 열기'))
    })

    expect(openNotificationSettings).toHaveBeenCalledWith(Platform.OS)
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

// 구독은 FCM 왕복이라 수백 밀리초에서 몇 초가 걸린다. 그 사이 스위치가 안 움직이거나 누름이
// 무시되면 사용자는 반응이 느리다고 본다. 줄과 누른 값이 스토어에 있어서, 여기서는 스토어를
// 목으로 덮지 않고 진짜로 돌린다.
describe('왕복을 기다리지 않는다', () => {
  /** 문을 열 때까지 안 끝나는 푸시. 줄에 선 요청이 그 앞에서 기다린다. */
  function 문달린푸시(실패할토픽: readonly string[] = []): { open: () => void } {
    let open!: () => void
    const gate = new Promise<void>((resolve) => {
      open = resolve
    })
    const pass = async (topic: string): Promise<void> => {
      await gate
      if (실패할토픽.includes(topic)) throw new Error(`${topic} 망 끊김`)
    }
    setPushPort({
      subscribe: pass,
      unsubscribe: pass,
      addMessageListener: () => () => {},
      addOpenedListener: () => () => {},
      getInitialNotification: async () => null,
    })
    return { open }
  }

  /** 문을 열고 줄이 빌 때까지 기다린다. 줄에 선 것이 전부 마이크로태스크라 한 틱이면 된다. */
  async function 문열기(push: { open: () => void }): Promise<void> {
    await act(async () => {
      push.open()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  function 켜졌나(view: Awaited<ReturnType<typeof renderOverlay>>, label: string): boolean {
    return view.getByLabelText(label).props.accessibilityState.checked
  }

  beforeEach(() => {
    installFakePreferences()
    setNotificationsPort({
      requestPermission: async () => true,
      hasPermission: async () => true,
      schedule: async () => {},
      cancel: async () => {},
      getPendingCount: async () => 0,
    })
    useNoticeStore.setState({
      setSubscribed: 진짜.setSubscribed,
      setAllSubscribed: 진짜.setAllSubscribed,
    })
  })

  afterEach(installNoopNativePorts)

  it('누르면 왕복이 끝나기 전에 켜진 것으로 그린다', async () => {
    const push = 문달린푸시()
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(켜졌나(view, '알림 받기')).toBe(true)
    // 기본 묶음이 켜진 모양으로 하위도 함께 나온다.
    expect(켜졌나(view, '게임 공지 사항 알림')).toBe(true)
    expect(켜졌나(view, '캐시 아이템 업데이트 알림')).toBe(false)

    await 문열기(push)
  })

  it('첫 요청이 도는 중에 다른 스위치를 누르면 즉시 움직인다', async () => {
    const push = 문달린푸시()
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('게임 공지 사항 알림'))
    })

    expect(켜졌나(view, '캐시 아이템 업데이트 알림')).toBe(true)
    expect(켜졌나(view, '게임 공지 사항 알림')).toBe(true)

    await 문열기(push)

    expect(useNoticeStore.getState().subscriptions).toMatchObject({ cashshop: true, game: true })
  })

  // 늦게 끝난 요청이 이기면 마지막으로 누른 것과 다른 상태로 끝난다.
  it('켜기, 끄기 연타는 끄기로 끝난다', async () => {
    const push = 문달린푸시()
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })

    expect(켜졌나(view, '캐시 아이템 업데이트 알림')).toBe(false)

    await 문열기(push)

    expect(켜졌나(view, '캐시 아이템 업데이트 알림')).toBe(false)
    expect(useNoticeStore.getState().subscriptions.cashshop).toBe(false)
  })

  // 미리 그린 값이 실패한 채로 남으면 스위치는 켜져 있는데 알림은 안 오는 상태가 된다.
  it('실패하면 그 스위치만 돌아가고 이유를 말한다', async () => {
    const push = 문달린푸시(['notice-cashshop'])
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('게임 공지 사항 알림'))
    })
    await 문열기(push)

    expect(켜졌나(view, '캐시 아이템 업데이트 알림')).toBe(false)
    expect(켜졌나(view, '게임 공지 사항 알림')).toBe(true)
    expect(view.getByText('notice-cashshop 망 끊김')).toBeTruthy()
  })

  it('전체 스위치가 실패하면 제자리로 돌아가고 이유를 말한다', async () => {
    const push = 문달린푸시(['notice', 'notice-game', 'notice-event'])
    useNoticeStore.setState({ subscriptions: NO_SUBSCRIPTIONS })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })
    await 문열기(push)

    expect(켜졌나(view, '알림 받기')).toBe(false)
    expect(view.getByText('notice 망 끊김')).toBeTruthy()
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

// 켜고 끄는 것도 고른 값이 바뀌는 일이라 선택 촉각이다. 이 화면은 왕복이 끝나기 전에 누른
// 결과를 먼저 그리므로 두드림도 누를 때 난다.
describe('스위치의 촉각', () => {
  const select = jest.fn(async () => undefined)

  beforeEach(() => {
    select.mockClear()
    setHapticsPort({ tap: async () => {}, select })
  })

  afterEach(installNoopNativePorts)

  it('전체 스위치를 누르면 한 번 난다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('알림 받기'))
    })

    expect(select).toHaveBeenCalledTimes(1)
  })

  it('토픽 스위치에서도 난다', async () => {
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('게임 공지 사항 알림'))
    })

    expect(select).toHaveBeenCalledTimes(1)
  })

  // 왕복 중에도 누름을 받는다. 두드림이 안 나면 손끝은 안 눌렸다고 말하는데 값은 바뀐다.
  it('앞 요청이 도는 중에 눌러도 난다', async () => {
    useNoticeStore.setState({ setSubscribed: jest.fn(() => new Promise<void>(() => {})) })
    const view = await renderOverlay(<SettingsNoticeAlertsScreen />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('게임 공지 사항 알림'))
    })
    await act(async () => {
      fireEvent.press(view.getByLabelText('캐시 아이템 업데이트 알림'))
    })

    expect(select).toHaveBeenCalledTimes(2)
  })
})

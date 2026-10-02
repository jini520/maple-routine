// 약속 시트. 한 번 · 반복은 ＋ 의 갈래에서 정해지고, 시트에는 그것을 바꾸는 칸이 없다.
import type { ReactNode } from 'react'
import { act, fireEvent, within } from '@testing-library/react-native'

// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 시트 안에 무엇이 서는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { usePartyAlarmSettingsStore } from '../../../features/party-appointments/alarm-settings'
import { initialDraft } from '../../../features/party-appointments/draft'
import { usePartyAppointmentsStore } from '../../../features/party-appointments/store'
import { __resetNativePortsForTest, setNotificationsPort } from '../../../native/ports'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { setNotificationPermissionAsked } from '../../../storage/notice-settings'
import { occurrencesInWeek } from '../../../features/party-appointments/occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'
import { AppointmentSheet } from '../AppointmentSheet'

const NAMES = new Map([['ocid-1', '낟낟']])

function 그리기(props: Partial<React.ComponentProps<typeof AppointmentSheet>> = {}) {
  return renderOverlay(<AppointmentSheet names={NAMES} faces={new Map()} onClose={jest.fn()} {...props} />)
}

describe('추가 시트', () => {
  it('한 번만 갈래로 열면 제목이 약속 추가다', async () => {
    const view = await 그리기({ repeats: false })

    expect(view.getByText('약속 추가')).toBeTruthy()
  })

  it('매주 반복 갈래로 열면 제목이 반복 약속 추가다', async () => {
    const view = await 그리기({ repeats: true })

    expect(view.getByText('반복 약속 추가')).toBeTruthy()
  })

  it('한 번 약속은 날짜를 고른다', async () => {
    const view = await 그리기({ repeats: false })

    expect(view.getByLabelText('날짜 고르기')).toBeTruthy()
  })

  it('반복 약속은 날짜 대신 요일을 고른다', async () => {
    const view = await 그리기({ repeats: true })

    expect(view.queryByLabelText('날짜 고르기')).toBeNull()
    expect(view.getByText(/^매주 .요일$/)).toBeTruthy()
  })

  it('매주 반복 체크 상자가 없다', async () => {
    const view = await 그리기({ repeats: true })

    expect(view.queryByLabelText('매주 반복')).toBeNull()
  })
})

describe('수정 시트', () => {
  const weekly: PartyAppointment = {
    id: 'a1',
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: null,
    schedule: { type: 'weekly', weekday: 4, fromWeek: '2099-01-01', untilWeek: null },
    exceptions: {},
  }

  // 한 번 ↔ 반복은 수정에서 바꾸지 못한다. 바꾸려면 지우고 다시 추가한다.
  it('매주 반복 체크 상자가 없고, 제목은 약속 수정 그대로다', async () => {
    const [occurrence] = occurrencesInWeek([weekly], '2099-01-01')
    const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' } })

    await act(async () => {
      fireEvent.press(view.getByLabelText('수정'))
    })

    expect(view.getByText('약속 수정')).toBeTruthy()
    expect(view.queryByLabelText('매주 반복')).toBeNull()
    expect(view.getByLabelText('이 주만 적용하기')).toBeTruthy()
  })

  // 앞으로 모두는 그 주부터 모든 회차를 바꾸니 요일을, 이 주만은 그 회차 하나를 옮기니 날짜를 고른다.
  it('앞으로 모두는 요일, 이 주만 적용하기를 켜면 날짜다', async () => {
    const [occurrence] = occurrencesInWeek([weekly], '2099-01-01')
    const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' } })
    await act(async () => {
      fireEvent.press(view.getByLabelText('수정'))
    })

    expect(view.getByText('매주 목요일')).toBeTruthy()
    expect(view.queryByLabelText('날짜 고르기')).toBeNull()

    await act(async () => {
      fireEvent.press(view.getByLabelText('이 주만 적용하기'))
    })

    expect(view.getByLabelText('날짜 고르기')).toBeTruthy()
  })

  // 일요일 반복을 이 주만 월요일로 옮긴 회차를 다시 고치면 이 주만 적용하기가 켜진 채 고친 날짜로 열린다(사용자 결정).
  // 끄면 앞으로 모두가 되고 요일 타일은 옮긴 날이 아니라 반복 요일(일요일)이다(사용자 보고).
  it('이 주만 고친 회차를 다시 고치면 이 주만 적용하기가 켜진 채 고친 날짜로 열린다', async () => {
    const sunday: PartyAppointment = {
      ...weekly,
      schedule: { type: 'weekly', weekday: 0, fromWeek: '2099-01-01', untilWeek: null },
      exceptions: {
        '2099-01-01': {
          type: 'override',
          dateKey: '2099-01-05',
          timeKst: '21:00',
          durationMinutes: 30,
          bosses: weekly.bosses,
          leadMinutes: null,
        },
      },
    }
    const [occurrence] = occurrencesInWeek([sunday], '2099-01-01')
    expect(occurrence!.dateKey).toBe('2099-01-05')
    const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' } })
    await act(async () => {
      fireEvent.press(view.getByLabelText('수정'))
    })

    expect(view.getByLabelText('이 주만 적용하기').props.accessibilityState).toMatchObject({ checked: true })
    expect(within(view.getByLabelText('날짜 고르기')).getByText(/^1\/5/)).toBeTruthy()

    await act(async () => {
      fireEvent.press(view.getByLabelText('이 주만 적용하기'))
    })

    expect(view.getByText('매주 일요일')).toBeTruthy()
  })

  it('이 주만 고친 적이 없는 회차는 이 주만 적용하기가 꺼진 채 열린다', async () => {
    const [occurrence] = occurrencesInWeek([weekly], '2099-01-01')
    const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' } })
    await act(async () => {
      fireEvent.press(view.getByLabelText('수정'))
    })

    expect(view.getByLabelText('이 주만 적용하기').props.accessibilityState).toMatchObject({ checked: false })
  })
})

// 알림 체크 상자를 켤 때의 모달 둘(정정 21 · 23). 기기 권한 → 파티 약속 알림 스위치 차례다.
describe('알림 체크 상자를 켤 때', () => {
  let granted = true

  beforeEach(async () => {
    installFakePreferences()
    granted = true
    setNotificationsPort({
      requestPermission: async () => granted,
      hasPermission: async () => granted,
      schedule: async () => {},
      cancel: async () => {},
      getPendingCount: async () => 0,
    })
    await setNotificationPermissionAsked()
    usePartyAppointmentsStore.setState({ appointments: [] })
    usePartyAlarmSettingsStore.setState({ enabled: true, loaded: true })
  })

  afterEach(__resetNativePortsForTest)

  /** 시트가 처음 여는 날짜에 알림 달린 약속 셋을 깐다 */
  function 그날알림셋(): void {
    const dateKey = initialDraft(new Date()).startDateKey
    usePartyAppointmentsStore.setState({
      appointments: ['x', 'y', 'z'].map((id) => ({
        id,
        bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
        members: [],
        timeKst: '10:00',
        durationMinutes: 30,
        leadMinutes: 10,
        schedule: { type: 'once', dateKey },
        exceptions: {},
      })),
    })
  }

  async function 켜기(view: Awaited<ReturnType<typeof 그리기>>): Promise<void> {
    await act(async () => {
      fireEvent.press(view.getByLabelText('알림'))
    })
  }

  it('걸리는 것이 없으면 모달 없이 켜진다', async () => {
    const view = await 그리기({ repeats: false })
    await 켜기(view)

    expect(view.getByLabelText('알림').props.accessibilityState).toMatchObject({ checked: true })
    expect(view.queryByText('알림이 꺼져 있어요')).toBeNull()
  })

  // 하루 한도는 없다. 약속 알림은 기기가 예약해 서버 비용이 없다(정정 23).
  it('그 날 알림이 이미 셋이어도 모달 없이 켜지고 사용량을 적지 않는다', async () => {
    그날알림셋()
    const view = await 그리기({ repeats: false })
    await 켜기(view)

    expect(view.getByLabelText('알림').props.accessibilityState).toMatchObject({ checked: true })
    expect(view.queryByText(/알림 \d\/3/)).toBeNull()
  })

  it('기기 권한이 없으면 권한 모달이고, 나중에를 눌러도 체크 상자는 켜져 있다', async () => {
    granted = false
    const view = await 그리기({ repeats: false })
    await 켜기(view)

    expect(view.getByText('알림이 꺼져 있어요')).toBeTruthy()
    expect(view.getByText('설정 열기')).toBeTruthy()

    await act(async () => {
      fireEvent.press(view.getByText('나중에'))
    })

    expect(view.getByLabelText('알림').props.accessibilityState).toMatchObject({ checked: true })
  })

  it('권한은 있는데 파티 약속 알림 스위치가 꺼져 있으면 알림 켜기로 스위치를 켠다', async () => {
    usePartyAlarmSettingsStore.setState({ enabled: false, loaded: true })
    const view = await 그리기({ repeats: false })
    await 켜기(view)

    expect(view.getByText('스케줄 알림이 꺼져있어요')).toBeTruthy()

    await act(async () => {
      fireEvent.press(view.getByText('알림 켜기'))
    })

    expect(usePartyAlarmSettingsStore.getState().enabled).toBe(true)
    expect(view.getByLabelText('알림').props.accessibilityState).toMatchObject({ checked: true })
  })

  // 저장할 때 같은 차례를 저장할 값으로 한 번 더 본다(정정 22).
  describe('저장할 때', () => {
    const weekly: PartyAppointment = {
      id: 'a1',
      bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
      members: [],
      timeKst: '21:00',
      durationMinutes: 30,
      leadMinutes: 10,
      schedule: { type: 'weekly', weekday: 4, fromWeek: '2099-01-01', untilWeek: null },
      exceptions: {},
    }

    async function 수정으로(appointment: PartyAppointment) {
      usePartyAppointmentsStore.setState({ appointments: [appointment] })
      const [occurrence] = occurrencesInWeek([appointment], '2099-01-01')
      const onClose = jest.fn()
      const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' }, onClose })
      await act(async () => {
        fireEvent.press(view.getByLabelText('수정'))
      })
      return { view, onClose }
    }

    async function 저장(view: Awaited<ReturnType<typeof 그리기>>): Promise<void> {
      await act(async () => {
        fireEvent.press(view.getByLabelText('저장'))
      })
    }

    // 설정 열기로 갔다가 켜지 않고 돌아와도 체크 상자는 켜져 있다(사용자 보고).
    it('권한이 여전히 없으면 권한 모달이고, 알림 없이 저장은 알림을 끄고 저장한다', async () => {
      granted = false
      const { view, onClose } = await 수정으로(weekly)

      await 저장(view)

      expect(view.getByText('알림이 꺼져 있어요')).toBeTruthy()
      expect(view.queryByText('나중에')).toBeNull()
      await act(async () => {
        fireEvent.press(view.getByText('알림 없이 저장'))
      })
      expect(onClose).toHaveBeenCalled()
      expect(usePartyAppointmentsStore.getState().appointments[0]!.leadMinutes).toBeNull()
    })

    it('스위치가 꺼져 있으면 알림 켜기가 스위치를 켜고 알림을 단 채 저장한다', async () => {
      usePartyAlarmSettingsStore.setState({ enabled: false, loaded: true })
      const { view, onClose } = await 수정으로(weekly)

      await 저장(view)

      expect(view.getByText('스케줄 알림이 꺼져있어요')).toBeTruthy()
      expect(view.getByText('알림 없이 저장')).toBeTruthy()
      await act(async () => {
        fireEvent.press(view.getByText('알림 켜기'))
      })
      expect(usePartyAlarmSettingsStore.getState().enabled).toBe(true)
      expect(onClose).toHaveBeenCalled()
      expect(usePartyAppointmentsStore.getState().appointments[0]!.leadMinutes).toBe(10)
    })

    it('걸리는 것이 없으면 그대로 저장한다', async () => {
      const { view, onClose } = await 수정으로(weekly)

      await 저장(view)

      expect(onClose).toHaveBeenCalled()
    })
  })
})

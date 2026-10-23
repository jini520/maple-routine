// 위젯 10 다음 파티 스케줄. 캐릭터마다 칸 하나에 닉네임과 보스 줄을 담는다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../../components/__tests__/render-atom'
import { usePartyAppointmentOpenStore } from '../../../../features/party-appointments/open-request'
import { getCurrentKstDateKey } from '../../../../lib/scheduler/reset-clock'
import type { NextPartyView } from '../../view-model'
import { NextPartyScheduleWidget } from '../NextPartyScheduleWidget'
import { 뷰모델 } from './widget-fixture'

const MINUTE_MS = 60_000

function 회차(startsInMs: number, overrides: Partial<NextPartyView> = {}): NextPartyView {
  const startsAtMs = Date.now() + startsInMs
  return {
    appointmentId: 'p1',
    dateKey: getCurrentKstDateKey(new Date(startsAtMs)),
    timeKst: '21:00',
    endClock: '22:00',
    startsAtMs,
    groups: [
      {
        ocid: 'a',
        name: '낟낟',
        imageUrl: null,
        bosses: [
          { bossKey: 'limbo', difficulty: 'hard', ocid: 'a' },
          { bossKey: 'bardrix', difficulty: 'hard', ocid: 'a' },
        ],
      },
      { ocid: 'b', name: '낟넘', imageUrl: null, bosses: [{ bossKey: 'jupiter', difficulty: 'normal', ocid: 'b' }] },
    ],
    leadMinutes: 30,
    repeats: true,
    ...overrides,
  }
}

async function 위젯(nextParty: NextPartyView[]) {
  return renderAtom(<NextPartyScheduleWidget data={뷰모델({ nextParty })} />)
}

beforeEach(() => usePartyAppointmentOpenStore.setState({ request: null, create: null }))

describe('NextPartyScheduleWidget', () => {
  it('제목 · 시각 줄 · 캐릭터 묶음 · 알림 · 반복을 그린다', async () => {
    const view = await 위젯([회차(3 * 60 * MINUTE_MS + 25 * MINUTE_MS + 30_000)])

    expect(view.getByText('다음 파티 스케줄')).toBeTruthy()
    expect(view.getByText('21:00')).toBeTruthy()
    expect(view.getByText('오늘 · 3시간 25분 뒤')).toBeTruthy()
    expect(view.getByText('낟낟')).toBeTruthy()
    expect(view.getByText('낟넘')).toBeTruthy()
    expect(view.getByText('30분 전')).toBeTruthy()
    expect(view.getByText('매주')).toBeTruthy()
  })

  // 시작하면 다음으로 넘어간다.
  it('이미 시작한 회차는 건너뛰고 그 다음을 그린다', async () => {
    const view = await 위젯([
      회차(-MINUTE_MS, { appointmentId: 'gone', timeKst: '17:00' }),
      회차(10 * MINUTE_MS + 30_000, { appointmentId: 'next', timeKst: '18:00' }),
    ])

    expect(view.queryByText('17:00')).toBeNull()
    expect(view.getByText('18:00')).toBeTruthy()
    expect(view.getByText('오늘 · 10분 뒤')).toBeTruthy()
  })

  // 폭 40 의 열에 초상화와 닉네임을 쌓으면 네 글자가 넘는 닉네임이 잘린다. 닉네임만 칸 머리에 적는다.
  it('캐릭터 초상화 없이 캐릭터마다 칸 하나에 닉네임을 적는다', async () => {
    const view = await 위젯([회차(60 * MINUTE_MS)])

    expect(view.getAllByTestId('next-party-group')).toHaveLength(2)
    expect(view.queryByTestId('character-group-face')).toBeNull()
  })

  it('누르면 그 회차를 열 약속으로 남긴다', async () => {
    const next = 회차(60 * MINUTE_MS)
    const view = await 위젯([next])

    await act(async () => {
      fireEvent.press(view.getByLabelText('다음 파티 스케줄 열기'))
    })

    expect(usePartyAppointmentOpenStore.getState().request).toEqual({ appointmentId: 'p1', dateKey: next.dateKey })
  })
})

// 회차가 없으면 격자가 맨 아래 줄로 내리고, 위젯은 새 스케줄을 등록하는 칸 둘을 그린다.
describe('회차가 없을 때', () => {
  it('`매주 반복` · `한 번만` 칸 둘을 그린다', async () => {
    const view = await 위젯([])

    expect(view.getByText('예정된 파티가 없습니다')).toBeTruthy()
    expect(view.getByLabelText('매주 반복 파티 스케줄 등록')).toBeTruthy()
    expect(view.getByLabelText('한 번만 파티 스케줄 등록')).toBeTruthy()
  })

  it.each([
    ['매주 반복', 'weekly'],
    ['한 번만', 'once'],
  ] as const)('%s 칸을 누르면 그 갈래의 새 스케줄을 열 요청을 남긴다', async (label, kind) => {
    const view = await 위젯([])

    await act(async () => {
      fireEvent.press(view.getByLabelText(`${label} 파티 스케줄 등록`))
    })

    expect(usePartyAppointmentOpenStore.getState().create).toBe(kind)
  })

  // 띄워 둔 사이 마지막 회차가 시작해도 빈 타일로 남지 않는다.
  it('이미 시작한 회차뿐이면 등록 칸을 그린다', async () => {
    const view = await 위젯([회차(-MINUTE_MS)])

    expect(view.getByText('예정된 파티가 없습니다')).toBeTruthy()
  })
})

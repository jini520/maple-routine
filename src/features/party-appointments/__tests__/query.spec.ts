jest.mock('../../../storage/party-appointments', () => ({
  getPartyAppointments: jest.fn(async () => []),
  setPartyAppointments: jest.fn(async () => undefined),
}))
jest.mock('../../local-notifications/run', () => ({ requestNotificationReconcile: jest.fn(async () => undefined) }))

import type { PartyAppointment } from '../../../types/party-appointment'
import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { loadPartyAppointments, savePartyAppointments } from '../query'

const { getPartyAppointments: getMock, setPartyAppointments: setMock } = jest.requireMock(
  '../../../storage/party-appointments',
) as Record<string, jest.Mock>
const { requestNotificationReconcile: reconcileMock } = jest.requireMock('../../local-notifications/run') as Record<string, jest.Mock>

const ONE: PartyAppointment = {
  id: 'one',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: 10,
  schedule: { type: 'once', dateKey: '2026-10-07' },
  exceptions: {},
}

beforeEach(() => {
  queryClient.clear()
  jest.clearAllMocks()
  getMock.mockResolvedValue([])
})

it('저장이 캐시를 덮고 알림 재조정을 부른다. 저장이 먼저다', async () => {
  const order: string[] = []
  setMock.mockImplementation(async () => void order.push('set'))
  reconcileMock.mockImplementation(async () => void order.push('reconcile'))

  await savePartyAppointments([ONE])

  expect(order).toEqual(['set', 'reconcile'])
  expect(queryClient.getQueryData(queryKeys.partyAppointments())).toEqual([ONE])
})

it('저장이 실패하면 캐시도 그대로다. 다시 켰을 때 약속이 사라지면 안 된다', async () => {
  queryClient.setQueryData(queryKeys.partyAppointments(), [])
  setMock.mockRejectedValue(new Error('disk'))

  await expect(savePartyAppointments([ONE])).rejects.toThrow('disk')

  expect(queryClient.getQueryData(queryKeys.partyAppointments())).toEqual([])
  expect(reconcileMock).not.toHaveBeenCalled()
})

it('아직 안 읽었으면 저장소를 읽고, 읽은 뒤에는 캐시를 돌려준다', async () => {
  getMock.mockResolvedValue([ONE])

  expect(await loadPartyAppointments()).toEqual([ONE])
  expect(await loadPartyAppointments()).toEqual([ONE])
  expect(getMock).toHaveBeenCalledTimes(1)
})

// 알림을 눌러 들어와도 숨은 회차의 상세를 열지 않는다. 그 주만 연다.
it('읽은 목록에서 이 기기가 모르는 캐릭터의 보스를 뺀다', async () => {
  const mixed: PartyAppointment = { ...ONE, bosses: [...ONE.bosses, { bossKey: 'lucid', difficulty: 'hard', ocid: '#a1b2' }] }
  getMock.mockResolvedValue([mixed])

  expect((await loadPartyAppointments())[0]!.bosses).toEqual(ONE.bosses)
})

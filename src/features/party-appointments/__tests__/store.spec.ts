import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { usePartyAppointmentsStore } from '../store'
import type { PartyAppointment } from '../../../types/party-appointment'

const LIMBO: PartyAppointment = {
  id: 'a1',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  members: [],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: null,
  schedule: { type: 'once', dateKey: '2026-09-30' },
  exceptions: {},
}

beforeEach(() => {
  installFakePreferences()
  usePartyAppointmentsStore.setState({ appointments: [], loaded: false })
})

it('불러오기 전에는 loaded 가 거짓이다', () => {
  expect(usePartyAppointmentsStore.getState().loaded).toBe(false)
})

it('저장소의 약속을 불러온다', async () => {
  await usePartyAppointmentsStore.getState().save([LIMBO])
  usePartyAppointmentsStore.setState({ appointments: [], loaded: false })

  await usePartyAppointmentsStore.getState().load()

  expect(usePartyAppointmentsStore.getState()).toMatchObject({ appointments: [LIMBO], loaded: true })
})

it('저장하면 상태와 저장소가 함께 바뀐다', async () => {
  await usePartyAppointmentsStore.getState().save([LIMBO])

  expect(usePartyAppointmentsStore.getState().appointments).toEqual([LIMBO])
  usePartyAppointmentsStore.setState({ appointments: [] })
  await usePartyAppointmentsStore.getState().load()
  expect(usePartyAppointmentsStore.getState().appointments).toEqual([LIMBO])
})

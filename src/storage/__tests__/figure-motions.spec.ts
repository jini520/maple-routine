import { installFakePreferences } from './fake-preferences'
import { getFigureMotions, moveFigureMotionToOcid, setFigureMotions } from '../figure-motions'

const 걷기 = { actions: ['A03'], emotions: ['E02'], durationMs: 5000, rest: false }
const 찌르기 = { actions: ['A24'], emotions: ['E00'], durationMs: 10000, rest: true }

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('캐릭터마다 고른 값을 한 칸에 적고 그대로 읽는다', async () => {
  await setFigureMotions({ 'ocid-1': 걷기, 'ocid-2': 찌르기 } as never)

  expect(await getFigureMotions()).toEqual({ 'ocid-1': 걷기, 'ocid-2': 찌르기 })
})

it('없거나 JSON 이 깨졌으면 `null` 이다', async () => {
  expect(await getFigureMotions()).toBeNull()

  await prefs.set('figureMotions', '{')
  expect(await getFigureMotions()).toBeNull()
})

describe('월드 리프', () => {
  it('옛 ocid 의 값을 새 ocid 로 옮긴다', async () => {
    await setFigureMotions({ 'old-1': 걷기 } as never)

    await moveFigureMotionToOcid('old-1', 'new-1')

    expect(await getFigureMotions()).toEqual({ 'new-1': 걷기 })
  })

  it('새 ocid 에 값이 있으면 새 것을 둔다', async () => {
    await setFigureMotions({ 'old-1': 걷기, 'new-1': 찌르기 } as never)

    await moveFigureMotionToOcid('old-1', 'new-1')

    expect(await getFigureMotions()).toEqual({ 'new-1': 찌르기 })
  })

  it('옮길 값이 없으면 아무것도 안 적는다', async () => {
    await moveFigureMotionToOcid('old-1', 'new-1')

    expect(await prefs.get('figureMotions')).toBeNull()
  })
})

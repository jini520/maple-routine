import { installFakePreferences } from './fake-preferences'
import { getLastHuntSelection, setLastHuntSelection } from '../last-hunt-selection'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('한 번도 안 적었으면 null 이다', async () => {
  expect(await getLastHuntSelection()).toBeNull()
})

it('넣은 값을 그대로 돌려준다', async () => {
  await setLastHuntSelection({ ocid: 'ocid-1', ground: '지하 1층' })

  expect(await getLastHuntSelection()).toEqual({ ocid: 'ocid-1', ground: '지하 1층' })
})

// 캐릭터를 안 고르고 적은 행도 사냥터는 있다. 그 사냥터만 되살린다.
it('캐릭터 없이도 사냥터만 기억한다', async () => {
  await setLastHuntSelection({ ocid: null, ground: '지하 1층' })

  expect(await getLastHuntSelection()).toEqual({ ocid: null, ground: '지하 1층' })
})

/**
 * 모양이 어긋난 값은 **없는 것으로 본다**. 되살리는 쪽이 그 값을 고르개에 세우면 목록에 없는
 * 값을 든 단계가 되어 배지도 자리표시자도 안 서는 줄이 된다.
 */
it('상한 값은 없는 것으로 본다', async () => {
  await prefs.set('lastHuntSelection', '{')
  expect(await getLastHuntSelection()).toBeNull()

  await prefs.set('lastHuntSelection', '{"ocid":"ocid-1"}')
  expect(await getLastHuntSelection()).toBeNull()

  await prefs.set('lastHuntSelection', '{"ocid":1,"ground":"지하 1층"}')
  expect(await getLastHuntSelection()).toBeNull()
})

it('사냥터 이름이 비었으면 안 적는다', async () => {
  await setLastHuntSelection({ ocid: 'ocid-1', ground: '' })

  expect(await prefs.get('lastHuntSelection')).toBeNull()
})

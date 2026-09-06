import { getEventWorldNames, saveEventWorldNames } from '../event-world-names'
import { installFakePreferences } from './fake-preferences'

const fake = installFakePreferences()

beforeEach(() => {
  fake.clear()
})

it('적은 것을 그대로 돌려준다', async () => {
  await saveEventWorldNames(new Set(['머리맨들맨둘']))

  expect(await getEventWorldNames()).toEqual(new Set(['머리맨들맨둘']))
})

// 앞은 아직 못 받았다는 뜻이고 뒤는 스페셜 캐릭터가 없는 계정이다.
it('안 적힌 것과 빈 집합을 가른다', async () => {
  expect(await getEventWorldNames()).toBeNull()

  await saveEventWorldNames(new Set())
  expect(await getEventWorldNames()).toEqual(new Set())
})

it('상한 값은 없는 것으로 본다', async () => {
  await fake.set('eventWorldNames', '{{{')

  expect(await getEventWorldNames()).toBeNull()
})

it('배열이 아닌 값도 없는 것으로 본다', async () => {
  await fake.set('eventWorldNames', '{"a":1}')

  expect(await getEventWorldNames()).toBeNull()
})

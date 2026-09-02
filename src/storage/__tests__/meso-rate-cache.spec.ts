import { installFakePreferences } from './fake-preferences'
import { getCachedMesoRate, setCachedMesoRate } from '../meso-rate-cache'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('한 번도 안 읽은 캐릭터는 null 이다', async () => {
  expect(await getCachedMesoRate('ocid-1')).toBeNull()
})

it('넣은 값을 그대로 돌려준다', async () => {
  await setCachedMesoRate('ocid-1', 149)

  expect(await getCachedMesoRate('ocid-1')).toBe(149)
})

it('캐릭터마다 따로 산다', async () => {
  await setCachedMesoRate('ocid-1', 149)
  await setCachedMesoRate('ocid-2', 46)

  expect(await getCachedMesoRate('ocid-1')).toBe(149)
  expect(await getCachedMesoRate('ocid-2')).toBe(46)
})

// 메획이 0 인 캐릭터는 실제로 있다(잠재에 메획을 안 두른 부캐). `없음`과 섞이면 안 된다.
it('0 은 값이다 — null 로 접히지 않는다', async () => {
  await setCachedMesoRate('ocid-1', 0)

  expect(await getCachedMesoRate('ocid-1')).toBe(0)
})

it('다시 넣으면 덮어쓴다 — 장비를 갈아입으면 값이 바뀐다', async () => {
  await setCachedMesoRate('ocid-1', 149)
  await setCachedMesoRate('ocid-1', 161)

  expect(await getCachedMesoRate('ocid-1')).toBe(161)
})

// 손으로 편집됐거나 옛 형식인 값. 폴백의 **기본값**으로 쓰이는 자리라 NaN 이 새면 칸이 깨진다.
it('상한 값은 없는 것으로 본다', async () => {
  await prefs.set('mesoRateCache:ocid-1', '메획')
  expect(await getCachedMesoRate('ocid-1')).toBeNull()

  await prefs.set('mesoRateCache:ocid-1', '-5')
  expect(await getCachedMesoRate('ocid-1')).toBeNull()
})

it('상한 값은 넣지도 않는다', async () => {
  await setCachedMesoRate('ocid-1', Number.NaN)

  expect(await prefs.get('mesoRateCache:ocid-1')).toBeNull()
})

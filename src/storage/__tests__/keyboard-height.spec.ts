import { installFakePreferences } from './fake-preferences'
import { getKeyboardHeight, setKeyboardHeight } from '../keyboard-height'

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('한 번도 안 쟀으면 null 이다', async () => {
  expect(await getKeyboardHeight()).toBeNull()
})

it('잰 값을 그대로 돌려준다', async () => {
  await setKeyboardHeight(372)

  expect(await getKeyboardHeight()).toBe(372)
})

// 0 이 판정에 들어가면 어느 화면이든 키보드를 받칠 수 있다고 읽어 카드가 다시 잘린다.
it('상한 값은 없는 것으로 본다', async () => {
  await prefs.set('keyboardHeight', '0')
  expect(await getKeyboardHeight()).toBeNull()

  await prefs.set('keyboardHeight', '키보드')
  expect(await getKeyboardHeight()).toBeNull()
})

it('상한 값은 아예 안 쓴다', async () => {
  await setKeyboardHeight(0)
  await setKeyboardHeight(Number.NaN)

  expect(await prefs.get('keyboardHeight')).toBeNull()
})

import { setKeyboardPort } from '../../../native/ports'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { getKeyboardHeight } from '../../../storage/keyboard-height'
import { defaultKeyboardPx } from '../../../lib/number-pad-metrics'
import { __resetKeyboardHeightForTest, keyboardHeightPx, startKeyboardHeightRecorder } from '../keyboard-height'

/** 포트에 꽂아 두고 테스트가 키보드 높이를 흘려 넣는 자리. */
let emitHeight: (heightPx: number) => void = () => {}

beforeEach(() => {
  installFakePreferences()
  __resetKeyboardHeightForTest()
  setKeyboardPort({
    addVisibilityListener: async () => () => {},
    addHeightListener: async (onHeight) => {
      emitHeight = onHeight
      return () => {
        emitHeight = () => {}
      }
    },
  })
})

describe('키보드 높이를 기기에 저장한다', () => {
  it('잰 적이 없으면 첫 실행 기본값을 쓴다', async () => {
    await startKeyboardHeightRecorder()

    expect(keyboardHeightPx()).toBe(defaultKeyboardPx())
  })

  it('키보드가 뜨면 그 높이를 쓰고 저장한다', async () => {
    await startKeyboardHeightRecorder()

    emitHeight(301)

    expect(keyboardHeightPx()).toBe(301)
    await Promise.resolve()
    expect(await getKeyboardHeight()).toBe(301)
  })

  it('저장된 값을 다음 실행에서 읽어 온다', async () => {
    await startKeyboardHeightRecorder()
    emitHeight(301)
    await Promise.resolve()

    __resetKeyboardHeightForTest()
    await startKeyboardHeightRecorder()

    expect(keyboardHeightPx()).toBe(301)
  })

  // 모르면 자체 판으로 기운다. 떠 있는 작은 키보드나 하드웨어 키보드가 높이를 낮추면 짧은 화면의 카드가 다시 잘린다.
  it('본 것 중 가장 높은 값을 남긴다', async () => {
    await startKeyboardHeightRecorder()

    emitHeight(335)
    emitHeight(308)

    expect(keyboardHeightPx()).toBe(335)
  })

  it('높이 0 은 버린다', async () => {
    await startKeyboardHeightRecorder()

    emitHeight(0)

    expect(keyboardHeightPx()).toBe(defaultKeyboardPx())
  })
})

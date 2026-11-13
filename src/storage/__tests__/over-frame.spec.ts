import { installFakePreferences } from './fake-preferences'
import { getOverFrameEnabled, setOverFrameEnabled } from '../over-frame'

beforeEach(() => {
  installFakePreferences()
})

// 처음 값은 켜짐이다. 저장된 값이 없는 기존 사용자도 업데이트하면 오버 프레임을 본다.
describe('over-frame 저장', () => {
  it('저장된 값이 없으면 켜짐으로 읽는다', async () => {
    expect(await getOverFrameEnabled()).toBe(true)
  })

  it('끈 값만 꺼짐으로 읽고, 다시 켜면 켜짐으로 읽는다', async () => {
    await setOverFrameEnabled(false)
    expect(await getOverFrameEnabled()).toBe(false)

    await setOverFrameEnabled(true)
    expect(await getOverFrameEnabled()).toBe(true)
  })
})

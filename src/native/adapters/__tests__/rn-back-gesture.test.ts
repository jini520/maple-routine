// `BackGesturePort` 의 RN 구현 — **하나는 구현이고 둘은 던진다**는 사실 자체가 계약이다.
//
// 계획서는 이 포트를 통째로 *"삭제 — 네이티브 스택 기본"* 으로 적어 두었는데, 실제로는 절반만
// 맞았다(`rn-back-gesture.ts`). 그 갈림을 여기서 고정한다 — 나중에 "다 없앴는데 왜 남아 있지"
// 하며 지우면 [[ADR-120]] 결정 18 이 조용히 사라진다(앱이 종료되고 다음 실행이 콜드 스타트가
// 되는데, 그것을 알아채려면 실기기에서 두 번 실행해 봐야 한다).

// 변수 이름이 `mock` 으로 시작하는 것은 취향이 아니다 — jest 가 `jest.mock()` 팩토리에서 바깥
// 변수를 참조하는 것을 막는데(호이스팅 때문에 초기화 전 접근이 될 수 있다) 그 접두사만 예외로 둔다.
// 게터로 감싸는 것도 같은 이유다: 팩토리는 모듈 평가보다 먼저 돌므로 값을 그때 읽으면 안 된다.
let mockNativeModule: { moveToBackground: jest.Mock } | null = null

jest.mock('../../../../modules/app-background', () => ({
  __esModule: true,
  get default() {
    return mockNativeModule
  },
}))

import { rnBackGesturePort } from '../rn-back-gesture'

beforeEach(() => {
  mockNativeModule = { moveToBackground: jest.fn(async () => {}) }
})

describe('moveToBackground — 유일한 실구현', () => {
  it('네이티브 모듈을 부른다', async () => {
    await rnBackGesturePort.moveToBackground()

    expect(mockNativeModule?.moveToBackground).toHaveBeenCalledTimes(1)
  })

  // iOS 에는 이 개념이 없어 모듈이 `null` 이다(`platforms: ["android"]`). 그 자리는 `not-implemented`
  // 의 기준으로 *"이 플랫폼에 그 개념이 없다"* 쪽이라 **정당한 no-op** 이고, 던지면 안 된다 —
  // 던지면 iOS 에서 뒤로가기 훅이 매번 처리되지 않은 거부를 남긴다.
  it('네이티브 모듈이 없는 플랫폼(iOS)에서는 조용히 아무것도 하지 않는다', async () => {
    mockNativeModule = null

    await expect(rnBackGesturePort.moveToBackground()).resolves.toBeUndefined()
  })
})

describe('나머지 둘은 네이티브 스택이 소유한다', () => {
  const cases: [string, () => Promise<unknown>][] = [
    ['setEnabled', () => rnBackGesturePort.setEnabled(true)],
    ['addListeners', () => rnBackGesturePort.addListeners({ onInvoked: () => {} })],
  ]

  it.each(cases)('%s() 는 조용히 넘어가지 않고 거부한다', async (_name, call) => {
    await expect(call()).rejects.toThrow()
  })

  // 메시지가 사유를 말해야 한다. *"아직 안 만들었다"*(`not-implemented.ts`)와 *"이제 다른 것이
  // 소유한다"* 는 다른 상황이고, 뒤엣것은 **기다려도 채워지지 않는다** — 부르는 코드를 지우는 것이
  // 정답이다. 그 구분이 메시지에 없으면 다음 사람이 3단계 완료를 기다린다.
  it.each(cases)('%s() 의 메시지가 네이티브 스택을 가리킨다', async (name, call) => {
    await expect(call()).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining(`BackGesturePort.${name}()`) as unknown as string,
      }),
    )
    await expect(call()).rejects.toThrow(/react-navigation 네이티브 스택/)
    await expect(call()).rejects.toThrow(/ADR-120/)
  })

  // 동기 `throw` 로 두면 `await` 없이 `.catch()` 만 단 호출부에서 예외가 그대로 터진다
  // (거부하는 다른 어댑터들과 같은 판단).
  it.each(cases)('%s() 는 동기 throw 가 아니라 거부된 Promise 다', async (_name, call) => {
    let result: unknown
    expect(() => {
      result = call()
    }).not.toThrow()

    expect(result).toBeInstanceOf(Promise)
    await expect(result).rejects.toThrow()
  })
})

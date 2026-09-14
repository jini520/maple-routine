// 발행 지문 못박기([[ADR-190]]). 이 파일이 지키는 것 둘 —
// ① 못박은 플랫폼은 트리 계산값을 **안 쓴다**(결정 1)
// ② 못박은 값이 **지금 발행돼 있는 판정값과 다르면 발행이 멈춘다**(결정 2)
//
// 이 둘이 깨지면 나는 사고가 화면에 안 보인다 — 배포도 성공하고 앱도 안 죽고, 스토어 사용자만
// 부팅할 때마다 「스토어 업데이트가 필요해요」를 본다. 그래서 수치로 못 박는다.
import {
  IN_REVIEW_RUNTIME_VERSIONS,
  PINNED_RUNTIME_VERSIONS,
  describePinMismatch,
  pinsForPlatforms,
  resolveAcceptedRuntimeVersions,
  resolvePublishPlatforms,
  resolveRuntimeVersions,
} from '../ota-runtime-version.mjs'

const IOS_STORE = 'd304704ee9eeedd73d61383372e00849f830f8fb'
const ANDROID_STORE = '3df849c014ea95bb7b0b9dd506094148b0fdc508'
const COMPUTED = { ios: 'a52ce256dea7a8316d27c3c5e07466c751abc440', android: '7e2fec5dcde4539a077aa014b8cba5eeef456267' }

describe('resolveRuntimeVersions — 못박은 값이 트리 계산값을 이긴다 ([[ADR-190]] 결정 1)', () => {
  it('못박지 않았으면 트리 계산값 그대로다 — 이것이 정상 상태다', () => {
    expect(resolveRuntimeVersions(COMPUTED, {})).toEqual({
      ios: { runtimeVersion: COMPUTED.ios, pinned: null },
      android: { runtimeVersion: COMPUTED.android, pinned: null },
    })
  })

  it('못박은 플랫폼은 그 값을 쓴다 — 계산값은 버린다', () => {
    const pins = {
      ios: { runtimeVersion: IOS_STORE, binaryAppVersion: '1.0.6' },
      android: { runtimeVersion: ANDROID_STORE, binaryAppVersion: '1.0.6' },
    }

    expect(resolveRuntimeVersions(COMPUTED, pins)).toEqual({
      ios: { runtimeVersion: IOS_STORE, pinned: pins.ios },
      android: { runtimeVersion: ANDROID_STORE, pinned: pins.android },
    })
  })

  // 한쪽만 못박는 일이 실제로 있었다(2026-08-25 안드로이드 단독 발행).
  it('한 플랫폼만 못박을 수 있다', () => {
    const pins = { android: { runtimeVersion: ANDROID_STORE, binaryAppVersion: '1.0.6' } }
    const resolved = resolveRuntimeVersions(COMPUTED, pins)

    expect(resolved.ios.runtimeVersion).toBe(COMPUTED.ios)
    expect(resolved.android.runtimeVersion).toBe(ANDROID_STORE)
  })
})

describe('describePinMismatch — 판정값과 다르면 멈춘다 ([[ADR-190]] 결정 2)', () => {
  const pin = { runtimeVersion: IOS_STORE, binaryAppVersion: '1.0.6' }

  it('발행된 판정값과 같으면 통과다', () => {
    expect(describePinMismatch('ios', pin, { runtimeVersion: IOS_STORE, appVersion: '1.0.6' })).toBeNull()
  })

  // 이것이 이 가드가 겨누는 사고다 — 값을 잘못 베끼면 그 순간 스토어 사용자 전원에게 거짓 모달이 뜬다.
  it('판정값과 다르면 무엇이 어긋났는지 말한다', () => {
    const gap = describePinMismatch('ios', pin, { runtimeVersion: COMPUTED.ios, appVersion: '1.0.6' })

    expect(gap).toContain(IOS_STORE)
    expect(gap).toContain(COMPUTED.ios)
  })

  // 첫 발행에는 비교할 대상이 없다 — «어긋났다» 가 아니라 «아직 없다» 다.
  it('발행된 판정 파일이 아직 없으면 통과다', () => {
    expect(describePinMismatch('ios', pin, { runtimeVersion: null, appVersion: null })).toBeNull()
    expect(describePinMismatch('ios', pin, null)).toBeNull()
  })

  it('못박지 않은 플랫폼은 검사하지 않는다', () => {
    expect(describePinMismatch('ios', undefined, { runtimeVersion: COMPUTED.ios, appVersion: '1.0.6' })).toBeNull()
  })
})

// 값은 우리가 정한 것이 아니라 바이너리에서 읽어 온 사실이다. 새 스토어 바이너리가 나오면 상수를
// 고치는 것이 아니라 비운다.
describe('PINNED_RUNTIME_VERSIONS: 못박은 스토어 바이너리의 지문', () => {
  // 두 스토어의 1.0.8 이 트리 계산값과 같은 지문으로 게시됐다(iOS 2026-09-12 · 안드로이드 2026-09-13).
  it('두 플랫폼 다 비었다', () => {
    expect(PINNED_RUNTIME_VERSIONS).toEqual({})
  })
})

// 앱이 **나는 잠기지 않아도 되는가** 를 묻는 자리다([[ADR-268]] 결정 2). 값 하나와 같은가로
// 두면 심사 기간을 표현할 수 없다. 그때는 정당한 바이너리가 둘이다(스토어에 있는 옛 것 · 심사
// 중인 새 것). 여기서 틀리면 심사 담당자가 못 쓰는 앱을 보거나, 반대로 아무도 안 잠긴다.
describe('resolveAcceptedRuntimeVersions ([[ADR-268]] 결정 2)', () => {
  const RUNTIME = { ios: IOS_STORE, android: ANDROID_STORE }

  it('심사 중인 것이 없으면 발행 지문 하나다: 이것이 정상 상태다', () => {
    expect(resolveAcceptedRuntimeVersions(RUNTIME, {})).toEqual({
      ios: [IOS_STORE],
      android: [ANDROID_STORE],
    })
  })

  it('심사 중인 지문을 뒤에 붙인다', () => {
    const accepted = resolveAcceptedRuntimeVersions(RUNTIME, { ios: ['NEW_IOS'] })

    expect(accepted.ios).toEqual([IOS_STORE, 'NEW_IOS'])
  })

  // 두 스토어의 게시 시점이 달라 한쪽만 심사 중인 구간이 실제로 생긴다(결정 3).
  it('플랫폼마다 따로 든다', () => {
    const accepted = resolveAcceptedRuntimeVersions(RUNTIME, { ios: ['NEW_IOS'] })

    expect(accepted.android).toEqual([ANDROID_STORE])
  })

  // 같은 값이 두 번 실리면 그 파일을 읽는 사람이 **둘이 다른 바이너리** 로 읽는다.
  it('발행 지문과 같은 값은 겹쳐 싣지 않는다', () => {
    const accepted = resolveAcceptedRuntimeVersions(RUNTIME, { ios: [IOS_STORE] })

    expect(accepted.ios).toEqual([IOS_STORE])
  })

  it('심사 목록 자체가 없어도 발행 지문은 나온다', () => {
    expect(resolveAcceptedRuntimeVersions(RUNTIME, undefined)).toEqual({
      ios: [IOS_STORE],
      android: [ANDROID_STORE],
    })
  })
})

// 못박은 지문과 같은 성질이라 같은 파일에 둔다. 출시 후에 비워야 해서 수치로 박아 둔다. 안 비우면
// 아무도 안 잠기고, 그 방향이 안전한 쪽이라 조용히 지나간다.
describe('IN_REVIEW_RUNTIME_VERSIONS: 심사 중인 바이너리의 지문', () => {
  // 비운 것이 곧 그 플랫폼 1.0.6 기기의 잠금이다. iOS 2026-09-13 · 안드로이드 2026-09-14.
  it('두 플랫폼 다 비었다: 1.0.8 이 게시돼 1.0.6 기기가 잠긴다', () => {
    expect(IN_REVIEW_RUNTIME_VERSIONS).toEqual({})
  })
})

// 한 플랫폼만 발행하는 자리. 안드로이드 스토어가 1.0.6 에 머문 동안 iOS 만 내야 했다.
describe('resolvePublishPlatforms: --platform 으로 발행할 플랫폼을 고른다', () => {
  it('안 주면 둘 다다', () => {
    expect(resolvePublishPlatforms([])).toEqual(['ios', 'android'])
  })

  it('--platform ios 면 iOS 만이다', () => {
    expect(resolvePublishPlatforms(['--platform', 'ios'])).toEqual(['ios'])
  })

  it('--platform=android 모양도 받는다', () => {
    expect(resolvePublishPlatforms(['--platform=android'])).toEqual(['android'])
  })

  it('모르는 플랫폼이면 던진다. 오타로 둘 다 발행되면 안 된다', () => {
    expect(() => resolvePublishPlatforms(['--platform', 'ipados'])).toThrow('ipados')
  })

  it('--platform 뒤에 값이 없으면 던진다', () => {
    expect(() => resolvePublishPlatforms(['--platform'])).toThrow()
  })
})

describe('pinsForPlatforms: 발행하는 플랫폼의 못박기만 남긴다', () => {
  const pins = { android: { runtimeVersion: ANDROID_STORE, binaryAppVersion: '1.0.6' } }

  it('iOS 만 발행하면 안드로이드 못박기는 안 걸린다', () => {
    expect(pinsForPlatforms(pins, ['ios'])).toEqual({})
  })

  it('안드로이드를 발행하면 그 못박기가 남는다', () => {
    expect(pinsForPlatforms(pins, ['ios', 'android'])).toEqual(pins)
  })
})

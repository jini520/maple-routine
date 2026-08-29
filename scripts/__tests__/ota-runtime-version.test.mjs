// 발행 지문 못박기([[ADR-190]]). 이 파일이 지키는 것 둘 —
// ① 못박은 플랫폼은 트리 계산값을 **안 쓴다**(결정 1)
// ② 못박은 값이 **지금 발행돼 있는 판정값과 다르면 발행이 멈춘다**(결정 2)
//
// 이 둘이 깨지면 나는 사고가 화면에 안 보인다 — 배포도 성공하고 앱도 안 죽고, 스토어 사용자만
// 부팅할 때마다 「스토어 업데이트가 필요해요」를 본다. 그래서 수치로 못 박는다.
import { PINNED_RUNTIME_VERSIONS, describePinMismatch, resolveRuntimeVersions } from '../ota-runtime-version.mjs'

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

// 값은 «우리가 정한 것» 이 아니라 **바이너리에서 읽어 온 사실**이다([[ADR-190]] 결정 1). 그래서
// 여기 적어 둔다 — 이 두 줄이 바뀌면 그것은 새 스토어 바이너리가 나왔다는 뜻이고, 그때는 상수를
// 고치는 것이 아니라 **비우는** 것이 맞다(결정 4).
describe('PINNED_RUNTIME_VERSIONS — 1.0.6 스토어 바이너리의 지문 ([[ADR-190]])', () => {
  it('두 플랫폼 다 1.0.6 바이너리를 가리킨다', () => {
    expect(PINNED_RUNTIME_VERSIONS).toEqual({
      ios: { runtimeVersion: IOS_STORE, binaryAppVersion: '1.0.6' },
      android: { runtimeVersion: ANDROID_STORE, binaryAppVersion: '1.0.6' },
    })
  })
})

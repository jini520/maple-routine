// 광고 단위 ID 해석 규칙.
//
// 실 광고 단위 ID는 저장소에 두지 않고 빌드할 때 환경 변수로 넣는다. 값이 없으면 광고를 켜지
// 않는다. 잘못된 ID로 광고를 띄우는 것보다 안 띄우는 편이 안전하기 때문이다. 실제 ID로 자기
// 광고를 클릭하면 AdMob 계정이 정지될 수 있고 복구하기가 매우 어렵다.
//
// 테스트 광고 ID는 코드에 그대로 둔다. Google이 공개한 고정값이라 설정이 아니고, 누가 눌러도
// 위험이 없다.
import { resolveInterstitialAdId } from '../ads'

const PRODUCTION = {
  android: 'ca-app-pub-TEST-FIXTURE/android',
  ios: 'ca-app-pub-TEST-FIXTURE/ios',
}
const NONE = { android: undefined, ios: undefined }

describe('resolveInterstitialAdId', () => {
  it.each(['android', 'ios'] as const)('%s: 테스트 광고를 쓰면 Google 고정값을 준다', (os) => {
    const id = resolveInterstitialAdId(os, true, NONE)

    // 환경 변수가 없어도 테스트 광고는 항상 나와야 한다. 개발이 막히면 안 된다.
    expect(id).toMatch(/^ca-app-pub-3940256099942544\//)
  })

  it.each(['android', 'ios'] as const)('%s: 환경 변수를 무시하지 않는다', (os) => {
    expect(resolveInterstitialAdId(os, false, PRODUCTION)).toBe(PRODUCTION[os])
  })

  it.each(['android', 'ios'] as const)('%s: 테스트 광고가 실 ID를 이긴다', (os) => {
    // 개발 빌드에 실 ID가 들어 있어도 테스트 광고가 나가야 한다.
    expect(resolveInterstitialAdId(os, true, PRODUCTION)).not.toBe(PRODUCTION[os])
  })

  it.each(['android', 'ios'] as const)('%s: 실 ID가 없으면 광고를 켜지 않는다', (os) => {
    expect(resolveInterstitialAdId(os, false, NONE)).toBeNull()
  })

  it('빈 문자열도 없는 것으로 본다', () => {
    // 셸에서 `EXPO_PUBLIC_...=` 로 비워 두면 빈 문자열이 들어온다. 그것을 ID로 쓰면 SDK가
    // 초기화 단계에서 죽는다.
    expect(resolveInterstitialAdId('android', false, { android: '', ios: '' })).toBeNull()
  })

  it('네이티브가 아닌 플랫폼은 항상 null이다', () => {
    expect(resolveInterstitialAdId('web', true, PRODUCTION)).toBeNull()
    expect(resolveInterstitialAdId('web', false, PRODUCTION)).toBeNull()
  })

  it('실 광고 단위 ID가 소스에 남아 있지 않다', () => {
    // 저장소 전체에서 확인하는 것은 `ads-id-not-committed.test.ts` 가 한다. 여기서는 이 모듈이
    // 테스트 ID 말고 다른 `ca-app-pub` 값을 들고 있지 않은지만 본다.
    const source = require('node:fs').readFileSync(require.resolve('../ads'), 'utf8') as string
    const ids = source.match(/ca-app-pub-\d+/g) ?? []

    expect([...new Set(ids)]).toEqual(['ca-app-pub-3940256099942544'])
  })
})

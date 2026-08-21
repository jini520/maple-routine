
import { getOnboardingAccountScope, setOnboardingAccountScope } from '../flow'

// 이 값은 모듈 스코프에 산다 — 한 케이스가 바꿔 두면 다음 케이스가 그 값을 물려받는다.
afterEach(() => {
  setOnboardingAccountScope('single')
})

// ADR-143 결정 8: core 의 온보딩 스토어에는 무효 키·한도 초과 알림 사슬(ADR-115·ADR-116)이 함께
// 들어 있어 사본을 만들 수 없다. 그래서 앱이 주입하는 값 하나만 둔다.
describe('계정 범위 플래그', () => {
  // **기본값이 계약이다** — Capacitor 는 이 값을 주입하지 않으므로, 기본이 'all' 로 뒤집히는 순간
  // 그 앱의 재개 표에서 계정 선택 행이 조용히 사라진다(계정을 고를 화면은 그대로 있는 채로).
  it('아무도 주입하지 않았으면 single 이다', () => {
    expect(getOnboardingAccountScope()).toBe('single')
  })

  it('주입한 값을 그대로 돌려준다', () => {
    setOnboardingAccountScope('all')

    expect(getOnboardingAccountScope()).toBe('all')
  })

  it('되돌릴 수 있다 — 한시적인 값이라 지우는 날까지 양방향이다', () => {
    setOnboardingAccountScope('all')
    setOnboardingAccountScope('single')

    expect(getOnboardingAccountScope()).toBe('single')
  })
})

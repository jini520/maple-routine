// 이 테스트가 지키는 것은 **로직이 아니라 배선**이다 — `packages/core` 의 로직은 이미 vitest 쪽
// 3,044개가 검사하고 있고, 여기서 깨질 수 있는 유일한 지점은 `@core/*` 가 jest 에서 풀리는가다
// (`jest.config.js` 참고 — 매핑은 `tsconfig.json` 의 `paths` 에서 파생된다).
//
// `boss-crystal-prices` 를 고른 이유는 `App.tsx` 가 그것을 고른 이유와 같다: 그 모듈이 다시
// `@core/data/*.json` 과 `@core/types` 를 부르므로 **core 내부의 `@core/*` 참조까지** 한 번에
// 확인된다(앱 → core 한 겹만이 아니다).
import { CRYSTAL_PRICES, DEFAULT_MAX_PARTY_SIZE, getMaxPartySize } from '@core/lib/boss-crystal-prices'
import { formatBytes } from '@core/lib/format-bytes'

describe('@core/* 해석', () => {
  it('잎 모듈(의존 없음)을 부른다', () => {
    expect(formatBytes(1536)).toBe('1.5KB')
  })

  it('core 안에서 다시 `@core/*` 를 부르는 모듈(JSON·타입 포함)을 부른다', () => {
    expect(CRYSTAL_PRICES.length).toBeGreaterThan(0)
    expect(DEFAULT_MAX_PARTY_SIZE).toBe(6)
    // 표에 없는 조합은 기본값으로 떨어진다 — JSON 이 실제로 배열로 들어왔음을 함께 확인한다.
    expect(getMaxPartySize('존재하지 않는 보스', '노멀')).toBe(DEFAULT_MAX_PARTY_SIZE)
  })
})

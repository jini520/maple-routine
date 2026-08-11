/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 넥슨 Analytics 스크립트([[ADR-095]])는 **앱 코드가 아무도 참조하지 않는 한 줄**이다.
 *
 * 그게 의도한 성질이지만(넥슨 도메인 가용성이 앱 동작의 의존성이 되면 안 된다, [[ADR-003]])
 * 대가로 이 줄은 **지워져도 아무것도 깨지지 않는다** — 빌드도 테스트도 화면도 멀쩡하다.
 * 사라진 것을 알아챌 유일한 신호가 "대시보드에 지표가 안 쌓인다"인데 연동 판정 자체가
 * 최대 24시간 걸려서, 언제 사라졌는지조차 알 수 없다. 그 침묵을 여기서 깬다.
 */
const HTML = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
const HEAD = /<head>(?<body>[\s\S]*?)<\/head>/.exec(HTML)?.groups?.body ?? ''

describe('index.html 넥슨 Analytics 스크립트', () => {
  it('<head> 안에 있다 — 가이드가 지정한 자리다', () => {
    expect(HEAD).toContain('analytics.js')
  })

  // 경로가 `/js/analytics.js` 다 — 가이드 본문 예시(`/analytics.js`)와 다르고, 애플리케이션
  // 상세 하단이 주는 실제 구문이 이쪽이다. 데이터 조회 API 의 `open.api.nexon.com` 과도
  // 도메인이 반대이니 고칠 때 주의할 것([[ADR-007]]).
  it('app_id 가 박힌 정확한 URL 이다', () => {
    expect(HEAD).toContain('src="https://openapi.nexon.com/js/analytics.js?app_id=322698"')
  })

  it('async 다 — 애널리틱스가 첫 페인트를 막을 이유가 없다', () => {
    const tag = /<script[^>]*analytics\.js[^>]*>/.exec(HEAD)?.[0] ?? ''
    expect(tag).toContain('async')
  })
})

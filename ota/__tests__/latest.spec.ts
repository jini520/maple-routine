// ADR-154 결정 4 — `ota/latest.json` 은 캐패시터 소스를 지운 뒤 **유도를 켜는 유일한 재료**다.
// url·checksum·size 는 그 빌드에서만 나오는 값이라 다시 계산할 방법이 없고, 이 파일이 깨지면
// 이미 올라간 1.0.6.zip 이 «아무도 못 받는 번들» 이 된다. 그래서 형식을 테스트가 지킨다.
//
// 켜는 방법은 파일에 플랫폼을 넣고 한 줄:
//
//     gh release upload live-update-latest ota/latest.json --repo jini520/maple-routine --clobber
//
// 파서가 옆의 **동결 사본**인 이유는 `manifest-parser.ts` 머리에 적혀 있다([[ADR-155]] 결정 5) —
// 이 가드가 대조해야 하는 것은 저장소의 현재가 아니라 **기기에서 도는 1.0.6 번들**이다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseLiveUpdateManifest } from '../manifest-parser'

describe('ota/latest.json — 캐패시터 최종 매니페스트', () => {
  const draft: Record<string, unknown> & { highlights: string[] } = JSON.parse(readFileSync(join(__dirname, '../latest.json'), 'utf-8'))

  it('앱의 파서를 그대로 통과한다', () => {
    expect(parseLiveUpdateManifest(draft)).not.toBeNull()
    // 매니페스트는 GitHub CDN 이 octet-stream 으로 내려줘 문자열로 도착하는 경로가 실재한다.
    expect(parseLiveUpdateManifest(JSON.stringify(draft))).not.toBeNull()
  })

  // 2단계 켜짐(2026-08-21) — Play 비공개 테스트에 RN 바이너리가 올라간 것을 실기기로 확인한 뒤다
  // (ADR-154 «실기기로 사슬 전체를 확인했다»). iOS 는 App Store 게시 전이라 아직 목록에 없다.
  it('Android 만 게이트에 들어가 있다 — iOS 는 App Store 게시 후 3단계', () => {
    expect(draft.storeRequiredPlatforms).toEqual(['android'])
  })

  // 매니페스트는 한 벌이라 **게이트가 안 걸리는 iOS 도 이 문구를 읽는다**(그쪽은 평범한
  // update-available 이다). 그래서 highlights 에 「스토어로 가라」를 쓰면 App Store 에 아직
  // 1.0.6 이 없는 동안 그것이 거짓이 된다 — Android 쪽 스토어 안내는 `store-required` 모달이
  // 자기 문구로 한다.
  it('highlights 가 스토어 유도 문구를 담지 않는다 — iOS 도 같은 값을 읽는다', () => {
    for (const line of draft.highlights) {
      expect(line).not.toMatch(/스토어/)
    }
  })

  it('업로드된 zip 을 가리키고 버전이 x.y.z 다', () => {
    expect(draft.url).toContain(`/${draft.version}.zip`)
    expect(draft.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(draft.checksum).toMatch(/^[0-9a-f]{64}$/)
    expect(draft.size).toBeGreaterThan(0)
  })
})

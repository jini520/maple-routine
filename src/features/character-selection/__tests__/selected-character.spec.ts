// `고른 캐릭터가 목록에 없을 때 무엇을 고르는가` — 화면 넷이 **같은 답**을 내야 한다는 계약.
//
// 정정 전에는 이 네 줄이 화면마다 한 벌씩, 넷이 있었다(`ContentScreen` · `ContentManageScreen` ·
// `BossScreen` · `BossManageScreen`). 선택이 스토어 하나로 합쳐지면 그 폴백이 갈리는 순간
// **공유했는데 화면마다 다른 캐릭터** 가 되므로, 규칙을 한 자리로 내리고 여기서 못 박는다
//

import { resolveSelectedCharacter } from '../selected-character'

const 캐릭터 = (ocid: string) => ({ ocid, characterName: ocid })

describe('resolveSelectedCharacter', () => {
  it('고른 것이 목록에 있으면 그것이다', () => {
    const 목록 = [캐릭터('a'), 캐릭터('b'), 캐릭터('c')]

    expect(resolveSelectedCharacter('b', 목록)).toBe(목록[1])
  })

  // 화면마다 **고를 수 있는 목록** 이 다를 수 있다 — 각 스토어의 `characters` 는 자기 동기화
  // 결과라, 공유된 선택이 그 목록에 없는 순간이 실재한다(배경).
  it('고른 것이 목록에 없으면 첫 번째다', () => {
    const 목록 = [캐릭터('a'), 캐릭터('b')]

    expect(resolveSelectedCharacter('없는-ocid', 목록)).toBe(목록[0])
  })

  it('아직 고른 것이 없으면 첫 번째다', () => {
    const 목록 = [캐릭터('a'), 캐릭터('b')]

    expect(resolveSelectedCharacter(null, 목록)).toBe(목록[0])
  })

  // 조회 전·추적 0명. 화면은 이 자리에서 빈 상태를 그린다.
  it('목록이 비어 있으면 null 이다', () => {
    expect(resolveSelectedCharacter('a', [])).toBeNull()
    expect(resolveSelectedCharacter(null, [])).toBeNull()
  })
})

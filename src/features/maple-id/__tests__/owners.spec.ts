// 캐릭터마다의 메이플 ID 와 메이플 ID 의 차례. today 위젯 둘과 보스 수익 결정석 칸이 같은 차례를 쓴다.
import type { CharacterAccountSighting } from '../../../lib/mvp/membership'
import { mapleIdOwnersOf } from '../owners'

function seen(ocid: string, accountId: string, lastSeenOn = '2026-11-01'): CharacterAccountSighting {
  return { ocid, name: ocid, accountId, firstSeenOn: '2026-08-01', lastSeenOn }
}

describe('mapleIdOwnersOf', () => {
  // 리프 · 이관으로 같은 ocid 의 줄이 여럿이면 마지막으로 본 줄이 지금 소속이다.
  it('캐릭터마다 마지막으로 본 메이플 ID 를 고른다', () => {
    const owners = mapleIdOwnersOf({
      sightings: [seen('a', 'maple-old', '2026-10-01'), seen('a', 'maple-new', '2026-11-01')],
      nexonAccountOfOcid: new Map(),
      credentialAccountIds: [],
      trackedOcids: ['a'],
    })

    expect(owners.ofOcid).toEqual({ a: 'maple-new' })
  })

  // 결정석 칸의 기본 차례는 주계정 > 부계정1 > 부계정2 다(사용자 지정). 부계정 캐릭터가 추적 목록 앞에 있어도 뒤에 선다.
  it('메이플 ID 는 넥슨 계정 차례이고, 한 계정 안에서는 추적 목록에 먼저 선 차례다', () => {
    const owners = mapleIdOwnersOf({
      sightings: [seen('sub', 'maple-sub'), seen('main-2', 'maple-main-2'), seen('main-1', 'maple-main-1')],
      nexonAccountOfOcid: new Map([
        ['sub', 'nexon-key'],
        ['main-1', 'nexon-login'],
        ['main-2', 'nexon-login'],
      ]),
      credentialAccountIds: ['nexon-login', 'nexon-key'],
      trackedOcids: ['sub', 'main-1', 'main-2'],
    })

    expect(owners.order).toEqual(['maple-main-1', 'maple-main-2', 'maple-sub'])
  })

  it('넥슨 계정을 모르거나 지금 쓸 수 없는 계정의 메이플 ID 는 맨 뒤다', () => {
    const owners = mapleIdOwnersOf({
      sightings: [seen('unknown', 'maple-unknown'), seen('gone', 'maple-gone'), seen('main', 'maple-main')],
      nexonAccountOfOcid: new Map([
        ['gone', 'nexon-other-login'],
        ['main', 'nexon-login'],
      ]),
      credentialAccountIds: ['nexon-login'],
      trackedOcids: ['unknown', 'gone', 'main'],
    })

    expect(owners.order[0]).toBe('maple-main')
    expect(owners.order.slice(1).sort()).toEqual(['maple-gone', 'maple-unknown'])
  })
})

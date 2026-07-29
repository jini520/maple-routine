import { describe, expect, it } from 'vitest'
import type { NexonCharacterBasicResponse, NexonCharacterListResponse } from '../../../types'
import { normalizeCharacterBasic, normalizeCharacterList } from '../normalize'

describe('normalizeCharacterList', () => {
  it('snake_case wire 응답을 MapleAccount[] domain 타입으로 변환한다', () => {
    const wire: NexonCharacterListResponse = {
      account_list: [
        {
          account_id: 'da9b2f2...',
          character_list: [
            {
              ocid: '50119a0...',
              character_name: '내옆에최성일',
              world_name: '베라',
              character_class: '아크메이지(썬,콜)',
              character_level: 211,
            },
          ],
        },
        {
          account_id: '69e3525...',
          character_list: [
            {
              ocid: '23be5de...',
              character_name: '낟낟',
              world_name: '엘리시움',
              character_class: '렌',
              character_level: 293,
            },
          ],
        },
      ],
    }

    expect(normalizeCharacterList(wire)).toEqual([
      {
        accountId: 'da9b2f2...',
        characters: [
          {
            ocid: '50119a0...',
            name: '내옆에최성일',
            world: '베라',
            jobClass: '아크메이지(썬,콜)',
            level: 211,
          },
        ],
      },
      {
        accountId: '69e3525...',
        characters: [
          {
            ocid: '23be5de...',
            name: '낟낟',
            world: '엘리시움',
            jobClass: '렌',
            level: 293,
          },
        ],
      },
    ])
  })

  it('account_list가 빈 배열이면 빈 배열을 반환한다', () => {
    expect(normalizeCharacterList({ account_list: [] })).toEqual([])
  })
})

describe('normalizeCharacterBasic', () => {
  it('snake_case wire 응답을 domain 타입으로 변환하고 access_flag 문자열을 boolean으로 바꾼다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W02',
      access_flag: 'true',
    }

    expect(normalizeCharacterBasic(wire)).toEqual({
      name: '낟낟',
      level: 293,
      imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc?wmotion=W02',
      accessFlag: true,
    })
  })

  it('world_name을 world로 매핑한다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      world_name: '엘리시움',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
    }

    expect(normalizeCharacterBasic(wire).world).toBe('엘리시움')
  })

  // ADR-057: 길드 가입 여부 판정의 원천. "필드가 아예 없음"(구버전 캐시·응답 미포함)과
  // "가입한 길드 없음"을 반드시 구분해야 한다 — 둘을 같게 두면 전자에서 길드 콘텐츠를
  // 잘못 잠근다(사용자가 할 수 있는 일이 사라지는 방향의 실패).
  it('character_guild_name을 guildName으로 매핑한다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
      character_guild_name: '메이플길드',
    }

    expect(normalizeCharacterBasic(wire).guildName).toBe('메이플길드')
  })

  it('길드 미가입(null·빈 문자열·공백)은 guildName: null로 정규화한다', () => {
    const base = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true' as const,
    }

    expect(normalizeCharacterBasic({ ...base, character_guild_name: null }).guildName).toBeNull()
    expect(normalizeCharacterBasic({ ...base, character_guild_name: '' }).guildName).toBeNull()
    expect(normalizeCharacterBasic({ ...base, character_guild_name: '  ' }).guildName).toBeNull()
  })

  it('응답에 character_guild_name 자체가 없으면 guildName은 undefined다(미가입이 아니라 "모름")', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
    }

    expect(normalizeCharacterBasic(wire).guildName).toBeUndefined()
  })

  it('access_flag가 "false" 문자열이면 accessFlag: false로 변환한다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '가려진부캐',
      character_level: 220,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/def',
      access_flag: 'false',
    }

    expect(normalizeCharacterBasic(wire).accessFlag).toBe(false)
  })
})

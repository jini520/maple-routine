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

  // ADR-127: 캐릭터가 0명인 메이플 ID는 **고를 수 있는 계정이 아니다**. 그대로 올리면 계정 선택
  // 화면이 대표 캐릭터를 세우지 못해 렌더 중에 던지고, 키가 이미 저장된 뒤라 재시작해도 같은
  // 단계로 되돌아온다(영구 크래시, 2026-08-12 테스터 보고).
  it('character_list가 빈 계정은 걸러낸다', () => {
    const wire: NexonCharacterListResponse = {
      account_list: [
        {
          account_id: 'empty-account',
          character_list: [],
        },
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
    ])
  })

  it('모든 계정의 character_list가 비면 빈 배열이 된다', () => {
    expect(
      normalizeCharacterList({
        account_list: [
          { account_id: 'a', character_list: [] },
          { account_id: 'b', character_list: [] },
        ],
      }),
    ).toEqual([])
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
  // "가입한 길드 없음"을 반드시 구분해야 한다. 둘을 같게 두면 전자에서 길드 콘텐츠를
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

  // ADR-147 결정 7: character_exp_rate 는 숫자가 아니라 **문자열**("80.300")이다. access_flag와 같은
  // 모양의 함정이라 여기서 풀어 두지 않으면 문자열째 비교돼("9.500" > "80.300" 이 사전순으로 참)
  // 진행률 바가 조용히 뒤집힌다.
  it('character_exp_rate 문자열을 expRate 숫자로 변환한다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
      character_exp_rate: '80.300',
    }

    expect(normalizeCharacterBasic(wire).expRate).toBe(80.3)
  })

  it('응답에 character_exp_rate가 없으면 expRate는 undefined다(0이 아니다)', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
    }

    expect(normalizeCharacterBasic(wire).expRate).toBeUndefined()
  })

  // Number('') 은 0이라 그냥 통과시키면 "모름"이 "0%"로 둔갑한다.
  it('character_exp_rate가 빈 문자열이면 expRate는 undefined다(0이 아니다)', () => {
    const base = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true' as const,
    }

    expect(normalizeCharacterBasic({ ...base, character_exp_rate: '' }).expRate).toBeUndefined()
    expect(normalizeCharacterBasic({ ...base, character_exp_rate: '  ' }).expRate).toBeUndefined()
  })

  it('character_exp_rate가 숫자로 안 풀리면 expRate는 undefined다(NaN을 싣지 않는다)', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
      character_exp_rate: 'abc',
    }

    expect(normalizeCharacterBasic(wire).expRate).toBeUndefined()
  })

  // 위 두 케이스와 갈리는 자리 — 진짜 0%는 "모름"이 아니라 사실이므로 실어야 한다.
  it('character_exp_rate가 "0.000"이면 expRate는 0이다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '갓만든캐릭',
      character_level: 10,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/ghi',
      access_flag: 'true',
      character_exp_rate: '0.000',
    }

    expect(normalizeCharacterBasic(wire).expRate).toBe(0)
  })

  // ADR-147 결정 7: 누적 절대값은 레벨이 오를수록 커져 "얼마나 남았나"를 못 말한다. 카드가 답해야
  // 하는 것은 진행률이라 도메인 타입이 이 값을 나르지 않는다.
  it('character_exp는 도메인 객체에 실리지 않는다', () => {
    const wire: NexonCharacterBasicResponse = {
      character_name: '낟낟',
      character_level: 293,
      character_image: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      access_flag: 'true',
      character_exp: 1390734270108,
      character_exp_rate: '80.300',
    }

    expect(normalizeCharacterBasic(wire)).toEqual({
      name: '낟낟',
      level: 293,
      imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
      accessFlag: true,
      expRate: 80.3,
    })
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

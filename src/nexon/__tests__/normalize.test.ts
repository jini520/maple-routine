import { describe, expect, it } from 'vitest'
import type {
  NexonCharacterListResponse,
  NexonSchedulerCharacterStateWire,
} from '../../types'
import { normalizeCharacterList, normalizeSchedulerCharacterState } from '../normalize'

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

describe('normalizeSchedulerCharacterState', () => {
  const baseWire: NexonSchedulerCharacterStateWire = {
    date: '2026-07-09T00:00+09:00',
    character_name: '낟낟',
    world_name: '엘리시움',
    character_level: 293,
    character_class: '렌',
    daily_contents: [
      {
        content_name: '몬스터파크',
        type: 'contents',
        registration_flag: 'true',
        now_count: 7,
        max_count: 14,
        quest_state: null,
      },
    ],
    weekly_contents: [
      {
        content_name: '에픽 던전 : 악몽선경',
        type: 'contents',
        registration_flag: 'true',
        now_count: 5,
        max_count: 0,
        quest_state: null,
      },
      {
        content_name: '[메이플 유니온] 주간 드래곤 퇴치',
        type: 'quest',
        registration_flag: 'false',
        now_count: 0,
        max_count: 0,
        quest_state: '0',
      },
    ],
    boss_contents: [
      {
        content_name: '검은 마법사',
        difficulty: 'extreme',
        cycle: 'bossMonthly',
        registration_flag: 'true',
        complete_flag: 'true',
      },
      {
        content_name: '스우',
        difficulty: 'hard',
        cycle: 'bossWeekly',
        registration_flag: 'true',
        complete_flag: 'false',
      },
      {
        content_name: '힐라',
        difficulty: 'hard',
        cycle: 'bossDaily',
        registration_flag: 'true',
        complete_flag: 'true',
      },
    ],
    weekly_boss_clear_count: 0,
    weekly_boss_clear_limit_count: 0,
  }

  it('문자열 flag를 boolean으로, 필드명을 domain 표기로 변환한다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.asOf).toBe('2026-07-09T00:00+09:00')
    expect(result.characterName).toBe('낟낟')
    expect(result.world).toBe('엘리시움')
    expect(result.level).toBe(293)
    expect(result.jobClass).toBe('렌')

    expect(result.dailyContents[0]).toEqual({
      name: '몬스터파크',
      isRegistered: true,
      nowCount: 7,
      maxCount: 14,
    })

    expect(result.weeklyContents[1]).toEqual({
      name: '[메이플 유니온] 주간 드래곤 퇴치',
      kind: 'quest',
      isRegistered: false,
      nowCount: 0,
      maxCount: 0,
    })
  })

  it('difficulty 영문 표기를 한글로, cycle을 weekly/monthly로 변환한다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    const blackMage = result.bossContents.find((boss) => boss.name === '검은 마법사')
    expect(blackMage).toEqual({
      name: '검은 마법사',
      difficulty: '익스트림',
      cycle: 'monthly',
      isRegistered: true,
      isComplete: true,
    })

    const swoo = result.bossContents.find((boss) => boss.name === '스우')
    expect(swoo).toEqual({
      name: '스우',
      difficulty: '하드',
      cycle: 'weekly',
      isRegistered: true,
      isComplete: false,
    })
  })

  it('cycle이 bossDaily인 항목은 결과의 bossContents에서 제외된다', () => {
    const result = normalizeSchedulerCharacterState(baseWire)

    expect(result.bossContents.find((boss) => boss.name === '힐라')).toBeUndefined()
    expect(result.bossContents).toHaveLength(2)
  })
})

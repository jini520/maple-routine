import { groupWeeklyLimitOf, isClosedByWeeklyLimit } from '../scheduler/group-weekly-limit'

// 갈래의 주간 한도 판정. today 위젯 · 컨텐츠 카드 · 링이 이 함수 하나를 부른다. 갈라 두면 위젯은
// 3/3 인데 카드는 할 일이 남는 날이 생긴다.

const HIGH = 'epic_dungeon_high_mountain'
const ANGLER = 'epic_dungeon_angler_company'
const NIGHTMARE = 'epic_dungeon_nightmare_paradise'
const AURUM = 'epic_dungeon_aurum_regis'

const done = (contentKey: string | null) => ({ contentKey, isComplete: true })
const todo = (contentKey: string | null) => ({ contentKey, isComplete: false })

describe('groupWeeklyLimitOf', () => {
  it('완료한 에픽 던전 수와 한도를 낸다', () => {
    expect(groupWeeklyLimitOf('epic_dungeon', [done(HIGH), done(ANGLER), todo(NIGHTMARE), todo(AURUM)])).toEqual({
      completed: 2,
      limit: 3,
    })
  })

  it('다른 갈래의 완료는 안 센다', () => {
    const contents = [done(HIGH), done('maple_union_weekly_dragon'), done('erda_spectrum')]

    expect(groupWeeklyLimitOf('epic_dungeon', contents)?.completed).toBe(1)
  })

  // 캐릭터 응답과 원장 복원이 같은 컨텐츠를 두 번 넘길 수 있다.
  it('같은 컨텐츠 key 의 완료는 한 번만 센다', () => {
    expect(groupWeeklyLimitOf('epic_dungeon', [done(HIGH), done(HIGH), done(ANGLER)])?.completed).toBe(2)
  })

  // 컨텐츠 표에 없는 항목은 어느 갈래인지 모른다. 한도를 채우는 데 쓰면 안 막을 카드를 막는다.
  it('컨텐츠 key 가 없는 항목(null)의 완료는 안 센다', () => {
    expect(groupWeeklyLimitOf('epic_dungeon', [done(HIGH), done(null), done(null)])?.completed).toBe(1)
  })

  it('한도가 없는 갈래는 null 이다', () => {
    expect(groupWeeklyLimitOf('monster_park', [done('monster_park')])).toBeNull()
  })
})

describe('isClosedByWeeklyLimit', () => {
  const three = [done(HIGH), done(ANGLER), todo(NIGHTMARE), done(AURUM)]

  it('완료 3종이면 남은 1종이 막힌다', () => {
    expect(isClosedByWeeklyLimit(todo(NIGHTMARE), three)).toBe(true)
  })

  it('완료한 항목은 막힌 것이 아니다', () => {
    expect(isClosedByWeeklyLimit(done(HIGH), three)).toBe(false)
  })

  it('완료 2종이면 안 막힌다', () => {
    const two = [done(HIGH), done(ANGLER), todo(NIGHTMARE), todo(AURUM)]

    expect(isClosedByWeeklyLimit(todo(NIGHTMARE), two)).toBe(false)
  })

  it('한도가 없는 갈래의 항목은 안 막힌다', () => {
    expect(isClosedByWeeklyLimit(todo('erda_spectrum'), three)).toBe(false)
  })

  it('컨텐츠 key 가 없는 항목은 안 막힌다', () => {
    expect(isClosedByWeeklyLimit(todo(null), three)).toBe(false)
  })
})

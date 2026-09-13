import { groupWeeklyLimitOf, isClosedByWeeklyLimit } from '../scheduler/group-weekly-limit'

// 계열의 주간 한도 판정. today 위젯 · 컨텐츠 카드 · 링이 이 함수 하나를 부른다. 갈라 두면 위젯은
// 3/3 인데 카드는 할 일이 남는 날이 생긴다.

const HIGH = '에픽 던전 : 하이마운틴'
const ANGLER = '에픽 던전 : 앵글러 컴퍼니'
const NIGHTMARE = '에픽 던전 : 악몽선경'
const AURUM = '에픽 던전 : 아우룸 레기스'

const done = (name: string) => ({ name, isComplete: true })
const todo = (name: string) => ({ name, isComplete: false })

describe('groupWeeklyLimitOf', () => {
  it('완료한 에픽 던전 수와 한도를 낸다', () => {
    expect(groupWeeklyLimitOf('에픽던전', [done(HIGH), done(ANGLER), todo(NIGHTMARE), todo(AURUM)])).toEqual({
      completed: 2,
      limit: 3,
    })
  })

  it('다른 계열의 완료는 안 센다', () => {
    const contents = [done(HIGH), done('[메이플 유니온] 주간 드래곤 퇴치'), done('에르다 스펙트럼')]

    expect(groupWeeklyLimitOf('에픽던전', contents)?.completed).toBe(1)
  })

  it('한도가 없는 계열은 null 이다', () => {
    expect(groupWeeklyLimitOf('몬스터파크', [done('몬스터파크')])).toBeNull()
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

  it('한도가 없는 계열의 항목은 안 막힌다', () => {
    expect(isClosedByWeeklyLimit(todo('에르다 스펙트럼'), three)).toBe(false)
  })
})

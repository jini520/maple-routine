// 번들에 박힌 개발자 키. **로그인만 한 사용자의 비프렌즈 경로**가 이걸로 넥슨을 부른다.
// Open ID 는 프렌즈 6경로만 열어서 character/basic · 메소 다섯 · 공지 넷은 키가 있어야 한다.
//
// 여기서 막는 사고는 둘이다. ① 키 하나가 막혔는데 계속 그것만 써서 사용자가 통째로 죽는 것
// ② 죽은 키를 영영 빼 두지 않고 매번 다시 찔러 한도를 더 태우는 것.
import {
  __setDeveloperKeysForTest,
  markDeveloperKeyDead,
  nextDeveloperKey,
} from '../developer-keys'

afterEach(() => {
  __setDeveloperKeysForTest([])
})

describe('번갈아 쓴다', () => {
  it('부를 때마다 교대한다. 한도가 두 배가 된다', () => {
    __setDeveloperKeysForTest(['키1', '키2'])

    expect([nextDeveloperKey(), nextDeveloperKey(), nextDeveloperKey()]).toEqual([
      '키1',
      '키2',
      '키1',
    ])
  })

  it('하나뿐이면 그것만 준다', () => {
    __setDeveloperKeysForTest(['키1'])

    expect([nextDeveloperKey(), nextDeveloperKey()]).toEqual(['키1', '키1'])
  })

  it('빈 값은 키가 아니다', () => {
    // .env 에 항목만 만들고 값을 안 채운 상태다. 빈 문자열을 키로 실으면 넥슨이 400 을 준다.
    __setDeveloperKeysForTest(['키1', ''])

    expect([nextDeveloperKey(), nextDeveloperKey()]).toEqual(['키1', '키1'])
  })

  it('하나도 없으면 null 이다', () => {
    __setDeveloperKeysForTest([])

    expect(nextDeveloperKey()).toBeNull()
  })
})

describe('죽은 키는 뺀다', () => {
  it('죽었다고 적으면 그 뒤로 안 나온다', () => {
    __setDeveloperKeysForTest(['키1', '키2'])

    markDeveloperKeyDead('키1')

    expect([nextDeveloperKey(), nextDeveloperKey()]).toEqual(['키2', '키2'])
  })

  it('전부 죽으면 null 이다. 되살리지 않는다', () => {
    // 무효 키는 영구다. 한도 초과는 시간이 지나면 풀리지만, 그것을 여기서 재려면 시계를
    // 들여야 한다. 앱을 다시 켜면 집합이 비므로 그때 다시 해 본다.
    __setDeveloperKeysForTest(['키1', '키2'])

    markDeveloperKeyDead('키1')
    markDeveloperKeyDead('키2')

    expect(nextDeveloperKey()).toBeNull()
  })

  it('모르는 키를 적어도 멀쩡한 것이 안 죽는다', () => {
    __setDeveloperKeysForTest(['키1'])

    markDeveloperKeyDead('남의키')

    expect(nextDeveloperKey()).toBe('키1')
  })
})

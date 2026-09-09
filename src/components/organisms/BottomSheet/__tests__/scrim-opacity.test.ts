// 스크림이 옅어지는 규칙.
//
// 라이브러리의 `animatedIndex` 는 **시트의 자리를 스냅 포인트에 견줘** 낸다. 내용이 커져 스냅
// 포인트가 먼저 갱신되는 프레임에는 시트가 아직 옛 자리에 있어, 그 자리가 새 스냅 포인트보다
// 아래로 읽힌다. 그래서 인덱스가 한 프레임만 음수로 떨어진다(60fps 녹화에서 배경 밝기가
// 111.8 → 161.9 → 111.8 로 한 장 튀는 것을 확인했다).
//
// 그 한 장을 걸러 내는 규칙이 이 파일이다.
import { nextScrimOpacity } from '../scrim-opacity'

describe('nextScrimOpacity', () => {
  it('인덱스를 그대로 옮긴다. 열림 0 이 짙음 1 이다', () => {
    expect(nextScrimOpacity(0, 500, 0, 900)).toBe(1)
    expect(nextScrimOpacity(-1, 900, 1, 500)).toBe(0)
    expect(nextScrimOpacity(-0.5, 700, 1, 500)).toBe(0.5)
  })

  it('시트가 **안 내려갔으면** 옅어지지 않는다. 스냅 포인트만 바뀐 프레임이 여기 걸린다', () => {
    // 자리는 그대로(500)인데 인덱스만 -0.4 로 떨어진 프레임.
    expect(nextScrimOpacity(-0.4, 500, 1, 500)).toBe(1)
    // 오히려 올라가는 중(시트가 커지는 쪽)에도 마찬가지다.
    expect(nextScrimOpacity(-0.4, 420, 1, 500)).toBe(1)
  })

  it('시트가 내려가는 중이면 따라 옅어진다. 끌어내려 닫는 자리다', () => {
    expect(nextScrimOpacity(-0.4, 560, 1, 500)).toBeCloseTo(0.6)
  })

  it('짙어지는 쪽은 언제나 따른다. 시트가 올라오는 동안 스크림이 함께 든다', () => {
    expect(nextScrimOpacity(-0.5, 700, 0, 900)).toBe(0.5)
  })

  it('0~1 밖으로 안 나간다', () => {
    expect(nextScrimOpacity(0.4, 500, 1, 500)).toBe(1)
    expect(nextScrimOpacity(-2, 900, 1, 500)).toBe(0)
  })
})

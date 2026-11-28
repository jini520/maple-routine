// SF Symbols 는 라이선스가 Apple 플랫폼 밖에서 쓰는 것을 막는다. 안드로이드 번들에 SF 그림이 들어가지 않는지 소스로 본다.
// 렌더로는 볼 수 없다. jest 는 플랫폼 파일 중 하나만 고르기 때문이다.
import { readFileSync } from 'fs'
import { join } from 'path'

const dir = join(__dirname, '..')
const read = (name: string) => readFileSync(join(dir, name), 'utf8')

describe('SF 그림은 iOS 파일만 가져온다', () => {
  it('안드로이드 그림 파일은 SF 그림(png)을 가져오지 않는다', () => {
    const android = read('bar-symbol.android.tsx')

    expect(android).not.toMatch(/bar-sf/)
    expect(android).not.toMatch(/\.png/)
    expect(android).not.toMatch(/bar-symbol\.ios/)
  })

  it('iOS 그림 파일은 SF 그림을 가져온다', () => {
    expect(read('bar-symbol.ios.tsx')).toMatch(/bar-sf\//)
  })

  // 공용 진입점이 SF 그림을 직접 가져오면 안드로이드 번들에도 들어간다. 진입점은 타입 검사와 jest 용으로 다시 내보내기만 한다.
  it('플랫폼 확장자가 없는 진입점은 SF 그림을 직접 가져오지 않는다', () => {
    expect(read('bar-symbol.tsx')).not.toMatch(/\.png/)
  })
})

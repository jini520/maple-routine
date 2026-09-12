/**
 * iOS 프로젝트의 서명 설정이 살아 있는지 보는 가드.
 *
 * 둘 다 손으로 넣은 값이라 `expo prebuild` 가 프로젝트를 다시 쓰면 사라진다. 2026-08-04 에
 * 넣은 것이 2026-09-13 아카이브에서 다시 없어진 채 발견됐고, 그 사이 iOS 를 안 구워서 아무도
 * 몰랐다. 증상은 `Signing for "app" requires a development team` 으로 **아카이브가 통째로
 * 실패**하는 것이다.
 *
 * `CODE_SIGN_IDENTITY` 의 레거시 문자열(`iPhone Developer`)은 더 늦게 드러난다. 아카이브는
 * 통과하고 `-exportArchive` 에서 error 90034 로 떨어진다.
 *
 * @see docs/trouble/2026-08-04-ios-appstore-signing.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PBXPROJ = join(process.cwd(), 'ios/app.xcodeproj/project.pbxproj')

describe('iOS 서명 설정', () => {
  const source = readFileSync(PBXPROJ, 'utf-8')

  it('타겟 구성 둘이 팀을 든다', () => {
    expect(source.match(/DEVELOPMENT_TEAM = TQPKW249G7;/g)).toHaveLength(2)
    expect(source.match(/CODE_SIGN_STYLE = Automatic;/g)).toHaveLength(2)
  })

  it('레거시 서명 문자열이 돌아오지 않았다', () => {
    expect(source).not.toContain('"iPhone Developer"')
    expect(source).not.toContain('"iPhone Distribution"')
  })
})

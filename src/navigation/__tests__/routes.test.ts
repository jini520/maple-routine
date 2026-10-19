// 라우트 표가 지켜야 하는 규칙. 실제로 열리는지는 `RootNavigator.test.tsx` 가 본다.
import { FEATURE_GUIDE_ROUTE_NAMES, INITIAL_TAB_ROUTE, ROUTE_TABLE } from '../routes'

describe('ROUTE_TABLE', () => {
  it('경로가 중복되지 않는다', () => {
    const paths = ROUTE_TABLE.map((row) => row.path)

    expect(new Set(paths).size).toBe(paths.length)
  })

  // **`/` 행과 첫 화면이 갈렸다**. `/` 행은 *"그 경로에서 무엇을 보여
  // 줬는가"* 라는 기록이라 그대로 컨텐츠이고, *"이 앱이 어디서 시작하는가"* 는 새 `today` 다.
  // **한 케이스 안에서** 둘을 함께 단언한다. 갈린 것 자체가 결정이라
  //  *"둘이 지금 이렇게 갈려 있다"* 가 한 자리에 적혀 있어야, 누군가 **불일치** 로 보고 `/` 를
  // `Today` 로 맞추는 일이 안 생긴다.
  it('첫 화면은 today 이고 `/` 행은 여전히 컨텐츠다', () => {
    expect(INITIAL_TAB_ROUTE).toBe('Today')
    expect(ROUTE_TABLE.find((row) => row.path === '/')?.target).toEqual({
      kind: 'initial',
      route: 'Content',
    })
    expect(ROUTE_TABLE.find((row) => row.target.kind === 'tab' && row.target.route === 'Today')).toBeDefined()
  })

  // 웹의 `/…/…` 경로는 전부 push 다. 보스 관리가 탭이던 예외는 설정에서 여는 하위 페이지로 돌아가며 사라졌다.
  it('웹의 하위 경로 중 탭인 것은 없다', () => {
    const promoted = ROUTE_TABLE.filter(
      (row) => row.origin === 'web' && row.path.split('/').length > 2 && row.target.kind === 'tab',
    )

    expect(promoted).toEqual([])
    expect(ROUTE_TABLE.find((row) => row.path === '/boss/manage')?.target).toEqual({ kind: 'push', route: 'BossManage' })
  })
})

// 기능 설명 목록에서도, 개발 노트 항목에서도 **같은 상세**가 열린다.
// 경로를 둘로 두면(`resolveStackDirection` 이 형제 이동을 `replace` 로 떨어뜨려 전환이
// 사라진다)는 RN 에 없지만, **화면과 데이터가 한 벌이라는 계약은 그대로**다.
describe('안내 상세는 두 경로가 같은 화면을 가리킨다', () => {
  const guideRows = ROUTE_TABLE.filter((row) =>
    row.path.endsWith('/:guideId'),
  )

  it('둘의 `screen` 이 같다. 사본이 아니라 한 벌이다', () => {
    expect(guideRows.map((row) => row.screen)).toEqual([
      'SettingsFeatureGuideScreen',
      'SettingsFeatureGuideScreen',
    ])
  })

  // 라우트 **이름**은 갈린다(부모가 다르므로 pop 목적지도 다르다). 갈리는 것은 이름뿐이라는 것을
  // 고정해 둔다. 나중에 하나로 합치면 어느 목록으로 돌아갈지가 사라진다.
  it('라우트 이름은 둘이고 표의 두 행과 일치한다', () => {
    expect(FEATURE_GUIDE_ROUTE_NAMES).toEqual([
      'SettingsFeatureGuide',
      'SettingsReleaseNoteGuide',
    ])
    expect(guideRows.map((row) => row.target.route)).toEqual([...FEATURE_GUIDE_ROUTE_NAMES])
  })
})

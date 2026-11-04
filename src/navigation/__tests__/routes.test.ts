// 라우트 표가 지켜야 하는 규칙. 실제로 열리는지는 `RootNavigator.test.tsx` 가 본다.
import { INITIAL_TAB_ROUTE, ROUTE_TABLE } from '../routes'

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

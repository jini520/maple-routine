// 화면 상단 헤더 셸. 지키는 것은 *"4화면이 복붙하던 마크업을 글자
// 하나까지 그대로 낸다"* 였는데, RN 에서는 그 마크업이 통째로 바뀌므로(`PageHeader.tsx`)
// 이 파일이 지키는 것도 갈린다.
//
// | 지키던 것 | 여기서는 |
// |---|---|
// | 셸 클래스 문자열 동일 | **스냅샷 기준선**으로 대체(값 대조가 불가능하다) |
// | `fixed` 이지 `sticky` 가 아니다 | **스크롤 뷰 밖에 있다**. 위치가 스크롤의 함수가 아닌 것이 요점이고, RN 은 그것을 레이아웃으로 얻는다 |
// | spacer 가 실측 높이와 같은 커밋에 갱신된다 | **spacer 자체가 없다**. 아래 회귀 가드 |
// | 페이드에 `backdrop-filter` 가 없다 | **페이드째 걷어냈다**(아래). 검사할 대상이 없다 |
//
// 안전영역은 `renderOverlay` 가 넣는 인셋(상 59)을 쓴다.

import { Text } from 'react-native'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { PageHeader } from '../PageHeader'

beforeEach(__resetThemeAppearanceForTest)
afterEach(__resetThemeAppearanceForTest)

/** 벌거벗은 문자열 자리를 채우는 도우미. RN 은 그것을 View 자식으로 못 그린다. */
const 내용 = <Text>내용</Text>

/** 페이드는 `aria-hidden` 이라 RNTL 기본 쿼리에서 빠진다. */

describe('PageHeader', () => {
// ★ **딱 안전영역만큼이다.** 상수 몫
  // 1rem 을 뺐다: 그 16 은 불투명 헤더 판의 안쪽 여백이자 고정 헤더와 상태바의 분리였는데,
  // RN 헤더는 배경을 안 칠하고 고정도 아니라 둘 다 해당이 없다.
  // **`toBe` 로 못 박는 이유**는 이 값이 상단 페이드의 끝선과 **같은 선**이 됐기
  // 때문이다. 한쪽이 움직이면 제목이 갉히거나 띄워지고, 그 어긋남은 여기서만 보인다.
  it('상단 안전영역만큼만 자기 패딩으로 먹는다. 여백을 더하지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(flattenStyle(getByTestId('page-header').props.style).paddingTop).toBe(
      테스트_안전영역.insets.top,
    )
  })

  // 회귀 가드. 헤더는 자기 배경을 칠하지 않는다.
  //
  // 헤더가 불투명하면 벽지 위에 검은 띠가 남는다. 배경 없는 테마에서는 보이는 그림이 바뀌지
  // 않는다. 내비게이션 테마가 화면을 같은 `bg` 로 칠하므로 뒤에 같은 색이 있다. 그래서 이
  // 검사는 색이 무엇인가 가 아니라 칠하지 않는가 다.
  it('자기 배경을 칠하지 않는다. 배경은 벽지 한 장이 진다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    expect(flattenStyle(getByTestId('page-header').props.style).backgroundColor).toBeUndefined()
  })

  // 헤더는 아래 여백을 안 갖는다. 헤더와 콘텐츠 사이는 `ScreenScroll` 의 콘텐츠 간격 하나가
  // 낸다. 헤더가 자기 몫을 더하면 그 화면만 더 벌어져, 헤더 셸을 안 쓰는 화면과 어긋난다.
  it('아래 여백을 갖지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<PageHeader>{내용}</PageHeader>)

    const style = flattenStyle(getByTestId('page-header').props.style)
    expect(style.paddingBottom ?? 0).toBe(0)
  })
})

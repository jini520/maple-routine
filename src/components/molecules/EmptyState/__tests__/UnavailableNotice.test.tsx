// 아직 집계 전 고지. `EmptyState` 와 파일을 나눠 둔다. 두 컴포넌트가 같은 디렉터리에 있을 뿐
// **일부러 디자인을 공유하지 않는 사이**라, 한 파일에 두면 스냅샷 이름도 섞인다.
//
// **문구는 한 글자도 손대지 않았다.** 이 저장소는 에러·불가 문구를 전수 조사해 어미까지 통일한
// 이력이 있다. 여기서 다듬으면 그 작업이 조용히 되돌아간다.
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { UnavailableNotice } from '../UnavailableNotice'

describe('UnavailableNotice', () => {
  // 확인해서 없는 것과 아직 확인 못 한 것은 다른 사실이다. 디자인을 공유하면 `데이터가 없다` 로
  // 오해된다.
  it('제목과 설명을 렌더링한다', async () => {
    const { getByText } = await renderAtom(<UnavailableNotice />)

    expect(getByText('아직 집계되지 않았습니다')).toBeTruthy()
    expect(getByText('이 기간 기록이 준비되면 자동으로 채워집니다')).toBeTruthy()
  })

  // 영구히 확인할 수 없다(정보 톤)와 같은 말을 하면 거짓말이 된다. 기다리면 풀린다.
  it('정보 톤이 아니라 중립 톤이다', async () => {
    const { getByTestId } = await renderAtom(<UnavailableNotice />)

    expect(flattenStyle(getByTestId('unavailable-notice').props.style).backgroundColor).toBe(
      기본테마.surface2,
    )
  })

  // 고칠 수 있는 실패가 아니라 기다리면 풀리는 것이라 액션을 두지 않는다.
  it('버튼이 없다', async () => {
    const { queryByRole } = await renderAtom(<UnavailableNotice />)

    expect(queryByRole('button')).toBeNull()
  })

  // 시각을 암시하는 표현을 쓰지 않는다. 집계 시각은 넥슨이 정하고 우리는 브래킷으로만 안다.
  it('시각을 말하지 않는다', async () => {
    const { getByTestId } = await renderAtom(<UnavailableNotice />)

    expect(getByTestId('unavailable-notice-description').props.children).not.toMatch(/시|분|새벽/)
  })
})

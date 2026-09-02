// 웹판은 `EmptyState.test.tsx` 안에 함께 있었다. RN 에서는 파일을 나눈다. 두 컴포넌트가 같은
// 디렉터리에 있을 뿐 **일부러 디자인을 공유하지 않는 사이**라, 한 파일에 두면
// 스냅샷 이름도 섞인다.
//
// **문구는 한 글자도 손대지 않았다.** 이 저장소는 에러·불가 문구를 전수 조사해 어미까지 통일한
// 이력이 있다. 여기서 다듬으면 그 작업이 조용히 되돌아간다.
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { UnavailableNotice } from '../UnavailableNotice'

describe('UnavailableNotice', () => {
  // "조회 불가"는 빈 상태가 아니라 확인 자체를 못 한 상태 — 디자인을 공유하면 "데이터가 없다"로
  // 오해된다.
  it('제목과 설명을 렌더링한다', async () => {
    const { getByText, getByTestId } = await renderAtom(<UnavailableNotice />)

    expect(getByText('이 기간은 조회할 수 없습니다')).toBeTruthy()
    expect(getByTestId('unavailable-notice-description').props.children).toContain(
      '처치 기록이 없다는 뜻은 아닙니다',
    )
  })

  it('경고(error)가 아니라 정보 톤으로 그린다', async () => {
    const { getByTestId } = await renderAtom(<UnavailableNotice />)

    expect(flattenStyle(getByTestId('unavailable-notice').props.style).backgroundColor).toBe(
      기본테마.infoTint,
    )
  })

  it('compact면 카드 안에 들어가도록 축소하고 설명을 생략한다', async () => {
    const { getByText, queryByTestId } = await renderAtom(<UnavailableNotice compact />)

    expect(getByText('이 기간은 조회할 수 없습니다')).toBeTruthy()
    expect(queryByTestId('unavailable-notice-description')).toBeNull()
  })

  // `notCollected` 는 넷째 얼굴이다. "영구히 확인할 수 없다"(정보 톤)와 같은
  // 말을 하면 거짓말이 되므로 중립 톤 + Clock 이고, **시각을 암시하는 표현을 쓰지 않는다**
  // (트레이드오프 — 집계 시각은 브래킷만 실측됐다).
  it('notCollected 는 중립 톤에 "자동으로 채워집니다" 문구다', async () => {
    const { getByText, getByTestId } = await renderAtom(<UnavailableNotice variant="notCollected" />)

    expect(getByText('아직 집계되지 않았습니다')).toBeTruthy()
    expect(getByText('이 기간 기록이 준비되면 자동으로 채워집니다')).toBeTruthy()
    expect(flattenStyle(getByTestId('unavailable-notice').props.style).backgroundColor).toBe(
      기본테마.surface2,
    )
  })

  // 고칠 수 있는 실패가 아니라 API 의 알려진 제약이라 액션을 두지 않는다.
  it.each([['outOfRange'], ['notCollected']] as const)('%s 에도 버튼이 없다', async (variant) => {
    const { queryByRole } = await renderAtom(<UnavailableNotice variant={variant} />)

    expect(queryByRole('button')).toBeNull()
  })

})

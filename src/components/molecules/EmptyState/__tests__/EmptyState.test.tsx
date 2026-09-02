// 웹판이 지키던 것과 같다. 클래스 문자열 단언(`toHaveClass('h-14','w-14')`)은 **풀린 값**으로 바꿨고
// (RN 에 클래스가 안 남는다), 그 밖의 계약은 한 줄도 줄이지 않았다.
//
// `EmptyState` 의 `icon` 은 lucide 아이콘도 커스텀 아이콘도 받는다. 여기서
// `atoms/Icon/lucide` 를 거쳐 가져오는 것이 요점이다 — 직접 `lucide-react-native` 에서 가져오면 `className`
// 이 조용히 무시된다(그 파일 주석).
import { fireEvent } from '@testing-library/react-native'
import Swords from 'lucide-react-native/icons/swords'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { withIconInterop } from '../../../../lib/nativewind-interop'
import { EmptyState } from '../EmptyState'

const SwordsIcon = withIconInterop(Swords)
const HIDDEN = { includeHiddenElements: true } as const

describe('EmptyState', () => {
  it('제목과 설명을 렌더링한다', async () => {
    const { getByText } = await renderAtom(
      <EmptyState
        icon={SwordsIcon}
        title="추적할 주간 보스가 없습니다"
        description="보스 관리에서 이번 주에 잡을 보스를 골라주세요"
      />,
    )

    expect(getByText('추적할 주간 보스가 없습니다')).toBeTruthy()
    expect(getByText('보스 관리에서 이번 주에 잡을 보스를 골라주세요')).toBeTruthy()
  })

  it('action을 주면 CTA 버튼이 보이고 누르면 onClick이 호출된다', async () => {
    const onClick = jest.fn()
    const { getByText } = await renderAtom(
      <EmptyState icon={SwordsIcon} title="추적할 주간 보스가 없습니다" action={{ label: '보스 관리', onClick }} />,
    )

    await fireEvent.press(getByText('보스 관리'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // 자동 모드("게임에서 등록해주세요")·보스 수익처럼 앱 안에 목적지가 없는 곳은 CTA를 만들지
  // 않는다(— 액션이 없는 자리에 비활성 버튼을 두지 않는다).
  it('action이 없으면 버튼을 그리지 않는다', async () => {
    const { queryByRole } = await renderAtom(
      <EmptyState icon={SwordsIcon} title="등록된 주간 보스가 없습니다" />,
    )

    expect(queryByRole('button')).toBeNull()
  })

  it('description이 없으면 설명 문단 자체가 없다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <EmptyState icon={SwordsIcon} title="등록된 주간 보스가 없습니다" />,
    )

    expect(getByTestId('empty-state-title')).toBeTruthy()
    expect(queryByTestId('empty-state-description')).toBeNull()
  })

  it('아이콘은 장식이므로 접근성 트리에서 숨긴다', async () => {
    const { getByTestId } = await renderAtom(
      <EmptyState icon={SwordsIcon} title="등록된 주간 보스가 없습니다" />,
    )

    expect(getByTestId('empty-state-badge', HIDDEN).props['aria-hidden']).toBe(true)
  })

  // page(캐릭터 미선택 3곳)와 inline(목록 8곳)은 배지 크기·타이포만 다르고 구조는 같다.
  it('기본은 inline 크기 — 56px 배지, 자체 카드 껍데기를 가진다', async () => {
    const { getByTestId } = await renderAtom(
      <EmptyState icon={SwordsIcon} title="추적할 주간 보스가 없습니다" />,
    )

    expect(flattenStyle(getByTestId('empty-state-badge', HIDDEN).props.style)).toMatchObject({
      height: 56,
      width: 56,
    })
    expect(flattenStyle(getByTestId('empty-state').props.style)).toMatchObject({
      borderWidth: 1,
      backgroundColor: 기본테마.surface,
    })
    expect(flattenStyle(getByTestId('empty-state-title').props.style).fontSize).toBe(14)
  })

  it('size=page면 84px 배지에 큰 타이포, 자체 껍데기는 없다(화면이 감싼다)', async () => {
    const { getByTestId } = await renderAtom(
      <EmptyState size="page" icon={SwordsIcon} title="표시할 캐릭터가 없습니다" />,
    )

    expect(flattenStyle(getByTestId('empty-state-badge', HIDDEN).props.style)).toMatchObject({
      height: 84,
      width: 84,
    })
    expect(flattenStyle(getByTestId('empty-state').props.style).borderWidth).toBeUndefined()
    expect(flattenStyle(getByTestId('empty-state-title').props.style).fontSize).toBe(16)
  })

  //  정정: 캐릭터 미선택(page) 3곳은 컨텍스트 아이콘이 아니라 브랜드 마크(단풍잎)를 쓴다.
  it('icon="leaf"면 lucide 아이콘 대신 단풍잎 마크를 그린다', async () => {
    const { getByTestId } = await renderAtom(
      <EmptyState size="page" icon="leaf" title="표시할 캐릭터가 없습니다" />,
    )

    expect(getByTestId('maple-leaf', HIDDEN)).toBeTruthy()
  })

  it('lucide 아이콘을 주면 단풍잎 마크는 그리지 않는다', async () => {
    const { queryByTestId } = await renderAtom(
      <EmptyState icon={SwordsIcon} title="추적할 주간 보스가 없습니다" />,
    )

    expect(queryByTestId('maple-leaf', HIDDEN)).toBeNull()
  })

  // 웹은 `fill-primary-ink` 로 색을 줬다. RN 에는 `fill` 스타일이 없어 `text-*` → `color` 프롭 →
  // 자식의 `currentColor` 로 흐른다(`lib/nativewind-interop.ts`). **통로가 끊기면 잎이 검게 된다.**
  it('단풍잎 색은 className 이 정한다 — `currentColor` 가 읽는 `color` 프롭으로 들어간다', async () => {
    const { getByTestId } = await renderAtom(
      <EmptyState size="page" icon="leaf" title="표시할 캐릭터가 없습니다" />,
    )

    expect(getByTestId('maple-leaf', HIDDEN).props.color).toBe(기본테마.primaryInk)
  })

})

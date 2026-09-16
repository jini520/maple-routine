// 소식 갈래의 조회 중 자리. 이 부품이 지키는 것은 하나다 - **결과와 같은 치수로 선다.**
// 어긋나면 내용이 도착할 때 아래가 밀리고, 그 밀림을 없애려고 만든 부품이라 그때 존재 이유가 없다.
//
// 그래서 치수를 여기에 손으로 적지 않고 **결과가 쓰는 값에서 읽어 와** 대조한다. 배너는
// `noticeBannerRatio`, 글 줄은 `typography.cjs` 의 줄 높이다. 값이 바뀌면 이 테스트가 먼저 깨진다.
import { renderAtom } from '../../../components/__tests__/render-atom'
import { noticeBannerRatio } from '../../../features/notice/notice-display'
import { NoticeBannerSkeleton, NoticeLinesSkeleton } from '../NoticeSkeleton'

const HIDDEN = { includeHiddenElements: true } as const

/** `NoticeLines` 의 제목·날짜가 쓰는 글자 계단. 줄 높이는 그 표가 든다. */
const { fontSize } = require('../../../../typography.cjs') as {
  fontSize: Record<string, [string, { lineHeight: string }]>
}

function lineHeightOf(step: 'sm' | 'xs'): number {
  return Number.parseInt(fontSize[step][1].lineHeight, 10)
}

describe('NoticeBannerSkeleton', () => {
  it('배너 갈래의 비율로 자리를 잡는다', async () => {
    const { getByTestId } = await renderAtom(<NoticeBannerSkeleton kind="cashshop" />)

    expect(getByTestId('notice-banner-skeleton', HIDDEN)).toHaveStyle({
      aspectRatio: noticeBannerRatio('cashshop'),
    })
  })

  it('갈래마다 비율이 갈린다', async () => {
    const event = await renderAtom(<NoticeBannerSkeleton kind="event" />)
    const cashshop = await renderAtom(<NoticeBannerSkeleton kind="cashshop" />)

    const ratioOf = (view: typeof event): unknown =>
      view.getByTestId('notice-banner-skeleton', HIDDEN).props.style.aspectRatio

    expect(ratioOf(event)).not.toBe(ratioOf(cashshop))
  })

  // 막대 하나하나는 장식이고, 조회 중임을 말하는 것은 갈래를 감싸는 이 상자다
  // (`LoadingState` 와 같은 계약).
  it('조회 중임을 보조기술에 알린다', async () => {
    const { getByTestId } = await renderAtom(<NoticeBannerSkeleton kind="event" />)

    const box = getByTestId('notice-banner-skeleton', HIDDEN)
    expect(box.props.role).toBe('status')
    expect(box.props['aria-busy']).toBe(true)
  })
})

describe('NoticeLinesSkeleton', () => {
  it('받은 줄 수만큼 줄이 선다', async () => {
    const { getAllByTestId } = await renderAtom(<NoticeLinesSkeleton lines={3} />)

    expect(getAllByTestId('notice-skeleton-row', HIDDEN)).toHaveLength(3)
  })

  it('제목과 날짜 자리가 결과의 줄 높이를 그대로 든다', async () => {
    const { getAllByTestId } = await renderAtom(<NoticeLinesSkeleton lines={1} />)

    expect(getAllByTestId('notice-skeleton-title', HIDDEN)[0]).toHaveStyle({
      height: lineHeightOf('sm'),
    })
    expect(getAllByTestId('notice-skeleton-date', HIDDEN)[0]).toHaveStyle({
      height: lineHeightOf('xs'),
    })
  })

  it('조회 중임을 보조기술에 알린다', async () => {
    const { getByTestId } = await renderAtom(<NoticeLinesSkeleton lines={2} />)

    const box = getByTestId('notice-lines-skeleton', HIDDEN)
    expect(box.props.role).toBe('status')
    expect(box.props['aria-busy']).toBe(true)
  })
})

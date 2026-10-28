// 소식 갈래의 조회 중 자리. 이 부품이 지키는 것은 하나다 - **결과와 같은 치수로 선다.**
// 어긋나면 내용이 도착할 때 아래가 밀리고, 그 밀림을 없애려고 만든 부품이라 그때 존재 이유가 없다.
//
// 그래서 치수를 여기에 손으로 적지 않고 **결과가 쓰는 값에서 읽어 와** 대조한다. 배너는
// `noticeBannerRatio`, 글 줄은 `typography.cjs` 의 줄 높이다. 값이 바뀌면 이 테스트가 먼저 깨진다.
import { renderAtom } from '../../../components/__tests__/render-atom'
import { noticeBannerRatio } from '../../../features/notice/notice-display'
import { NoticeBannerCardSkeleton, NoticeBannerSkeleton, NoticeLinesSkeleton } from '../NoticeSkeleton'
import { topLinesIn } from './row-lines'

const HIDDEN = { includeHiddenElements: true } as const

/** `NoticeLines` 의 제목·날짜가 쓰는 글자 계단. 줄 높이는 그 표가 든다. */
const { fontSize } = require('../../../../typography.cjs') as {
  fontSize: Record<string, [string, { lineHeight: string }]>
}

function lineHeightOf(step: 'sm' | 'xs' | '13'): number {
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
})

describe('NoticeLinesSkeleton', () => {
  it('제목과 날짜 자리가 결과의 줄 높이를 그대로 든다', async () => {
    const { getAllByTestId } = await renderAtom(<NoticeLinesSkeleton lines={1} />)

    expect(getAllByTestId('notice-skeleton-title', HIDDEN)[0]).toHaveStyle({
      height: lineHeightOf('sm'),
    })
    expect(getAllByTestId('notice-skeleton-date', HIDDEN)[0]).toHaveStyle({
      height: lineHeightOf('xs'),
    })
  })

  // 결과(`NoticeLines`)가 칸으로 갈리므로 자리도 칸으로 갈린다. 선이 남으면 도착할 때 경계 모양이 바뀐다.
  it('줄 사이에 선을 긋지 않는다', async () => {
    const view = await renderAtom(<NoticeLinesSkeleton lines={3} />)

    expect(topLinesIn(view.toJSON())).toBe(0)
  })
})

// 목록 화면(`전체`)의 카드 한 장. 위와 같은 규칙인데 재는 자리가 셋이다 - 그림 · 제목 · 기간.
describe('NoticeBannerCardSkeleton', () => {
  it('배너 갈래의 비율로 그림 자리를 잡는다', async () => {
    const { getByTestId } = await renderAtom(<NoticeBannerCardSkeleton kind="event" />)

    expect(getByTestId('notice-card-skeleton-art', HIDDEN)).toHaveStyle({
      aspectRatio: noticeBannerRatio('event'),
    })
  })

  it('제목과 기간 자리가 결과의 줄 높이를 그대로 든다', async () => {
    const { getByTestId } = await renderAtom(<NoticeBannerCardSkeleton kind="cashshop" />)

    // `NoticeBannerCard` 의 제목은 `text-13`, 기간은 `text-xs` 다.
    expect(getByTestId('notice-card-skeleton-title', HIDDEN)).toHaveStyle({ height: lineHeightOf('13') })
    expect(getByTestId('notice-card-skeleton-period', HIDDEN)).toHaveStyle({ height: lineHeightOf('xs') })
  })
})

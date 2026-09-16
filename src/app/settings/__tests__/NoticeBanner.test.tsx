// 더보기 배너 줄과 `전체` 목록 카드.
//
// ① 배너 줄은 끝과 처음을 잇는 사본을 양끝에 하나씩 두고, 사본은 스크린리더가 읽지 않는다. ② 칸의 이름과 왼쪽 위 캡슐은 화면에
// 적는 제목이다(캐시샵은 날짜 머리를 뗀다). ③ 그림이 없으면 빈 자리만 둔다. 넘어가는 모습의 값은 `notice-banner-motion` 테스트가
// 본다. jsdom 은 스크롤을 그리지 않는다.
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import type { Notice } from '../../../types/notice'
import { NoticeBannerCard } from '../NoticeBannerCard'
import { NoticeBannerRail } from '../NoticeBannerRail'
import { NoticeLines } from '../NoticeLines'

function banner(id: number, patch: Partial<Notice> = {}): Notice {
  return {
    id: `event-${id}`,
    kind: 'event',
    title: `이벤트 ${id}`,
    body: '',
    publishedAt: '2026-09-10T02:08:00.000Z',
    thumbnailUrl: `https://file.nexon.com/${id}`,
    ...patch,
  }
}

describe('NoticeBannerRail', () => {
  // 사본 칸까지 읽으면 같은 이벤트를 두 번 듣는다. 접근성 트리에서 숨긴 칸은 기본 조회에 안 잡힌다.
  it('배너가 둘 이상이면 양끝에 스크린리더가 안 읽는 사본을 두고 점은 배너 수만큼이다', async () => {
    const view = await renderOverlay(<NoticeBannerRail notices={[banner(1), banner(2), banner(3)]} onOpen={jest.fn()} />)

    expect(view.getAllByTestId('notice-banner-slide', { includeHiddenElements: true })).toHaveLength(5)
    expect(view.getAllByTestId('notice-banner-slide')).toHaveLength(3)
    expect(view.getAllByTestId('notice-banner-dot')).toHaveLength(3)
  })

  // 바탕이 반투명하면 RN iOS 가 그림자 모양을 못 만들어 점마다 픽셀 그림자를 뜬다. 배너가 보이는 동안 스크롤이 끊긴다.
  it('점은 불투명한 흰 바탕 전체를 72% 로 옅게 해 흰색 72% 와 그림자를 낸다', async () => {
    const view = await renderOverlay(<NoticeBannerRail notices={[banner(1), banner(2)]} onOpen={jest.fn()} />)
    const dot = flattenStyle(view.getAllByTestId('notice-banner-dot')[0]?.props.style)

    expect(dot.backgroundColor).toBe('#ffffff')
    expect(dot.opacity).toBe(0.72)
    expect(dot.shadowOpacity).toBe(0.35)
  })

  it('배너가 하나면 사본도 점도 없다', async () => {
    const view = await renderOverlay(<NoticeBannerRail notices={[banner(1)]} onOpen={jest.fn()} />)

    expect(view.getAllByTestId('notice-banner-slide')).toHaveLength(1)
    expect(view.queryAllByTestId('notice-banner-dot')).toHaveLength(0)
  })

  it('칸을 누르면 그 공지를 연다 · 이름은 화면에 적는 제목이다', async () => {
    const onOpen = jest.fn()
    const cash = banner(7, { id: 'cashshop-7', kind: 'cashshop', title: '8월 20일 캐시아이템 업데이트 - 마스터라벨 플러스' })
    const view = await renderOverlay(<NoticeBannerRail notices={[banner(1), cash]} onOpen={onOpen} />)

    await act(async () => {
      fireEvent.press(view.getAllByLabelText('마스터라벨 플러스')[0])
    })

    expect(onOpen).toHaveBeenCalledWith(cash)
  })

  // 그림만으로는 무슨 이벤트 · 상품인지 알기 어려운 배너가 있다(사용자 지적 2026-09-16).
  it('칸마다 왼쪽 위 캡슐에 화면에 적는 제목을 한 줄로 적는다', async () => {
    const cash = banner(7, { id: 'cashshop-7', kind: 'cashshop', title: '8월 20일 캐시아이템 업데이트 - 마스터라벨 플러스' })
    const view = await renderOverlay(<NoticeBannerRail notices={[banner(1), cash]} onOpen={jest.fn()} />)

    const titles = view.getAllByTestId('notice-banner-title')
    expect(titles.map((title) => title.props.children)).toEqual(['이벤트 1', '마스터라벨 플러스'])
    expect(titles[0].props.numberOfLines).toBe(1)
  })

  // 캡슐이 제목을 들고 있어 빈 자리 안에 또 적지 않는다.
  it('그림 받기가 실패하면 빈 자리와 캡슐 제목만 남는다', async () => {
    const view = await renderOverlay(<NoticeBannerRail notices={[banner(1)]} onOpen={jest.fn()} />)

    await act(async () => {
      fireEvent(view.getByTestId('notice-banner-image'), 'error')
    })

    expect(view.queryByTestId('notice-banner-image')).toBeNull()
    expect(view.getByTestId('notice-banner-title').props.children).toBe('이벤트 1')
  })
})

describe('NoticeBannerCard', () => {
  it('제목과 한국 시간 기간을 적는다', async () => {
    const view = await renderOverlay(
      <NoticeBannerCard
        notice={banner(1, { startsAt: '2026-09-10T10:20:00.000Z', endsAt: '2026-09-16T14:59:00.000Z' })}
        onPress={jest.fn()}
      />,
    )

    expect(view.getByText('이벤트 1')).toBeTruthy()
    expect(view.getByTestId('notice-banner-period').props.children).toBe('2026.09.10 ~ 2026.09.16')
  })

  it('캐시샵은 날짜 머리를 떼고 기간이 없으면 상시 판매다', async () => {
    const view = await renderOverlay(
      <NoticeBannerCard
        notice={banner(2, { id: 'cashshop-2', kind: 'cashshop', title: '8월 20일 캐시아이템 업데이트 - 마스터라벨 플러스' })}
        onPress={jest.fn()}
      />,
    )

    expect(view.getByText('마스터라벨 플러스')).toBeTruthy()
    expect(view.getByTestId('notice-banner-period').props.children).toBe('상시 판매')
  })

  it('기간 없는 이벤트는 기간 줄이 없다', async () => {
    const view = await renderOverlay(<NoticeBannerCard notice={banner(3)} onPress={jest.fn()} />)

    expect(view.queryByTestId('notice-banner-period')).toBeNull()
  })

  // 카드 아래에 제목이 이미 있다.
  it('그림이 없으면 빈 자리만 두고 제목을 또 적지 않는다', async () => {
    const view = await renderOverlay(<NoticeBannerCard notice={banner(4, { thumbnailUrl: undefined })} onPress={jest.fn()} />)

    expect(view.queryByTestId('notice-banner-image')).toBeNull()
    expect(view.getAllByText('이벤트 4')).toHaveLength(1)
  })

  it('누르면 연다', async () => {
    const onPress = jest.fn()
    const view = await renderOverlay(<NoticeBannerCard notice={banner(5)} onPress={onPress} />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('이벤트 5'))
    })

    expect(onPress).toHaveBeenCalled()
  })
})

describe('NoticeLines', () => {
  const lines = [
    { id: 'game-1', kind: 'game', title: '9/17(목) 넥슨 정기점검 안내', body: '', publishedAt: '2026-09-15T05:44:00.000Z' },
    { id: 'game-2', kind: 'game', title: '클라이언트 패치', body: '', publishedAt: '2026-09-11T06:55:00.000Z' },
  ] satisfies Notice[]

  it('제목과 날짜를 적고 누르면 그 공지를 연다', async () => {
    const onPress = jest.fn()
    const view = await renderOverlay(<NoticeLines notices={lines} onPress={onPress} />)

    expect(view.getByText('2026. 9. 15.')).toBeTruthy()
    await act(async () => {
      fireEvent.press(view.getByLabelText('클라이언트 패치'))
    })
    expect(onPress).toHaveBeenCalledWith(lines[1])
  })

  // 더보기는 몇 줄만 보이는 자리라 제목을 한 줄로 자르고, 목록 화면은 제목 전체를 읽으러 온다.
  it('줄 수를 주면 제목을 자르고 안 주면 자르지 않는다', async () => {
    const cut = await renderOverlay(<NoticeLines notices={lines} titleLines={1} onPress={jest.fn()} />)
    expect(cut.getByText('클라이언트 패치').props.numberOfLines).toBe(1)

    const full = await renderOverlay(<NoticeLines notices={lines} onPress={jest.fn()} />)
    expect(full.getByText('클라이언트 패치').props.numberOfLines).toBeUndefined()
  })
})

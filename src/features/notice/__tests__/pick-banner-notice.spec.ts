import { pickBannerNotice } from '../pick-banner-notice'
import type { Notice } from '../../../types/notice'

function notice(id: string, publishedAt: string): Notice {
  return { id, title: `공지 ${id}`, body: '본문', publishedAt }
}

describe('배너가 세우는 공지 고르기', () => {
  it('쌓인 것이 없으면 null', () => {
    expect(pickBannerNotice([], [])).toBeNull()
  })

  it('가장 최근 발행분 하나', () => {
    const picked = pickBannerNotice(
      [notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')],
      [],
    )

    expect(picked?.id).toBe('new')
  })

  // 저장소가 최근순으로 넣어 두기는 하지만 그 사실에 기대면, 저장 순서를 바꾸는 순간
  // 배너가 옛 공지를 세운다. 고르는 자리에서 다시 잰다.
  it('저장 순서가 뒤집혀 있어도 가장 최근 것을 고른다', () => {
    const picked = pickBannerNotice(
      [notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')].reverse(),
      [],
    )

    expect(picked?.id).toBe('new')
  })

  it('가장 최근 것을 닫았으면 null', () => {
    const picked = pickBannerNotice(
      [notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')],
      ['new'],
    )

    expect(picked).toBeNull()
  })

  // `다시 보지 않기` 는 이 배너를 치워라이지 다음 것을 보여 달라가 아니다. 누른 자리에 다른 글이
  // 즉시 서면 안 없어진 것으로 보인다.
  it('닫힌 자리에 옛 공지를 올리지 않는다', () => {
    const picked = pickBannerNotice(
      [
        notice('older', '2026-08-20T00:00:00Z'),
        notice('old', '2026-09-01T00:00:00Z'),
        notice('new', '2026-09-05T00:00:00Z'),
      ],
      ['new'],
    )

    expect(picked).toBeNull()
  })

  // 옛 것을 닫아 둬도 후보는 최신 하나라 그 하나가 그대로 선다.
  it('옛 공지를 닫은 것은 최신에 영향이 없다', () => {
    const picked = pickBannerNotice(
      [notice('old', '2026-09-01T00:00:00Z'), notice('new', '2026-09-05T00:00:00Z')],
      ['old'],
    )

    expect(picked?.id).toBe('new')
  })

  // 닫아 둔 뒤 새 공지가 오면 그것이 최신이 되어 다시 선다.
  it('닫은 뒤 더 최근 공지가 오면 그것이 선다', () => {
    const picked = pickBannerNotice(
      [notice('new', '2026-09-05T00:00:00Z'), notice('newer', '2026-09-09T00:00:00Z')],
      ['new'],
    )

    expect(picked?.id).toBe('newer')
  })

  // 서버가 이상한 값을 보내도 배너가 죽지 않아야 한다. 못 읽는 날짜는 맨 뒤로 민다.
  it('발행일을 못 읽는 공지는 읽히는 것에 진다', () => {
    const picked = pickBannerNotice(
      [notice('broken', '날짜가 아니다'), notice('ok', '2026-09-01T00:00:00Z')],
      [],
    )

    expect(picked?.id).toBe('ok')
  })
})

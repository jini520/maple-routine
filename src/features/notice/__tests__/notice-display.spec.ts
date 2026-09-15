// 소식 화면이 공지를 적는 말.
import type { Notice } from '../../../types/notice'
import { emptyNoticeText, noticeDisplayTitle, noticePeriodLabel } from '../notice-display'

function notice(patch: Partial<Notice>): Notice {
  return { id: 'x', kind: 'event', title: '제목', body: '', publishedAt: '2026-09-10T02:08:00.000Z', ...patch }
}

describe('noticeDisplayTitle', () => {
  // 캐시샵 제목이 모두 날짜 머리로 시작해 좁은 칸에서 상품 이름이 두 줄 뒤로 밀린다. 날짜는 기간 줄이 말한다.
  it('캐시샵은 앞의 `n월 n일 캐시아이템 업데이트 - ` 를 뗀다', () => {
    expect(noticeDisplayTitle(notice({ kind: 'cashshop', title: '8월 20일 캐시아이템 업데이트 - 마스터라벨 플러스' }))).toBe(
      '마스터라벨 플러스',
    )
    expect(noticeDisplayTitle(notice({ kind: 'cashshop', title: '12월 3일 캐시아이템 업데이트 - 로얄스타일 &  마스터피스' }))).toBe(
      '로얄스타일 &  마스터피스',
    )
  })

  it('머리 모양이 다르면 그대로 · 떼고 빈 글자면 원래 제목이다', () => {
    expect(noticeDisplayTitle(notice({ kind: 'cashshop', title: '캐시샵 점검 안내' }))).toBe('캐시샵 점검 안내')
    expect(noticeDisplayTitle(notice({ kind: 'cashshop', title: '8월 20일 캐시아이템 업데이트 - ' }))).toBe(
      '8월 20일 캐시아이템 업데이트 - ',
    )
  })

  it('캐시샵이 아니면 떼지 않는다', () => {
    expect(noticeDisplayTitle(notice({ kind: 'event', title: '8월 20일 캐시아이템 업데이트 - 이벤트' }))).toBe(
      '8월 20일 캐시아이템 업데이트 - 이벤트',
    )
  })
})

describe('noticePeriodLabel', () => {
  // 넥슨은 끝을 23:59+09:00 으로 준다. 기기 시간대로 적으면 한국 밖에서 끝 날짜가 하루 밀린다.
  it('기간은 한국 시간 날짜로 `YYYY.MM.DD ~ YYYY.MM.DD` 다', () => {
    expect(noticePeriodLabel(notice({ startsAt: '2026-09-10T10:20:00.000Z', endsAt: '2026-09-16T14:59:00.000Z' }))).toBe(
      '2026.09.10 ~ 2026.09.16',
    )
    // UTC 로는 전날인 한국 새벽.
    expect(noticePeriodLabel(notice({ startsAt: '2026-08-20T15:00:00.000Z', endsAt: '2026-09-17T14:59:00.000Z' }))).toBe(
      '2026.08.21 ~ 2026.09.17',
    )
  })

  it('캐시샵에 기간이 없으면 `상시 판매` 다', () => {
    expect(noticePeriodLabel(notice({ kind: 'cashshop' }))).toBe('상시 판매')
  })

  it('이벤트에 기간이 없으면 적지 않는다', () => {
    expect(noticePeriodLabel(notice({ kind: 'event' }))).toBeNull()
    expect(noticePeriodLabel(notice({ kind: 'event', startsAt: '2026-09-10T10:20:00.000Z' }))).toBeNull()
  })
})

describe('emptyNoticeText', () => {
  // 조사를 `이` 로 고정하면 `아직 받은 업데이트이 없습니다` 가 된다.
  it('조사를 이름 끝 글자의 받침으로 고른다', () => {
    expect(emptyNoticeText('앱 공지사항')).toBe('아직 받은 앱 공지사항이 없습니다')
    expect(emptyNoticeText('캐시샵')).toBe('아직 받은 캐시샵이 없습니다')
    expect(emptyNoticeText('업데이트')).toBe('아직 받은 업데이트가 없습니다')
    expect(emptyNoticeText('진행 중인 이벤트')).toBe('아직 받은 진행 중인 이벤트가 없습니다')
  })

  // 영문 이름은 받침으로 못 고른다. 끝 글자가 모음 글자면 모음으로 끝나게 읽힌다(`NOTICE` 노티스).
  it('영문 이름은 끝 글자가 모음 글자면 가 다', () => {
    expect(emptyNoticeText('NOTICE')).toBe('아직 받은 NOTICE가 없습니다')
  })
})

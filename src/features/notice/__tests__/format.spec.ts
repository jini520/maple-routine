import { formatNoticeDate } from '../format'

describe('formatNoticeDate', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  // 기간은 이미 한국 시간이다. 발행일만 기기 시간대로 적으면 해외에 있는 기기에서 날짜가 하루 어긋난다.
  it('기기 시간대가 아니라 한국 시간의 날짜를 적는다', () => {
    // 2026-09-09T16:00Z 는 한국 9월 10일 01시이고, 로스앤젤레스 기기에서는 9월 9일이다. 그 기기의 지역 시각을 흉내 낸다.
    jest.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026)
    jest.spyOn(Date.prototype, 'getMonth').mockReturnValue(8)
    jest.spyOn(Date.prototype, 'getDate').mockReturnValue(9)

    expect(formatNoticeDate('2026-09-09T16:00:00.000Z')).toBe('2026. 9. 10.')
  })

  it('못 읽는 값은 빈 문자열이다', () => {
    expect(formatNoticeDate('없음')).toBe('')
  })
})

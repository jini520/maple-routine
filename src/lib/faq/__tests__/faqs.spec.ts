// 서버 FAQ 묶음에서 시트 하나를 고른다. 묶음 목록은 서버 표의 줄이라 페이지가 늘어도 이 모듈은 그대로다.
import fixture from '../../../__fixtures__/game-data/faqs.json'
import { FAQ_SHEET_KEYS, faqSheetOf, parseFaqs } from '../faqs'

const 문단 = (text: string) => ({ kind: 'paragraph', text })

function 칸(
  faqItems: unknown[],
  faqSheets: unknown[] = [
    { id: 's-boss-manage', key: 'boss-manage', title: '보스 관리' },
    { id: 's-today', key: 'today', title: 'today' },
  ],
) {
  return { updatedAt: '2026-11-03T00:00:00.000Z', faqSheets, faqItems }
}

describe('FAQ 묶음 고르기', () => {
  it('key 로 묶음의 제목과 문항을 받은 차례대로 고른다', () => {
    const table = parseFaqs(
      칸([
        { sheetId: 's-boss-manage', question: '첫째', answer: '가' },
        { sheetId: 's-today', question: '다른 묶음', answer: '나' },
        { sheetId: 's-boss-manage', question: '둘째', answer: '다\n\n라' },
      ]),
    )!

    expect(faqSheetOf(table, 'boss-manage')).toEqual({
      title: '보스 관리',
      items: [
        { question: '첫째', answer: [문단('가')] },
        { question: '둘째', answer: [문단('다'), 문단('라')] },
      ],
    })
  })

  // 답은 글 하나이고 빈 줄이 문단을 나눈다. 줄바꿈 하나는 한 문단 안의 줄바꿈이다.
  it('빈 줄에서만 문단을 나누고, 공백만 있는 줄도 빈 줄로 본다', () => {
    const table = parseFaqs(칸([{ sheetId: 's-today', question: '질문', answer: '가\n나\n \n다\n\n\n라' }]))!

    expect(faqSheetOf(table, 'today')?.items[0]?.answer).toEqual([문단('가\n나'), 문단('다'), 문단('라')])
  })

  // 빈 시트를 여는 입구는 눌러도 얻는 것이 없어서, 화면은 null 이면 물음표를 그리지 않는다.
  it('문항이 없는 묶음과 서버에 없는 key 는 null 이다', () => {
    const table = parseFaqs(칸([{ sheetId: 's-today', question: '질문', answer: '답' }]))!

    expect(faqSheetOf(table, 'boss-manage')).toBeNull()
    expect(faqSheetOf(table, 'cashbook')).toBeNull()
  })
})

describe('faqs 칸의 계약', () => {
  it('형식을 어기면 칸 전체가 null 이다', () => {
    expect(parseFaqs(칸([{ sheetId: 's-today', question: '질문', answer: [문단('답')] }]))).toBeNull()
    expect(parseFaqs(칸([{ sheetId: 's-today', question: '질문', answer: '  ' }]))).toBeNull()
    expect(parseFaqs(칸([{ sheetId: 'nope', question: '질문', answer: '답' }]))).toBeNull()
    expect(parseFaqs(칸([], [{ id: 's1', key: 'Boss Manage', title: '보스 관리' }]))).toBeNull()
    expect(
      parseFaqs(
        칸(
          [],
          [
            { id: 's1', key: 'today', title: '가' },
            { id: 's2', key: 'today', title: '나' },
          ],
        ),
      ),
    ).toBeNull()
  })

  // 관리 화면에서 묶음을 다 지워도 계약 위반이 아니다. 위반이면 처음 켜는 사용자가 잠금 화면에 갇힌다.
  it('묶음도 문항도 없는 칸을 받는다', () => {
    expect(parseFaqs(칸([], []))).toEqual({ updatedAt: '2026-11-03T00:00:00.000Z', faqSheets: [], faqItems: [] })
  })

  // 화면에 단 key 가 서버 묶음 key 와 글자 하나라도 다르면 그 화면의 물음표는 끝내 뜨지 않는다.
  // fixture 는 서버 응답을 뜬 것이라, key 를 더하면 서버에 묶음을 만들고 fixture 를 다시 떠야 통과한다.
  it('앱이 쓰는 key 는 모두 서버에 묶음이 있다', () => {
    const table = parseFaqs(fixture)!
    const keys = new Set(table.faqSheets.map((sheet) => sheet.key))

    expect(FAQ_SHEET_KEYS.filter((key) => !keys.has(key))).toEqual([])
  })
})

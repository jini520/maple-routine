// 서버 FAQ 묶음에서 시트 하나를 고른다. 묶음 목록은 서버 표의 줄이라 페이지가 늘어도 이 모듈은 그대로다.
import fixture from '../../../__fixtures__/game-data/faqs.json'
import { FAQ_SHEET_KEYS, faqSheetOf, parseFaqs } from '../faqs'

const 문단 = (text: string) => ({ kind: 'paragraph', text })

function 칸(
  items: unknown[],
  sheets: unknown[] = [
    { key: 'boss-manage', title: '보스 관리' },
    { key: 'today', title: 'today' },
  ],
) {
  return { updatedAt: '2026-11-03T00:00:00.000Z', sheets, items }
}

describe('FAQ 묶음 고르기', () => {
  it('key 로 묶음의 제목과 문항을 받은 차례대로 고른다', () => {
    const table = parseFaqs(
      칸([
        { sheet: 'boss-manage', question: '첫째', answer: [문단('가')] },
        { sheet: 'today', question: '다른 묶음', answer: [문단('나')] },
        { sheet: 'boss-manage', question: '둘째', answer: [문단('다'), 문단('라')] },
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

  // 빈 시트를 여는 입구는 눌러도 얻는 것이 없어서, 화면은 null 이면 물음표를 그리지 않는다.
  it('문항이 없는 묶음과 서버에 없는 key 는 null 이다', () => {
    const table = parseFaqs(칸([{ sheet: 'today', question: '질문', answer: [문단('답')] }]))!

    expect(faqSheetOf(table, 'boss-manage')).toBeNull()
    expect(faqSheetOf(table, 'cashbook')).toBeNull()
  })
})

describe('faqs 칸의 계약', () => {
  // 새 종류를 쓴 문항 하나 때문에 옛 앱이 칸 전체를 버리면 모든 화면의 FAQ 가 사라진다.
  it('모르는 종류의 블록만 버리고, 남는 블록이 없는 문항은 뺀다', () => {
    const table = parseFaqs(
      칸([
        { sheet: 'today', question: '그림이 섞인 답', answer: [문단('가'), { kind: 'image', path: 'a.png' }] },
        { sheet: 'today', question: '그림만 있는 답', answer: [{ kind: 'image', path: 'b.png' }] },
      ]),
    )!

    expect(table.items).toEqual([{ sheet: 'today', question: '그림이 섞인 답', answer: [문단('가')] }])
  })

  it('형식을 어기면 칸 전체가 null 이다', () => {
    expect(parseFaqs(칸([{ sheet: 'today', question: '질문', answer: '답' }]))).toBeNull()
    expect(parseFaqs(칸([{ sheet: 'today', question: '질문', answer: [{ kind: 'paragraph', text: '' }] }]))).toBeNull()
    expect(parseFaqs(칸([], [{ key: 'Boss Manage', title: '보스 관리' }]))).toBeNull()
    expect(
      parseFaqs(
        칸(
          [],
          [
            { key: 'today', title: '가' },
            { key: 'today', title: '나' },
          ],
        ),
      ),
    ).toBeNull()
  })

  // 관리 화면에서 묶음을 다 지워도 계약 위반이 아니다. 위반이면 처음 켜는 사용자가 잠금 화면에 갇힌다.
  it('묶음도 문항도 없는 칸을 받는다', () => {
    expect(parseFaqs(칸([], []))).toEqual({ updatedAt: '2026-11-03T00:00:00.000Z', sheets: [], items: [] })
  })

  // 화면에 단 key 가 서버 묶음 key 와 글자 하나라도 다르면 그 화면의 물음표는 끝내 뜨지 않는다.
  // fixture 는 운영 서버 응답을 뜬 것이라, key 를 더하면 서버에 묶음을 만들고 fixture 를 다시 떠야 통과한다.
  it('앱이 쓰는 key 는 모두 서버에 묶음이 있다', () => {
    const table = parseFaqs(fixture)!
    const keys = new Set(table.sheets.map((sheet) => sheet.key))

    expect(FAQ_SHEET_KEYS.filter((key) => !keys.has(key))).toEqual([])
  })
})

/**
 * 확인 줄 문구. 고른 것이 몇이고 그중 몇을 정했나로 갈린다.
 *
 * 여기서 지키는 것은 **셈이 맞는가**다. 제목이 세는 것과 딸린 줄이 세는 것이 다르다. 제목은
 * 매긴 것을, 딸린 줄은 남은 것을 센다.
 */
import { dropPromptOf } from '../drop/drop-prompt'
import type { RecordedDrop } from '../../types/drops'

function 드롭(name: string, price?: 'entered' | 'excluded'): RecordedDrop {
  return {
    category: 'equipment',
    itemKey: null,
    itemName: name,
    quantity: 1,
    ...(price === undefined ? {} : { priceState: price }),
  }
}

describe('dropPromptOf', () => {
  it('고른 것이 없으면 줄이 없다', () => {
    expect(dropPromptOf([])).toBeNull()
  })

  describe('한 건', () => {
    it('안 매겼으면 이름과 물음이다', () => {
      expect(dropPromptOf([드롭('창세의 뱃지')])).toEqual({
        title: '창세의 뱃지가 선택되었습니다',
        detail: '판매 가격을 입력할까요?',
      })
    })

    it('받침이 있으면 `이` 다', () => {
      expect(dropPromptOf([드롭('가디언 엔젤링')])?.title).toBe('가디언 엔젤링이 선택되었습니다')
    })

    it('매겼으면 다 했다고 말하고 셈을 단다', () => {
      expect(dropPromptOf([드롭('창세의 뱃지', 'entered')])).toEqual({
        title: '모든 아이템의 가격을 입력했습니다',
        detail: '가격 입력 1건',
      })
    })
  })

  describe('여러 건', () => {
    it('하나도 안 매겼으면 고른 것을 센다', () => {
      const 줄 = dropPromptOf([드롭('창세의 뱃지'), 드롭('연마석'), 드롭('에테르')])
      expect(줄).toEqual({
        title: '창세의 뱃지 외 2건이 선택되었습니다',
        detail: '판매 가격을 입력할까요?',
      })
    })

    /** 제목은 **매긴 것**을 세고 딸린 줄이 남은 것을 센다. 두 수가 다르다. */
    it('일부만 매겼으면 매긴 것을 제목이, 남은 것을 딸린 줄이 센다', () => {
      const 줄 = dropPromptOf([
        드롭('창세의 뱃지', 'entered'),
        드롭('연마석', 'entered'),
        드롭('에테르'),
        드롭('마크'),
      ])
      expect(줄).toEqual({
        title: '창세의 뱃지 외 1건의 가격을 입력했습니다',
        detail: '미입력 2건 · 판매 가격을 입력할까요?',
      })
    })

    it('매긴 것이 하나면 `외 n건` 을 안 붙인다', () => {
      const 줄 = dropPromptOf([드롭('창세의 뱃지', 'entered'), 드롭('연마석')])
      expect(줄?.title).toBe('창세의 뱃지의 가격을 입력했습니다')
    })

    /** 기록 안함은 정한 것이라 미입력에서 빠진다. 제목은 여전히 고른 것을 센다. */
    it('기록 안함만 있고 매긴 것이 없으면 아직 고른 것을 센다', () => {
      const 줄 = dropPromptOf([드롭('창세의 뱃지', 'excluded'), 드롭('연마석'), 드롭('에테르')])
      expect(줄).toEqual({
        title: '연마석 외 1건이 선택되었습니다',
        detail: '판매 가격을 입력할까요?',
      })
    })

    it('다 정했으면 셈 둘을 나란히 적는다', () => {
      const 줄 = dropPromptOf([
        드롭('창세의 뱃지', 'entered'),
        드롭('연마석', 'entered'),
        드롭('에테르', 'excluded'),
      ])
      expect(줄).toEqual({
        title: '모든 아이템의 가격을 입력했습니다',
        detail: '가격 입력 2건 · 기록 안함 1건',
      })
    })

    it('없는 셈은 안 적는다', () => {
      expect(dropPromptOf([드롭('a', 'entered'), 드롭('b', 'entered')])?.detail).toBe('가격 입력 2건')
      expect(dropPromptOf([드롭('a', 'excluded'), 드롭('b', 'excluded')])?.detail).toBe('기록 안함 2건')
    })
  })
})

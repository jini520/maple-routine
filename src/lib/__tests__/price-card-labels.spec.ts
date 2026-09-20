/**
 * 가격 카드 확인 버튼의 글자.
 *
 * 여기서 지키는 것은 **글자가 거짓말을 안 하는가**다. 빈 칸에서 `저장 후` 라고 적으면 안 쓰는
 * 것을 쓴다고 말하는 셈이고, 세는 수가 틀리면 몇 건이 남았는지를 못 믿게 된다.
 */
import { confirmLabels } from '../drop/price-card-labels'

const 자리 = {
  하나: false,
  마지막: false,
  자리: 0,
  전체: 3,
  매긴것: 0,
  지금매김: false,
}

describe('confirmLabels', () => {
  it('하나뿐이면 끝내는 말만 한다', () => {
    expect(confirmLabels({ ...자리, 하나: true, 마지막: true, 전체: 1 })).toEqual({
      confirmLabel: '완료',
      confirmEmptyLabel: '닫기',
    })
  })

  it('가운데 자리는 갈 곳의 번호를 단다', () => {
    expect(confirmLabels({ ...자리, 자리: 1 })).toEqual({
      confirmLabel: '저장 후 다음(3/3)',
      confirmEmptyLabel: '다음(3/3)',
    })
  })

  it('첫 자리에서 누르면 둘째로 간다', () => {
    expect(confirmLabels({ ...자리, 자리: 0 }).confirmEmptyLabel).toBe('다음(2/3)')
  })

  /** 세는 것은 **누른 뒤에** 값이 매겨져 있을 개수다. 지금 칸을 채우면 하나 더 는다. */
  it('마지막 자리는 정해질 가격의 개수를 센다', () => {
    const 끝 = { ...자리, 마지막: true, 자리: 2, 매긴것: 1 }

    expect(confirmLabels(끝)).toEqual({
      confirmLabel: '2개 입력 완료',
      confirmEmptyLabel: '1개 입력 완료',
    })
  })

  it('지금 자리에 이미 값이 있으면 빈 칸으로 끝내도 그 값이 남는다', () => {
    const 끝 = { ...자리, 마지막: true, 자리: 2, 매긴것: 1, 지금매김: true }

    // 칸을 비워도 앞서 매긴 값은 안 지워진다. 둘 다 2다.
    expect(confirmLabels(끝).confirmEmptyLabel).toBe('2개 입력 완료')
    expect(confirmLabels(끝).confirmLabel).toBe('2개 입력 완료')
  })

  it('하나도 안 매기고 마지막에 오면 0개다', () => {
    expect(confirmLabels({ ...자리, 마지막: true, 자리: 2 }).confirmEmptyLabel).toBe('0개 입력 완료')
  })
})

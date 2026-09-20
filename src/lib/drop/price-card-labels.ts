/**
 * 가격 카드 확인 버튼의 글자. 지금 누르면 무슨 일이 나는가를 말한다.
 *
 * 저장과 다음을 두 버튼으로 두었더니 어느 쪽이 값을 쓰는지가 안 읽혔다(사용자 지적). 버튼은
 * 하나이고 **칸이 비었나**로 글자가 갈린다. 빈 칸은 쓸 것이 없으니 옮기기만 하고, 값이 있으면
 * 쓰고 옮긴다.
 *
 * 드롭 기록 시트와 아이템 가격 입력 화면이 같은 규칙을 쓴다. 두 곳에 적으면 한쪽만 고쳐진다.
 */

/** 버튼 글자를 정하는 데 필요한 사실. 수는 전부 이 연쇄 안의 것이다. */
export interface PriceCardPosition {
  /** 도는 것이 하나뿐인가. 오갈 자리가 없어 글자가 끝내는 말만 한다. */
  하나: boolean
  /** 지금이 마지막 자리인가. 갈 곳이 없어 세는 말을 한다. */
  마지막: boolean
  /** 지금 자리(0부터). 다음 자리 번호를 여기서 센다. */
  자리: number
  /** 도는 것의 개수. */
  전체: number
  /** **지금 자리를 빼고** 값이 매겨진 개수. */
  매긴것: number
  /** 지금 자리에 이미 값이 매겨져 있나. 빈 칸으로 끝내도 그 값은 남는다. */
  지금매김: boolean
}

/** 카드가 받는 두 글자. 칸이 비면 `confirmEmptyLabel`, 값이 있으면 `confirmLabel` 이 선다. */
export interface PriceCardLabels {
  confirmLabel: string
  confirmEmptyLabel: string
}

export function confirmLabels(at: PriceCardPosition): PriceCardLabels {
  if (at.하나) return { confirmLabel: '완료', confirmEmptyLabel: '닫기' }
  if (at.마지막) {
    return {
      confirmLabel: `${at.매긴것 + 1}개 입력 완료`,
      confirmEmptyLabel: `${at.매긴것 + (at.지금매김 ? 1 : 0)}개 입력 완료`,
    }
  }
  // 갈 곳의 번호다. 누르면 그 수가 된다.
  const 갈곳 = `(${at.자리 + 2}/${at.전체})`
  return { confirmLabel: `저장 후 다음${갈곳}`, confirmEmptyLabel: `다음${갈곳}` }
}

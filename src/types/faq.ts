/**
 * 답 한 조각.
 *
 * 종류가 지금 하나인 것은 쓰는 FAQ 가 문단만 써서다. 배열 모양을 두는 것이 늘릴 자리이고,
 * 종류가 늘어도 호출부는 안 고친다.
 */
export type FaqBlock = { kind: 'paragraph'; text: string }

export interface FaqItem {
  question: string
  answer: FaqBlock[]
}

/** 시트 하나에 싣는 것. 서버 FAQ 묶음 하나다. */
export interface FaqSheetContent {
  /** 시트 머리에 서는 이름 */
  title: string
  /** 한 개 이상. 문항이 없는 묶음은 시트로 만들지 않는다 */
  items: readonly FaqItem[]
}

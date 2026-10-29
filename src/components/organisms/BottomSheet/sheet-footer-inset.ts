import { createContext } from 'react'

/** 바닥 줄의 좌우 여백. 바텀시트가 바닥 줄에 주는 값과 같아야 한다. */
export const FOOTER_INSET = 16

/** 주 버튼과 시트 가장자리 사이. 바텀시트의 바닥 줄이 내려 준다. 바텀시트 밖에서는 바닥 줄 여백과 같은 16 이다. */
export const SheetFooterInset = createContext(FOOTER_INSET)

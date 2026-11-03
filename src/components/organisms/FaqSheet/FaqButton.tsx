/**
 * 화면 머리 제목 바로 오른쪽에서 그 화면의 FAQ 시트를 여는 물음표.
 *
 * 제목과의 간격(6)은 이 부품이 준다. 제목과 한 덩어리로 읽혀야 해서 머리 줄의 다른 간격을 따르지 않는다.
 *
 * 묶음이 없으면 아무것도 그리지 않는다. 문항이 아직 없는 화면에도 미리 달아 두는 입구라서다.
 *
 * @example
 * const faq = useFaqSheet('today')
 * <Text className="shrink-0 text-lg font-bold text-text">today</Text>
 * <FaqButton sheet={faq} />
 */
import { useState } from 'react'
import { Pressable } from 'react-native'

import type { FaqSheetContent } from '../../../types/faq'
import { CircleQuestionMarkIcon } from '../../atoms'
import { FaqSheet } from './FaqSheet'

/** 14px 아이콘의 누르는 영역을 권장 크기 44px 로 넓히는 값. */
const HIT_SLOP = 15

export interface FaqButtonProps {
  /** 그 화면의 FAQ 묶음. `null` 이면 물음표를 그리지 않는다 */
  sheet: FaqSheetContent | null
}

export function FaqButton(props: FaqButtonProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (props.sheet === null) return null
  const sheet = props.sheet

  return (
    <>
      <Pressable
        role="button"
        aria-label="자주 묻는 질문"
        hitSlop={HIT_SLOP}
        className="ml-1.5 shrink-0 opacity-70"
        onPress={() => setOpen(true)}
      >
        <CircleQuestionMarkIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
      </Pressable>

      {open && <FaqSheet title={sheet.title} items={sheet.items} onClose={() => setOpen(false)} />}
    </>
  )
}

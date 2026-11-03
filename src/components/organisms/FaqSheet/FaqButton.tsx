/**
 * 화면 머리 제목 바로 오른쪽에서 그 화면의 FAQ 시트를 여는 물음표.
 *
 * 제목과의 간격(6)은 이 부품이 준다. 제목과 한 덩어리로 읽혀야 해서 머리 줄의 다른 간격을 따르지 않는다.
 *
 * @example
 * <Text className="shrink-0 text-lg font-bold text-text">today</Text>
 * <FaqButton title="today" items={TODAY_FAQ} />
 */
import { useState } from 'react'
import { Pressable } from 'react-native'

import { CircleQuestionMarkIcon } from '../../atoms'
import { FaqSheet, type FaqItem } from './FaqSheet'

/** 14px 아이콘의 누르는 영역을 권장 크기 44px 로 넓히는 값. */
const HIT_SLOP = 15

export interface FaqButtonProps {
  /** 시트 머리에 서는 이름. 그 화면의 제목을 쓴다. */
  title: string
  items: readonly FaqItem[]
}

export function FaqButton(props: FaqButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

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

      {open && <FaqSheet title={props.title} items={props.items} onClose={() => setOpen(false)} />}
    </>
  )
}

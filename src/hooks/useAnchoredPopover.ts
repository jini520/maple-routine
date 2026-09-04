/**
 * 트리거를 재서 팝오버를 여닫는 훅. 팝오버를 띄우는 화면 셋이 공유한다.
 *
 * 이 훅은 `app/boss-profit/ItemRevenuePopover.tsx` 안에 살았다. 호출부가 그 화면 안 셋뿐일 때는
 * 맞는 자리였는데 today 위젯이 넷째로 붙으면서 틀린 자리가 됐다. 거기서 import 하면 타일 하나가
 * 보스 수익 화면 모듈을 통째로 평가한다. 훅이 `react` 와 `Dimensions` 밖에 안 써서 옮기는 데 걸리는 것이
 * 없다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, View } from 'react-native'

/** 트리거의 **윈도우 기준** 사각형. 웹 `DOMRect` 자리. `measureInWindow` 가 주는 네 값 그대로다. */
export interface PopoverAnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export interface AnchoredPopover {
  /**
   * 트리거에 다는 ref. 이것을 재서 상자를 앉힌다.
   *
   * `RefObject` 가 아니라 콜백 ref 다. 훅이 `RefObject` 를 객체에 담아 돌려주면 호출부의
   * `popover.toggle` 같은 평범한 프로퍼티 접근까지 `react-hooks/refs` 가 렌더 중 ref 접근으로
   * 읽는다. 노드를 훅 안에 가둬 두면 밖으로 나가는 것은 함수와 값뿐이라 그 물음 자체가 사라진다.
   */
  ref: (node: View | null) => void
  /** 열려 있는가. 위치를 아직 몰라도 `true` 일 수 있다. */
  isOpen: boolean
  /** 잰 결과. `null` 이면 아직 모른다. 상자는 그리되 보이지 않는다. */
  anchor: PopoverAnchorRect | null
  toggle: () => void
  close: () => void
}

/**
 * 트리거를 재서 팝오버를 여닫는 훅.
 *
 * 호출부가 셋이라 여기 산다(보스 행 · 주차 소계 행 · 캐릭터 카드). 팝오버 자신의 관심사라
 * 별도 파일로 가르지 않는다.
 */
export function useAnchoredPopover(): AnchoredPopover {
  const nodeRef = useRef<View | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<PopoverAnchorRect | null>(null)

  const ref = useCallback((node: View | null) => {
    nodeRef.current = node
  }, [])

  function close(): void {
    setIsOpen(false)
    setAnchor(null)
  }

  function toggle(): void {
    if (isOpen) {
      close()
      return
    }
    setIsOpen(true)
    nodeRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ left: x, top: y, width, height })
    })
  }

  // 회전하면 잰 좌표가 거짓이 된다. 스크롤 쪽은 별도 네이티브 윈도우라는 구조가 대신 지킨다.
  useEffect(() => {
    if (!isOpen) return
    const subscription = Dimensions.addEventListener('change', () => {
      setIsOpen(false)
      setAnchor(null)
    })
    return () => subscription.remove()
  }, [isOpen])

  return { ref, isOpen, anchor, toggle, close }
}

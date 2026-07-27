import { useEffect, useRef } from 'react'

import { DROP_EFFECT_FRAMES } from '../../lib/drop-effect-frames'
import { createPortal } from 'react-dom'
import { getItemIconUrl } from '../../lib/item-icons'

interface DropEffectOverlayProps {
  itemName: string
  slot?: string
  onClose: () => void
}

// 단계별 고정 fps(ADR-038): ScreenEff 15(8f 시점에 아이템+pre 병렬) → pre 14 → loop 11.5 → end 12.
const FPS = { screen: 15, pre: 14, loop: 11.5, end: 12 }
const DROP_START_FRAME = 8

// 중앙 아이템 세로 위치(값 ↑ = 아래로). DropEff 하단 앵커도 이 값 기준으로 계산한다.
const ITEM_CENTER_TOP = '66%'
const ITEM_SIZE_PX = 72
// DropEff 기둥만 아이템과 무관하게 세로 이동(양수 = 아래로).
const DROP_OFFSET_Y_PX = 8

// 고가 아이템 드롭 시 전체화면 연출. ScreenEff는 cover로 화면을 채우고, 8프레임 시점에 아이템이
// 등장하며 DropEff(pre→loop ∞)가 아이템 하단에서 올라온다. 화면 탭 → end 재생 후 닫힘.
// 빛 효과는 검은배경 JPEG + mix-blend:screen(가산 합성) — 검정은 투명 처리된다.
export function DropEffectOverlay(props: DropEffectOverlayProps): React.JSX.Element {
  const itemUrl = getItemIconUrl(props.itemName, props.slot)
  const screenRef = useRef<HTMLImageElement>(null)
  const dropRef = useRef<HTMLImageElement>(null)
  const itemRef = useRef<HTMLImageElement>(null)
  const closeRef = useRef<() => void>(() => props.onClose())

  useEffect(() => {
    const frames = DROP_EFFECT_FRAMES
    const elScreen = screenRef.current
    const elDrop = dropRef.current
    const elItem = itemRef.current
    if (elScreen === null || elDrop === null || frames.loop.length === 0) {
      // 프레임이 없으면(에셋 누락) 연출 없이 닫기만 가능하게 둔다.
      closeRef.current = () => props.onClose()
      return
    }

    let raf = 0
    let lastTs = 0
    const st = {
      sIdx: 0,
      sAcc: 0,
      sDone: false,
      dStarted: false,
      dPhase: 'pre' as 'pre' | 'loop',
      dIdx: 0,
      dAcc: 0,
      closing: false,
      eIdx: 0,
      eAcc: 0,
    }

    elScreen.style.opacity = '1'
    elScreen.src = frames.screen[0]
    elDrop.style.opacity = '0'
    if (elItem !== null) elItem.style.opacity = '0'

    function startDrop(): void {
      st.dStarted = true
      st.dPhase = 'pre'
      st.dIdx = 0
      st.dAcc = 0
      elDrop!.style.opacity = '1'
      elDrop!.src = frames.pre[0]
      if (elItem !== null) {
        elItem.style.opacity = '1'
        elItem.style.transform = 'scale(1)' // 중앙정렬은 래퍼가, 부유는 .fx-drop-float가 담당
      }
    }

    function finish(): void {
      cancelAnimationFrame(raf)
      props.onClose()
    }

    function tick(ts: number): void {
      if (lastTs === 0) lastTs = ts
      const dt = Math.min(ts - lastTs, 100) // 백그라운드 복귀 시 폭주 방지
      lastTs = ts

      if (!st.closing) {
        // ScreenEff (18fps·1회) — 8f 시점에 아이템+pre 트리거
        if (!st.sDone) {
          st.sAcc += dt
          const dur = 1000 / FPS.screen
          let guard = 0
          while (guard++ < 600 && st.sAcc >= dur) {
            st.sAcc -= dur
            st.sIdx++
            if (!st.dStarted && st.sIdx >= DROP_START_FRAME) startDrop()
            if (st.sIdx >= frames.screen.length) {
              st.sDone = true
              elScreen!.style.opacity = '0'
              break
            }
          }
          if (!st.sDone) elScreen!.src = frames.screen[st.sIdx]
        }
        // DropEff (pre16 → loop8 ∞)
        if (st.dStarted) {
          st.dAcc += dt
          let guard = 0
          while (guard++ < 600) {
            const dur = 1000 / (st.dPhase === 'pre' ? FPS.pre : FPS.loop)
            if (st.dAcc < dur) break
            st.dAcc -= dur
            st.dIdx++
            if (st.dPhase === 'pre') {
              if (st.dIdx >= frames.pre.length) {
                st.dPhase = 'loop'
                st.dIdx = 0
              }
            } else if (st.dIdx >= frames.loop.length) {
              st.dIdx = 0
            }
          }
          elDrop!.src = (st.dPhase === 'pre' ? frames.pre : frames.loop)[st.dIdx]
        }
      } else {
        // 닫기: end (14fps·1회) → 종료
        st.eAcc += dt
        const dur = 1000 / FPS.end
        let guard = 0
        while (guard++ < 600 && st.eAcc >= dur) {
          st.eAcc -= dur
          st.eIdx++
          if (st.eIdx >= frames.end.length) {
            finish()
            return
          }
        }
        elDrop!.src = frames.end[st.eIdx]
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    closeRef.current = () => {
      if (st.closing) {
        finish()
        return
      }
      if (frames.end.length === 0) {
        finish()
        return
      }
      st.closing = true
      st.eIdx = 0
      st.eAcc = 0
      elScreen!.style.opacity = '0'
      elDrop!.style.opacity = '1'
      if (elItem !== null) elItem.style.opacity = '1'
      elDrop!.src = frames.end[0]
    }

    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      onClick={() => closeRef.current()}
      data-testid="drop-effect-overlay"
      // pointer-events-auto: 시트(vaul/Radix)가 열려 있으면 body에 pointer-events:none이 걸려
      // 상속으로 이 오버레이의 탭이 먹지 않고 뒤 시트로 통과된다(ADR-039). 명시적으로 되살린다.
      // data-sheet-keep-open: 이 오버레이 위 pointerdown이 시트를 dismiss하지 않도록 BottomSheet의
      // onPointerDownOutside 가드가 인식하는 마커(연출 탭이 시트까지 닫아버리는 문제 방지, ADR-039).
      data-sheet-keep-open=""
      className="pointer-events-auto fixed inset-0 z-[70] cursor-pointer overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 50%, #1b0f29, #05010a)' }}
      />
      {/* DropEff: 검은배경 JPEG + screen 블렌드, 아이템 하단 기준 상승 */}
      <img
        ref={dropRef}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 mix-blend-screen"
        style={{
          top: `calc(${ITEM_CENTER_TOP} + ${ITEM_SIZE_PX / 2 + DROP_OFFSET_Y_PX}px)`,
          transform: 'translate(-50%, -100%) scale(1.3)',
          transformOrigin: '50% 100%',
          zIndex: 2,
        }}
      />
      {/* 중앙 아이템(투명 PNG). 바깥=중앙정렬, 중간=부유(translateY 반복), 안쪽 img=팝인(scale) —
          세 transform이 서로 충돌하지 않게 레이어를 나눈다. 8f 시점에 팝인. */}
      {itemUrl !== null && (
        <div
          className="pointer-events-none absolute left-1/2"
          style={{ top: ITEM_CENTER_TOP, transform: 'translate(-50%, -50%)', zIndex: 3 }}
        >
          <div className="fx-drop-float">
            <img
              ref={itemRef}
              src={itemUrl}
              alt={props.itemName}
              className="block h-[72px] w-[72px] object-contain"
              style={{
                opacity: 0,
                transform: 'scale(0.5)',
                transition: 'opacity .35s ease, transform .5s cubic-bezier(.2,1.3,.35,1)',
                filter: 'drop-shadow(0 0 10px rgba(255,214,140,.85))',
              }}
            />
          </div>
        </div>
      )}
      {/* ScreenEff: cover로 화면 채움 + screen 블렌드 */}
      <img
        ref={screenRef}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-screen"
        style={{ zIndex: 4 }}
      />
      <p
        className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs font-semibold text-white/80"
        style={{ zIndex: 5, textShadow: '0 1px 4px rgba(0,0,0,.7)' }}
      >
        화면을 터치하면 닫힙니다
      </p>
    </div>,
    document.body,
  )
}

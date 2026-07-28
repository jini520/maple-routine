import { useEffect, useRef } from 'react'

import { DROP_EFFECT_FRAMES } from '../../lib/drop-effect-frames'
import {
  DROP_EFFECT_ORIGINS,
  DROP_PILLAR_SCALE,
  dropFrameTransform,
  screenEffectScale,
} from '../../lib/drop-effect-layout'
import type { DropEffectPhase } from '../../lib/drop-effect-layout'
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

// 중앙 아이템 세로 위치(값 ↑ = 아래로). DropEff 지면 앵커도 이 값 기준으로 계산한다.
const ITEM_CENTER_TOP = '66%'
const ITEM_SIZE_PX = 72
// DropEff 기둥만 아이템과 무관하게 세로 이동(양수 = 아래로).
const DROP_OFFSET_Y_PX = 8
// 프레임마다 비트맵 크기가 달라 하단-중앙으로는 기둥 축이 최대 26px 흔들린다(ADR-048). src 를 바꿀 땐
// 반드시 그 프레임 origin 에 맞춘 transform 도 같이 갱신해, 앵커에 지면 접점이 오도록 배치한다.
//
// 단 src 교체는 비동기다 — 새 프레임이 아직 안 그려졌는데 transform 만 먼저 옮기면 이전 프레임 픽셀이
// 새 origin 으로 그려져 한 프레임 옆으로 튄다(프레임 크기가 제각각이라 오차가 최대 26px). 그래서 픽셀이
// 준비되기 전엔 좌표도 그대로 두고, 이 함수는 tick 마다 다시 불리므로 준비되는 즉시 함께 제자리를 잡는다.
// 좌표가 아직 없는 프레임을 보여주지 않도록 표시 여부도 여기서 켠다.
function applyDropFrame(el: HTMLImageElement, phase: DropEffectPhase, index: number): void {
  el.src = DROP_EFFECT_FRAMES[phase][index]
  if (!el.complete) return
  el.style.transform = dropFrameTransform(DROP_EFFECT_ORIGINS[phase][index], DROP_PILLAR_SCALE)
  el.style.opacity = '1'
}

// 고가 아이템 드롭 시 전체화면 연출. ScreenEff는 전 프레임 동일 배율로 화면을 채우고, 8프레임 시점에 아이템이
// 등장하며 DropEff(pre→loop ∞)가 아이템 하단에서 올라온다. 화면 탭 → end 재생 후 닫힘.
// 빛 효과는 검은배경 JPEG + mix-blend:screen(가산 합성) — 검정은 투명 처리된다.
export function DropEffectOverlay(props: DropEffectOverlayProps): React.JSX.Element {
  const itemUrl = getItemIconUrl(props.itemName, props.slot)
  const screenRef = useRef<HTMLImageElement>(null)
  const dropRef = useRef<HTMLImageElement>(null)
  const itemRef = useRef<HTMLImageElement>(null)
  const closeRef = useRef<() => void>(() => props.onClose())
  // 디코드해 둔 DropEff 프레임을 붙잡아 둔다(GC 방지). 미리 디코드해야 재생 중 src 교체가 곧바로
  // 반영돼(complete=true) 픽셀과 좌표가 같은 프레임으로 함께 바뀐다 — applyDropFrame 주석 참고.
  const preloadRef = useRef<HTMLImageElement[]>([])

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

    preloadRef.current = [...frames.pre, ...frames.loop, ...frames.end].map((url) => {
      const img = new Image()
      img.src = url
      // decode()가 없는 구형 WebView 는 로드만으로 충분(complete 로 판단). 실패해도 재생은 그대로
      // 진행되고 좌표만 한 tick 늦는다.
      void img.decode?.().catch(() => {})
      return img
    })

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
    elScreen.style.transform = `translate(-50%, -50%) scale(${screenEffectScale(window.innerWidth, window.innerHeight)})`
    elScreen.src = frames.screen[0]
    elDrop.style.opacity = '0'
    if (elItem !== null) elItem.style.opacity = '0'

    function startDrop(): void {
      st.dStarted = true
      st.dPhase = 'pre'
      st.dIdx = 0
      st.dAcc = 0
      applyDropFrame(elDrop!, 'pre', 0) // 표시(opacity)는 첫 프레임 픽셀이 준비될 때 켜진다
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
          applyDropFrame(elDrop!, st.dPhase, st.dIdx)
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
        applyDropFrame(elDrop!, 'end', st.eIdx)
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
      if (elItem !== null) elItem.style.opacity = '1'
      applyDropFrame(elDrop!, 'end', 0)
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
      {/* DropEff: 검은배경 JPEG + screen 블렌드, 아이템 하단 기준 상승.
          left/top 이 기둥의 지면 앵커고, 프레임별 origin 을 그 점에 맞추는 transform 은
          applyDropFrame 이 src 와 함께 매 프레임 갱신한다(ADR-048). */}
      <img
        ref={dropRef}
        alt=""
        aria-hidden="true"
        data-testid="drop-effect-pillar"
        className="pointer-events-none absolute left-1/2 mix-blend-screen"
        style={{
          top: `calc(${ITEM_CENTER_TOP} + ${ITEM_SIZE_PX / 2 + DROP_OFFSET_Y_PX}px)`,
          transformOrigin: '0 0',
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
      {/* ScreenEff: 전 프레임 동일 배율 + screen 블렌드. 크롭이 이미 버스트 원점 기준 중앙이라
          위치는 translate(-50%,-50%)로 충분하고, 배율만 고정하면 된다(ADR-048 결정 5).
          max-w-none: preflight의 img{max-width:100%}가 큰 프레임을 컨테이너 폭으로 줄여 배율을 깬다. */}
      <img
        ref={screenRef}
        alt=""
        aria-hidden="true"
        data-testid="drop-effect-screen"
        className="pointer-events-none absolute top-1/2 left-1/2 max-w-none mix-blend-screen"
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

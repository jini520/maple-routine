// 임시 계측 도구 — 아코디언 접기 프레임을 실기기에서 재기 위한 것([[ADR-084]] 후속).
//
// 왜 필요한가: 1.0.41의 처방(페인트 전 스크롤 클램프)이 실기기에서 무효였고, 최상단에서는 재현되지
// 않는다(= 스크롤은 여전히 필요조건). 남은 갈림길은 두 개다.
//   (A) JS가 보는 레이아웃이 이미 깨져 있다 — 어느 프레임에 hdr(페이지 헤더 top)이 음수로 찍힌다.
//   (B) 레이아웃은 내내 멀쩡한데 화면만 깨진다 — hdr이 0에서 변하지 않는데도 헤더가 사라져 보인다.
//       그러면 원인은 컴포지터/스크롤 스레드이고, JS에서 스크롤을 만지는 어떤 처방도 통하지 않는다.
//
// rAF 콜백은 그 프레임이 그려지기 직전에 돌므로, 여기서 잰 값이 "그 프레임의 레이아웃"이다.
// 원인이 확정되면 이 파일과 호출부(BossProfitScreen의 data-probe·onPointerDown·오버레이)를 함께 지운다.
import { useState, useSyncExternalStore } from 'react'

interface ProbeFrame {
  i: number
  t: number
  y: number
  doc: number
  vh: number
  hdr: number | null
  card: number | null
  note?: string
}

interface ProbeSnapshot {
  label: string
  frames: ProbeFrame[]
  done: boolean
}

const FRAME_COUNT = 45

let snapshot: ProbeSnapshot = { label: '', frames: [], done: true }
let running = false
let startedAt = 0
const listeners = new Set<() => void>()

function publish(next: ProbeSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 클램프처럼 "프레임 사이에 일어난 일"을 같은 타임라인에 끼워 넣는다. */
export function noteProbe(note: string): void {
  if (!running) return
  snapshot.frames.push({
    i: -1,
    t: Math.round(performance.now() - startedAt),
    y: Math.round(window.scrollY),
    doc: Math.round(document.documentElement.scrollHeight),
    vh: Math.round(window.innerHeight),
    hdr: null,
    card: null,
    note,
  })
}

/** 접기 탭(pointerdown)에서 부른다 — 상태가 바뀌기 전 프레임부터 잡아야 비교가 된다. */
export function startProbe(label: string, getCard: () => HTMLElement | null): void {
  if (running) return
  running = true
  startedAt = performance.now()
  const frames: ProbeFrame[] = []
  publish({ label, frames, done: false })

  let i = 0
  const tick = (): void => {
    const header = document.querySelector('[data-probe="page-header"]')
    const card = getCard()
    frames.push({
      i,
      t: Math.round(performance.now() - startedAt),
      y: Math.round(window.scrollY),
      doc: Math.round(document.documentElement.scrollHeight),
      vh: Math.round(window.innerHeight),
      hdr: header === null ? null : Math.round(header.getBoundingClientRect().top),
      card: card === null ? null : Math.round(card.getBoundingClientRect().top),
    })
    i += 1
    if (i < FRAME_COUNT) {
      requestAnimationFrame(tick)
      return
    }
    running = false
    publish({ label, frames, done: true })
    // Safari 웹 인스펙터를 붙일 수 있을 때를 위해 콘솔에도 남긴다.
    console.log(`[COLLAPSE] ${label}\n` + frames.map(formatFrame).join('\n'))
  }
  requestAnimationFrame(tick)
}

function formatFrame(frame: ProbeFrame): string {
  if (frame.note !== undefined) return `-- +${frame.t} ${frame.note}`
  return `${String(frame.i).padStart(2, '0')} +${frame.t} y${frame.y} d${frame.doc} v${frame.vh} h${frame.hdr} c${frame.card}`
}

function getSnapshot(): ProbeSnapshot {
  return snapshot
}

/**
 * 계측 결과를 화면에 띄운다 — 실기기에서 콘솔을 못 볼 때 스크린샷 한 장으로 넘길 수 있어야 한다.
 * 프레임 캡처가 **끝난 뒤에만** 마운트되므로, 관측 대상 프레임에는 이 오버레이가 존재하지 않는다.
 */
export function CollapseProbeOverlay(): React.JSX.Element | null {
  const probe = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [dismissedLabel, setDismissedLabel] = useState<string | null>(null)

  if (!probe.done || probe.frames.length === 0 || probe.label === dismissedLabel) return null

  const layoutFrames = probe.frames.filter((frame) => frame.note === undefined)
  const brokenHeader = layoutFrames.filter((frame) => frame.hdr !== null && frame.hdr !== 0)
  const docHeights = [...new Set(layoutFrames.map((frame) => frame.doc))]
  // 헤더(fixed 라 항상 0이어야 한다)와 카드 top(페이지 전체가 옛 오프셋으로 그려지면 함께 튄다)을
  // 같이 본다 — ADR-085 의 두 결정이 각각 무엇을 막았는지 이 두 줄로 갈린다.
  const cardTops = [...new Set(layoutFrames.map((frame) => frame.card))]
  const verdict =
    brokenHeader.length > 0
      ? `헤더 어긋난 프레임 ${brokenHeader.length}개 (hdr 최소 ${Math.min(...brokenHeader.map((f) => f.hdr ?? 0))})`
      : '헤더 내내 제자리(hdr=0)'

  return (
    <div className="fixed inset-x-2 bottom-[calc(4.5rem+var(--sa-bottom))] z-[80] max-h-[45vh] overflow-auto rounded-lg bg-black/85 p-2 font-mono text-[9px] leading-[11px] text-white">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold">{probe.label}</span>
        <button type="button" className="rounded bg-white/20 px-2 py-0.5" onClick={() => setDismissedLabel(probe.label)}>
          닫기
        </button>
      </div>
      <div className="mb-1 text-[10px] font-bold text-yellow-300">{verdict}</div>
      <div className="mb-1 text-white/70">
        doc: {docHeights.join(' → ')} · card: {cardTops.join(' → ')}
      </div>
      <pre className="whitespace-pre">{probe.frames.map(formatFrame).join('\n')}</pre>
    </div>
  )
}

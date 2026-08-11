// 드롭 판매가 입력 키패드(#185 조건 4).
//
// **OS 키보드를 부르지 않는다.** 메소는 자릿수가 커서 시스템 숫자 키패드로는 0을 세게 되고, 키보드가
// 뜨는 순간 WebView 가 줄어(iOS `resize:native` · 안드로이드 컨테이너 패딩) 시트가 밀리거나 잘린다.
// 앱이 자기 키패드를 그리면 뷰포트가 그대로라 **보정할 것이 애초에 없다** — 간섭을 다루는 대신
// 발생시키지 않는 쪽이다.
//
// 층은 위에서 아래로 금액 → 단위 칩 → 분배 → 키패드 → 동작이고, 강조색(primary)은 저장 버튼
// 하나에만 쓴다. 키는 테두리 없이 누를 때만 `surface-2` 가 든다.

import { useState } from 'react'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { formatMesoUnits } from '../../lib/drop-price'
import { getItemIconUrl } from '../../lib/item-icons'
import type { BossDifficulty } from '@core/types'
import type { RecordedDrop } from '@core/types/drops'

/** 자릿수 상한 — 조 단위를 넘기면 `Number` 정밀도가 아니라 화면이 먼저 깨진다. */
const MAX_MESO = 9_999_999_999_999

/**
 * 금액 바로 아래 붙는 단위 칩. 자릿수 세기를 없애는 것이 이 줄의 전부다.
 *
 * 100만에서 100억까지 **10배씩** 오른다 — 칩 다섯이 곧 자릿수 눈금이라 원하는 단위를 세지 않고
 * 짚을 수 있다. 칠흑 마크처럼 100억을 넘기는 값도 두세 번이면 닿는다.
 */
const QUICK_ADDS = [
  { label: '+100만', value: 1_000_000 },
  { label: '+1000만', value: 10_000_000 },
  { label: '+1억', value: 100_000_000 },
  { label: '+10억', value: 1_000_000_000 },
  { label: '+100억', value: 10_000_000_000 },
] as const

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const

export interface DropPricePadProps {
  drop: RecordedDrop
  boss: string
  difficulty: BossDifficulty
  characterName: string
  /** 분배 인원 기본값 — 그 행의 파티원 수(사용자 결정). 저장하면 이 값과 무관해진다. */
  defaultShare: number
  maxShare: number
  /** 순차 모드의 진행 표기(`3 / 6`). 단건 편집이면 넘기지 않는다. */
  progress?: { current: number; total: number }
  onSave: (priceMeso: number, share: number) => void
  /** **기록 안함** — "이 아이템은 값을 매길 만하지 않다"는 결정을 저장한다. */
  onExclude: () => void
  /**
   * **스킵** — 아직 안 팔렸으니 미입력으로 두고 다음으로. **아무것도 저장하지 않는다**
   * (사용자 지정 2026-08-10). 순차 모드에서만 준다 — 단건 편집은 닫으면 같은 일이 된다.
   */
  onLater?: () => void
}

/**
 * 키패드 **본문**. 시트 껍데기를 두르지 않는다 — 두 자리에서 쓰이기 때문이다.
 *
 * ① 가격 기록 화면에서는 아래 `DropPricePad` 가 `BottomSheet` 로 감싸 띄우고,
 * ② 드롭 입력 시트 안에서는 **상자 드릴다운(`BoxDrillDown`)과 같은 방식**으로 시트 내용을 갈아
 *    끼운다. 시트를 닫고 새 시트를 여는 대신 드릴다운으로 들어가는 이유는, 가격을 매긴 뒤
 *    **하던 작업(다른 아이템 고르기)을 이어서** 해야 하기 때문이다(2026-08-10 반려 사항 2).
 *
 * `onBack` 이 있으면 드릴다운 모드다 — 상단에 뒤로 버튼이 생기고 안전영역 패딩을 넣지 않는다
 * (감싼 시트가 이미 넣는다).
 */
export function DropPricePadContent(props: DropPricePadProps & { onBack?: () => void }): React.JSX.Element {
  const [meso, setMeso] = useState(props.drop.priceMeso ?? 0)
  const [share, setShare] = useState(props.drop.priceShare ?? props.defaultShare)

  // **대상이 바뀌면 값을 그 아이템의 것으로 되돌린다.** 시트 드릴다운과 순차 모드는 컴포넌트를
  // 언마운트하지 않고 `drop` 만 갈아 끼우므로, 두지 않으면 앞 아이템에 치던 금액과 인원이 그대로
  // 남아 다음 아이템에 얹힌다. 인원은 **그 행의 파티원 수**(`defaultShare`)로 돌아간다.
  //
  // 렌더 중 setState 는 React 가 권하는 "프롭 변화에 상태 맞추기" 패턴이다 — effect 로 하면 옛
  // 값으로 한 프레임 그려진 뒤 덮인다.
  const identity = `${props.drop.boxOrigin ?? ''}|${props.drop.itemName}|${props.drop.ringLevel ?? ''}`
  const [lastIdentity, setLastIdentity] = useState(identity)
  if (lastIdentity !== identity) {
    setLastIdentity(identity)
    setMeso(props.drop.priceMeso ?? 0)
    setShare(props.drop.priceShare ?? props.defaultShare)
  }

  const iconUrl = getItemIconUrl(props.drop.itemName, props.drop.slot)
  const perPerson = share > 1 ? Math.floor(meso / share) : 0

  function pressKey(key: (typeof KEYS)[number]): void {
    if (key === 'del') {
      setMeso((prev) => Math.floor(prev / 10))
      return
    }
    setMeso((prev) => {
      const next = Number(`${prev}${key}`)
      return Number.isFinite(next) && next <= MAX_MESO ? next : prev
    })
  }

  return (
    <div>
      <div className="px-5">
        <div className="flex items-center gap-2.5">
          {props.onBack !== undefined && (
            <button
              type="button"
              onClick={props.onBack}
              aria-label="뒤로"
              className="-ml-2 flex-none text-text"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
          {iconUrl !== null ? (
            <img src={iconUrl} alt="" className="h-9 w-9 flex-none object-contain" />
          ) : (
            <span className="h-9 w-9 flex-none rounded-lg border border-border bg-surface-2" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold tracking-[-.012em] text-text">
              {props.drop.itemName}
              {props.drop.ringLevel !== undefined && ` ${props.drop.ringLevel}레벨`}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
              <DifficultyBadge difficulty={props.difficulty} />
              <span className="truncate">
                {props.boss} · {props.characterName}
              </span>
            </p>
          </div>
          {props.progress !== undefined && (
            <span className="flex-none text-xs font-bold tabular-nums text-text-muted">
              {props.progress.current} / {props.progress.total}
            </span>
          )}
        </div>

        {/* 금액 — **자릿수 전체가 주 표기다**(2026-08-10 정정). 억/만으로 접어 보여줬더니 한 자를
            칠 때마다 `3억` → `32억` → `3억 2,000만` 처럼 단위가 갈아엎여 지금 무엇을 치고 있는지
            읽히지 않았다. 원시 표기는 왼쪽으로 자라기만 하므로 흔들림이 없고, 앱의 다른 금액 표기와도
            같다([[ADR-046]]). 억/만 환산은 자릿수를 눈으로 세지 않게 해 주는 값이라 **보조 줄로**
            남긴다 — 작고 아래에 있으면 갈아엎여도 시선을 흔들지 않는다. */}
        {/* 초기화는 **금액 왼쪽**이다(2026-08-10 사용자 요청). 키패드 자리를 뺏지 않고(⌫ 는 한 자씩
            지우는 별개 동작이라 남는다), 고칠 대상인 숫자 바로 옆이라 겨냥이 자명하다. 값이 0이면
            지울 것이 없으므로 `invisible` 로 **자리만 지킨다** — 없애면 금액이 좌우로 흔들린다. */}
        <div className="mt-5 flex items-center justify-end gap-1.5 border-b border-border pb-1.5">
          <button
            type="button"
            onClick={() => setMeso(0)}
            aria-label="가격 초기화"
            className={`mr-auto flex h-7 items-center gap-1 rounded-full border border-border px-2.5 text-[11px] font-semibold text-text-muted active:bg-surface-2 ${
              meso === 0 ? 'invisible' : ''
            }`}
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            초기화
          </button>
          <span
            data-testid="drop-price-amount"
            className={`text-[32px] font-bold leading-none tracking-[-.03em] tabular-nums ${
              meso === 0 ? 'text-text-disabled' : 'text-text'
            }`}
          >
            {meso.toLocaleString()}
          </span>
          <span className="text-sm font-semibold text-text-muted">메소</span>
        </div>
        {/* 항상 자리를 지킨다 — 0에서 사라지면 첫 타건에 아래가 통째로 밀린다. */}
        <p className="mt-1.5 min-h-4 text-right text-[11px] tabular-nums text-text-muted">
          {meso > 0 ? formatMesoUnits(meso) : ''}
        </p>

        {/* 다섯 개가 390px 한 줄에 들어가도록 여백·글자를 한 단계 줄였다(px-3 → px-2.5,
            xs → 11px). `flex-wrap` 은 안전장치다 — 더 좁은 기기에서는 넘치는 대신 줄을 바꾼다. */}
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {QUICK_ADDS.map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => setMeso((prev) => Math.min(MAX_MESO, prev + quick.value))}
              className="h-7 whitespace-nowrap rounded-full border border-border px-2.5 text-[11px] font-semibold tabular-nums text-text-muted active:bg-surface-2 active:text-text"
            >
              {quick.label}
            </button>
          ))}
        </div>

        {/* 분배 인원 — 스테퍼는 파티 인원 모달과 같은 어휘(ADR-121)를 축소한 것이다. */}
        <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-border pt-3.5">
          <span className="text-xs font-semibold text-text-muted">분배 인원</span>
          <span className="inline-flex h-8 items-center gap-2.5 rounded-full border border-border px-1.5">
            <button
              type="button"
              onClick={() => setShare((prev) => Math.max(1, prev - 1))}
              disabled={share <= 1}
              aria-label="분배 인원 감소"
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[30px] text-center text-[13px] font-semibold tabular-nums text-text">
              {share}인
            </span>
            <button
              type="button"
              onClick={() => setShare((prev) => Math.min(props.maxShare, prev + 1))}
              disabled={share >= props.maxShare}
              aria-label="분배 인원 증가"
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              +
            </button>
          </span>
        </div>
        {/* 높이를 항상 차지한다 — 1인일 때 사라지면 그 줄만큼 키패드가 위아래로 튄다. */}
        <p className="mt-1.5 min-h-4 text-right text-[11px] tabular-nums text-text-muted">
          {meso > 0 && share > 1 ? `1인당 ${perPerson.toLocaleString()} 메소` : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-0.5 px-3 pt-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pressKey(key)}
            aria-label={key === 'del' ? '한 자리 지우기' : key}
            className={
              key === 'del' || key === '00'
                ? 'h-13 rounded-[15px] text-lg font-medium tabular-nums text-text-muted active:bg-surface-2'
                : 'h-13 rounded-[15px] text-[23px] font-medium tracking-[-.015em] tabular-nums text-text active:bg-surface-2'
            }
          >
            {key === 'del' ? '⌫' : key}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 pt-1.5 pb-[calc(1.25rem+var(--sa-bottom))]">
        {/* **기록 안함**은 "값이 없다"가 아니라 "값을 매기지 않기로 했다"는 결정이라 저장과 같은
            층에 선다. **스킵**은 그 옆의 글자 버튼이다 — 아무것도 저장하지 않고 다음으로만 가므로
            테두리를 주면 결정처럼 보인다. */}
        <button
          type="button"
          onClick={props.onExclude}
          className="h-[46px] flex-none rounded-full border border-border px-4 text-sm font-semibold text-text-muted"
        >
          기록 안함
        </button>
        {props.onLater !== undefined && (
          <button
            type="button"
            onClick={props.onLater}
            className="h-[46px] flex-none px-2 text-sm font-semibold text-text-muted"
          >
            스킵
          </button>
        )}
        <button
          type="button"
          onClick={() => props.onSave(meso, share)}
          disabled={meso === 0}
          className="h-[46px] flex-1 rounded-full bg-primary text-[15px] font-bold text-on-primary disabled:opacity-40"
        >
          {props.progress !== undefined ? '다음' : '저장'}
        </button>
      </div>
    </div>
  )
}

/** 가격 기록 화면에서 띄우는 단독 시트. 드롭 입력 시트 안에서는 위 본문을 드릴다운으로 쓴다. */
export function DropPricePad(props: DropPricePadProps & { onClose: () => void }): React.JSX.Element {
  return (
    <BottomSheet onClose={props.onClose} testId="drop-price-pad">
      <DropPricePadContent {...props} />
    </BottomSheet>
  )
}

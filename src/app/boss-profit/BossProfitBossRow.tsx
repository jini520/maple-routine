// 보스 한 줄과 그 줄의 **드롭 표시**(ADR-094 결정 7로 화면에서 분리).
//
// 파티원 수 조절, 드롭 기록 시트 열기, 획득 아이템 아이콘 스택이 여기 산다. 아코디언을 펼쳤을 때
// 카드 안에 나열되는 단위이고, 자기 행 안에서 끝나 카드의 sticky 헤더와는 무관하다.

import type { BossProfitRow } from '../../features/boss-profit/store'
import { AnimatedMeso } from '../../components/atoms/AnimatedMeso/AnimatedMeso'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { useToastStore } from '../../features/toast/store'
import { getItemIconUrl } from '../../lib/item-icons'
import type { RecordedDrop } from '../../types/drops'
import { BossDropSheet } from './BossDropSheet'
import { useBossProfitContext } from './boss-profit-context'
import { clamp, findPortraitSlug } from './character-groups'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { isValuableDrop } from '../../lib/valuable-drops'

// BossPortrait의 size prop 기본값(40px, 기존 h-10 관례)과 동일하게 시작값을 맞춘다 —
// /debug/boss-portrait-size에서 이 값을 조정해보고 확정되면 여기 상수만 바꾸면 된다.
export const BOSS_PORTRAIT_SIZE = 40

export interface BossProfitBossRowProps {
  row: BossProfitRow
  drops: RecordedDrop[]
}
// 접힌 보스 행의 이름 라인 오른쪽에 붙는 드롭 지시자(ADR-038). 있으면 아이콘 스택+개수, 없으면
// "＋ 드롭 추가" 칩. 상자 결과는 실제 나온 아이템(반지 등) 아이콘으로 뜬다.
export function DropIndicator(props: { drops: RecordedDrop[] }): React.JSX.Element {
  if (props.drops.length === 0) {
    // 아이콘 스택(h-6)과 같은 슬롯이라 높이도 h-6으로 맞춘다(ADR-049) — py로 높이를 만들면
    // text-[11px]의 line-height(font 의존)가 그대로 행 높이에 실려 드롭 유무로 행이 튄다.
    return (
      <span className="ml-auto inline-flex h-6 flex-none items-center rounded-full border border-dashed border-primary bg-primary-tint px-2.5 text-[11px] font-bold text-primary-ink">
        ＋ 드롭 추가
      </span>
    )
  }

  const shown = props.drops.slice(0, 3)
  const extra = props.drops.length - shown.length

  return (
    <span className="ml-auto flex flex-none items-center">
      {shown.map((drop, index) => {
        const url = getItemIconUrl(drop.itemName, drop.slot)
        return (
          <span
            key={`${drop.itemName}-${index}`}
            className="relative h-6 w-6 flex-none"
            style={{ marginLeft: index === 0 ? 0 : -2, zIndex: shown.length - index }}
          >
            {url !== null ? (
              <img src={url} alt="" className="h-6 w-6 object-contain" />
            ) : (
              <span className="block h-6 w-6 rounded-md border-[1.5px] border-surface bg-surface-2" />
            )}
            {/* 특수 스킬 반지(반지 상자 드릴다운 결과, ADR-041)만 등급이 기록된다 — 드롭 시트
                ItemThumb의 lv 뱃지와 같은 규칙. 아이콘이 24px(시트는 36px)이라 좌우 패딩만 줄였다.
                absolute라 이름 줄의 h-6 고정(ADR-049)에는 영향을 주지 않는다. */}
            {drop.ringLevel !== undefined && (
              <span className="absolute -bottom-1 -right-0.5 rounded-full bg-primary px-0.5 py-px text-[8px] font-bold leading-none text-on-primary ring-1 ring-bg">
                lv{drop.ringLevel}
              </span>
            )}
          </span>
        )
      })}
      {extra > 0 && (
        <span
          className="relative grid h-6 w-6 place-items-center rounded-md border-[1.5px] border-surface bg-surface-2 text-[10px] font-bold text-text-muted"
          style={{ marginLeft: -2, zIndex: 0 }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}

export function BossProfitBossRow(props: BossProfitBossRowProps): React.JSX.Element {
  const { row } = props
  const { setPartySize, setBossDrops } = useBossProfitContext()
  const [isDropSheetOpen, setIsDropSheetOpen] = useState(false)
  // 이 보스에서 고가 아이템을 획득했으면 행 배경에 골드 셰인이 흐르는 강조 효과(valuable-drop-row)를 준다
  // — 캐릭터 카드를 펼쳤을 때 카드 테두리 효과 대신 실제 획득한 보스 행으로 강조가 이동하는 지점(사용자 요청).
  const hasValuableDrop = props.drops.some((drop) => isValuableDrop(drop.itemName))
  const isPriceUnknown = row.priceMeso === null
  // 미완료(보스 스케줄러에 등록만 되고 아직 처치 전) placeholder는 파티원 수를 조정해도 의미가
  // 없다 — 계산은 항상 0메소로 고정된다(ADR-032). "가격 미확정"과 동일한 비활성 처리를 재사용한다.
  const isEditable = row.isComplete && !isPriceUnknown
  const partySize = row.partySize ?? 1

  // ADR-063: 예외 메시지를 그대로 렌더하던 인라인 문단을 걷어내고 토스트로 알린다 — 개발자용
  // 문구('setPartySize: …')와 SQLite 네이티브 원문이 사용자에게 새던 유일한 자리였다. 문구는
  // 보스 관리 화면(BossManageScreen)과 같아 두 경로가 통일된다.
  async function handleChange(delta: number): Promise<void> {
    const next = clamp(partySize + delta, 1, row.maxPartySize)
    try {
      await setPartySize(row, next)
    } catch {
      useToastStore.getState().showError('파티원 수를 저장하지 못했습니다')
    }
  }

  return (
    // 마지막 행도 테두리 "박스"는 남기고 색만 지운다(last:border-b-transparent, ADR-049) —
    // last:border-b-0이면 그 행만 1px 짧아진다. 배경은 border-box 기준이라 valuable-drop-row의
    // 골드 배경이 투명 테두리 자리도 그대로 채운다(시각 변화 없음).
    <li
      className={`flex items-start gap-3 p-4 border-b border-border last:border-b-transparent${
        hasValuableDrop ? ' valuable-drop-row' : ''
      }`}
    >
      <BossPortrait portraitSlug={findPortraitSlug(row.boss)} label={row.boss} size={BOSS_PORTRAIT_SIZE} />

      <div className="flex-1 min-w-0">
        {/* 이름 라인 전체가 드롭 시트 열기 버튼(ADR-038). 파티 스테퍼는 아래 줄이라 탭 충돌 없음. */}
        <button
          type="button"
          onClick={() => setIsDropSheetOpen(true)}
          aria-label={`${row.boss} ${row.difficulty} 드롭 아이템 관리`}
          // h-6 고정(ADR-049) — 자식(난이도 뱃지 20px · 보스명 20px · 드롭 지시자 24px) 중 최대값에
          // 높이를 맡기면 지시자 종류가 바뀔 때마다 행 높이가 흔들린다.
          className="flex h-6 w-full items-center gap-1.5 text-left"
        >
          <DifficultyBadge difficulty={row.difficulty} />
          <span className="truncate text-sm font-semibold text-text">{row.boss}</span>
          <DropIndicator drops={props.drops} />
        </button>

        <div className="flex items-center justify-between gap-2 mt-2">
          <div
            className={
              isEditable
                ? 'inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5'
                : 'inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5 opacity-40'
            }
          >
            <button
              type="button"
              onClick={() => handleChange(-1)}
              disabled={!isEditable || partySize <= 1}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 감소`}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              <Minus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="text-xs tabular-nums text-text">{partySize}</span>
            <button
              type="button"
              onClick={() => handleChange(1)}
              disabled={!isEditable || partySize >= row.maxPartySize}
              aria-label={`${row.characterName} ${row.boss} ${row.difficulty} 파티원 수 증가`}
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-2 text-text disabled:opacity-40"
            >
              <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {!row.isComplete ? (
            <span className="inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
              미완료
            </span>
          ) : isPriceUnknown ? (
            <span className="inline-block rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-ink">
              가격 미확정
            </span>
          ) : (
            <span className="text-sm font-semibold text-text tabular-nums">
              <AnimatedMeso
                identity={`boss|${row.ocid}|${row.boss}|${row.difficulty}|${row.periodKey}`}
                value={row.payoutMeso ?? 0}
              />{' '}
              메소
            </span>
          )}
        </div>

      </div>

      {isDropSheetOpen && (
        <BossDropSheet
          boss={row.boss}
          difficulty={row.difficulty}
          isComplete={row.isComplete}
          initialDrops={props.drops}
          onSave={(drops) => setBossDrops(row, drops)}
          onClose={() => setIsDropSheetOpen(false)}
        />
      )}
    </li>
  )
}

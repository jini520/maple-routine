// 가격 기록 화면 — 보스 수익의 하위 스택 화면(#185). 라우트 `/profit/prices`.
//
// 히스토리(`/profit/drops`)와 형제이고 같은 셸을 쓴다. 축이 다르다 — 히스토리는 **전 기간**을 한
// 목록에 펼치는 읽기 전용이고, 여기는 **한 주**를 놓고 값을 매기는 쓰기 화면이다.
//
// 뼈대는 주차 → 캐릭터 → 기록이다. 캐릭터로 한 번 묶는 이유는 가격이 기록 단위이기 때문이다 —
// 같은 아이템도 캐릭터마다 판 값이 다를 수 있고, 그 차이가 곧 캐릭터별 수익의 차이가 된다.
//
// **이 컴포넌트는 표시 전용이다.** 주차 이동·저장은 전부 프롭으로 올라간다. 스토어를 직접 물면
// 시안 단계에서 화면을 볼 수 없고, 나중에도 이 화면의 렌더를 스토어 없이 테스트할 수 없다.

import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react'
import { StackScreen } from '../../components/templates/StackScreen/StackScreen'
import { avatarFaceCropStyle } from './CharacterAvatar'
import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ProfitIcon } from '../../components/atoms/ProfitIcon/ProfitIcon'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { DropPricePad } from './DropPricePad'
import { useBossProfitStore } from '../../features/boss-profit/store'
import { useDropPriceStore } from '../../features/boss-profit/drop-price-store'
import { useToastStore } from '../../features/toast/store'
import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '../../lib/boss-crystal-prices'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  isEarliestNavigablePeriod,
  isLatestPeriod,
} from '../../lib/boss-profit-period'
import { useStackBack } from '../../lib/use-stack-back'
import { formatMesoShort } from '../../lib/boss-profit-delta'
import { dropPayoutMeso } from '../../lib/drop-price'
import { getItemIconUrl } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import type { DropPriceEntry, DropPriceGroup } from '../../features/boss-profit/drop-price-store'
import type { RecordedDrop } from '@core/types/drops'

const PARENT_PATH = '/profit'

function characterTotal(group: DropPriceGroup): number {
  return group.entries.reduce((sum, entry) => sum + dropPayoutMeso(entry.drop), 0)
}

/** 상태 pill — 세 상태를 색이 아니라 **형태**로 가른다(점선 / 채움 / 회색). */
function PriceStatePill(props: { drop: RecordedDrop }): React.JSX.Element {
  const { drop } = props
  // 칩 안에서는 접는다 — 10자리 원시 표기가 들어가면 금액이 행을 밀어낸다(`formatMesoShort` 의 존재 이유).
  if (drop.priceState === 'entered') {
    return (
      <span className="inline-flex h-[26px] flex-none items-center rounded-full bg-primary-tint px-2.5 text-[12.5px] font-bold tabular-nums text-primary-ink">
        {formatMesoShort(drop.priceMeso ?? 0)}
      </span>
    )
  }
  if (drop.priceState === 'excluded') {
    return (
      <span className="inline-flex h-[26px] flex-none items-center rounded-full bg-surface-2 px-2.5 text-[12.5px] font-semibold text-text-disabled">
        기록 안함
      </span>
    )
  }
  return (
    <span className="inline-flex h-[26px] flex-none items-center rounded-full border border-dashed border-border px-2.5 text-[12.5px] font-semibold text-text-disabled">
      입력
    </span>
  )
}

function EntryRow(props: { entry: DropPriceEntry; onSelect: () => void }): React.JSX.Element {
  const { drop } = props.entry
  const iconUrl = getItemIconUrl(drop.itemName, drop.slot)
  // 상자명(`boxOrigin`)은 쓰지 않는다(2026-08-10 사용자 지정) — 반지 상자·칠흑 장신구 상자는
  // 이름이 길어 실제 정보인 아이템명과 보스를 밀어낸다. 무엇을 열었는지는 히스토리가 말한다.
  const shareLabel = drop.priceState === 'entered' ? ` · ${drop.priceShare ?? 1}인` : ''

  return (
    <li className={isValuableDrop(drop.itemName) ? 'valuable-drop-row' : undefined}>
      {/* 행 전체가 버튼이다 — 입력이든 수정이든 같은 자리를 누른다(조건 5). */}
      <button
        type="button"
        onClick={props.onSelect}
        className="flex w-full items-center gap-3 border-b border-border p-4 text-left last:border-b-transparent"
      >
        {iconUrl !== null ? (
          <img src={iconUrl} alt="" className="h-8 w-8 flex-none object-contain" />
        ) : (
          <span className="h-8 w-8 flex-none rounded-md border border-border bg-surface-2" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-text">
              {drop.itemName}
              {drop.ringLevel !== undefined && ` ${drop.ringLevel}레벨`}
            </span>
            {drop.quantity > 1 && (
              <span className="flex-none text-[11px] tabular-nums text-text-muted">×{drop.quantity}</span>
            )}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
            <DifficultyBadge difficulty={props.entry.difficulty} />
            <span className="truncate">
              {props.entry.boss}
              {shareLabel}
            </span>
          </span>
        </span>
        <PriceStatePill drop={drop} />
      </button>
    </li>
  )
}

/**
 * 이 화면은 **보스 수익에서 보던 기간을 통째로 이어받는다**([[ADR-124]] 결정 8) — 주기까지 함께다.
 *
 * 처음엔 주 단위로만 열었는데, 그러면 **월간 보스(검은마법사) 드롭에 닿을 길이 없다**
 * (사용자 보고 2026-08-10): 그 기록의 `period_key` 는 `YYYY-MM` 이라 어느 주차 조회에도 안 걸린다.
 * 드롭 시트에서 기록 직후에는 값을 매길 수 있지만 "나중에"를 누르면 되돌아갈 자리가 없었다.
 */

export function DropPriceScreen(): React.JSX.Element {
  const goBack = useStackBack(PARENT_PATH)
  const { tab, periodKey: profitPeriodKey } = useBossProfitStore()
  const { status, groups, load, savePrice, excludePrice } = useDropPriceStore()

  // 화면이 한 번만 만든 '지금' — 두 번 부르면 기간 경계를 사이에 두고 갈릴 수 있다
  // (보스 수익 화면과 같은 규약).
  const [now] = useState(() => new Date())
  const [cycle] = useState(tab)
  const [week, setWeek] = useState(profitPeriodKey)
  const [pricing, setPricing] = useState<DropPriceEntry | null>(null)
  // 순차 모드에서 남은 미입력 건. 비어 있으면 단건 편집이다.
  const [queue, setQueue] = useState<DropPriceEntry[]>([])

  useEffect(() => {
    void load(week)
  }, [load, week])

  const allEntries = groups.flatMap((group) => group.entries)
  const total = allEntries.reduce((sum, entry) => sum + dropPayoutMeso(entry.drop), 0)
  const entered = allEntries.filter((entry) => entry.drop.priceState === 'entered').length
  const excluded = allEntries.filter((entry) => entry.drop.priceState === 'excluded').length
  const unpriced = allEntries.length - entered - excluded
  const periodLabel = formatBossProfitPeriodLabel(cycle, week, now)

  // 미입력만 골라 순차로 돈다. 첫 건을 열고 나머지는 큐에 쌓아 저장·스킵마다 하나씩 꺼낸다.
  function startSequence(): void {
    const [first, ...rest] = allEntries.filter((entry) => entry.drop.priceState === undefined)
    if (first === undefined) return
    setQueue(rest)
    setPricing(first)
  }

  /** 저장·스킵 뒤 다음 행동 — 순차 모드면 다음 건, 아니면 닫는다. */
  function advance(): void {
    const [next, ...rest] = queue
    setQueue(rest)
    setPricing(next ?? null)
  }

  async function runWrite(write: () => Promise<void>): Promise<void> {
    try {
      await write()
      advance()
    } catch {
      // 조용히 삼키면 저장된 줄 알고 화면을 떠난다([[ADR-063]] — 예외 원문 대신 토스트).
      useToastStore.getState().showError('가격을 저장하지 못했습니다')
    }
  }

  return (
    <StackScreen
      parentPath={PARENT_PATH}
      scroll={false}
      overlays={
        pricing !== null && (
          <DropPricePad
            drop={pricing.drop}
            boss={pricing.boss}
            difficulty={pricing.difficulty}
            characterName={
              groups.find((group) => group.ocid === pricing.ocid)?.characterName ?? ''
            }
            defaultShare={pricing.partySize}
            maxShare={
              findPriceEntry(pricing.boss, pricing.difficulty)?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE
            }
            progress={
              queue.length > 0 ? { current: unpriced - queue.length, total: unpriced } : undefined
            }
            onSave={(priceMeso, share) => void runWrite(() => savePrice(pricing, priceMeso, share))}
            onExclude={() => void runWrite(() => excludePrice(pricing))}
            // 스킵은 저장하지 않는다 — 미입력에 그대로 두고 다음 건으로만 간다.
            onLater={queue.length > 0 ? advance : undefined}
            onClose={() => {
              setQueue([])
              setPricing(null)
            }}
          />
        )
      }
    >
      <div className="absolute inset-x-0 top-0 bottom-[var(--nav-solid-bottom,0px)] space-y-4 overflow-y-auto overscroll-y-none">
        {/* 히스토리 화면과 같은 sticky 헤더 레시피 — 스크롤 상자가 노치까지 덮으므로 안전영역은
            이 헤더의 pt 가 넣는다. */}
        <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="-ml-2 flex h-9 w-9 items-center justify-center text-text"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <h1 className="text-lg font-semibold text-text">가격 기록</h1>
          </div>
        </div>

        <div className="space-y-4 px-4 pb-[calc(1.5rem+var(--sa-bottom))]">
          {/* 주차 네비게이터 — **보스 수익 화면의 것을 그대로 옮겼다**(같은 h-7 원형 버튼 + 가운데
              2줄 라벨). 이 화면은 그 화면에서 보던 주를 이어받아 열리므로 넘기는 손짓도 같아야 한다. */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setWeek(getAdjacentPeriodKey(cycle, week, 'prev'))}
              disabled={isEarliestNavigablePeriod(cycle, week)}
              aria-label="이전 기간"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="text-center">
              <p className="text-sm font-semibold text-text">{periodLabel.primary}</p>
              <p className="mt-0.5 text-xs text-text-muted tabular-nums">{periodLabel.secondary}</p>
            </div>

            <button
              type="button"
              onClick={() => setWeek(getAdjacentPeriodKey(cycle, week, 'next'))}
              disabled={isLatestPeriod(cycle, week, now)}
              aria-label="다음 기간"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-text disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {status === 'loading' || status === 'idle' ? (
            <LoadingState size="page" message="불러오고 있어요" />
          ) : status === 'failed' ? (
            <ErrorState
              title="가격 기록을 불러오지 못했습니다"
              description="기기에 저장된 기록을 읽지 못했습니다. 다시 시도해주세요."
              action={{ label: '다시 시도', onClick: () => void load(week) }}
            />
          ) : allEntries.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={`${cycle === 'weekly' ? '이 주' : '이 달'}에 기록된 아이템이 없습니다`}
              description="보스 수익에서 아이템을 먼저 기록하면 여기서 값을 매길 수 있습니다"
            />
          ) : (
            <>
              {/* 요약은 **카드가 아니라 헤드라인**이다(B안 채택 2026-08-10) — [[ADR-046]] 이 보스
                  수익 총 수익에 내린 판단이 이 화면에도 그대로 성립한다: 아래가 전부 같은 카드
                  셸이라 요약도 카드면 "흰 카드의 반복"으로 묻힌다. 껍데기를 벗고 아이콘·크기·색
                  으로만 위계를 주면 두 화면의 요약이 같은 어휘가 된다.

                  아래 칩 셋은 **목록의 범례**다 — 생김새가 행의 상태 pill 과 같아(채움 / 회색 /
                  점선) 칩만 봐도 무엇이 몇 개인지 읽힌다. 0인 상태는 칩을 만들지 않는다. */}
              <div>
                <div className="flex h-6 items-center">
                  <p className="text-xs font-semibold tracking-wide text-text-muted">
                    {cycle === 'weekly' ? '이 주' : '이 달'} 아이템 수익
                  </p>
                  <span className="ml-auto text-xs tabular-nums text-text-muted">
                    {entered + excluded} / {allEntries.length} 정함
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-ink">
                    <ProfitIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  {/* 단위 앞의 실제 공백은 남긴다 — 마진만으로 띄우면 `textContent` 가 "N메소"로
                      붙어 스크린리더가 이어 읽는다([[ADR-046]] 규약). */}
                  <p className="text-xl font-extrabold leading-none tabular-nums text-primary-ink">
                    {total.toLocaleString()} <span className="text-xs font-bold text-text-muted">메소</span>
                  </p>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {entered > 0 && (
                    <span className="inline-flex h-6 items-center rounded-full bg-primary-tint px-2.5 text-xs font-bold tabular-nums text-primary-ink">
                      입력 {entered}
                    </span>
                  )}
                  {excluded > 0 && (
                    <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2.5 text-xs font-semibold tabular-nums text-text-disabled">
                      기록 안함 {excluded}
                    </span>
                  )}
                  {unpriced > 0 && (
                    <span className="inline-flex h-6 items-center rounded-full border border-dashed border-border px-2.5 text-xs font-semibold tabular-nums text-text-disabled">
                      미입력 {unpriced}
                    </span>
                  )}
                  {unpriced === 0 && (
                    <span className="text-xs font-semibold text-text-muted">
                      {cycle === 'weekly' ? '이 주는' : '이 달은'} 다 정했습니다
                    </span>
                  )}
                </div>
                <div className="mt-3 h-px bg-border" aria-hidden="true" />
              </div>

              {/* CTA 는 요약 **바로 아래**다 — 목록 끝에 두면 기록이 열 건만 넘어도 손이 닿지 않는다. */}
              {unpriced > 0 && (
                <button
                  type="button"
                  onClick={startSequence}
                  className="w-full rounded-full bg-primary py-3 text-sm font-bold text-on-primary"
                >
                  미입력 {unpriced}건 이어서 입력
                </button>
              )}

              {groups.map((group) => (
                <div
                  key={group.ocid}
                  className="overflow-hidden rounded-[14px] border border-border bg-surface"
                >
                  {/* 캐릭터 머리 — 보스 수익 아코디언 헤더와 같은 짜임(아바타 32 + 이름 + 금액). */}
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-2">
                      {group.imageUrl !== null ? (
                        <img
                          src={group.imageUrl}
                          alt=""
                          className="absolute max-w-none"
                          style={avatarFaceCropStyle()}
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-text">
                          {group.characterName.charAt(0)}
                        </span>
                      )}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold text-text">
                      {group.characterName}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-text">
                      {characterTotal(group).toLocaleString()} 메소
                    </span>
                  </div>
                  <ul>
                    {group.entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} onSelect={() => setPricing(entry)} />
                    ))}
                  </ul>
                </div>
              ))}

            </>
          )}
        </div>
      </div>
    </StackScreen>
  )
}

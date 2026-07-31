import { useState } from 'react'
import { AlertTriangle, Ban, ChevronDown } from 'lucide-react'
import { BossProfitScreen } from './boss-profit/BossProfitScreen'
import { useBossProfitStore, type BossProfitRow } from '../features/boss-profit/store'

// 임시 확인용 화면 — [[ADR-068]] 결정 3(캐릭터 카드 실패 표식) 세 안을 **한 화면에서** 비교한다.
// 사용자 계정에서는 이 상태가 재현되지 않아(조회 불가·동기화 실패 캐릭터가 없다) 눈으로 확인할
// 방법이 없었다. 확정되면 이 파일과 App.tsx의 /debug/issue-badges 라우트를 삭제할 것.
//
// 맨 위 "③ 현재 구현"만 **실제 BossProfitScreen**이다(스토어 액션을 no-op으로 덮어 시드가 지워지지
// 않게 한다). ①·②는 이 파일 안에서 카드 헤더의 실제 클래스 문자열을 그대로 복사한 목업이다 —
// 실물 컴포넌트는 한 번에 한 가지 모양만 렌더할 수 있으므로 비교용으로만 둔다.

function row(overrides: Partial<BossProfitRow>): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '낟낟',
    imageUrl: null,
    world: '엘리시움',
    boss: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    periodKey: '2026-07-30',
    periodLabel: '이번 주',
    priceMeso: 8_080_000,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 8_080_000,
    isComplete: true,
    ...overrides,
  }
}

const noop = async (): Promise<void> => undefined

// 모듈 로드 시점에 심는다 — 화면의 loadTrackedOcids는 비동기라, effect에서 심으면 그 프로미스가
// 나중에 resolve되며 시드를 null로 덮는다(실제로 겪었다). 액션을 먼저 no-op으로 바꿔둬야 한다.
function seed(): void {
  useBossProfitStore.setState({
    loadTrackedOcids: noop,
    refresh: noop,
    retryPeriod: noop,
    status: 'loaded',
    tab: 'weekly',
    periodKey: '2026-07-30',
    trackedOcids: ['ocid-1', 'ocid-2', 'ocid-3', 'ocid-4'],
    lastSyncedAt: new Date().toISOString(),
    periodState: 'recorded',
    canGoPreviousPeriod: true,
    rows: [
      row({ ocid: 'ocid-1', characterName: '낟낟', boss: '자쿰', payoutMeso: 8_080_000 }),
      row({ ocid: 'ocid-1', characterName: '낟낟', boss: '매그너스', difficulty: '하드', payoutMeso: 8_560_000 }),
      row({ ocid: 'ocid-2', characterName: '잠수깨비', payoutMeso: 8_080_000 }),
      row({ ocid: 'ocid-3', characterName: '또삭제될제로', payoutMeso: 0, partySize: null, isComplete: false }),
      row({ ocid: 'ocid-4', characterName: '내옆에최성일', payoutMeso: 4_040_000, partySize: 2 }),
    ],
    // ocid-2: 일시 실패(네트워크) · ocid-3: 영구(400 OPENAPI00003) · ocid-4: 금액이 있는 영구 실패
    characterIssues: { 'ocid-2': 'failed', 'ocid-3': 'unavailable', 'ocid-4': 'unavailable' },
    staleCharacterNames: [],
    weeklySubtotals: [],
    dropsByRowKey: {},
  })
}

// ── ①·② 비교용 목업 (카드 헤더의 실제 클래스를 그대로 옮겼다) ──────────────────
type Issue = 'unavailable' | 'failed' | undefined

const MOCK_CARDS: { name: string; meso: string; issue: Issue }[] = [
  { name: '낟낟', meso: '16,640,000', issue: undefined },
  { name: '잠수깨비', meso: '8,080,000', issue: 'failed' },
  { name: '또삭제될제로', meso: '0', issue: 'unavailable' },
  { name: '내옆에최성일', meso: '4,040,000', issue: 'unavailable' },
]

function LabelBadge(props: { issue: 'unavailable' | 'failed' }): React.JSX.Element {
  const isPermanent = props.issue === 'unavailable'
  return (
    <span
      className={
        isPermanent
          ? 'inline-flex h-5 flex-none items-center gap-1 rounded-full bg-info-tint px-2 text-[11px] font-semibold leading-none text-info-ink'
          : 'inline-flex h-5 flex-none items-center gap-1 rounded-full bg-error-tint px-2 text-[11px] font-semibold leading-none text-error-ink'
      }
    >
      {isPermanent ? (
        <Ban className="h-3 w-3" strokeWidth={2} />
      ) : (
        <AlertTriangle className="h-3 w-3" strokeWidth={2} />
      )}
      {isPermanent ? '조회 불가' : '실패'}
    </span>
  )
}

function MockCardList(props: { hidesMesoOnIssue: boolean }): React.JSX.Element {
  return (
    <div className="space-y-2 px-4">
      {MOCK_CARDS.map((card) => (
        <div key={card.name} className="rounded-[14px] border border-border bg-surface">
          <div className="flex w-full items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-text">
                {card.name.slice(0, 1)}
              </span>
            </span>
            <span className="flex-1 truncate text-left text-sm font-semibold text-text">{card.name}</span>
            {card.issue !== undefined && <LabelBadge issue={card.issue} />}
            {!(props.hidesMesoOnIssue && card.issue !== undefined) && (
              <span className="text-sm font-bold text-text tabular-nums">{card.meso} 메소</span>
            )}
            <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={2} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Section(props: { code: string; title: string; note: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-2 border-t border-border pt-5">
      <div className="px-4">
        <h2 className="text-sm font-bold text-text">
          <span className="text-primary-ink">{props.code}</span> {props.title}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{props.note}</p>
      </div>
      {props.children}
    </section>
  )
}

export function IssueBadgePreview(): React.JSX.Element {
  // 모듈 로드 시점에 부르면 안 된다 — App.tsx가 이 파일을 import하므로 **App 테스트가 통째로 깨졌다**
  // (스토어를 목한 환경에서 setState가 없다). useState의 lazy initializer는 첫 렌더에서 딱 한 번,
  // 자식(BossProfitScreen)이 마운트되기 전에 돌아 loadTrackedOcids가 시드를 덮는 것도 막는다.
  useState(seed)

  return (
    <div className="min-h-screen space-y-5 bg-bg pb-16">
      <div className="border-b border-border bg-surface-2 px-4 py-3">
        <p className="text-xs font-bold text-text">ADR-068 결정 3 — 캐릭터 카드 실패 표식 세 안 (임시)</p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
          낟낟 = 정상 · 잠수깨비 = 일시 실패 · 또삭제될제로 = 조회 불가(금액 0) · 내옆에최성일 = 조회
          불가(금액 있음). ③만 실제 BossProfitScreen이고 ①·②는 같은 클래스로 만든 비교용 목업이다.
        </p>
      </div>

      <Section
        code="③"
        title="아이콘만 + 금액 (현재 구현 · 실물 화면)"
        note="이름·금액·헤드라인 합계가 모두 온전하다. 대가는 원인을 문구로 말하지 않는 것 — 아이콘(⚠/🚫)과 톤(error/info)으로만 갈리고, 스크린리더에는 role=img + aria-label로 전달한다."
      >
        <BossProfitScreen />
      </Section>

      <Section
        code="①"
        title="라벨 배지 + 금액"
        note="원인을 문구로 말하고 금액도 지키는 대신, 캐릭터명이 6자부터 잘린다 — 아래 '내옆에최성일'을 보라. n/12 숫자 표기를 보류한 것과 같은 문제다(ADR-054 정정 7)."
      >
        <MockCardList hidesMesoOnIssue={false} />
      </Section>

      <Section
        code="②"
        title="라벨 배지가 금액을 대체 (원래 시안 A)"
        note="이름이 살아있고 문구로 원인을 말한다. 대가는 헤드라인 합계(28,760,000)와 카드 합(24,720,000)이 어긋나 보이는 것 — 금액은 카드를 펼치면 보스 행에 남아 있다."
      >
        <MockCardList hidesMesoOnIssue />
      </Section>
    </div>
  )
}

// 캐릭터 관리 화면의 **본문**([[ADR-144]] 결정 2) — 설정 하위 페이지와 온보딩 단계가 함께 쓴다.
// 갈리는 것은 머리(← + 제목 vs 제목 블록)와 CTA(닫기/저장 vs 계속하기)뿐이라 그 둘은 화면이 갖는다.
//
//   선택된 캐릭터 4개
//    ⣿ (얼굴) 내옆에최성일   ★ ✕      ← 핸들 + 대표 별 + 빼기
//   ───────────────────────────
//    (얼굴) [스] 스카니아 Lv.294 낟낟 ▾  ← 드롭다운은 **아래 층의 머리**
//   캐릭터 추가        12개 중 7개 표시
//    (얼굴) 달의아이              ＋   ← 같은 카드, 핸들·별 없이
//
// ── 두 층은 같은 카드다 ─────────────────────────────────────────────────────────────
//
// 위(선택됨)와 아래(후보)는 같은 것들의 **두 상태**이지 다른 종류가 아니라 `CharacterRow` 한 벌을
// 쓰고, 가르는 것은 넷이다 — 섹션 라벨 · 구분선 · **왼쪽 핸들의 유무** · **오른쪽 컨트롤**.
// 모양을 갈라 두면 카드가 층을 옮길 때(결정 3) 「다른 물건」으로 보인다.
//
// ── 대기·실패는 **아래 자리에만** 그린다 ────────────────────────────────────────────
//
// 위 층은 로컬 캐시로 그리므로(결정 2 표) 계정을 바꿔도 건드리지 않는다. 아래 자리의 로딩·빈·실패
// 표현은 캐릭터 관리 피커의 정책 그대로다(`docs/features/content-scheduler.md` 「후보 목록 로딩」) —
// 항목이 있으면 지우지 않고 스탈 배너를 얹고([[ADR-062]] 결정 4), 401·429 는 액션 없이 문구만 남긴다
// ([[ADR-114]] 결정 2 · [[ADR-115]] 결정 7 — 화면이 곧 키 입력으로 옮겨간다).
//
// **`place` 가 그 규칙에서 갈리는 유일한 값이다.** 온보딩의 401 은 키 재입력 진입점에 배선하지
// 않으므로(«방금 넣은 키가 나쁘다» 는 뜻이라 폼 자체의 실패다 — [[ADR-115]] "구현하며 정정한 것" 5)
// 화면이 옮겨가지 않는다. 그 자리에 피커 문구(«키 입력 화면으로 이동합니다»)를 그대로 쓰면 **거짓인
// 데다 액션까지 없어** 401 이 하드 잠금이 된다([[ADR-116]] 이 429 에서 없앤 그 얼굴이다). 그래서
// 자리를 프롭으로 받아 `formatRosterError` 에 그대로 넘긴다 — 문구·액션 표는 core 가 계속 갖는다.
//
// ── 「고를 수 있는 계정이 0개」 ──────────────────────────────────────────────────────
//
// 그때는 본문 전체가 빈 상태 + 키 재입력 경로다([[ADR-143]] 결정 10 넷째 줄 — [[ADR-127]] 결정 3 이
// 열린 질문으로 남긴 자리). 「계정 다시 선택」 같은 옛 탈출구는 두지 않는다: 계정을 고르는 단계가
// 없어졌고 출구는 드롭다운이다.
import { Text, View } from 'react-native'

import {
  formatRosterError,
  formatStaleRosterError,
  type RosterErrorPlace,
} from '@core/features/schedule-sync/format'
import { useOnboardingStore } from '@core/features/onboarding/store'

import { MapleSweepSpinner } from '../../atoms/MapleSweepSpinner/MapleSweepSpinner'
import { AddMark } from '../../molecules/CharacterRow/AddMark'
import { CharacterRow } from '../../molecules/CharacterRow/CharacterRow'
import { EmptyState } from '../../molecules/EmptyState/EmptyState'
import { ErrorState } from '../../molecules/ErrorState/ErrorState'
import { StaleBanner } from '../../molecules/ErrorState/StaleBanner'
import { AccountSelect } from '../AccountSelect/AccountSelect'
import { SelectedCharacterList } from './SelectedCharacterList'
import type { CharacterManageController } from './use-character-manage'
import type { ReorderScroll } from './use-reorder-scroll'

export interface CharacterManageBodyProps {
  manage: CharacterManageController
  /**
   * 끌기 중 자동 스크롤이 만질 스크롤 뷰([[ADR-144]] 결정 5) — **화면이 소유한다.**
   *
   * 컨트롤러에 실어 내려보내지 않는 이유는 그 안에 `ref` 가 들어가기 때문이다: 컨트롤러 객체가
   * ref 를 품는 순간 «렌더 중에 ref 를 만졌다» 가 되어(`react-hooks/refs`) 그 객체를 읽는 자리가
   * 전부 걸린다. 스크롤 뷰는 어차피 화면(`ScreenScroll`)의 것이라, 그 짝인 `scrollRef`·`onScroll`
   * 도 화면에 남는 편이 자리에 맞는다.
   */
  scroll: ReorderScroll
  /**
   * 실패 문구·액션이 갈리는 자리(파일 머리) — 설정 하위 페이지는 `'picker'`, 온보딩 단계는
   * `'onboarding'`. 기본값을 두지 않는다: 두 호출부뿐이고, 기본값이 있으면 셋째 호출부가
   * **틀린 자리의 문구를 조용히** 물려받는다.
   */
  place: RosterErrorPlace
}

function Waiting(props: { label: string }): React.JSX.Element {
  return (
    <View
      role="status"
      aria-busy
      aria-label={props.label}
      className="min-h-[120px] flex-1 items-center justify-center"
    >
      <MapleSweepSpinner size={32} className="text-primary" />
    </View>
  )
}

function SectionLabel(props: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-sm font-medium text-text-muted">{props.children}</Text>
}

function Notice(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="min-h-[80px] items-center justify-center px-4">
      <Text className="text-center text-sm text-text-muted">{props.children}</Text>
    </View>
  )
}

/** 아래 층의 목록 자리 — 피커의 `PickerBody` 와 같은 순서로 갈린다. */
function CandidateArea({
  manage,
  place,
}: {
  manage: CharacterManageController
  place: RosterErrorPlace
}): React.JSX.Element {
  // 보여줄 후보 풀이 있으면 실패해도 지우지 않는다([[ADR-062]] 결정 4) — 캐시 stub 이 네트워크보다
  // 먼저 오므로 예열이 끝난 정상 경로에서는 이쪽이 기본 분기다.
  if (manage.selectableCount > 0) {
    const stale = manage.rosterError === null ? null : formatStaleRosterError(manage.rosterError)
    return (
      <>
        {stale !== null && (
          <StaleBanner
            message={stale.message}
            action={
              stale.action === undefined
                ? undefined
                : { label: stale.action.label, onClick: manage.retryRoster }
            }
          />
        )}
        {manage.candidates.length > 0 ? (
          <View testID="character-manage-candidates" className="gap-2">
            {manage.candidates.map((entry) => (
              <CharacterRow
                key={entry.ocid}
                name={entry.name}
                level={entry.level}
                jobClass={entry.jobClass}
                world={entry.world}
                imageUrl={entry.imageUrl}
                // 누르는 것은 **카드 전체**다(결정 3) — `＋` 는 표시일 뿐 버튼이 아니다.
                onPress={() => manage.addCharacter(entry.ocid)}
                trailing={<AddMark />}
              />
            ))}
          </View>
        ) : (
          <Notice>표시할 캐릭터가 없어요</Notice>
        )}
      </>
    )
  }

  if (manage.isRosterLoading) {
    return <Waiting label="캐릭터 목록을 불러오는 중" />
  }

  if (manage.rosterError !== null) {
    const copy = formatRosterError(manage.rosterError, place)
    return (
      <ErrorState
        title={copy.title}
        description={copy.description}
        action={
          copy.action === undefined
            ? undefined
            : { label: copy.action.label, onClick: manage.retryRoster }
        }
      />
    )
  }

  // [[ADR-143]] 결정 10 둘째 줄 — 출구는 **드롭다운이 그대로 위에 있는 것**이라 액션을 두지 않는다.
  return <Notice>이 메이플 ID 의 캐릭터는 모두 조회할 수 없어요</Notice>
}

export function CharacterManageBody({
  manage,
  scroll,
  place,
}: CharacterManageBodyProps): React.JSX.Element {
  // 계정을 하나도 못 고르면 본문 전체가 이 화면이다([[ADR-143]] 결정 10 넷째 줄).
  if (!manage.isAccountsLoading && manage.accountsError === null && manage.accounts.length === 0) {
    return (
      <View testID="character-manage-body">
        <EmptyState
          icon="leaf"
          size="page"
          title="조회되는 캐릭터가 없어요"
          description="이 API 키에 연결된 메이플 ID 를 찾지 못했어요"
          // core 에 «이 키로는 앞으로 갈 수 없다» 를 알리는 진입점이 이것 하나다
          // ([[ADR-115]] 결정 10 · [[ADR-116]] 결정 1) — 확인을 누르면 키 입력 화면으로 간다.
          action={{
            label: 'API 키 다시 입력',
            onClick: () => useOnboardingStore.getState().noticeApiKeyIssue('invalid'),
          }}
        />
      </View>
    )
  }

  return (
    <View testID="character-manage-body" className="gap-4">
      {/* ── 위: 선택됨 (계정 전체) ── */}
      <View testID="character-manage-selected" className="gap-2">
        <SectionLabel>선택된 캐릭터 {manage.selectedOcids.length}개</SectionLabel>
        {/* 행들은 별도 컴포넌트다 — 끌기·자동 스크롤·접근성 액션([[ADR-144]] 결정 5)이 붙고,
            칸 높이를 재려면 **행만 담은 상자**가 필요하다(라벨이 섞이면 잰 값이 틀린다). */}
        <SelectedCharacterList
          views={manage.selectedViews}
          representativeOcid={manage.representativeOcid}
          scroll={scroll}
          onMove={manage.moveCharacter}
          onRemove={manage.removeCharacter}
          onSelectRepresentative={manage.setRepresentative}
        />
      </View>

      <View testID="character-manage-divider" className="h-px bg-border" />

      {/* ── 아래: 고르는 곳 (드롭다운이 고른 계정 하나) ── */}
      <View className="gap-2">
        {manage.isAccountsLoading && manage.accounts.length === 0 ? (
          <Waiting label="메이플 ID 를 불러오는 중" />
        ) : manage.accounts.length === 0 ? (
          // 계정 목록 자체가 실패했다 — 드롭다운도 후보도 세울 수 없어 이 자리 하나로 답한다.
          <AccountsError manage={manage} place={place} />
        ) : (
          <>
            {manage.selectedAccountId !== null && (
              <AccountSelect
                accounts={manage.accounts}
                selectedAccountId={manage.selectedAccountId}
                portraitByAccountId={manage.portraitByAccountId}
                onSelect={manage.selectAccount}
              />
            )}
            {/* 라벨 오른쪽의 «{n}개 중 {m}개 표시» 는 뺐다(사용자 지정 2026-08-17). 그 줄이 답하던
                질문(«왜 12개가 아니라 7개인가»)은 이 화면에서 물을 수 없는 질문이었다 — 안 보이는
                캐릭터가 왜 안 보이는지는 그 숫자로도 알 수 없다. */}
            <SectionLabel>캐릭터 추가</SectionLabel>
            <CandidateArea manage={manage} place={place} />
          </>
        )}
      </View>
    </View>
  )
}

function AccountsError({
  manage,
  place,
}: {
  manage: CharacterManageController
  place: RosterErrorPlace
}): React.JSX.Element {
  // 계정 목록 실패도 로스터 실패와 같은 어휘를 쓴다 — 사용자에게는 «목록을 못 불러왔다» 한 가지다.
  const copy = formatRosterError(manage.accountsError ?? { kind: 'network' }, place)
  return (
    <ErrorState
      title={copy.title}
      description={copy.description}
      action={
        copy.action === undefined
          ? undefined
          : { label: copy.action.label, onClick: manage.retryAccounts }
      }
    />
  )
}

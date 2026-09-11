/**
 * 캐릭터 관리 화면의 본문. 설정 하위 페이지와 온보딩 단계가 함께 쓰는 두 층 목록.
 *
 *   선택된 캐릭터 4개
 *    ⣿ (얼굴) 내옆에최성일   ★ ✕      ← 핸들 + 대표 별 + 빼기
 *
 *    (얼굴) [스] 스카니아 Lv.294 낟낟 ▾  ← 드롭다운은 아래 층의 머리
 *   캐릭터 추가        12개 중 7개 표시
 *    (얼굴) 달의아이              ＋   ← 같은 카드, 핸들·별 없이
 *
 * 지키는 것 셋.
 *
 * ① 두 층이 **같은 카드**(`CharacterRow`)다. 갈리는 것은 섹션 라벨 · 구분선 · 왼쪽 핸들 · 오른쪽
 *    컨트롤 넷뿐이다. 모양을 갈라 두면 카드가 층을 옮길 때 다른 물건으로 보인다.
 * ② 대기·실패는 **아래 자리에만** 그린다. 위 층은 로컬 캐시로 그려서 계정을 바꿔도 안 건드린다.
 * ③ 401 문구가 `place` 로 갈린다. 캐릭터 설정 화면은 키 입력으로 안 옮겨가므로 피커 문구
 *    (`키 입력 화면으로 이동합니다`)를 쓰면 거짓인 데다 액션까지 없어 하드 잠금이 된다.
 */
import { View } from 'react-native'
import type { ScrollView } from 'react-native'
import type { AnimatedRef } from 'react-native-reanimated'

import {
  formatRosterError,
  formatStaleRosterError,
  type RosterErrorPlace,
} from '../../../features/schedule-sync/format'
import { useAuthStore } from '../../../features/auth/store'

import { MapleSweepSpinner, Text } from '../../atoms'
import { CharacterLayerGrid } from './CharacterLayerGrid'
import { EmptyState } from '../../molecules/EmptyState/EmptyState'
import { ErrorState } from '../../molecules/ErrorState/ErrorState'
import { StaleBanner } from '../../molecules/ErrorState/StaleBanner'
import { AccountSelect } from '../AccountSelect/AccountSelect'
import type { CharacterManageController } from '../../../hooks/useCharacterManage'

export interface CharacterManageBodyProps {
  manage: CharacterManageController
  /**
   * 끌기 중 자동 스크롤이 굴릴 스크롤 뷰. **화면이 소유한다.**
   *
   * 컨트롤러에 실어 내려보내지 않는 이유는 그 안에 `ref` 가 들어가기 때문이다: 컨트롤러 객체가
   * ref 를 품는 순간 렌더 중에 ref 를 만졌다 가 되어(`react-hooks/refs`) 그 객체를 읽는 자리가
   * 전부 걸린다. 스크롤 뷰는 어차피 화면(`ScreenScroll`)의 것이라 그 ref 도 화면에 남는 편이
   * 자리에 맞는다.
   */
  scrollableRef: AnimatedRef<ScrollView>
  /**
   * 실패 문구·액션이 갈리는 자리. 설정 하위 페이지는 `'picker'`, 첫 설정 화면은
   * `'characterSetup'`. 기본값을 두지 않는다. 두 호출부뿐이고, 기본값이 있으면 셋째 호출부가
   * 틀린 자리의 문구를 조용히 물려받는다.
   */
  place: RosterErrorPlace
}

// 대기 자리. 마크와 문구가 함께 선다.
//
// 이 자리는 콜드 캐시에서 `character/basic` 을 캐릭터 수만큼 부르느라 대기가 길다. 그 길이에서는
// 마크만으로 무엇을 기다리는지가 전달되지 않는다.
//
// `aria-label` 을 걷고 글자를 그린다. 둘을 함께 두면 스크린리더가 같은 말을 두 번 읽는다.
// 카드 껍데기는 안 씌운다(`LoadingState` 를 쓰지 않는 이유).
function Waiting(props: { label: string }): React.JSX.Element {
  return (
    <View role="status" aria-busy className="min-h-[120px] flex-1 items-center justify-center gap-3">
      <MapleSweepSpinner size={32} className="text-primary" />
      <Text className="text-center text-sm text-text-muted">{props.label}</Text>
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

/**
 * 후보 행을 격자에 못 넣는 상태에 그리는 것. 배너 · 대기 · 실패 셋이다.
 *
 * 행이 있는 정상 경로에서는 배너만 낸다(행은 격자가 그린다). 격자 밖인 이유는 그 자리들이
 * 카드가 아니라 화면 한 덩어리라, 격자에 넣으면 그것도 끌 수 있는 칸이 되기 때문이다.
 */
function CandidateNotice({
  manage,
  place,
}: {
  manage: CharacterManageController
  place: RosterErrorPlace
}): React.JSX.Element | null {
  // 보여줄 후보 풀이 있으면 실패해도 지우지 않는다. 캐시 stub 이 네트워크보다
  // 먼저 오므로 예열이 끝난 정상 경로에서는 이쪽이 기본 분기다.
  if (manage.selectableCount > 0) {
    if (manage.rosterError !== null) {
      const stale = formatStaleRosterError(manage.rosterError)
      return (
        <StaleBanner
          message={stale.message}
          action={
            stale.action === undefined
              ? undefined
              : { label: stale.action.label, onClick: manage.retryRoster }
          }
        />
      )
    }
    return manage.candidates.length > 0 ? null : <Notice>표시할 캐릭터가 없어요</Notice>
  }

  if (manage.isRosterLoading) {
    return <Waiting label="캐릭터 목록을 불러오고 있어요" />
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

  //  둘째 줄. 출구는 **드롭다운이 그대로 위에 있는 것**이라 액션을 두지 않는다.
  return <Notice>이 메이플 ID 의 캐릭터는 모두 조회할 수 없어요</Notice>
}

export function CharacterManageBody({
  manage,
  scrollableRef,
  place,
}: CharacterManageBodyProps): React.JSX.Element {
  // 계정을 하나도 못 고르면 본문 전체가 이 화면이다(넷째 줄).
  if (!manage.isAccountsLoading && manage.accountsError === null && manage.accounts.length === 0) {
    return (
      <View testID="character-manage-body">
        <EmptyState
          icon="leaf"
          size="page"
          title="조회되는 캐릭터가 없어요"
          description="이 API 키에 연결된 메이플 ID 를 찾지 못했어요"
          // core 에 이 키로는 앞으로 갈 수 없다 를 알리는 진입점이 이것 하나다. 확인을 누르면
          // 키 입력 화면으로 간다.
          action={{
            label: 'API 키 다시 입력',
            onClick: () => useAuthStore.getState().noticeApiKeyIssue('invalid'),
          }}
        />
      </View>
    )
  }

  return (
    <View testID="character-manage-body" className="gap-4">
      {/* 격자 밖 위에 남는다. 안에 넣으면 첫 칸이 고정 항목이 되어 맨 위로 옮기려는 카드가
          설 자리를 잃는다. */}
      <View testID="character-manage-selected">
        <SectionLabel>선택된 캐릭터 {manage.selectedOcids.length}개</SectionLabel>
      </View>

      {/* 두 층이 한 격자다. 층을 넘는 것이 재배열이라 그 움직임을 라이브러리가 잇는다. */}
      <CharacterLayerGrid
        views={manage.selectedViews}
        candidates={manage.candidates}
        representativeOcid={manage.representativeOcid}
        scrollableRef={scrollableRef}
        onOrderChange={manage.replaceSelection}
        onAdd={manage.addCharacter}
        onRemove={manage.removeCharacter}
        onSelectRepresentative={manage.setRepresentative}
        separator={
          <View testID="character-manage-divider" className="gap-4 pb-2 pt-2">
            <View className="h-px bg-border" />
            {manage.isAccountsLoading && manage.accounts.length === 0 ? (
              <Waiting label="메이플 ID 를 불러오고 있어요" />
            ) : manage.accounts.length === 0 ? (
              // 계정 목록 자체가 실패했다. 드롭다운도 후보도 세울 수 없어 이 자리 하나로 답한다.
              <AccountsError manage={manage} place={place} />
            ) : (
              <View className="gap-2">
                {manage.selectedAccountId !== null && (
                  <AccountSelect
                    accounts={manage.accounts}
                    selectedAccountId={manage.selectedAccountId}
                    portraitByAccountId={manage.portraitByAccountId}
                    onSelect={manage.selectAccount}
                  />
                )}
                {/* 라벨 오른쪽의 `{n}개 중 {m}개 표시` 는 두지 않는다. 그 줄이 답하던 질문(왜 12개가
                    아니라 7개인가)은 이 화면에서 물을 수 없는 질문이다. */}
                <SectionLabel>캐릭터 추가</SectionLabel>
              </View>
            )}
          </View>
        }
      />

      {/* 후보 행이 없을 때만 무언가 그린다. 행이 있으면 격자가 이미 그렸다. */}
      <View testID="character-manage-candidates">
        <CandidateNotice manage={manage} place={place} />
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
  // 계정 목록 실패도 로스터 실패와 같은 어휘를 쓴다. 사용자에게는 **목록을 못 불러왔다** 한 가지다.
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

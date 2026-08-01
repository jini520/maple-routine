import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ScrollText } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { LoadingState } from '../../components/LoadingState/LoadingState'
import { MAPLE_LEAF_PATH } from '../../components/mapleLeafPath'
import {
  useDropHistoryStore,
  type DropHistoryCharacter,
} from '../../features/boss-profit/drop-history-store'
import { formatBossProfitPeriodLabel } from '../../lib/boss-profit-period'
import {
  formatDropHistoryLine,
  formatValuableDroughtHeadline,
  formatValuableDroughtItems,
  getValuableDroughtTier,
  VALUABLE_DROUGHT_LATE_HEADLINE_COUNT,
} from '../../lib/drop-history'
import { getItemIconUrl } from '../../lib/item-icons'
import { isValuableDrop } from '../../lib/valuable-drops'
import type { DropHistoryPeriodGroup, DropHistoryRecord, ValuableDroughtSummary } from '../../lib/drop-history'

// 드롭 획득 히스토리 — 전 기간을 가로지르는 읽기 전용 목록([[ADR-071]], 이슈 #54). 보스 수익 화면의
// 고가 강조는 전부 "지금 보고 있는 기간"에 갇혀 있어(`dropsByRowKey`) 과거 기록은 그 기간으로
// 이동해야만 보였다. 이 화면은 화면 rows 가 아니라 DB를 직접 읽으므로 그 제약도, 월간 탭의 주차별
// 합계 한계도 없다.
//
// **삭제·수정 기능은 두지 않는다** — 기록 편집은 드롭 입력 시트 한 곳에서만 하고, 거기서 지운 것은
// 같은 테이블을 읽는 이 화면에서 자동으로 사라진다([[ADR-071]] 결정 1).

/**
 * 슬픔 단계별 시각 표현([[ADR-071]] 결정 8 후속, 사용자 확정 2026-08-01 — 시안 W4).
 *
 * 단풍잎이 색을 잃고 기울다 떨어지는 것으로 가뭄을 말한다. 은유를 새로 만들지 않고 **브랜드 마크를
 * 그대로 쓴 이유**가 이것이다 — 단풍잎은 원래 그렇게 늙으므로 억지 장식이 아니고, 새 에셋도 없다.
 *
 * 색이 테마 토큰이 아니라 고정 hex 인 것은 고가 골드와 같은 사정이다([[ADR-045]]) — 이 램프는 "골드에서
 * 무채색을 거쳐 차가운 회청색으로" 가는 한 줄기라 테마마다 다른 색으로 갈리면 의미를 잃는다. 잎은
 * 아이콘(면적 채색)이라 본문 텍스트급 대비가 필요 없고, 글자색은 테마 토큰을 쓴다.
 *
 * 단계 경계·문구는 `lib/drop-history` 의 `VALUABLE_DROUGHT_TIERS` 가 정한다 — 여기 배열은 그 인덱스에
 * 1:1로 대응하므로 길이가 어긋나면 안 된다.
 */
const DROUGHT_TIER_STYLES = [
  { leaf: '#f7d00d', ink: 'text-text', rotate: 0, opacity: 1, glow: true },
  { leaf: '#e0b400', ink: 'text-text', rotate: 6, opacity: 0.95, glow: false },
  { leaf: '#b99a5c', ink: 'text-text-muted', rotate: 14, opacity: 0.8, glow: false },
  { leaf: '#9a9a93', ink: 'text-text-muted', rotate: 26, opacity: 0.6, glow: false },
  { leaf: '#8f98a1', ink: 'text-text-disabled', rotate: 42, opacity: 0.45, glow: false },
] as const

/** 단풍잎 한 변(px). 단계별 색·기울기가 이 요소의 감정을 지고 있어 작으면 차이가 읽히지 않는다. */
const DROUGHT_LEAF_SIZE = 42

// 미획득 기간 요약([[ADR-071]] 결정 4) — 고가 전체를 **하나로** 집계한다. 아이템별·세트별로 나누지
// 않는다(칠흑·광휘 구성원 수십 종이 대부분 "기록 없음"으로 채워져 소음이 된다).
function ValuableDrought(props: { summary: ValuableDroughtSummary; now: Date }): React.JSX.Element {
  const label = formatBossProfitPeriodLabel(props.summary.cycle, props.summary.periodKey, props.now)
  const weeks = props.summary.weeksSince
  const tier = getValuableDroughtTier(weeks)
  const style = DROUGHT_TIER_STYLES[tier]
  const items = formatValuableDroughtItems(props.summary.records)

  // 마지막 단계는 문구가 여럿이고 그중 하나가 무작위로 나온다(사용자 지정 2026-08-01). **마운트당 한
  // 번만 고른다** — 렌더마다 고르면 리렌더가 일어날 때 문구가 깜빡인다. `useState` 초기화 함수는 그
  // 컴포넌트 인스턴스에서 딱 한 번 실행되므로 화면에 머무는 동안 문구가 고정되고, 다시 들어오면 새로
  // 뽑힌다. 무작위는 화면(경계)에만 두고 `lib` 은 순수하게 유지한다.
  const [lateIndex] = useState(() => Math.floor(Math.random() * VALUABLE_DROUGHT_LATE_HEADLINE_COUNT))

  return (
    <div
      data-testid="valuable-drought"
      data-drought-tier={tier}
      className="flex items-center justify-center gap-2.5"
    >
      {/* 잎만 인라인 style 을 쓴다 — 단계별 hex·회전각은 Tailwind 클래스로 만들면 5단 × 3속성이
          임의 값 클래스로 흩어지고, 위 표 하나로 읽히는 편이 고치기 쉽다.

          크기는 42px(사용자 지정 2026-08-01, 26px에서 키움) — 이 요소의 감정은 잎의 색·기울기가 지고
          있어서 작으면 단계 차이가 읽히지 않는다. 높이 비율은 원본 뷰박스(127×130)를 따른다. */}
      <svg
        width={DROUGHT_LEAF_SIZE}
        height={Math.round(DROUGHT_LEAF_SIZE * (130 / 127))}
        viewBox="0 0 127 130"
        aria-hidden="true"
        className="flex-none"
        style={{
          transform: `rotate(${style.rotate}deg)`,
          opacity: style.opacity,
          filter: style.glow ? 'drop-shadow(0 0 5px rgba(247,208,13,.75))' : undefined,
        }}
      >
        <path d={MAPLE_LEAF_PATH} fill={style.leaf} />
      </svg>
      <div>
        {/* 잎을 키운 만큼 글자도 한 단계씩 올린다(사용자 지정 2026-08-01) — 제목 `text-sm`→`text-base`,
            아래 줄 `text-[10px]`→`text-[11px]`. 아래 줄을 `text-xs`(12px)까지 올리지 않는 이유는 목록
            문장이 12px 라, 같아지면 요약과 본문의 위계가 사라진다. */}
        <p className={`text-base font-bold ${style.ink}`}>
          {formatValuableDroughtHeadline(weeks, lateIndex)}
        </p>
        {/* 이번 주에 먹었으면 그게 곧 마지막이라 "마지막 에픽 빔!"을 뺀다 — 아직 진행 중인 주를
            "마지막"이라 부르면 어색하다. 1주 이상은 실제로 지난 일이라 붙인다. */}
        <p className="text-[11px] leading-tight text-text-muted">
          {weeks === 0 ? '' : '마지막 에픽 빔! '}
          {label.primary}
          {items !== '' && ` · ${items}`}
        </p>
      </div>
    </div>
  )
}

/**
 * 기록 한 건 = **한 줄 문장**이다(사용자 지정 2026-07-31): "지내우시님이 가디언 엔젤 슬라임(카오스)에서
 * 가디언 엔젤링을 획득하였습니다."
 *
 * 아이콘·난이도 배지·2단 레이아웃을 두지 않는다 — 한 기록이 목록에서 큰 비중을 차지하지 않게 하려는
 * 것이고, 그래서 **꾸밈은 고가 아이템에만** 준다(그게 실제로 눈에 띌 값이다).
 *
 * 고가 꾸밈에 새 색을 만들지 않는다: 고가 골드(`#f7d00d`)는 테마와 무관하게 고정이라([[ADR-045]] —
 * 그래서 토큰이 아니라 `index.css` plain 클래스다) 테마 토큰으로는 표현할 수 없다. 이미 있는
 * `.valuable-drop-badge` 를 아이템명에 그대로 씌운다 — 자체 배경·글자색을 들고 있어 라이트/다크 표면
 * 모두에서 읽힌다(그 클래스가 원래 그 목적으로 만들어졌다). 여기서는 아이콘 스택 대신 아이템 아이콘
 * 하나 + 이름을 담는데, [[ADR-046]] 의 "배지 외형은 단일 구현" 은 아이콘 스택 배지
 * (`ValuableDropBadge`) 규약이고 이 줄은 그 컴포넌트가 아니라 같은 스킨을 쓰는 인라인 강조다.
 *
 * 줄 배경(`.valuable-drop-row`)과 카드 셸·구분선은 쓰지 않는다(사용자 지정 2026-07-31) — 배경을
 * 없애고 줄간격을 좁히기로 했고, 그 둘은 같은 방향의 결정이다(배경 블록은 줄을 좁히면 서로 붙는다).
 */
function DropHistoryEntry(props: {
  record: DropHistoryRecord
  character: DropHistoryCharacter | undefined
}): React.JSX.Element {
  const { record } = props
  const line = formatDropHistoryLine(record, props.character?.characterName)
  const isValuable = isValuableDrop(record.itemName)
  const iconUrl = isValuable ? getItemIconUrl(record.itemName, record.slot) : null

  return (
    <li data-testid="drop-history-entry" data-valuable={isValuable ? 'true' : undefined} className="py-0.5">
      {/* 배경·구분선 없이 문장만 둔다(사용자 지정 2026-07-31) — 카드 셸도, 고가 줄의 골드 틴트
          (`.valuable-drop-row`)도 쓰지 않는다. 고가 표시는 아이템명 pill과 본문색만 담당한다.

          `break-keep`: 한국어는 기본값(`normal`)에서 **음절 단위로 아무 데서나** 끊긴다 — "가디언 엔젤
          슬라/임에서" 처럼 단어가 갈린다. `word-break: keep-all` 이면 띄어쓰기만 줄바꿈 지점이 된다.
          `text-balance` 를 함께 두는 이유는 가운데 정렬이라서다 — 없으면 마지막 줄에 한 단어만 남아
          꼬리처럼 보인다(`BossDropSheet` 의 아이템명이 같은 조합을 쓴다). */}
      <p
        className={`text-balance break-keep text-center text-xs leading-snug ${
          isValuable ? 'text-text' : 'text-text-muted'
        }`}
      >
        {line.prefix}
        {/* 상자명도 강조 대상이다(사용자 지정 2026-08-01) — 반지 상자·칠흑 장신구 상자를 열어 나온
            기록은 "무엇을 열었는지"가 정보의 절반이라([[ADR-010]]) 아이템과 같은 굵기를 준다. pill(고가)은
            결과에만 붙는다 — 가치를 정하는 쪽이 결과이고, 강조 둘 다 골드면 어느 쪽이 값인지 흐려진다. */}
        {line.box !== undefined && (
          <>
            <span className="font-semibold">{line.box.name}</span>
            {line.box.connector}
          </>
        )}
        {/* 조사는 아이템과 한 덩어리로 묶는다 — pill(inline-flex)은 원자적 인라인 박스라 그 경계에
            줄바꿈 지점이 생기고, 그대로 두면 조사만 다음 줄로 떨어진다("…마크 / 를 획득하였습니다"). */}
        {isValuable ? (
          <span className="whitespace-nowrap">
            <span className="valuable-drop-badge inline-flex items-baseline gap-1 rounded-full px-1.5 align-baseline text-[11px] font-bold">
              {iconUrl !== null && (
                <img src={iconUrl} alt="" className="h-3.5 w-3.5 self-center object-contain" />
              )}
              {line.item}
            </span>
            {line.particle}
          </span>
        ) : (
          <>
            {/* 고가가 아니어도 아이템명은 살짝 굵게(사용자 지정 2026-08-01) — 문장에서 실제 정보는
                아이템이라 배경·색 없이 굵기만으로 짚어준다. 고가 pill 은 `font-bold` 라 위계가 남는다.
                조사는 강조 밖에 두는데(고가 쪽과 같은 규약) 평범한 인라인 `span` 은 원자적 박스가
                아니라 경계에 줄바꿈 지점을 만들지 않으므로 nowrap 으로 묶을 필요가 없다 — 띄어쓰기
                단위 줄바꿈이 그대로 유지된다. */}
            <span className="font-semibold">{line.item}</span>
            {line.particle}
          </>
        )}
        {line.suffix}
      </p>
    </li>
  )
}

function DropHistoryPeriodSection(props: {
  group: DropHistoryPeriodGroup
  charactersByOcid: Record<string, DropHistoryCharacter>
  now: Date
}): React.JSX.Element {
  const label = formatBossProfitPeriodLabel(props.group.cycle, props.group.periodKey, props.now)

  return (
    <section>
      {/* 기간 라벨은 본문과 같이 가운데, `primary` 하나만 둔다(사용자 지정 2026-07-31) — 날짜 구간
          (`secondary`, "7월 30일 ~ 8월 5일")은 빼서 구분선 역할만 하게 한다. `primary` 는 두 주기 모두
          자기 완결적이다: 주간은 "이번 주"·"지난 주"·"N월 M주차", 월간은 "이번 달"·"지난 달"·"YYYY년 M월".

          라벨 양옆에 헤어라인을 두고 글자는 가볍게 물러나게 한다(사용자 지정 2026-07-31) — 구분이
          글자 굵기가 아니라 선에서 나오므로 라벨이 본문보다 튀지 않아도 된다. 문자 스타일은 총 수익
          헤드라인의 조용한 라벨 관례를 그대로 쓰고(`text-xs font-semibold tracking-wide text-text-muted`),
          선은 이 저장소의 헤어라인 관례(`h-px bg-border`)다. `flex-1` 선이 양쪽을 채우므로 라벨은
          `text-center` 없이도 가운데 온다. */}
      {/* 헤어라인은 **라벨 줄이 아니라 라벨+날짜 두 줄 블록 기준으로 세로 중앙**에 온다(사용자 지정
          2026-08-01) — 선을 라벨과 같은 flex 행에 두면 날짜 줄이 아래로 매달려 선이 위로 치우쳐 보인다.
          두 줄을 한 자식으로 묶고 `items-center` 로 선을 그 블록에 맞춘다. */}
      <div data-testid="drop-history-period" className="flex items-center gap-2 pb-1.5">
        <span data-testid="drop-history-period-rule" className="h-px flex-1 bg-border" aria-hidden="true" />
        <div className="text-center">
          <h2 className="text-xs font-semibold tracking-wide text-text-muted">{label.primary}</h2>
          {/* 날짜 구간은 라벨 바로 아래 작게 — `leading-tight` + 마진 없이 붙여 한 덩어리로 읽히게 한다.

              **같은 값이면 렌더하지 않는다**: 월간 과거 기간은 `primary` 가 곧 `secondary` 다
              (`formatBossProfitPeriodLabel` 의 월간 폴백이 `{ primary: secondary, secondary }` 를 준다) —
              그대로 두면 "2026년 3월"이 두 줄로 겹쳐 나온다. */}
          {label.secondary !== label.primary && (
            <p
              data-testid="drop-history-period-range"
              className="text-[10px] leading-tight text-text-muted tabular-nums"
            >
              {label.secondary}
            </p>
          )}
        </div>
        <span data-testid="drop-history-period-rule" className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      {/* 카드 셸 없음 — 배경 위에 문장만 흐른다(사용자 지정 2026-07-31). */}
      <ul>
        {props.group.records.map((record, index) => (
          <DropHistoryEntry
            // 같은 기간·보스에 같은 아이템을 두 개 먹은 경우를 구분할 수 없으므로 index를 키에 넣는다
            // (기록 자체가 그 둘을 구분하지 않는다, [[ADR-069]] 결정 4의 "임의로 합치지 않는다").
            key={`${record.ocid}-${record.boss}-${record.difficulty}-${record.itemName}-${index}`}
            record={record}
            character={props.charactersByOcid[record.ocid]}
          />
        ))}
      </ul>
    </section>
  )
}

export function DropHistoryScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { status, groups, drought, charactersByOcid, load } = useDropHistoryStore()

  useEffect(() => {
    void load()
  }, [load])

  const now = new Date()

  return (
    // ADR-077: 이 화면은 보스 수익 위에 얹히는 스택 화면이라 **자기 스크롤을 갖는 오버레이**다.
    // - `fixed inset-0`: 아래 화면(BossProfitScreen)은 마운트된 채로 남고 문서 스크롤도 그 화면의
    //   위치에 그대로 머문다 — 뒤로 왔을 때 스크롤을 되돌릴 필요가 없다(저장·복원 코드 없음).
    // - `overflow-y-auto`: 문서 대신 이 컨테이너가 스크롤한다. 당겨서 새로고침 훅은 스크롤 가능한
    //   조상 안에서 시작한 터치를 페이지 당김에서 제외하므로([[ADR-072]] 결정 14) 아래 화면의
    //   재조회가 딸려 돌지 않는다.
    // - `bg-bg`: 불투명해야 아래 화면이 비치지 않는다.
    // - `z-20`: **반드시 페이지 sticky 헤더(z-10)보다 위여야 한다.** z를 안 주면(z-auto) 그 헤더가
    //   오버레이 위에 그려져 이 화면의 `←`·제목 줄을 덮는다(실기기 확인 2026-08-02). 모달(z-50)·
    //   토스트/시트(z-[60])·드롭 연출(z-[70])보다는 아래다 — 이건 모달이 아니라 페이지 레벨 화면이다.
    // - 하단 여백: fixed라 AppShell의 `pb-[calc(4rem+var(--sa-bottom))]`을 물려받지 못해 직접 갖는다.
    //   하단 탭바는 DOM 순서상 이 오버레이보다 뒤라 계속 위에 그려진다(현행 유지).
    // `space-y-4`는 그대로 둔다 — 제목 블록과 목록 사이 1rem 간격은 이 유틸리티가 만들던 것이다.
    // `-mt-[var(--sa-top)]`는 뺐다: AppShell의 `pt-[var(--sa-top)]`를 상쇄하려던 것인데 `fixed inset-0`은
    // 애초에 그 패딩 바깥에서 뷰포트 기준으로 놓이므로 상쇄할 대상이 없다(마진을 두면 오히려 밀린다).
    <div className="fixed inset-0 z-20 space-y-4 overflow-y-auto bg-bg pb-[calc(4rem+var(--sa-bottom))]">
      {/* 제목 줄만 sticky로 고정하고 목록만 스크롤 — 보스 관리·컨텐츠 관리와 같은 서브 화면 패턴이다. */}
      <div className="sticky top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2">
        <div className="space-y-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로"
              className="-ml-2 flex h-9 w-9 items-center justify-center text-text"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
            <h1 className="text-lg font-semibold text-text">히스토리</h1>
          </div>

          {drought !== null && <ValuableDrought summary={drought} now={now} />}
        </div>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {(status === 'idle' || status === 'loading') && (
          <LoadingState size="page" message="불러오고 있어요" />
        )}

        {/* 실패를 빈 목록으로 위장하지 않는다([[ADR-062]]) — "기록이 없습니다"는 확정된 사실일 때만
            할 수 있는 말이고, 조회가 실패한 상태에서는 기록이 있는지조차 모른다. */}
        {status === 'failed' && (
          <ErrorState
            title="히스토리를 불러오지 못했습니다"
            description="저장된 기록을 읽지 못했습니다. 다시 시도해주세요."
            action={{ label: '다시 시도', onClick: () => void load() }}
          />
        )}

        {status === 'ready' && groups.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title="아직 기록된 드롭이 없습니다"
            description="보스 수익 화면에서 보스를 눌러 드롭을 기록하면 여기에 쌓입니다"
            action={{ label: '보스 수익으로', onClick: () => navigate('/profit') }}
          />
        )}

        {status === 'ready' &&
          groups.map((group) => (
            <DropHistoryPeriodSection
              key={group.periodKey}
              group={group}
              charactersByOcid={charactersByOcid}
              now={now}
            />
          ))}
      </div>
    </div>
  )
}

/**
 * 드롭 획득 히스토리. 전 기간을 가로지르는 읽기 전용 목록(이슈 #54). 보스 수익 화면의
 * 고가 강조는 전부 "지금 보고 있는 기간"에 갇혀 있어(`dropsByRowKey`) 과거 기록은 그 기간으로
 * 이동해야만 보였다. 이 화면은 화면 rows 가 아니라 DB를 직접 읽으므로 그 제약도, 월간 탭의 주차별
 * 합계 한계도 없다.
 *
 * **삭제·수정 기능은 두지 않는다**. 기록 편집은 드롭 입력 시트 한 곳에서만 하고, 거기서 지운 것은
 * 같은 테이블을 읽는 이 화면에서 자동으로 사라진다. **쿼리를 화면이 짜지
 * 않는다**. `useDropHistoryStore.load()` 가 전 기간 조회·획득 불가 필터·
 * 가뭄 집계를 전부 갖는다.
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import {
  useDropHistoryStore,
  type DropHistoryCharacter,
} from '../../features/boss-profit/drop-history-store'
import { formatBossProfitPeriodLabel } from '../../lib/boss/boss-profit-period'
import {
  formatDropHistoryLine,
  formatValuableDroughtHeadline,
  formatValuableDroughtItems,
  getValuableDroughtTier,
  valuableDroughtHeadlineCount,
} from '../../lib/drop/drop-history'
import type {
  DropHistoryPeriodGroup,
  DropHistoryRecord,
  ValuableDroughtSummary,
} from '../../lib/drop/drop-history'
import { getItemIconUrl } from '../../lib/assets/asset-lookup'
import { isValuableDrop } from '../../lib/drop/valuable-drops'

import { ArrowLeftIcon, MapleLeaf, ScrollTextIcon, Text } from '../../components/atoms'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { DROUGHT_GLOW_FILTER, DROUGHT_TIER_STYLES } from '../../constants/style/drought-tier-styles'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useTopSafeAreaPx } from '../../lib/safe-area'
import { useScreenNavigation } from '../use-screen-navigation'

/**
 * 웹 `index.css` 의 `.valuable-drop-badge` 스킨. **여기서는 단색으로 내려앉는다**(파일 머리 ④).
 *
 * 그라디언트(`linear-gradient(135deg, #ffe98a, #f7c400)`)의 **끝 정지점**을 그대로 쓴다. 새 골드를
 * 뽑지 않는 것이 의 요구다(*"임의의 골드 hex 를 새로 뽑으면 어느 한쪽 테마에서
 * 대비가 깨진다"*). 두 정지점 중 어두운 쪽이라 골드 잉크와의 대비가 밝은 쪽보다 보수적이다.
 * 잉크는 웹과 **같은 값**이고, 둘 다 테마 토큰이 아니라 전 테마 공통 고정색이다.
 */
const VALUABLE_INLINE_BG = '#f7c400'
const VALUABLE_INLINE_INK = '#6b4e00'

/** 단풍잎 한 변(px). 단계별 색·기울기가 이 요소의 감정을 지고 있어 작으면 차이가 읽히지 않는다. */
const DROUGHT_LEAF_SIZE = 42

// 미획득 기간 요약. 고가 전체를 **하나로** 집계한다. 아이템별·세트별로 나누지
// 않는다(칠흑·광휘 구성원 수십 종이 대부분 "기록 없음"으로 채워져 소음이 된다).
function ValuableDrought(props: { summary: ValuableDroughtSummary; now: Date }): React.JSX.Element {
  const label = formatBossProfitPeriodLabel(props.summary.cycle, props.summary.periodKey, props.now)
  const weeks = props.summary.weeksSince
  const tier = getValuableDroughtTier(weeks)
  const style = DROUGHT_TIER_STYLES[tier]
  const items = formatValuableDroughtItems(props.summary.records)

  // 단계마다 문구가 여럿이고 그중 하나가 무작위로 나온다(사용자 지정 2026-08-01·2026-08-17). **마운트당
  // 한 번만 고른다**. 렌더마다 고르면 리렌더가 일어날 때 문구가 깜빡인다. `useState` 초기화 함수는 그
  // 컴포넌트 인스턴스에서 딱 한 번 실행되므로 화면에 머무는 동안 문구가 고정되고, 다시 들어오면 새로
  // 뽑힌다. 무작위는 화면(경계)에만 두고 `lib` 은 순수하게 유지한다.
  const [headlineIndex] = useState(() =>
    Math.floor(Math.random() * valuableDroughtHeadlineCount(weeks)),
  )

  return (
    <View
      testID="valuable-drought"
      // RN 에 데이터 속성이 없어 접근성 이름으로 옮긴다. 테스트는
      // 이 이름으로만 단계를 지목할 수 있고, 스크린리더에도 단계가 문구로만 남는 것보다 낫다.
      aria-label={`고가 드롭 미획득 ${tier}단계`}
      className="flex-row items-center justify-center gap-2.5"
    >
      {/* 크기는 42px(사용자 지정 2026-08-01, 26px에서 키움). 이 요소의 감정은 잎의 색·기울기가 지고
          있어서 작으면 단계 차이가 읽히지 않는다. 높이 비율은 원본 뷰박스(127×130)를 따른다.
          단계별 hex·회전각은 위 표 하나로 읽히는 편이 고치기 쉬워 클래스가 아니라 값으로 준다.

          **기울기·투명도·글로우는 감싸는 `View` 가 진다**. `<Svg>` 의 `style.filter` 는 SVG 속성
          (`url(#id)`)으로 해석되어 배열을 주면 던진다(실측: `filter.match is not a function`).
          `FadedIllustration` 가 `<Image>` 에서 만난 것과 **같은 종류의 갈림**이고 처방도 같다. */}
      <View
        testID="valuable-drought-leaf"
        aria-hidden
        style={{
          transform: [{ rotate: `${style.rotate}deg` }],
          opacity: style.opacity,
          ...(style.glow ? { filter: DROUGHT_GLOW_FILTER } : {}),
        }}
      >
        <MapleLeaf size={DROUGHT_LEAF_SIZE} fill={style.leaf} />
      </View>
      <View className="shrink">
        {/* 잎을 키운 만큼 글자도 한 단계씩 올린다(사용자 지정 2026-08-01). 제목 `text-sm`→`text-base`,
            아래 줄 `text-10`→`text-11`. 아래 줄을 `text-xs`(12px)까지 올리지 않는 이유는 목록
            문장이 12px 라, 같아지면 요약과 본문의 위계가 사라진다. */}
        <Text className={`text-base font-bold ${style.ink}`}>
          {formatValuableDroughtHeadline(weeks, headlineIndex)}
        </Text>
        {/* 이번 주에 먹었으면 그게 곧 마지막이라 "마지막 에픽 빔!"을 뺀다. 아직 진행 중인 주를
            "마지막"이라 부르면 어색하다. 1주 이상은 실제로 지난 일이라 붙인다. */}
        <Text className="text-11 leading-tight text-text-muted">
          {weeks === 0 ? '' : '마지막 에픽 빔! '}
          {label.primary}
          {items !== '' && ` · ${items}`}
        </Text>
      </View>
    </View>
  )
}

/**
 * 기록 한 건 = **한 줄 문장**이다: "지내우시님이 가디언 엔젤 슬라임(카오스)에서
 * 가디언 엔젤링을 획득하였습니다."
 *
 * 아이콘·난이도 배지·2단 레이아웃을 두지 않는다. 한 기록이 목록에서 큰 비중을 차지하지 않게 하려는
 * 것이고, 그래서 **꾸밈은 고가 아이템에만** 준다(그게 실제로 눈에 띌 값이다).
 *
 * 줄 배경(`.valuable-drop-row`)과 카드 셸·구분선은 쓰지 않는다(사용자 지정 2026-07-31). 배경을
 * 없애고 줄간격을 좁히기로 했고, 그 둘은 같은 방향의 결정이다(배경 블록은 줄을 좁히면 서로 붙는다).
 * 그래서 이 화면은 `ValuableRowBackground` 를 부르지 않는다.
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
    <View testID="drop-history-entry" aria-label={isValuable ? '고가 드롭 기록' : undefined} className="py-0.5">
      {/* 배경·구분선 없이 문장만 둔다. 카드 셸도, 고가 줄의 골드 틴트도 쓰지 않는다. 고가 표시는
          아이템명 배경과 본문색만 담당한다.

          웹의 `break-keep`·`text-balance` 는 RN 에 짝이 없어 사라진다(줄바꿈 품질만 달라진다).
          난이도 괄호를 묶는 WORD JOINER 는 **`formatDropHistoryLine` 이 문자열에 박아 두므로**
          그대로 온다. 그 처방은 화면이 아니라 core 가 갖고 있었다. */}
      <Text
        className={`text-center text-xs leading-snug ${isValuable ? 'text-text' : 'text-text-muted'}`}
      >
        {line.prefix}
        {/* 상자명도 강조 대상이다(사용자 지정 2026-08-01). 반지 상자·칠흑 장신구 상자를 열어 나온
            기록은 "무엇을 열었는지"가 정보의 절반이라 아이템과 같은 굵기를 준다. 골드
            강조(고가)는 결과에만 붙는다. 가치를 정하는 쪽이 결과이고, 강조 둘 다 골드면 어느 쪽이
            값인지 흐려진다. */}
        {line.box !== undefined && (
          <Text>
            <Text className="font-semibold">{line.box.name}</Text>
            {line.box.connector}
          </Text>
        )}
        {isValuable ? (
          <Text>
            <Text
              testID="valuable-drop-inline"
              className="text-11 font-bold"
              style={{ backgroundColor: VALUABLE_INLINE_BG, color: VALUABLE_INLINE_INK }}
            >
              {/* 아이콘은 문장 안 인라인 이미지다. 크기를 명시해야 RN 이 줄 안에 앉힌다. 웹의
                  `gap-1` 자리는 공백 문자다(중첩 `Text` 에는 `gap` 이 없다). 아이콘이 없으면 그
                  공백도 만들지 않는다. 배경이 칠해진 자리라 앞쪽 여백이 그대로 보인다. */}
              {iconUrl !== null && (
                <Text>
                  <Image source={iconUrl} resizeMode="contain" className="h-3.5 w-3.5" />{' '}
                </Text>
              )}
              {line.item}
            </Text>
            {/* `whitespace-nowrap` 이 사라진 자리. 중첩 `Text` 는 원자적 인라인 박스가 아니라
                경계에 줄바꿈 지점을 만들지 않는다(파일 머리 ④). */}
            {line.particle}
          </Text>
        ) : (
          <Text>
            {/* 고가가 아니어도 아이템명은 살짝 굵게(사용자 지정 2026-08-01). 문장에서 실제 정보는
                아이템이라 배경·색 없이 굵기만으로 짚어준다. 고가는 `font-bold` + 골드라 위계가 남는다. */}
            <Text className="font-semibold">{line.item}</Text>
            {line.particle}
          </Text>
        )}
        {line.suffix}
      </Text>
    </View>
  )
}

function DropHistoryPeriodSection(props: {
  group: DropHistoryPeriodGroup
  charactersByOcid: Record<string, DropHistoryCharacter>
  now: Date
}): React.JSX.Element {
  const label = formatBossProfitPeriodLabel(props.group.cycle, props.group.periodKey, props.now)

  return (
    <View>
      {/* 기간 라벨은 본문과 같이 가운데, `primary` 하나만 둔다(사용자 지정 2026-07-31). 날짜 구간
          (`secondary`, "7월 30일 ~ 8월 5일")은 그 아래 작게 붙는다.

          라벨 양옆에 헤어라인을 두고 글자는 가볍게 물러나게 한다. 구분이 글자 굵기가 아니라 선에서
          나오므로 라벨이 본문보다 튀지 않아도 된다. **헤어라인은 라벨 줄이 아니라 라벨+날짜 두 줄
          블록 기준으로 세로 중앙**이다(사용자 지정 2026-08-01). 선을 라벨과 같은 행에 두면 날짜
          줄이 아래로 매달려 선이 위로 치우쳐 보인다. */}
      <View testID="drop-history-period" className="flex-row items-center gap-2 pb-1.5">
        <View testID="drop-history-period-rule" className="h-px flex-1 bg-border" aria-hidden />
        <View>
          <Text className="text-center text-xs font-semibold tracking-wide text-text-muted">
            {label.primary}
          </Text>
          {/* 날짜 구간은 라벨 바로 아래 작게. `leading-tight` + 마진 없이 붙여 한 덩어리로 읽히게 한다.

              **같은 값이면 렌더하지 않는다**: 월간 과거 기간은 `primary` 가 곧 `secondary` 다
              (`formatBossProfitPeriodLabel` 의 월간 폴백이 `{ primary: secondary, secondary }` 를 준다).
              그대로 두면 "2026년 3월"이 두 줄로 겹쳐 나온다. */}
          {label.secondary !== label.primary && (
            <Text
              testID="drop-history-period-range"
              className="text-center text-10 leading-tight text-text-muted"
              style={TABULAR_NUMS}
            >
              {label.secondary}
            </Text>
          )}
        </View>
        <View testID="drop-history-period-rule" className="h-px flex-1 bg-border" aria-hidden />
      </View>
      {/* 카드 셸 없음. 배경 위에 문장만 흐른다(사용자 지정 2026-07-31). */}
      <View>
        {props.group.records.map((record, index) => (
          <DropHistoryEntry
            // 같은 기간·보스에 같은 아이템을 두 개 먹은 경우를 구분할 수 없으므로 index를 키에 넣는다
            // (기록 자체가 그 둘을 구분하지 않는다 결정 4의 "임의로 합치지 않는다").
            key={`${record.ocid}-${record.boss}-${record.difficulty}-${record.itemName}-${index}`}
            record={record}
            character={props.charactersByOcid[record.ocid]}
          />
        ))}
      </View>
    </View>
  )
}

export function DropHistoryScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const topSafeAreaPx = useTopSafeAreaPx()
  const { status, groups, drought, charactersByOcid, load } = useDropHistoryStore()

  useEffect(() => {
    void load()
  }, [load])

  const now = new Date()

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        // 공용 `PageHeader` 를 쓰지 않는 이유는 파일 머리 ②. 이 화면에는 배경 조각도 하단 페이드도
        // 없다. 스크롤 상자가 노치까지 덮던 웹과 달리 **상단 안전영역을 헤더가 먹는다**는 계약은
        // 그대로다(`ScreenScroll` 은 헤더가 있으면 위를 안 건드린다).
        // **여백은 더하지 않는다**. 공용 셸과 같은 값이어야 가격 화면과 나란히 열릴 때
        // 제목 높이가 안 갈린다. 그 **같은 값** 이 `useTopSafeAreaPx()` 다(
        // 안드로이드 하한 48).
        <View testID="page-header" className="z-10 px-4 pb-2" style={{ paddingTop: topSafeAreaPx }}>
          <View className="gap-3">
            <PageHeaderTitleRow className="gap-1">
              <Pressable
                role="button"
                onPress={() => navigation.goBack()}
                aria-label="뒤로"
                className="-ml-2 h-9 w-9 items-center justify-center"
              >
                <ArrowLeftIcon className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
              </Pressable>
              <Text className="text-lg font-semibold text-text">히스토리</Text>
            </PageHeaderTitleRow>

            {drought !== null && <ValuableDrought summary={drought} now={now} />}
          </View>
        </View>
      }
    >
      {/* 하단 안전영역은 `ScreenScroll` 이 넣는다(웹이 콘텐츠 블록에 직접
          계산해 넣던 자리). 여기 남는 것은 상수 몫뿐이다.

          `screen-<라우트 이름>` 은 자리표시자에게서 그대로 물려받은 계약이다. 내비게이션 테스트가
          "그 라우트로 밀면 그 화면이 열리는가"를 이 이름으로 묻는다. */}
      <View testID="screen-DropHistory" className="gap-4 px-4 pb-4">
        {(status === 'idle' || status === 'loading') && (
          <LoadingState size="page" message="불러오고 있어요" />
        )}

        {/* 실패를 빈 목록으로 위장하지 않는다. "기록이 없습니다"는 확정된 사실일 때만
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
            icon={ScrollTextIcon}
            title="아직 기록된 드롭이 없습니다"
            description="보스 수익 화면에서 보스를 눌러 드롭을 기록하면 여기에 쌓입니다"
            // 웹은 `navigate('/profit')` 이었다. 이 화면은 **언제나 그 탭이 민 것**이라(딥링크 없음)
            // pop 이 곧 그 목적지이고, 새로 push 하면 같은 화면이 스택에 두 겹 쌓인다.
            action={{ label: '보스 수익으로', onClick: () => navigation.goBack() }}
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
      </View>
    </ScreenScroll>
  )
}

# 디자인 시스템 (Design System)

> **범위**: 디자인 원칙·안티패턴·기본 색 팔레트·시맨틱 색·기본 컴포넌트(카드/버튼/입력)·여러 화면이 공유하는 UI 컴포넌트·공유 레이아웃 패턴·타이포·아이콘. 테마별 토큰 표·런타임 전환은 [features/theme.md](../features/theme.md), 기능 전용 컴포넌트는 각 `features/*.md`.
> **관련 소스**: `components/*`(Modal, CharacterTrackingPicker, BossPortrait 등) · `src/index.css` · 각 화면 공통 레이아웃 · `lib/world-emblem`.
> **관련 ADR**: [[ADR-009]] [[ADR-015]] [[ADR-016]] [[ADR-018]] [[ADR-064]] [[ADR-072]] [[ADR-073]] [[ADR-074]]. **관련 문서**: [features/theme.md](../features/theme.md).

## 디자인 원칙
1. **캐주얼하고 친근한 게임 컴패니언 톤** — 정색한 업무 대시보드가 아니라 매일 캐릭터 챙기는 가벼운 도구. 라이트 테마가 기본.
2. 컴포넌트 성격별로 라운딩을 다르게 줘 캐주얼함을 표현(전부 rounded-2xl 통일 금지) — 카드 중간(14px), Primary 버튼·배지 캡슐형(pill), 인풋 각진(10px).
3. 정보 밀도 높은 리스트/카드 UI.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 | 이유 |
|---|---|
| `backdrop-filter: blur()` (glass morphism) | AI 템플릿의 가장 흔한 징후 |
| gradient-text | AI SaaS 랜딩 1번 특징 |
| "Powered by AI" 배지 | 장식, 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = 슬롭 |
| 보라/인디고 브랜드 색 | "AI=보라" 클리셰 |
| 모든 카드 동일 rounded-2xl | 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩에 있는 장식 |

## 색상 — 기본 팔레트
테마 시스템(아래 [features/theme.md](../features/theme.md)) 도입 전/미선택 시의 폴백 값. 배경·보더·텍스트 모두 순수 무채색 대신 오렌지 쪽으로 살짝 기운 웜뉴트럴.

**배경** — 라이트(기본): 페이지 `#FFF9F4`, 카드 `#FFFFFF`, 보더 `#F0DFD1`, 보더(연함) `#F7EDE3`. 다크(보조): 페이지 `#0a0a0a`, 카드 `#141414`, 보더 `#262626`.
**텍스트** — 라이트: 주 `#2B1B10`, 본문 `#5B4636`, 보조 `#8A7362`, 비활성 `#B7A490`. 다크: `text-white`/`neutral-300`/`neutral-400`/`neutral-500`.

**Primary(강조)**: 채움 `#FF7033`(hover `#E6652E`, active `#C75728`). 텍스트/아이콘 — 라이트 배경 `#C2410C`, 다크 배경 `#FF7033`. Subtle 배경 라이트 `#FFE9DB`/다크 `#FF7033/15`. Border 라이트 `#FFC9A8`/다크 `#FF7033/40`.

> **채움 위 전경색을 고정하지 않는다** ([[ADR-064]] 결정 1). 이 절의 옛 규칙("채움으로 쓸 때 텍스트는 짙은 `#2B1206`")과 코드에 굳어 있던 `text-white`·`text-bg` 는 모두 **"primary는 충분히 어둡다"를 전제**한 것이라 폐기했다. 밝은 파스텔 primary 테마도 어두운 primary 테마도 성립해야 하므로, 채움 위 전경은 항상 `on-primary`·`on-secondary`·`on-third`·`on-error` 토큰을 쓴다. 마찬가지로 accent 계열 텍스트·아이콘은 `*-ink`, 옅은 배경은 `*-tint` 다 — 이름 규칙과 대비 요구는 [features/theme.md](../features/theme.md).

**데이터/시맨틱 색** (라이트 배경은 텍스트용 짙은 버전 + 배지 배경용 옅은 버전):
| 용도 | 텍스트(라이트) | 배지 배경(라이트) | 다크 배경용 |
|---|---|---|---|
| 긍정/성공 | `#15803D` | `#DCFCE7` | `#22c55e` |
| 부정/에러 | `#B91C1C` | `#FEE2E2` | `#ef4444` |
| 중립/기본 | `#78716C` | — | `#525252` |

Primary는 브랜드 강조 전용 — 성공/에러 상태 표시에는 쓰지 않는다(의미 혼동 방지). 실제 컴포넌트 에러 텍스트는 이 표가 아니라 테마 `error` 토큰([features/theme.md](../features/theme.md))을 쓴다.

**값의 증감 — `rise`/`fall`** ([[ADR-087]] 결정 5): 위 표의 "긍정/부정"과 **다른 축**이다. 늘어난 것이 좋은 일이고 줄어든 것이 나쁜 일이라는 뜻이 아니라 방향만 말한다. 주식 신호 관례를 따라 **상승 빨강 · 하락 파랑**이고, `error`(빨강)와 색상은 가깝지만 한 화면에서 인접하지 않는다(실패는 토스트·`ErrorState`, 증감은 값 옆 칩).
```
riseTint/riseInk · fallTint/fallInk — 테마 토큰(고정 hex 아님)
휴 고정(rise 26 · fall 262) + mode 램프 + 표면 15% 혼합 틴트 — error·info 와 같은 파생 방식
```
**고정 hex 를 쓰지 않는 이유**: 테마는 직업별로 만들어지고 라이트·다크가 섞여 있어, 한 쌍으로는 어느 한쪽에서 반드시 죽는다(라이트용 진한 빨강은 `#0B0B0B` 배경에서 안 읽히고, 다크용 밝은 파랑은 `#FFFFFF` 카드 위에서 뜬다). **방향이 없는 상태("같음")에는 신호색을 쓰지 않는다** — 빨강도 파랑도 거짓이므로 `primary` 계열(테마 색)로 둔다. 현재 사용처는 보스 수익 증감 칩 하나([features/boss-profit.md](../features/boss-profit.md)).

## 기본 컴포넌트
**카드**
```
라이트: rounded-[14px] bg-white border border-[#F0DFD1] shadow-[0_1px_2px_rgba(43,27,16,0.04),0_4px_12px_rgba(255,112,51,0.06)] p-6
다크:   rounded-[14px] bg-[#141414] border border-neutral-800 p-6
```
그림자는 검정이 아니라 텍스트·Primary색을 옅게 섞은 웜톤, 애니메이션 없는 정적 elevation.

**버튼**
```
Primary(테마 공통): rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover px-5 py-2.5
Outline:            rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text hover:bg-primary-tint
Text(라이트): text-[#8A7362] hover:text-[#5B4636]   Text(다크): text-neutral-500 hover:text-neutral-300
```
`Outline` 은 **주 CTA 옆/아래에 서는 부 동작**용이다(2026-08-08, 온보딩 API 키 화면의 "API 키 발급 방법 보기"가 첫 사용처 — [features/onboarding.md](../features/onboarding.md)). `danger` 와 같은 테두리 pill 형태이되 색이 중립(`border`/`text`)이라 파괴적 동작과 헷갈리지 않고, hover 는 새 색을 만들지 않고 `primary-tint` 를 쓴다(선택 카드 hover 와 같은 값). **변형 클래스는 `Button.tsx` 가 아니라 `Button/variants.ts` 의 `BUTTON_VARIANT_CLASS` 에 있다** — 외부 URL로 나가는 이동은 `<button>` 이 아니라 `<a>` 여야 하므로(링크 시맨틱·`target`/`rel`) 겉모습만 입힐 길이 필요한데, 컴포넌트 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다(`react-refresh/only-export-components`). `Button` 자신도 같은 상수를 쓰므로 두 벌이 되지 않는다.
**입력 필드**
```
라이트: rounded-[10px] bg-white border border-[#F0DFD1] px-4 py-3 text-[#2B1B10]
다크:   rounded-[10px] bg-neutral-900 border border-neutral-800 px-4 py-3
```

## 공유 컴포넌트 (여러 기능이 함께 씀)

### 모달 (`components/Modal`) — 2026-07-13
`CharacterTrackingPicker`/`DisconnectConfirm` 에서 반복되던 오버레이(`fixed inset-0 flex items-center justify-center bg-scrim`, 안쪽 카드 `onClick` `stopPropagation`)를 공용화. 스크림은 `bg-bg/70` 이 아니라 전용 `scrim` 토큰이다([[ADR-064]] 결정 6) — 배경색을 반투명하게 깐 것은 밝은 테마에서 스크림이 약해진다. 기본은 카드(`rounded-[14px] border border-border bg-surface p-6`)를 제공하되, `card={false}` 면 위치 고정 래퍼만 남기고 카드 스타일 생략(자식이 자체 카드를 둘 때 카드-안-카드 방지). 설정의 계정 변경 모달·계정 선택 목록이 `card={false}` 로 재사용.

### 캐릭터 카드 그리드(다중 선택) — `CharacterTrackingPicker`, [[ADR-015]]
"캐릭터 관리" 피커. 컨텐츠/보스 스케줄러가 동일 컴포넌트 공유. **3열 그리드**, 카드 자체가 토글 버튼(체크박스 없음, `aria-pressed`).
```
카드: rounded-[14px] border, 선택 시 border-primary bg-primary-tint, 미선택 시 border-border hover:bg-primary-tint
아바타 프레임: 56px 원형 overflow-hidden, 확대된 <img> 절대 위치로 얼굴 크롭 (max-w-none 필수 — preflight img{max-width:100%}가 확대를 눌러버림)
즐겨찾기: lucide Star, top-1.5 right-1.5. 미선택 text-text-muted 아웃라인 / 선택 fill-primary text-primary
텍스트: 이름 text-xs font-semibold text-text + 서버 엠블럼(h-3.5), 레벨 text-xs text-text-muted (직업 미표시)
```
정렬: **즐겨찾기(선택) 먼저, 그다음 나머지**, 각 그룹 내부 레벨 내림차순 — 즐겨찾기 토글 시 즉시 재배치. `character/basic` 실패 캐릭터는 "?" 플레이스홀더 + 이름·레벨 유지(선택 가능) — 단 [[ADR-053]] 이후 이 폴백은 **캐시가 있는 캐릭터에만** 적용된다(캐시도 없고 조회도 실패한 캐릭터는 `access_flag` 를 확인할 길이 없어 목록에 아예 넣지 않는다). 서버 엠블럼은 `lib/world-emblem`(데이터 `world-emblems.json`) 재사용, world 없거나 미매핑이면 생략. 모달 헤더(제목+설명 `mb-4 space-y-1`), **이 모달은 오버레이 클릭으로 닫히지 않음**(닫기/저장 버튼만, 자체 오버레이라 이 모달에만 적용).

**모달 높이와 스크롤포트 ([[ADR-107]], 2026-08-06)**: 카드 높이의 상한은 **안전영역을 뺀 화면**이고, 스크롤포트는 그리드가 아니라 **쓰는 쪽**이 갖는다([[ADR-099]] 가 화면 스크롤에 세운 규칙과 같다 — 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 그려지므로, 스크롤포트가 카드 `p-6` 안쪽이면 인디케이터도 24px 안쪽에 뜬다).
```
오버레이: fixed inset-0 z-50 flex items-center justify-center bg-scrim
          px-4 pt-[calc(1rem+var(--sa-top))] pb-[calc(1rem+var(--sa-bottom))]   ← 안전영역 + 1rem 여백
카드:     flex max-h-full w-full max-w-sm flex-col p-6   (헤더·푸터 shrink-0 — 줄어드는 것은 본문뿐)
스크롤포트(모달):   -mr-6 min-h-0 overflow-y-auto pr-6   ← 음수 마진이 카드 테두리까지 넓혀 인디케이터를 끝에 붙이고,
                                                          같은 크기 패딩이 콘텐츠 여백을 되돌린다
스크롤포트(온보딩): max-h-[70vh] overflow-y-auto        ← 페이지라 상한이 스스로 필요하다
```
스탈 배너는 스크롤포트 **밖**에 둔다(목록을 굴려도 "최신이 아님"은 계속 보인다). `CharacterTrackingGrid` 자신은 상한도 스크롤도 갖지 않는다.

**로딩/빈/실패 상태 ([[ADR-053]], 구현 완료 2026-07-29)**: 그리드에 항목이 없을 때 세 경우를 구분해 그린다(빈 상태로 위장 금지, [error-resilience.md](./error-resilience.md) 원칙 1·2). 항목이 하나라도 있으면 조회 중이어도 기존대로 그리드만 그린다([[ADR-016]] 캐시 우선 표시를 스피너로 가리지 않는다). 어느 상태인지는 `getCharacterPickerRoster` Promise의 resolve/reject로 호출부가 판정해 필수 props `isLoading`·`loadFailed` 로 내려준다(정책 원문 [../features/content-scheduler.md](../features/content-scheduler.md)).
```
공통 자리: flex min-h-[120px] items-center justify-center (그리드 자리 중앙)
조회 중:   MapleSweepSpinner size={32} text-primary, 래퍼에 role="status" aria-busy="true" aria-label="캐릭터 목록을 불러오는 중"
           (모달·페이지 안이라 셸 승계 카드는 씌우지 않는다 — 위 "로딩 표현" 참고, [[ADR-061]])
조회 실패: 공용 ErrorState (아래 "실패 상태" 절, [[ADR-062]])
항목 0건: text-sm text-text-muted "표시할 캐릭터가 없어요"
```
**본문 자리 높이는 카드 3줄로 못 박는다** — `ROSTER_BODY_MIN_H`(`min-h-[385px]`, `CharacterTrackingGrid`에서 export). 실측 385px = 카드 123px × 3 + `gap-2` 8px × 2. 슬롯은 `flex flex-col`이고 중앙 정렬 분기(스피너·실패·빈 상태)는 `flex-1`로 그 높이를 채운다(그리드는 위쪽 정렬). **모달에서는 이 최소 높이를 클램프한다** — `min-h-[min(385px,calc(100dvh-var(--sa-top)-var(--sa-bottom)-15rem))]`. CSS 에서 `min-height` 는 `max-height` 를 이기므로 385px 를 그대로 두면 위 카드 상한이 짧은 기기에서 무효가 된다([[ADR-107]] 결정 2 — 클램프는 385px 가 애초에 안 들어가는 기기에서만 발동한다). 온보딩은 페이지라 클램프 없이 `ROSTER_BODY_MIN_H` 그대로다. 이 고정이 없으면 상태마다 높이가 달라 아래 CTA(온보딩 "계속하기", 모달 "닫기·저장")가 위아래로 움직이고, 실패 상태의 액션 버튼이 CTA에 붙어 보인다(사용자 보고 2026-07-30) — [[ADR-054]] 정정 4에서 라벨행을 `h-6`으로 명시 고정한 것과 같은 처방이다.
실패는 원인(`loadError: ScheduleSyncError | null`)을 받아 원인별 문구·액션을 그린다 — 자세한 것은 아래 "실패 상태" 절([[ADR-062]]). **보여줄 항목이 있는 채로 실패하면** 목록을 지우지 않고 그 위에 스탈 배너를 얹는다. 온보딩 캐릭터 선택 단계(`ContentCharacterStep`)는 같은 분기를 페이지에서 직접 그리며 액션만 다르다(온보딩 중에는 설정 화면이 없다, [onboarding.md](../features/onboarding.md)).

### 빈 상태 (`components/EmptyState`) — [[ADR-060]], 구현 완료 2026-07-29
"비어있음"을 표시하는 11곳이 이 컴포넌트 하나를 쓴다. `size` 두 변형만 다르고 구조는 동일 — **원형 배지(컨텍스트 아이콘) + 제목 + 설명 + CTA**, 중앙 정렬.
```
공통:   flex flex-col items-center text-center, 배지 rounded-full bg-primary-tint, 아이콘 text-primary-ink strokeWidth 1.75
page:   배지 84px / 아이콘 40px / 제목 text-base / 설명 text-sm max-w-[220px] / CTA px-5 py-2.5 text-sm / gap-4
inline: 배지 56px / 아이콘 28px / 제목 text-sm  / 설명 text-xs max-w-[240px] / CTA px-4 py-2 text-xs / gap-3
        + 박스 rounded-[14px] border border-border bg-surface px-4 py-8 (page 는 자체 박스 없음 — 화면이 감싼다)
CTA:    rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover (Primary 버튼 재사용, 새 스타일 금지)
```
- **배지 안 마크는 자리에 따라 둘로 갈린다**([[ADR-060]] 결정 2): **목록 빈 상태(inline)는 화면별 컨텍스트 아이콘** — 컨텐츠 `ListChecks` · 보스 `Swords` · 필터 `SlidersHorizontal` · 수익 `ProfitIcon`(커스텀, [[ADR-066]]) · 드롭 `PackageOpen`. 목록 자리는 "무엇이 비었는지"를 알려야 하기 때문. **캐릭터 미선택(page)은 브랜드 마크(단풍잎, `icon="leaf"`)** — 화면 전체를 차지하는 자리라 앱의 얼굴 역할을 겸한다(사용자 결정).
- **문구 규칙**: 제목은 *무엇이* 비었는지(`추적할 일간 컨텐츠가 없습니다` / `등록된 주간 보스가 없습니다`) — 탭·모드별로 문구를 나눈다(일간/주간, 주간/월간, 수동/자동이 같은 문구를 공유하지 않는다). 설명은 다음 행동 한 줄. CTA 라벨은 목적지 이름 그대로(`컨텐츠 관리`·`보스 관리`).
- **CTA는 문구가 지시하는 곳으로 실제 이동시킨다** — 수동 모드 컨텐츠 `/content/manage`, 수동 모드 보스 `/boss/manage`, 필터 결과 없음은 필터 초기화. **갈 곳이 없으면 CTA를 만들지 않는다**: 자동 모드("게임에서 등록해주세요")는 목적지가 앱 밖이고, 보스 수익 "아직 처치한 보스가 없습니다"는 앱 안에 할 일이 없다. 억지 목적지 금지.
- **"조회 불가"에는 이 컴포넌트를 쓰지 않는다** — 아래 `UnavailableNotice` 참고([error-resilience.md](./error-resilience.md) 원칙 2).
- 배지(둥근 배경 박스)는 아래 "아이콘" 절의 *배경 없이 단독* 규칙에 대한 **명시적 예외**다 — 빈 상태 배지는 아이콘이 아니라 **일러스트 자리**로 취급한다.

### 로딩 표현 (`components/LoadingState`, `components/MapleSweepSpinner`) — [[ADR-061]], 구현 완료 2026-07-30
"기다리는 중"을 표시하는 모든 자리가 지키는 규칙. 세 상태(**조회 중 / 확정된 빈 상태 / 확인 불가·실패**)는 항상 서로 구분 가능해야 한다([error-resilience.md](./error-resilience.md) 원칙 2) — 그래서 로딩은 빈 상태의 어법(점선 박스·배지+CTA)을 쓰지 않는다.

**스피너는 2종, 크기로 갈린다.**
```
버튼 내부(16px)      MapleSpinner        단풍잎 외곽선 둘레의 70% 구간이 도는 comet
그 밖(24·32px)       MapleSweepSpinner   흐린 잎 위로 밝은 띠가 아래→위로 훑고 지나간다
```
스윕이 16px에서 안 읽히고(띠가 잎보다 커져 바탕만 남아 비활성처럼 보인다) 트레일 링이 32px를 못 채우기 때문 — 두 크기 대역의 요구가 반대라 한 시안으로 덮이지 않는다. 스피너 색은 `text-primary`, 대기 문구는 `text-sm text-text-muted`.

**셸 승계 카드 (`components/LoadingState`)** — 콜드 스타트와 영역 부분 로딩이 공유한다. 로딩이 끝나면 그 자리를 채울 카드와 **같은 껍데기**라 결과가 들어와도 배경이 바뀌지 않는다(스켈레톤 없이 "자리를 미리 잡는" 효용을 얻는 지점).
```
공통:   rounded-[14px] border border-border bg-surface p-6
        + flex flex-col items-center justify-center gap-3 text-center
        + 래퍼에 role="status" aria-busy="true"
page:   스피너 32px, min-h-[132px] — 스케줄러 3화면 콜드 스타트, 컨텐츠·보스 관리 화면 최초 진입
inline: 스피너 24px             — 보스 수익 과거 기간 백필
```
- **목록·카드가 들어올 자리에만 쓴다.** 모달 안(캐릭터 관리 피커)이나 화면 전체 대기(온보딩 시드·예열)는 이미 자기 껍데기가 있거나 뒤에 카드가 오지 않으므로 카드를 씌우지 않고 **스피너 + 문구만** 둔다.
- **캐시가 남아 있으면 쓰지 않는다** — 재검증(SWR) 중에는 기존 내용을 그대로 보여준다([[ADR-016]]). 이 카드는 "보여줄 것이 하나도 없을 때"만.

**버튼 내부 대기** — `MapleSpinner size={16}` + 라벨 병기(`gap-2`), `aria-busy` + `disabled`. 라벨을 지우지 않는 이유는 파괴적 동작(캐시 삭제·연결 해제)에서 무엇이 진행 중인지 글자로 확인돼야 하기 때문이고, 형태를 하나로 맞추려고 조회성 버튼에도 같은 규칙을 쓴다.

**문구 규칙** — 말줄임표가 붙는 `~중...`은 **새로고침 옆 `조회 중...` 한 곳**에만 남는다(그 자리는 "마지막 동기화 3분 전" 시각 표시를 잠시 대체하는 라벨이라 짧아야 한다).
```
버튼 안:  ~중 (말줄임표 없음)   확인 중 · 삭제 중 · 해제 중 · 적용 중
그 밖:    ~하고 있어요          불러오고 있어요 · 캐릭터 정보를 준비하고 있어요 (N/M)
말줄임표: ...(마침표 3개)로 통일. …(1글자) 금지
```

**쓰지 않는 것**: 점선 박스(빈 상태 전용) · 스켈레톤(미도입) · 비-브랜드 CSS 링 스피너 · `MapleWaveProgress`(폐기) · 진행률 바 `h-2` 변형(폐기). 새로고침 아이콘(`RefreshCw`)의 회전은 스피너가 아니라 **기능 신호**라 교체 대상이 아니다.

### 조회 불가 알림 (`components/EmptyState/UnavailableNotice`) — [[ADR-060]]
확인 자체를 못 한 상태(보스 수익 롤링 조회 윈도우 밖, [[ADR-032]])는 빈 상태와 **디자인을 공유하지 않는다** — 같은 모양이면 "데이터가 없다"로 오해된다. 톤은 경고(error)가 아니라 **정보**: 사용자가 고칠 수 있는 실패가 아니라 API의 알려진 제약이라 error 색은 과하다.
```
기본:    flex items-start gap-3 rounded-[14px] border border-border bg-info-tint p-4
         + Info 아이콘(h-5 text-info-ink) + 제목 text-sm font-semibold + 설명 text-xs text-text-muted
compact: 카드 안에 중첩될 때. rounded-[10px] bg-surface-2 px-3 py-2.5, 아이콘 h-4, 제목 한 줄만(설명 생략)
```
문구 어미는 실패와 같은 `~습니다` 를 쓴다([[ADR-062]] 결정 5) — 정보 톤은 **색(info-tint)이 담당하지 어미가 담당하지 않는다**.

**선택 카드 안의 주의 줄은 이 규격의 축소판이되 컴포넌트를 공유하지 않는다** ([[ADR-035]] 결정 22, 2026-08-03). 트래킹 모드 옵션(온보딩 `TrackingModeStep`·설정 `TrackingModeSelector`)이 각 모드의 한계를 고지하는 자리 — `rounded-[8px] bg-info-tint px-2.5 py-1.5 text-xs text-info-ink` + `Info h-3.5`. 색·아이콘·"고칠 수 없는 제약이므로 error 가 아니다"는 판단을 그대로 물려받는다. 이 컴포넌트를 재사용하지 않는 이유는 **`UnavailableNotice` 가 문구를 자기 안에 고정으로 갖기 때문**이고(임의 문구를 못 받는다), 어미도 `~습니다` 가 아니라 **같은 카드 안 설명문과 맞춘 `~요`** 다(한 카드 안에서 어미가 갈리면 두 문장이 다른 출처처럼 읽힌다). 규격 전문은 [../features/settings.md](../features/settings.md).

### 실패 상태 (`components/ErrorState`) — [[ADR-062]]
로딩·빈 상태·조회 불가에는 공용 컴포넌트가 있는데 실패에만 없어 화면마다 `text-error` 한 줄을 각자 갖고 있던 것을 통일한다. 세 상태(**조회 중 / 확정된 빈 상태 / 확인 불가·실패**)는 항상 구분 가능해야 하므로([error-resilience.md](./error-resilience.md) 원칙 2) 빈 상태와 **디자인을 공유하지 않는다**.

| | 아이콘 | 색 | 정렬 | 액션 |
|---|---|---|---|---|
| `EmptyState` | 원형 배지 **안** | 브랜드(primary) | 중앙 | 목적지가 앱 안에 있을 때만 |
| `UnavailableNotice` | 단독 `Info` | 정보(info-tint) | 좌측 | 없음(고칠 수 없음) |
| **`ErrorState`** | **단독** `AlertTriangle` | 경고(error) | 중앙 | **항상** |

```
flex min-h-[120px] flex-col items-center justify-center gap-3 px-4 text-center
+ AlertTriangle h-7 w-7 text-error-ink (배지 없이 단독)
+ 제목 text-sm font-semibold text-text
+ 설명 text-xs text-text-muted (mx-auto max-w-[240px])
+ 액션 rounded-full bg-primary text-on-primary px-4 py-2 text-xs
```
- **배지를 쓰지 않는다** — 아래 "아이콘" 절의 *배경 없이 단독* 규칙을 그대로 따른다(예외를 늘리지 않는다). 그 결과 배지 유무만으로 빈 상태와 즉시 갈린다.
- **`ErrorState` 자신은 배경을 두지 않는다** — 색은 아이콘에만, 배경은 감싸는 쪽 카드에 맡긴다. 재시도 버튼은 파괴적 동작이 아니라 진행 동작이라 `bg-primary`(삭제 버튼의 `border-error text-error-ink` 와 구분). ~~`error-tint` 토큰을 만들지 않는다~~ 는 [[ADR-064]] 결정 2로 폐기됐다 — `error-tint` 는 `color-mix` 파생이라 테마당 추가 비용이 0이고, 아래 스탈 배너가 쓴다.
- **자체 카드·크기 변형이 없다** — 적용처 두 곳이 모두 이미 껍데기 안이다(피커=모달 카드, 온보딩=페이지). `LoadingState` 를 이 두 자리에 씌우지 않는 것과 같은 판단([[ADR-061]]).
- **원인별 문구·액션**은 자리에 따라 갈린다 — 피커의 `invalidApiKey` 는 **액션 없음**(화면이 곧 키 입력으로 이동해 누를 것이 없다, [[ADR-115]] 결정 7 · 2026-08-08 — 옛 `설정 열기` 는 설정에 키를 바꿀 자리가 없어 거짓이었다), 나머지는 다시 시도. 온보딩의 401 만 **다시 시도**를 유지한다(무효화 경로가 성립하지 않는 자리라 재시도가 실제 처방이다, [[ADR-115]] 결정 6). 표는 [[ADR-062]] 결정 3.
- **429에는 액션 자체를 주지 않는다**([[ADR-114]] 결정 2, 2026-08-08). 처방이 재시도가 아니라 **키 단계 확인**이기 때문이다 — 문구는 제목 `호출 한도를 초과했습니다` / 설명 `입력하신 API 키가 서비스 단계 키인지 확인해주세요`(결정 1). `characterUnavailable` 의 액션 없음도 그대로다. 401(피커)의 "설정 열기"는 그때 유지됐으나 [[ADR-115]] 결정 7 로 **액션 없음**이 됐다(위 줄).

**어디에 띄우는가 ([[ADR-063]])** — 기준은 하나다: **그 문구가 사라진 자리에 남는 것이 있는가.** 남으면 실패는 이벤트이므로 **토스트**(액션을 붙일 수 있다), 문구 자체가 그 자리의 내용이면 **인라인**(`ErrorState`). 판정 근거와 자리별 목록은 [error-resilience.md](./error-resilience.md) 원칙 4.
- **토스트로 옮긴 것**: 스케줄러 3화면의 동기화 전체 실패(새로고침 옆 "n분 전"이 지속 상태를 담당) · 보스 수익의 파티원 수 저장 실패(스테퍼가 남는다) · 일부 캐릭터 실패(이름 대신 인원 수 — 본문이 `truncate`라 나열하면 잘린다) · 스케줄러 두 화면의 **캐릭터별** 동기화 실패 · 보스 수익 기간 로드 실패(**카드가 있을 때만**) · 온보딩 계정 선택 실패([[ADR-083]]).
- **인라인으로 남는 것**: 피커 · 온보딩 캐릭터 선택 스텝 · 계정 플로우 카드 · 조회 불가·집계 전 안내 · 설정 행의 값 · 보스 수익 기간 실패(**카드가 없을 때**) · 드롭 히스토리 로드 실패.
- 토스트 액션도 같은 규칙이다 — `network`는 **다시 시도**, `rateLimited`는 **액션 없음**, `characterUnavailable`은 **액션 없음**(영구 실패라 눌러도 같은 400, [[ADR-083]] 결정 2). `invalidApiKey` 는 **동기화 훅이 토스트를 아예 띄우지 않는다** — 키 무효화 진입점이 자기 문구(`API 키가 더 이상 유효하지 않습니다`)를 **액션 없이** 띄우고 화면을 키 입력으로 옮긴다([[ADR-115]] 결정 1·7, 2026-08-08).
- **토스트 액션 아이콘**: 액션 슬롯은 아이콘만 보이고 `label` 은 `aria-label` 로만 쓰인다. 기본 아이콘(`RefreshCw`)이 "다시 시도"를 전제하므로 **뜻이 다른 액션은 `ToastAction.icon` 으로 자기 아이콘을 넘긴다** — "설정 열기"에 새로고침 아이콘을 쓰면 무엇을 하는 버튼인지 어긋난다([[ADR-063]]).

**스탈 배너** — 보여줄 항목이 있는 채로 실패했을 때. 목록을 지우지 않고 그 위에 한 줄로 얹는다.
```
mb-3 flex items-center gap-2 rounded-[10px] bg-error-tint px-3 py-2.5
+ AlertTriangle h-4 text-error-ink + 문구 text-xs text-text + (선택) 우측 액션 text-xs font-semibold text-primary-ink
```
- **문구도 액션도 원인별로 갈리고, 액션은 없을 수 있다**([[ADR-114]] 결정 3, 2026-08-08). 배너는 `message` 와 **옵셔널** 액션을 받고 `ScheduleSyncError` 를 직접 받지 않는다(molecule 이 feature 어휘를 알면 안 된다 — [[ADR-094]] 결정 2). 포맷은 호출부가 `formatStaleRosterError(error, place)`(`features/schedule-sync/format.ts`)로 한다. 원인별 표는 [../features/content-scheduler.md](../features/content-scheduler.md).
- **액션이 없어도 되는 이유는 자리에 있다** — 배너 아래에 목록이 그대로 남아 있어 막다른 길이 아니다. 같은 401 이 `ErrorState`(온보딩)에서는 재시도를 유지하는 것이 같은 근거의 뒷면이다(그쪽은 목록이 없어 액션을 빼면 화면에 아무 길도 없다).

### 앱 전역 폴백 (`components/ErrorBoundary`) — [[ADR-065]]
렌더 중 예외로 화면이 죽었을 때. 이 자리에는 남는 것이 아무것도 없으므로 화면 전체를 채운다.
```
flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center
+ AlertTriangle h-10 w-10 text-error-ink (배지 없이 단독 — ErrorState와 같은 어법)
+ 제목 text-base font-semibold text-text
+ 설명 text-sm text-text-muted (mx-auto max-w-[260px])
+ '다시 시작' 버튼 하나 (RotateCcw + bg-primary, max-w-[260px])
```
- **선택지를 하나만 둔다** — 설정 열기·스택트레이스 노출·브랜드 마크 모두 없다. 이 화면의 목적은 복구 도구를 주는 게 아니라 **흰 화면을 없애는 것**이고, 리로드로 안 풀리는 크래시의 탈출구(OS의 앱 데이터 삭제·재설치)는 앱 밖에 있다.
- 크래시 리포팅은 미도입([error-resilience.md](./error-resilience.md) 원칙 7은 여전히 미구현).

### 캐릭터 관리 저장 진행률 모달 — 2026-07-16
"저장" 시 추적 캐릭터마다 `syncSchedules` 순차 호출하는 동안 캐릭터 관리 모달 **위에** 진행률 모달을 띄우고 완료 시 함께 닫는다. 진행률 바 스타일은 온보딩 예열 바와 동일(track `h-1.5 w-full rounded-full bg-track` + fill `h-1.5 rounded-full bg-primary`) + "캐릭터 정보를 저장하고 있어요 (N/M)". 공용 `Modal` 재사용, 저장 도중 오버레이 클릭 무시(완료 시 프로그램적으로만 닫음). 콜백 `saveTrackedOcids → refresh → syncSchedules` 로 `onProgress(completed, total)` 전달. 개별 실패는 조용히 폴백, 전역 에러면 화면 에러 상태 전환.

### 스케줄러 캐릭터 드롭다운 — 선택 캐릭터 월드 아이콘 — 2026-07-16
`CharacterSelectDropdown` 은 네이티브 `<select>` 유지(`<option>` 이미지 불가라 펼친 목록은 텍스트만). 닫힌 상태 왼쪽에 선택 캐릭터의 **월드 엠블럼** 오버레이: `<select>` 를 `relative` 래퍼로 감싸고 `<img>` 를 `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-auto object-contain`, `<select>` 에 `pl-9`. world 는 캐시 우선 뷰는 스케줄 캐시(`SchedulerCharacterState.world`)에서, 동기화 후 뷰는 sync 결과에서 — 캐시 있으면 API 응답 전 즉시 표시. 미매핑 월드 생략.

**화살표는 UA 것을 쓰지 않고 직접 그린다** — `appearance-none` + `ChevronDown`(`pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-muted`, `strokeWidth 2.5`). 두 크기 모두 같다([[ADR-096]] 결정 5, 2026-08-05). 이유 둘:
- **`padding-right` 로는 화살표를 못 옮긴다**(브라우저 실측). 네이티브 `<select>` 의 화살표는 **오른쪽 테두리에 붙어 함께 움직여서**, `padding-right` 를 12→16→32→64px 로 키워도 화살표와 테두리 사이 간격은 그대로고 상자만 넓어진다(글자만 왼쪽으로 밀린다).
- **UA 화살표는 플랫폼마다 모양이 다르다.** Android WebView(Chrome)·iOS WKWebView(Safari) 양쪽에서 도는 하이브리드라([[ADR-001]]) 그대로 두면 같은 화면이 기기마다 다르게 보인다.

**두 가지 크기**:
- `size="default"` — 스케줄러 화면(`/content`·`/boss`). 제목 아래 **독립된 줄**의 주 컨트롤이라 `min-w-[160px] py-3 text-sm`, 엠블럼 `h-[22px] left-3`, `pl-8 pr-9`, chevron `right-3.5 h-4 w-4`.
- `size="compact"` — 관리 화면(`/content/manage`·`/boss/manage`). 제목 줄 우측의 작은 자리라, 이 자리에 있던 읽기 전용 칩과 **같은 크기감**을 유지한다: `rounded-full border border-border py-1 text-xs`, 엠블럼 `h-[14px] left-2.5`, `pl-7 pr-7`, chevron `right-2.5 h-3 w-3`. default 를 그대로 넣으면 헤더가 두꺼워지고 좁은 화면에서 제목과 폭을 다툰다.

`pr` 은 chevron 자리를 비워 두는 값이다 — chevron 크기·`right` 를 옮기면 함께 조정한다(따로 두면 글자가 화살표 밑으로 들어간다).

### 진행률 바 프리미티브
`role="progressbar"` + `aria-valuenow/min/max`, track `h-1.5 w-full rounded-full bg-track` + fill `h-1.5 rounded-full bg-primary`. **결정형 진행률은 예외 없이 이것 하나**([[ADR-061]] 결정 6) — 온보딩 예열·계정 변경 예열·캐릭터 관리 저장·OTA 다운로드·컨텐츠 진행률이 모두 같은 스타일이다. 새 색/모양/두께 신설 금지.

## 공유 레이아웃 패턴

### 탭 토글(주간/월간, 일간/주간 등) — [[ADR-018]]
드롭다운·탭·카운트 배지를 **별도 카드로 묶지 않는다**(배경 위에 바로).
```
탭 행: flex items-center gap-4
활성 탭: rounded-full bg-primary-tint text-primary-ink px-3 py-[5px] text-sm font-semibold (배지 pill 재사용, 새 스타일 금지)
비활성 탭: 배경 없음, text-sm font-medium text-text-muted, 좌우 패딩 활성과 동일(px-3)
카운트 배지(있는 화면만, 예 n/12): 같은 줄 justify-between 오른쪽 끝, rounded-full bg-primary-tint text-primary-ink text-xs font-semibold px-2.5 py-1
```
활성/비활성 색 차이만으로는 저채도 팔레트에서 약해 배경 pill 필수(굵기 차이만으로 대체 금지). 기능 전용 변형(솔로/파티 필터·보스 수익 네비게이터)은 각 feature 문서.

### 스크롤 영역 — 2026-07-13 · 헤더는 `fixed` ([[ADR-098]]) · **스크롤은 화면이 소유** ([[ADR-099]], 2026-08-06)
컨텐츠/보스 스케줄러는 제목~탭(보스는 필터까지)을 상단 고정, 그 아래 목록만 스크롤. **스케줄러 계열 4화면(컨텐츠·컨텐츠 관리·보스·보스 관리)은 문서가 아니라 자기 스크롤 컨테이너를 스크롤한다**([[ADR-099]], 공용 셸 `components/templates/ScreenScroll`). 헤더는 공용 셸 `PageHeader`([[ADR-094]])가 `fixed` + 실측 spacer 로 낸다. **보스 수익도 같은 요소 스크롤러다**([[ADR-100]]) — 다만 `PageHeader` 를 쓰지 않고 자기 헤더를 같은 형태(`fixed` + 실측 spacer)로 낸다(경계 페이드를 페이지 헤더에 두지 않고 헤드라인 실측을 중첩 sticky 레일에 쓰기 때문, [features/boss-profit.md](../features/boss-profit.md)).
```
ScreenScroll: fixed inset-x-0 top-[var(--sa-top)] bottom-[var(--tab-bar-h)] overflow-y-auto overscroll-y-none
  안쪽 래퍼: -mt-[var(--sa-top)] space-y-4          ← 상단 인셋을 되돌려 위치·스크롤 범위 보존
    헤더 래퍼: (PageHeader 가 반환하는 <div>)
      헤더 블록: fixed inset-x-0 top-0 z-10 bg-bg px-4 pt-[calc(1rem+var(--sa-top))] pb-2 (+ 페이드)
      spacer:   흐름에서 빠진 헤더 자리 — 실측 높이(측정 layout effect 매 커밋 + ResizeObserver)
    목록 블록: px-4 pb-4 space-y-4
모달·오버레이: ScreenScroll **바깥** (안에 두면 z-50 이 그 스태킹 컨텍스트에 갇혀 z-30 탭바 아래로 간다)
```
**스크롤포트를 "실제로 보이는 영역"에 맞추는 것**이 이 셸의 규칙이다 — 스크롤 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 겹쳐 그려지므로, 상자가 화면 끝까지 닿으면 노치를 침범하고 탭바 뒤로 사라진다(둘 다 실기기 관측). 하단 값은 가정이 아니라 **탭바 실측**(`--tab-bar-h`, `BottomTabBar` 가 `ResizeObserver` 로 쓴다)이다.
**`sticky` 가 아니라 `fixed` 인 이유**: `sticky` 요소의 화면 위치는 스크롤 오프셋의 함수라, iOS 스크롤 스레드가 옛 오프셋을 뒤늦게 되돌려 보내는 프레임에 헤더가 화면 밖으로 날아간다([[ADR-085]] 실기기 계측 → [[ADR-098]] 로 탭 이동 경로까지 확장). 헤더는 문서 최상단의 첫 요소라 **보이는 모습은 어떤 스크롤에서도 동일**하고, 바뀌는 것은 그 위치를 무엇이 정하느냐뿐이다.

`bg-bg` 는 뒤 카드가 비쳐 보이지 않게, `z-10` 은 목록이 헤더 위로 안 올라오게. 빈 목록 안내는 헤더가 아니라 목록 영역에 둔다. **패딩은 화면 루트가 아니라 헤더/목록 블록에 각각.** 헤더의 `pt-[calc(1rem+var(--sa-top))]` 과 루트의 `-mt-[var(--sa-top)]` 은 짝이다 — 헤더가 노치까지 `bg-bg` 로 덮으면서 목록은 AppShell 의 `pt-[var(--sa-top)]` 과 중복되지 않게 시작한다.

**높이 실측은 공용 훅 `lib/use-measured-height.ts` 로 끝낸다**([[ADR-112]] 결정 2 — `PageHeader` 와 보스 수익 헤더가 같이 쓴다). 화면별로 재게 만들지 말 것([[ADR-094]] 가 없앤 복붙이다). **훅 안에는 effect 가 둘이고 역할이 갈린다**:

- **측정 effect — deps 없음.** 매 커밋 페인트 전에 `getBoundingClientRect().height` 를 잰다. `useEffect` 로 재면 첫 프레임에 spacer 가 0이라 목록이 위로 튄다([[ADR-085]] 결정 1). 그리고 **deps 를 붙이면** 헤더 안의 조건부 블록(탭 줄·로딩 카드·경고 줄)이 붙었다 떨어질 때 재실행되지 않아, 헤더는 짧아졌는데 spacer 는 옛 값인 프레임이 한 번 그려진다([[ADR-112]], 보스 수익에서 약 90px).
- **관찰 effect — `ResizeObserver`.** 렌더 밖에서 높이가 바뀌는 경우(폰트 로드·기기 회전) 담당. **측정 effect 를 대신하지 못한다** — RO 콜백은 페인트 전에 배달되지만 그 안의 `setState` 는 React 이벤트 밖이라 Scheduler 태스크로 넘어가 다음 프레임에 렌더된다([[ADR-102]] 와 같은 성질). 둘은 담당이 다르니 어느 쪽도 지우지 말 것.

훅의 API 는 `RefObject` 가 아니라 **콜백 ref** 다 — 요소를 state 로 잡아야 관찰 effect 가 요소의 등장·소멸을 따라 재부착되고, 그래야 헤더가 조건부로 언마운트되는 화면이 자기 상태를 deps 로 훅에 알려줄 필요가 없다.

**라우트 이동은 스크롤을 먼저 0으로 옮긴다**([[ADR-098]] 결정 1) — 화면을 통째로 바꾸는 이동은 `useNavigate` 가 아니라 `lib/use-screen-navigate.ts` 의 `useScreenNavigate()` 를 쓴다. 스크롤과 이동은 **같은 태스크**여야 한다(`rAF` 로 미루면 그 프레임에 떠나는 화면이 최상단으로 올라간 모습이 보인다 — 실기기 반려). 네 탭이 문서 스크롤 하나를 공유하므로, 그러지 않으면 새 화면이 비-0 오프셋으로 마운트되고 문서 높이가 다르면 클램프 프레임이 생긴다. 예외는 자기 스크롤 컨테이너를 갖는 `/profit/drops` 오버레이뿐이다([[ADR-077]]).

**헤더-목록 경계 페이드**: 고정 헤더의 불투명 배경이 스크롤 도중 경계를 딱 끊어 보이게 하는 문제 완화. 헤더 블록에 오버레이:
```
pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm
style: maskImage/WebkitMaskImage: linear-gradient(to bottom, black, transparent)
```
색(그라데이션)과 블러(같은 mask 그라데이션)를 동시에 옅어지게 해야 자연스럽다. `mask-image` 는 Tailwind 로 애매해 인라인 스타일(보스 카드 일러스트 페이드와 동일 패턴).

**예외 — 보스 수익 화면은 이 페이드 오버레이를 페이지 헤더가 아니라 "중첩 sticky 요소"(펼친 캐릭터 카드 헤더) 하단에 붙인다**([[ADR-047]] 결정 6·후속, 2026-07-28). 레시피는 동일하고 배경색만 그 요소의 표면색(`from-surface`)으로 바꾼다 — **페이드는 콘텐츠가 실제로 지나가는 경계에 둔다**는 원칙. 그 화면은 펼친 캐릭터 카드 헤더가 **중첩 sticky**로 페이지 헤더 바로 아래(= 이 오버레이가 덮는 `top-full h-8` 밴드)에 멈추는데, 오버레이는 `z-10` 페이지 헤더 안에 있고 카드는 `isolate`로 그보다 아래라 stuck 헤더 상단이 가려진다. 경계는 헤어라인(`h-px bg-border`)이 대신한다. **중첩 sticky를 도입하는 화면에서는 이 레시피를 그대로 쓰면 안 된다.** 나머지 4개 화면(컨텐츠·컨텐츠 관리·보스·보스 관리)은 중첩 sticky가 없어 페이드를 유지한다. 상세는 [features/boss-profit.md](../features/boss-profit.md).

### 당겨서 새로고침(pull-to-refresh) — [[ADR-072]] · 인디케이터 형태는 [[ADR-073]] · 마크는 [[ADR-074]] (구현 완료 2026-08-01 · 실기기 검증 보류)
> **구현**: `lib/pull-to-refresh.ts`(상수·순수 함수) · `lib/use-pull-to-refresh.ts`(`usePullToRefresh({ enabled, isRefreshing, onRefresh })`) · `components/PullToRefreshIndicator/`(표시 전용, `data-testid="pull-to-refresh-indicator"`) · `src/index.css`(러버밴드 억제). 화면은 `enabled` 만 계산해 넘긴다.

목록 최상단에서 아래로 당기면 그 화면의 헤더 새로고침 버튼과 **같은 재조회**가 돈다. 제스처는 버튼의 대체가 아니라 추가 수단이다. **헤더는 고정되고 목록만 손가락을 따라 내려가며, 벌어진 틈에 인디케이터가 뜬다**(RN `RefreshControl` 감각, [[ADR-073]]). 이 절이 구현의 단일 진실 공급원이며, **새 색·새 토큰·새 SVG 자산을 만들지 않는다** — 기존 토큰(`text-primary-ink`)과 `MAPLE_LEAF_PATH` 로 전부 표현된다.

```
적용 화면: 컨텐츠·보스·수익 3개 탭 최상위 화면만(서브 화면·설정 탭 제외)

목록 블록(sticky 헤더의 형제, `px-4 pb-4` 를 가진 블록) — data-testid="pull-content":
  style transform: translateY(<오프셋>px)   ← 오프셋이 0이면 transform 자체를 걸지 않는다
  style transition: 드래그 중 'none' / 그 외 PULL_SETTLE_TRANSITION
  (드래그 여부는 훅이 주는 isDragging — 손을 떼면 즉시 false라 재조회 중은 전환을 탄다)

인디케이터: sticky 헤더 블록의 마지막 자식(페이드가 있으면 그 다음 형제)
  루트: pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden
        aria-hidden="true"                 ← 문구가 없어 빈 라이브 리전이 되므로 접근성 트리에서 뺀다
        style={{ height: <오프셋>px }}      ← 목록 translateY 오프셋과 같은 함수·같은 값
  내용: flex h-full items-center justify-center
  마크는 두 구간 모두 28px, 형태가 바뀌지 않는다:
    당기는 중/임계 초과: 단풍잎 외곽선 링(MAPLE_LEAF_PATH, fill="none" stroke="currentColor"
                        strokeWidth 9, strokeLinecap round, pathLength 300)
                        진행률만큼 그려진다 — strokeDasharray "300 300",
                        strokeDashoffset = 300 × (1 − 진행률). 회전·불투명도 변화 없음
    재조회 중:          <MapleSpinner size={28} />  ← ADR-061 "24px 이상은 스윕"의 유일한 예외
  문구 없음

문서 스크롤 기준: window.scrollY <= 0
제스처 무시: 스크롤 가능한 조상 안에서 시작한 터치([[ADR-072]] 결정 14)
러버밴드 억제: index.css 의 html, body 에 overscroll-behavior-y: none
```
- **수치**: `PULL_RESISTANCE = 0.5`(감쇠 계수) · `PULL_THRESHOLD_PX = 56`(이 거리를 넘으면 놓았을 때 재조회, 재조회 중 목록이 머무는 위치이기도 하다) · `PULL_MAX_PX = 80`(더 당겨도 여기서 멈춘다) · `PULL_SETTLE_TRANSITION = 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)'`(정착·복귀 전환, 대상이 `transform` 하나로 못 박혀 있다).
- **오프셋이 0이면 `transform` 을 걸지 않는다** — `translateY(0px)` 조차 containing block·stacking context를 만들어 `position: sticky` 후손(보스 수익의 중첩 카드 헤더, [[ADR-047]])에 영향을 줄 수 있다. 평상시 DOM은 이 기능 도입 전과 같아야 한다. `transition` 속성은 컨텍스트를 만들지 않으므로 항상 걸어둔다(그래야 복귀 애니메이션이 산다).
- **마진·높이가 아니라 `transform` 인 이유** — 흐름을 바꾸면 터치 프레임마다 목록이 리플로우되고, 보스 수익 화면은 페이지 헤더 높이를 실측해 중첩 sticky 오프셋에 쓰므로([[ADR-047]] 결정 3) 펼친 카드 헤더가 손가락을 따라 흔들린다. `transform` 은 레이아웃을 유발하지 않아 둘 다 일어나지 않는다. **[[ADR-112]] 이후 이 조건이 더 빡빡해졌다** — 실측이 매 커밋 도는 layout effect 라, 흐름·크기를 바꾸는 방식으로 되돌리면 당기는 동안 프레임마다 강제 리플로우가 붙는다.
- **드래그 중에는 전환을 끈다** — 손가락이 붙어 있는데 전환이 걸리면 목록이 늦게 따라와 "끌린다"는 감각이 죽는다. 손을 뗀 뒤(정착·복귀)에만 전환을 건다.
- **인디케이터 높이와 목록 오프셋은 같은 함수(`resolveContentOffsetPx`)에서 나온다** — 두 벌로 계산하면 인디케이터가 카드 위에 겹치거나 빈 띠가 남는다.
- **마크 색은 두 구간 모두 `text-primary-ink`** — 문구가 없어져 `text-text-muted` 는 이 자리에서 쓰이지 않는다.
- **당김 구간의 링은 스피너가 아니다** — 스스로 움직이지 않고 손가락 위치의 함수로 `strokeDashoffset` 이 정해지는 **제스처 진행률 표시**다. 손을 멈추면 그림도 멈춘다.
- **재조회 구간만 이 절의 예외다** — 위 "로딩 표현"의 스피너 2종 규칙([[ADR-061]] 결정 1, 24px 이상은 스윕)에 대해 **PTR 인디케이터 한 자리만** 트레일 링을 쓴다([[ADR-074]] 결정 5). 근거는 크기가 아니라 **연속성** — 앞 구간이 링으로 그려졌으니 뒤 구간도 링이어야 손을 떼는 순간 마크가 안 바뀐다. **다른 자리로 넓히지 말 것**(그러면 배분 규칙이 무너지고 매번 판단하게 된다).
- **인디케이터에 문구를 두지 않는다**([[ADR-074]] 결정 1) — 당김은 손이 이미 하고 있는 동작이라 지시문이 알려주는 정보가 없고, 마크 하나가 진행률과 대기를 모두 말한다. 문구가 없으므로 `role="status"`/`aria-live` 를 걸지 않고 `aria-hidden="true"` 로 접근성 트리에서 뺀다 — 재조회 상태는 헤더의 `조회 중...` 이 이미 알린다([[ADR-061]] 결정 8).
- **재조회 중에는 새 당김을 시작하지 않고**(멱등성) **목록은 임계 위치에 머문다**(대기 신호가 위치로도 남는다, [[ADR-073]] 결정 5). 대기 판정은 세 화면 공통 `status === 'loading'`.
- 빈 상태(추적 캐릭터 0명)에서는 제스처를 끈다 — 당길 목록이 없다.

**헤더 버튼으로 시작한 재조회에는 인디케이터를 열지 않는다**([[ADR-072]] 결정 11) — 그 대기는 아이콘 회전 + `조회 중...` 이 이미 말하고 있어, 인디케이터까지 열면 같은 대기를 두 자리에서 말하게 된다.

### 레이아웃
- 전체 너비: 모바일 단일 컬럼, max-width 제한 없음(하이브리드 앱이라 데스크톱 와이드 미고려).
- 좌측 정렬 기본. 화면 패딩 `p-4`, 블록 사이 `space-y-4`, 카드 안쪽 `p-4`.
- **하단 고정 탭바**: 화면이 2개 이상 되는 시점부터 `border-t` + 아이콘(위)·라벨(아래). 아직 화면 없는 기능 탭은 만들기 전까지 추가 안 함. 설정은 4번째 탭.
  - **탭 이동은 `NavLink`가 아니라 캡처 단계 클릭 인터셉터가 책임진다**([[ADR-050]] 결정 1). `NavLink`는 활성 스타일(`isActive`)·`aria-current`만 담당한다. iOS에서 두 손가락 동시 탭이 React 이벤트 시스템을 안 타는 클릭을 만들어 `<a href>`의 기본 동작이 **문서 전체 리로드**로 새어 나간 사례가 있어(2026-07-28 실기기 확인), React 밖의 DOM 리스너로 `preventDefault()` + `navigate()`를 직접 수행한다. 탭바를 수정할 때 이 분담을 유지할 것.

## 타이포그래피
| 용도 | 스타일 |
|---|---|
| 페이지 제목(h1) | `text-lg font-semibold text-[#2B1B10]` |
| 섹션/카드 제목(h2) | `text-sm font-semibold text-[#2B1B10]` |
| 본문 | `text-sm text-[#5B4636]` |
| 보조/캡션 | `text-sm text-[#8A7362]` |
| 에러 문구 | `text-sm text-error-ink` |

## 애니메이션
- 확정 애니메이션 없음(2026-07-11) — hover 색 전환(`hover:bg-*`/`hover:text-*`) 정도만 Tailwind 기본. 페이드·슬라이드 등 명시적 트랜지션은 미도입, 필요해지면 추가.
- 기능 전용 연출(고가 드롭 강조 [[ADR-045]])은 [features/boss-profit.md](../features/boss-profit.md). 모든 모션은 `prefers-reduced-motion: no-preference` 에서만 재생(정적 폴백 유지)이 원칙.

## 아이콘
- **라이브러리: `lucide-react`**(확정) — 새 아이콘은 이 라이브러리에서만. 다른 아이콘 **라이브러리** 혼용은 계속 금지다.
- **예외: 도메인 아이덴티티 아이콘은 직접 그린다**([[ADR-066]], 2026-07-31) — 그 기능을 대표하는 자리에 한해 커스텀 SVG를 허용하되, **lucide 규격을 지키는 것이 조건**이다: 24 그리드 · `fill="none"` · `stroke="currentColor"` · `strokeLinecap`/`strokeLinejoin` `round` · 기본 `strokeWidth` 2 · 크기는 `className`이 정한다(`width`/`height` 속성은 lucide와 같은 24 폴백까지만 — CSS가 속성보다 우선하므로 `h-5 w-5`가 항상 이기고, 폴백이 없으면 `className` 없이 쓸 때 인라인 SVG 기본값 300×150으로 부푼다). 규격을 지켜야 같은 줄에 선 lucide 아이콘과 선 굵기·광학 크기가 어긋나지 않는다. 겹침 표현은 `clipPath`·`mask`가 아니라 **뒤 요소의 선을 끊어서**(한 문서에 여러 번 렌더되면 마스크 `id`가 중복된다). 현재 해당: `ProfitIcon`(수익 — 동전 더미 + 앞 동전).
- `strokeWidth`: 하단 탭바 `1.5`, 소형 액션(새로고침 등) `2`.
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다 — 강조색 아이콘을 배경 없이 단독으로. **예외 2곳**: 빈 상태 배지(위 `EmptyState`, [[ADR-060]] — 아이콘이 아니라 일러스트 자리)와 드롭 시트 카테고리 헤더.
- 현재 사용: 하단 탭바 `ListChecks`(컨텐츠)/`Swords`(보스)/`ProfitIcon`(수익, 커스텀)/`Settings`(설정), 새로고침 `RefreshCw`, 보스 카드 파티 배지 `Users`, 파티 스테퍼 `Minus`/`Plus`.

## 폐기된 정책 (history)
- ~~429의 재시도 버튼은 비활성화하지 않는다(사용자 결정 2026-07-30)~~ → **액션 자체를 주지 않는다**([[ADR-114]] 결정 2, 2026-08-08, 이슈 #158). 옛 결정은 "초당 한도라면 잠시 뒤 재시도가 통한다"를 전제했으나, 사용자가 쓰는 개발 단계 키는 일 한도를 소진하면 다음 날까지 안 풀리고 새 처방은 재시도가 아니라 키 단계 확인이다.
- ~~스탈 배너는 문구 한 가지("목록이 최신이 아닙니다")에 "다시 시도" 고정~~ → 원인별 문구 + **옵셔널** 액션([[ADR-114]] 결정 3, 2026-08-08). `network` 계열은 옛 문구·액션 그대로라 폐기가 아니라 좁혀진 것이다.
- ~~보스 수익은 아직 문서 스크롤(요소 스크롤러 전환 범위 밖)~~ → 보스 수익도 자기 스크롤 컨테이너를 스크롤한다([[ADR-100]], 2026-08-06). [[ADR-099]] 결정 4가 "범위 밖"으로 미뤄둔 것을 그 ADR 이 폐기했고(스케줄러 4화면이 실기기 검증을 통과한 뒤로는 스크롤 모델이 둘로 남는 비용이 더 컸다), 이 절의 문장만 그때 함께 고쳐지지 않았다.
- ~~스크롤 영역의 헤더 블록은 `sticky top-0` 이고, 보스 수익만 `fixed`(그 화면에서만 증상이 관측됐으므로)~~ → 스케줄러 4화면도 `fixed` + 실측 spacer([[ADR-098]], 2026-08-06). 탭 이동도 같은 스크롤 클램프를 만들고, `sticky` 헤더는 그 프레임에 화면 밖으로 날아간다. [[ADR-085]] 결정 1의 조건("헤더가 문서 최상단 첫 요소라 보이는 모습이 동일")은 이 화면들에서도 성립한다.
- ~~모드 전환 대기는 모달 본문 하단 인라인 `MapleSpinner size=18` + "적용하고 있어요"~~ → 적용 버튼 안 16px + "적용 중"([[ADR-035]] 결정 23, 2026-08-03). 18px 은 두 대역(버튼 안 16 / 그 밖 24·32) 어디에도 없던 유일한 예외였고, 그 자리에 확인 버튼이 생기면서 대기를 그릴 자리가 규칙 안으로 들어왔다. 이로써 `~하고 있어요` 예시에서 "적용하고 있어요"가 빠진다.
- ~~당김 인디케이터는 문구 3상태(`당겨서 새로고침`/`놓으면 새로고침`/`새로고침하고 있어요`) + 채운 단풍잎 회전(진행률 × 180deg·불투명도 0.3~1), 재조회는 스윕 스피너~~ → 문구 없이 단풍잎 로고 링(진행률 드로잉 → 회전)([[ADR-074]], 2026-08-01). 지시문은 손이 이미 하는 동작을 읽어줄 뿐이고, 회전은 "얼마나 남았는지"를 못 말하며, 손을 뗄 때 마크가 바뀌면 한 동작이 둘로 끊겨 보인다.
- ~~당김 인디케이터는 sticky 헤더 아래 불투명 배너(`border-b border-border bg-bg`, 고정 `h-14` 내용을 위에서부터 드러냄), 목록은 고정~~ → 목록이 `transform: translateY()` 로 내려가고 벌어진 틈에 배경 없는 인디케이터([[ADR-073]], 2026-08-01). 배너 방식엔 "당겨진다"는 물리 감각이 없었고(사용자 반려), `transform` 은 레이아웃을 안 건드려 원래 근거(리플로우 없음·수익 헤더 실측 높이 불변)를 그대로 지킨다.
- ~~새 아이콘은 예외 없이 `lucide-react` 에서만 고른다~~ → 도메인 아이덴티티 자리는 lucide 규격을 지킨 커스텀 SVG를 허용([[ADR-066]], 2026-07-31). 선택된 그림(입체 동전 더미)이 라이브러리에 없었고, `Coins` 는 같은 소재의 평면 버전이라 대체가 되지 않았다. 다른 아이콘 **라이브러리** 혼용 금지는 그대로다.
- ~~수익을 가리키는 세 자리(탭바·총 수익 헤드라인·빈 상태)가 각자 lucide `Coins` 를 고른다~~ → 공용 `ProfitIcon` 한 곳([[ADR-066]], 2026-07-31). 셋이 같았던 것은 우연이라 한쪽만 바뀔 수 있었다.
- ~~일부 사용처의 배경 원으로 아이콘 감싸기~~ → 배경 없이 단독 사용으로 확정(2026-07-11).
- ~~비결정형 대기는 `MapleSpinner`(트레일 링) 한 종~~ → 크기로 2종, 24px 이상은 신규 `MapleSweepSpinner`([[ADR-061]], 2026-07-30).
- ~~결정형 진행률은 자리에 따라 `MapleWaveProgress`(화면)·얇은 바(모달)·`h-2` 바(OTA)~~ → 얇은 바 프리미티브 하나로 통일, `MapleWaveProgress`·`h-2` 변형 폐기([[ADR-061]], 2026-07-30).
- ~~로딩 자리마다 껍데기가 달랐다(텍스트 한 줄 / 점선 박스 / 없음)~~ → 목록·카드가 들어올 자리는 공용 셸 승계 카드 `LoadingState`, 점선은 빈 상태 전용([[ADR-061]], 2026-07-30).
- ~~대기 문구가 `~중...`과 `~하고 있어요`로 갈림~~ → 버튼 안은 `~중`(말줄임표 없음), 그 밖은 `~하고 있어요`, 말줄임표는 새로고침 옆 `조회 중...` 한 곳만([[ADR-061]], 2026-07-30).
- ~~피커·온보딩 조회 실패에 재시도 버튼을 두지 않는다(닫았다 다시 열면 재조회되므로 그 경로를 문구로 안내)~~ → 공용 `ErrorState` 가 원인별 액션(다시 시도 / 설정 열기)을 갖는다. 닫았다 여는 것으로 풀리지 않는 실패(401)가 있고, 원인을 못 보여주는 상태의 그 안내는 헛수고를 시킨다([[ADR-062]]가 [[ADR-053]] 결정 3 폐기, 2026-07-30).
- ~~실패 문구는 화면마다 `<p className="text-sm text-error">` 한 줄을 각자 보유~~ → 공용 `ErrorState`(아이콘 + 제목 + 설명 + 액션)([[ADR-062]], 2026-07-30).
- ~~에러 문구 어미가 인라인 `~습니다` / 토스트 `~어요` 로 갈림~~ → 실패·에러·불가는 `~습니다`, 성공·안내는 `~어요`, 진행 중은 `~하고 있어요`([[ADR-062]] 결정 5, 2026-07-30).
- ~~스케줄러 3화면이 동기화 실패를 헤더 아래 인라인 문단(`text-sm text-error`)으로 표시~~ → 토스트로 옮김. 지속 상태는 새로고침 옆 "n분 전"이 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다([[ADR-063]], 2026-07-30).
- ~~보스 수익 파티원 수 저장 실패를 카드 안 인라인 문단에 `err.message` 원문으로 표시~~ → 사용자 문구 토스트. 개발자용 문구·SQLite 네이티브 원문이 새던 유일한 자리였다([[ADR-063]] 결정 4, 2026-07-30).
- ~~일부 캐릭터 실패를 이름 나열로 표시("일부 캐릭터 동기화 실패: A, B — …")~~ → 인원 수를 담은 토스트. Toast 본문이 `truncate`라 이름은 잘렸다([[ADR-063]] 결정 5, 2026-07-30).
- ~~채움 배경 위 텍스트는 짙은 `#2B1206`(문서) / `text-white`(코드 7곳) / `text-bg`(코드 15곳)~~ → `on-*` 토큰([[ADR-064]] 결정 1, 2026-07-30). 셋 다 "primary는 충분히 어둡다"를 전제했고 지시된 적 없는 제한이었다. 밝은 파스텔 primary 테마에서 전부 깨진다.
- ~~틴트 배경은 Tailwind 투명도 접미사로 합성(`bg-primary/15` 등 67곳, 비율 4종)~~ → `*-tint` 값 토큰, 농도 15% 통일([[ADR-064]] 결정 2). 합성 결과가 깔리는 배경(`bg`/`surface`/`surface-2`)에 따라 달라져 대비를 보증할 수 없었다. `Toast`·`StaleBanner`가 이미 `color-mix`로 우회하던 것을 토큰으로 정식화.
- ~~틴트 위 텍스트에 base accent를 그대로 사용(`bg-primary/15 text-primary`, 35곳)~~ → `X-ink`([[ADR-064]] 결정 3). `-text` 토큰이 이 자리를 위해 만들어졌는데 정작 이 레시피가 안 썼다.
- ~~토큰 이름 `primary-text`/`secondary-text`/`third-text`~~ → `*-ink` 개명([[ADR-064]] 결정 3). 이름이 배경이 아니라 역할을 가리키게 했다 — `on-X`는 X 채움 위 전경, `X-ink`는 X 계열 텍스트/아이콘.
- ~~진행률 트랙은 `bg-surface-2`~~ → `track` 토큰([[ADR-064]] 결정 4). 채움(`primary`)과의 3:1을 보증하는 주체가 없어, 파스텔 primary + 라이트 테마에서 진행률이 안 읽혔다.
- ~~모달·바텀시트 스크림은 `bg-bg/70`~~ → `scrim` 토큰([[ADR-064]] 결정 6). 배경색을 반투명하게 깐 것이라 밝은 테마에서 스크림이 약했다.
- ~~일러스트 카드는 앱 테마와 무관하게 레테 다크 리터럴 고정(`#1A1720`/`#37323E`/`#E8DFEC`, 23곳)~~ → `media-*` 토큰 + `.media-scope`([[ADR-064]] 결정 5). 스코프 안에서 기준 표면이 바뀌므로 카드 안팎이 같은 레시피를 쓴다. [[ADR-021]]에 미해결로 남아 있던 카드 내부 배지 AA 미달(레테 3.88:1)도 함께 닫힌다.
- ~~`ErrorState`는 `error-tint` 토큰을 만들지 않는다~~ → `error-tint`는 `color-mix` 파생이라 테마당 추가 비용이 0이므로 신설([[ADR-064]] 결정 2가 [[ADR-062]] 결정 1의 해당 항목 폐기, 2026-07-30).
- ~~업데이트 모달의 부 동작(`나중에`)이 주 동작과 같은 크기(`px-5 py-2.5 text-sm`)~~ → `px-4 py-1.5 text-xs` + 버튼 간격 `space-y-1`, 모달 하단 `pb-4`. `GHOST_BTN` 상수라 4개 분기에 함께 적용([[ADR-065]] 결정 2, 2026-07-30).
- 색·컴포넌트 규칙이 `{...}` 플레이스홀더였던 초기 UI_GUIDE → 작성 완료.
- ~~스케줄러 두 화면의 **캐릭터별** 동기화 실패는 헤더 아래 인라인 문단(`text-sm text-error-ink`)~~ → 토스트([[ADR-083]] 결정 1, 2026-08-02). [[ADR-063]] 결정 1이 지운 것은 전역 실패 문단뿐이었고, 실패의 대부분이 오는 캐릭터별 경로는 액션 없는 인라인으로 남아 있었다.
- ~~보스 수익 기간 로드 실패는 기간 라벨 아래 밑줄 버튼("이 기간을 불러오지 못했습니다 — 다시 시도해주세요")~~ → **카드가 있을 때만** 토스트("이 기간을 불러오지 못했습니다" + 다시 시도), 카드가 없으면 `ErrorState` 유지([[ADR-083]] 결정 3, 2026-08-02).
- ~~온보딩 계정 선택 실패는 목록 상단 인라인 문구(`AccountSelectionList` 의 `errorMessage`)~~ → 토스트([[ADR-083]] 결정 4, 2026-08-02). 네 종류 중 셋은 이미 스토어가 토스트를 띄우고 있어 중복이었다.
- ~~캐릭터 관리 피커의 스크롤과 높이 상한은 `CharacterTrackingGrid` 가 갖는다(`max-h-[70vh] overflow-y-auto`)~~ → 카드가 `max-h-full` 로 **안전영역 뺀 화면** 안에 갇히고, 스크롤포트는 쓰는 쪽(모달 `-mr-6 pr-6` · 온보딩 `max-h-[70vh]`)이 갖는다([[ADR-107]], 2026-08-06). `vh` 는 시스템 바를 포함한 화면 전체라 안전영역이 큰 기기일수록 더 많이 침범했고, 카드 `p-6` 안쪽 스크롤포트는 인디케이터를 모달 끝에서 24px 안으로 들여놨다.

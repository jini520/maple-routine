# 디자인 시스템 (Design System)

> **범위**: 디자인 원칙·안티패턴·기본 색 팔레트·시맨틱 색·기본 컴포넌트(카드/버튼/입력)·여러 화면이 공유하는 UI 컴포넌트·공유 레이아웃 패턴·타이포·아이콘. 테마별 토큰 표·런타임 전환은 [features/theme.md](../features/theme.md), 기능 전용 컴포넌트는 각 `features/*.md`.
> **관련 소스**: `components/*`(Modal, CharacterTrackingPicker, BossPortrait 등) · `src/index.css` · 각 화면 공통 레이아웃 · `lib/world-emblem`.
> **관련 ADR**: [[ADR-009]] [[ADR-015]] [[ADR-016]] [[ADR-018]]. **관련 문서**: [features/theme.md](../features/theme.md).

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
- **대비 주의**: 버튼처럼 **채움**으로 쓸 때 텍스트는 짙은 `#2B1206`(라이트·다크 공통). **텍스트/아이콘**은 다크 배경 위 `#FF7033`(~6.6:1), 라이트 배경 위는 대비 부족(~2.9:1)이라 `#C2410C`(~5.2:1) 사용.

**데이터/시맨틱 색** (라이트 배경은 텍스트용 짙은 버전 + 배지 배경용 옅은 버전):
| 용도 | 텍스트(라이트) | 배지 배경(라이트) | 다크 배경용 |
|---|---|---|---|
| 긍정/성공 | `#15803D` | `#DCFCE7` | `#22c55e` |
| 부정/에러 | `#B91C1C` | `#FEE2E2` | `#ef4444` |
| 중립/기본 | `#78716C` | — | `#525252` |

Primary는 브랜드 강조 전용 — 성공/에러 상태 표시에는 쓰지 않는다(의미 혼동 방지). 실제 컴포넌트 에러 텍스트는 이 표가 아니라 테마 `error` 토큰([features/theme.md](../features/theme.md))을 쓴다.

## 기본 컴포넌트
**카드**
```
라이트: rounded-[14px] bg-white border border-[#F0DFD1] shadow-[0_1px_2px_rgba(43,27,16,0.04),0_4px_12px_rgba(255,112,51,0.06)] p-6
다크:   rounded-[14px] bg-[#141414] border border-neutral-800 p-6
```
그림자는 검정이 아니라 텍스트·Primary색을 옅게 섞은 웜톤, 애니메이션 없는 정적 elevation.

**버튼**
```
Primary(라이트·다크 공통): rounded-full bg-[#FF7033] text-[#2B1206] font-semibold hover:bg-[#E6652E] px-5 py-2.5
Text(라이트): text-[#8A7362] hover:text-[#5B4636]   Text(다크): text-neutral-500 hover:text-neutral-300
```
**입력 필드**
```
라이트: rounded-[10px] bg-white border border-[#F0DFD1] px-4 py-3 text-[#2B1B10]
다크:   rounded-[10px] bg-neutral-900 border border-neutral-800 px-4 py-3
```

## 공유 컴포넌트 (여러 기능이 함께 씀)

### 모달 (`components/Modal`) — 2026-07-13
`CharacterTrackingPicker`/`DisconnectConfirm` 에서 반복되던 오버레이(`fixed inset-0 flex items-center justify-center bg-bg/70`, 안쪽 카드 `onClick` `stopPropagation`)를 공용화. 기본은 카드(`rounded-[14px] border border-border bg-surface p-6`)를 제공하되, `card={false}` 면 위치 고정 래퍼만 남기고 카드 스타일 생략(자식이 자체 카드를 둘 때 카드-안-카드 방지). 설정의 계정 변경 모달·계정 선택 목록이 `card={false}` 로 재사용.

### 캐릭터 카드 그리드(다중 선택) — `CharacterTrackingPicker`, [[ADR-015]]
"캐릭터 관리" 피커. 컨텐츠/보스 스케줄러가 동일 컴포넌트 공유. **3열 그리드**, 카드 자체가 토글 버튼(체크박스 없음, `aria-pressed`).
```
카드: rounded-[14px] border, 선택 시 border-primary bg-primary/15, 미선택 시 border-border hover:bg-primary/15
아바타 프레임: 56px 원형 overflow-hidden, 확대된 <img> 절대 위치로 얼굴 크롭 (max-w-none 필수 — preflight img{max-width:100%}가 확대를 눌러버림)
즐겨찾기: lucide Star, top-1.5 right-1.5. 미선택 text-text-muted 아웃라인 / 선택 fill-primary text-primary
텍스트: 이름 text-xs font-semibold text-text + 서버 엠블럼(h-3.5), 레벨 text-xs text-text-muted (직업 미표시)
```
정렬: **즐겨찾기(선택) 먼저, 그다음 나머지**, 각 그룹 내부 레벨 내림차순 — 즐겨찾기 토글 시 즉시 재배치. `character/basic` 실패 캐릭터는 "?" 플레이스홀더 + 이름·레벨 유지(선택 가능) — 단 [[ADR-053]] 이후 이 폴백은 **캐시가 있는 캐릭터에만** 적용된다(캐시도 없고 조회도 실패한 캐릭터는 `access_flag` 를 확인할 길이 없어 목록에 아예 넣지 않는다). 서버 엠블럼은 `lib/world-emblem`(데이터 `world-emblems.json`) 재사용, world 없거나 미매핑이면 생략. 모달 헤더(제목+설명 `mb-4 space-y-1`), 그리드 `max-h-[70vh] overflow-y-auto`, **이 모달은 오버레이 클릭으로 닫히지 않음**(닫기/저장 버튼만, 자체 오버레이라 이 모달에만 적용).

**로딩/빈/실패 상태 ([[ADR-053]], 구현 완료 2026-07-29)**: 그리드에 항목이 없을 때 세 경우를 구분해 그린다(빈 상태로 위장 금지, [error-resilience.md](./error-resilience.md) 원칙 1·2). 항목이 하나라도 있으면 조회 중이어도 기존대로 그리드만 그린다([[ADR-016]] 캐시 우선 표시를 스피너로 가리지 않는다). 어느 상태인지는 `getCharacterPickerRoster` Promise의 resolve/reject로 호출부가 판정해 필수 props `isLoading`·`loadFailed` 로 내려준다(정책 원문 [../features/content-scheduler.md](../features/content-scheduler.md)).
```
공통 자리: flex min-h-[120px] items-center justify-center (그리드 자리 중앙)
조회 중:   MapleSweepSpinner size={32} text-primary, 래퍼에 role="status" aria-busy="true" aria-label="캐릭터 목록을 불러오는 중"
           (모달·페이지 안이라 셸 승계 카드는 씌우지 않는다 — 위 "로딩 표현" 참고, [[ADR-061]])
조회 실패: text-sm text-error "캐릭터 목록을 불러오지 못했어요 — 닫고 다시 열어주세요"
항목 0건: text-sm text-text-muted "표시할 캐릭터가 없어요"
```
재시도 버튼은 두지 않는다 — 모달을 닫았다 다시 열면 로딩·실패가 초기화되고 재조회되므로 그 경로를 문구로 안내한다. 온보딩 캐릭터 선택 단계(`ContentCharacterStep`)는 같은 분기를 페이지에서 직접 그리며 실패 문구만 "…네트워크를 확인한 뒤 앱을 다시 실행해주세요"로 다르다([onboarding.md](../features/onboarding.md)).

### 빈 상태 (`components/EmptyState`) — [[ADR-060]], 구현 완료 2026-07-29
"비어있음"을 표시하는 11곳이 이 컴포넌트 하나를 쓴다. `size` 두 변형만 다르고 구조는 동일 — **원형 배지(컨텍스트 아이콘) + 제목 + 설명 + CTA**, 중앙 정렬.
```
공통:   flex flex-col items-center text-center, 배지 rounded-full bg-primary/15, 아이콘 text-primary strokeWidth 1.75
page:   배지 84px / 아이콘 40px / 제목 text-base / 설명 text-sm max-w-[220px] / CTA px-5 py-2.5 text-sm / gap-4
inline: 배지 56px / 아이콘 28px / 제목 text-sm  / 설명 text-xs max-w-[240px] / CTA px-4 py-2 text-xs / gap-3
        + 박스 rounded-[14px] border border-border bg-surface px-4 py-8 (page 는 자체 박스 없음 — 화면이 감싼다)
CTA:    rounded-full bg-primary text-bg font-semibold hover:bg-primary-hover (Primary 버튼 재사용, 새 스타일 금지)
```
- **배지 안 마크는 자리에 따라 둘로 갈린다**([[ADR-060]] 결정 2): **목록 빈 상태(inline)는 화면별 컨텍스트 아이콘**(lucide) — 컨텐츠 `ListChecks` · 보스 `Swords` · 필터 `SlidersHorizontal` · 수익 `Coins` · 드롭 `PackageOpen`. 목록 자리는 "무엇이 비었는지"를 알려야 하기 때문. **캐릭터 미선택(page)은 브랜드 마크(단풍잎, `icon="leaf"`)** — 화면 전체를 차지하는 자리라 앱의 얼굴 역할을 겸한다(사용자 결정).
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
버튼 안:  ~중 (말줄임표 없음)   확인 중 · 삭제 중 · 해제 중
그 밖:    ~하고 있어요          불러오고 있어요 · 적용하고 있어요 · 캐릭터 정보를 준비하고 있어요 (N/M)
말줄임표: ...(마침표 3개)로 통일. …(1글자) 금지
```

**쓰지 않는 것**: 점선 박스(빈 상태 전용) · 스켈레톤(미도입) · 비-브랜드 CSS 링 스피너 · `MapleWaveProgress`(폐기) · 진행률 바 `h-2` 변형(폐기). 새로고침 아이콘(`RefreshCw`)의 회전은 스피너가 아니라 **기능 신호**라 교체 대상이 아니다.

### 조회 불가 알림 (`components/EmptyState/UnavailableNotice`) — [[ADR-060]]
확인 자체를 못 한 상태(보스 수익 롤링 조회 윈도우 밖, [[ADR-032]])는 빈 상태와 **디자인을 공유하지 않는다** — 같은 모양이면 "데이터가 없다"로 오해된다. 톤은 경고(error)가 아니라 **정보**: 사용자가 고칠 수 있는 실패가 아니라 API의 알려진 제약이라 error 색은 과하다.
```
기본:    flex items-start gap-3 rounded-[14px] border border-border bg-info-tint p-4
         + Info 아이콘(h-5 text-text-muted) + 제목 text-sm font-semibold + 설명 text-xs text-text-muted
compact: 카드 안에 중첩될 때. rounded-[10px] bg-surface-2 px-3 py-2.5, 아이콘 h-4, 제목 한 줄만(설명 생략)
```

### 캐릭터 관리 저장 진행률 모달 — 2026-07-16
"저장" 시 추적 캐릭터마다 `syncSchedules` 순차 호출하는 동안 캐릭터 관리 모달 **위에** 진행률 모달을 띄우고 완료 시 함께 닫는다. 진행률 바 스타일은 온보딩 예열 바와 동일(track `h-1.5 w-full rounded-full bg-surface-2` + fill `h-1.5 rounded-full bg-primary`) + "캐릭터 정보를 저장하고 있어요 (N/M)". 공용 `Modal` 재사용, 저장 도중 오버레이 클릭 무시(완료 시 프로그램적으로만 닫음). 콜백 `saveTrackedOcids → refresh → syncSchedules` 로 `onProgress(completed, total)` 전달. 개별 실패는 조용히 폴백, 전역 에러면 화면 에러 상태 전환.

### 스케줄러 캐릭터 드롭다운 — 선택 캐릭터 월드 아이콘 — 2026-07-16
`CharacterSelectDropdown` 은 네이티브 `<select>` 유지(`<option>` 이미지 불가라 펼친 목록은 텍스트만). 닫힌 상태 왼쪽에 선택 캐릭터의 **월드 엠블럼** 오버레이: `<select>` 를 `relative` 래퍼로 감싸고 `<img>` 를 `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-auto object-contain`, `<select>` 에 `pl-9`. world 는 캐시 우선 뷰는 스케줄 캐시(`SchedulerCharacterState.world`)에서, 동기화 후 뷰는 sync 결과에서 — 캐시 있으면 API 응답 전 즉시 표시. 미매핑 월드 생략.

### 진행률 바 프리미티브
`role="progressbar"` + `aria-valuenow/min/max`, track `h-1.5 w-full rounded-full bg-surface-2` + fill `h-1.5 rounded-full bg-primary`. **결정형 진행률은 예외 없이 이것 하나**([[ADR-061]] 결정 6) — 온보딩 예열·계정 변경 예열·캐릭터 관리 저장·OTA 다운로드·컨텐츠 진행률이 모두 같은 스타일이다. 새 색/모양/두께 신설 금지.

## 공유 레이아웃 패턴

### 탭 토글(주간/월간, 일간/주간 등) — [[ADR-018]]
드롭다운·탭·카운트 배지를 **별도 카드로 묶지 않는다**(배경 위에 바로).
```
탭 행: flex items-center gap-4
활성 탭: rounded-full bg-primary/15 text-primary px-3 py-[5px] text-sm font-semibold (배지 pill 재사용, 새 스타일 금지)
비활성 탭: 배경 없음, text-sm font-medium text-text-muted, 좌우 패딩 활성과 동일(px-3)
카운트 배지(있는 화면만, 예 n/12): 같은 줄 justify-between 오른쪽 끝, rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1
```
활성/비활성 색 차이만으로는 저채도 팔레트에서 약해 배경 pill 필수(굵기 차이만으로 대체 금지). 기능 전용 변형(솔로/파티 필터·보스 수익 네비게이터)은 각 feature 문서.

### 스크롤 영역 — 2026-07-13
컨텐츠/보스 스케줄러는 제목~탭(보스는 필터까지)을 상단 고정, 그 아래 목록만 스크롤. `position: sticky` 로 구현(별도 overflow 컨테이너+높이 계산 아님).
```
화면 루트: space-y-4 (패딩 없음 — 아래 두 블록이 각자 가짐)
헤더 블록: sticky top-0 z-10 bg-bg px-4 pt-4 pb-2 (+ 페이드 오버레이)
목록 블록: px-4 pb-4 space-y-4 (화면 루트 직계 자식, 헤더의 형제)
```
`bg-bg` 는 뒤 카드가 비쳐 보이지 않게, `z-10` 은 목록이 헤더 위로 안 올라오게. 빈 목록 안내는 헤더가 아니라 목록 영역에 둔다. **패딩은 화면 루트가 아니라 헤더/목록 블록에 각각** — 루트에 padding-top 을 주면 sticky 정지 위치가 어긋난다(sticky 는 자기 padding-box 기준).

**헤더-목록 경계 페이드**: sticky 헤더 불투명 배경이 스크롤 도중 경계를 딱 끊어 보이게 하는 문제 완화. 헤더 블록에 오버레이:
```
pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm
style: maskImage/WebkitMaskImage: linear-gradient(to bottom, black, transparent)
```
색(그라데이션)과 블러(같은 mask 그라데이션)를 동시에 옅어지게 해야 자연스럽다. `mask-image` 는 Tailwind 로 애매해 인라인 스타일(보스 카드 일러스트 페이드와 동일 패턴).

**예외 — 보스 수익 화면은 이 페이드 오버레이를 페이지 헤더가 아니라 "중첩 sticky 요소"(펼친 캐릭터 카드 헤더) 하단에 붙인다**([[ADR-047]] 결정 6·후속, 2026-07-28). 레시피는 동일하고 배경색만 그 요소의 표면색(`from-surface`)으로 바꾼다 — **페이드는 콘텐츠가 실제로 지나가는 경계에 둔다**는 원칙. 그 화면은 펼친 캐릭터 카드 헤더가 **중첩 sticky**로 페이지 헤더 바로 아래(= 이 오버레이가 덮는 `top-full h-8` 밴드)에 멈추는데, 오버레이는 `z-10` 페이지 헤더 안에 있고 카드는 `isolate`로 그보다 아래라 stuck 헤더 상단이 가려진다. 경계는 헤어라인(`h-px bg-border`)이 대신한다. **중첩 sticky를 도입하는 화면에서는 이 레시피를 그대로 쓰면 안 된다.** 나머지 4개 화면(컨텐츠·컨텐츠 관리·보스·보스 관리)은 중첩 sticky가 없어 페이드를 유지한다. 상세는 [features/boss-profit.md](../features/boss-profit.md).

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
| 에러 문구 | `text-sm text-[#B91C1C]` |

## 애니메이션
- 확정 애니메이션 없음(2026-07-11) — hover 색 전환(`hover:bg-*`/`hover:text-*`) 정도만 Tailwind 기본. 페이드·슬라이드 등 명시적 트랜지션은 미도입, 필요해지면 추가.
- 기능 전용 연출(고가 드롭 강조 [[ADR-045]])은 [features/boss-profit.md](../features/boss-profit.md). 모든 모션은 `prefers-reduced-motion: no-preference` 에서만 재생(정적 폴백 유지)이 원칙.

## 아이콘
- **라이브러리: `lucide-react`**(확정) — 새 아이콘은 이 라이브러리에서만. 다른 라이브러리 혼용 금지.
- `strokeWidth`: 하단 탭바 `1.5`, 소형 액션(새로고침 등) `2`.
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다 — 강조색 아이콘을 배경 없이 단독으로. **예외 2곳**: 빈 상태 배지(위 `EmptyState`, [[ADR-060]] — 아이콘이 아니라 일러스트 자리)와 드롭 시트 카테고리 헤더.
- 현재 사용: 하단 탭바 `ListChecks`(컨텐츠)/`Swords`(보스), 새로고침 `RefreshCw`, 보스 카드 파티 배지 `Users`, 파티 스테퍼 `Minus`/`Plus`.

## 폐기된 정책 (history)
- ~~일부 사용처의 배경 원으로 아이콘 감싸기~~ → 배경 없이 단독 사용으로 확정(2026-07-11).
- ~~비결정형 대기는 `MapleSpinner`(트레일 링) 한 종~~ → 크기로 2종, 24px 이상은 신규 `MapleSweepSpinner`([[ADR-061]], 2026-07-30).
- ~~결정형 진행률은 자리에 따라 `MapleWaveProgress`(화면)·얇은 바(모달)·`h-2` 바(OTA)~~ → 얇은 바 프리미티브 하나로 통일, `MapleWaveProgress`·`h-2` 변형 폐기([[ADR-061]], 2026-07-30).
- ~~로딩 자리마다 껍데기가 달랐다(텍스트 한 줄 / 점선 박스 / 없음)~~ → 목록·카드가 들어올 자리는 공용 셸 승계 카드 `LoadingState`, 점선은 빈 상태 전용([[ADR-061]], 2026-07-30).
- ~~대기 문구가 `~중...`과 `~하고 있어요`로 갈림~~ → 버튼 안은 `~중`(말줄임표 없음), 그 밖은 `~하고 있어요`, 말줄임표는 새로고침 옆 `조회 중...` 한 곳만([[ADR-061]], 2026-07-30).
- 색·컴포넌트 규칙이 `{...}` 플레이스홀더였던 초기 UI_GUIDE → 작성 완료.

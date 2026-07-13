# UI 디자인 가이드

## 디자인 원칙
1. **캐주얼하고 친근한 게임 컴패니언 톤** — 정색한 업무 대시보드가 아니라, 매일 들어와 캐릭터 챙기는 느낌의 가벼운 도구(확정, 2026-07-09). 라이트 테마가 기본이다
2. {원칙 2}
3. {원칙 3}

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

## 색상
**톤 방향 (확정, 2026-07-09)**: 라이트가 기본 테마다. 다크는 폐기하지 않고 보조 팔레트로 남겨둔다(설정에서 전환 가능하게 할지는 [[ADR-009]] 테마 시스템과 함께 추후 결정). 배경·보더·텍스트 모두 순수 무채색 대신 오렌지 쪽으로 아주 살짝 기운 웜톤을 쓴다 — 카드가 붕 뜨지 않고 브랜드 컬러와 한 팔레트처럼 보이게 하기 위함. 그레이스케일이 아니라 "고른" 웜뉴트럴을 의도적으로 골랐다는 뜻.

### 배경 — 라이트 (기본)
| 용도 | 값 |
|------|------|
| 페이지 | #FFF9F4 |
| 카드 | #FFFFFF |
| 보더 | #F0DFD1 |
| 보더(연함) | #F7EDE3 |

### 배경 — 다크 (보조)
| 용도 | 값 |
|------|------|
| 페이지 | #0a0a0a |
| 카드 | #141414 |
| 보더 | neutral-800 (#262626) |

### 텍스트 — 라이트 (기본)
| 용도 | 값 |
|------|------|
| 주 텍스트 | #2B1B10 |
| 본문 | #5B4636 |
| 보조 | #8A7362 |
| 비활성 | #B7A490 |

### 텍스트 — 다크 (보조)
| 용도 | 값 |
|------|------|
| 주 텍스트 | text-white |
| 본문 | text-neutral-300 |
| 보조 | text-neutral-400 |
| 비활성 | text-neutral-500 |

### Primary (강조 색상) — 기본 테마
테마 시스템(아래 [[ADR-009]] 참고)이 붙기 전, 또는 테마 미선택 시 쓰는 폴백 값이다. 채움(버튼 배경)용 값은 라이트/다크 공통이고, 텍스트·아이콘으로 쓸 때만 배경에 따라 다른 톤을 쓴다(아래 대비 주의 참고).

| 상태 | 값 | 용도 |
|------|------|------|
| 기본(채움) | #FF7033 (rgb(255,112,51)) | 주요 버튼 배경, 활성 탭·선택 표시 |
| Hover | #E6652E | 버튼/링크 hover |
| Active | #C75728 | 버튼 눌림 상태 |
| 텍스트/아이콘 — 라이트 배경 | #C2410C | 라이트 배경 위 링크·아이콘·강조 텍스트 |
| 텍스트/아이콘 — 다크 배경 | #FF7033 | 다크 배경 위 링크·아이콘·강조 텍스트 |
| Subtle — 라이트 | #FFE9DB | 선택된 항목 배경, 배지 (라이트) |
| Subtle — 다크 | bg-[#FF7033]/15 | 선택된 항목 배경, 배지 (다크) |
| Border — 라이트 | #FFC9A8 | 강조 테두리, 포커스 링 (라이트) |
| Border — 다크 | border-[#FF7033]/40 | 강조 테두리, 포커스 링 (다크) |

**대비 주의**: `#FF7033` 자체는 밝기가 높아 흰 텍스트(~2.9:1)와도, 검은 배경 위 작은 텍스트로 쓰기엔(라이트 배경에서는 반대로) 애매한 지점이 있다.
- 버튼처럼 **채움**으로 쓸 때: 배경이 라이트든 다크든 텍스트는 짙은 색(`#2B1206`)을 쓴다.
- **텍스트/아이콘**으로 쓸 때: 다크 배경(#0a0a0a) 위에서는 `#FF7033` 그대로 대비 충분(~6.6:1). 라이트 배경(#FFF9F4/#FFFFFF) 위에서는 `#FF7033`가 대비 부족(~2.9:1, AA 미달)이라 더 짙은 `#C2410C`(~5.2:1)를 대신 쓴다.

### 데이터/시맨틱 색상
텍스트로 쓸 때 라이트 배경에서 대비가 나오도록 각각 짙은 버전(텍스트용)과 옅은 버전(배지 배경용)을 같이 둔다. 다크 배경에서는 기존처럼 중간 톤을 그대로 텍스트에 써도 대비가 충분하다.

| 용도 | 텍스트 (라이트 배경) | 배지 배경 (라이트) | 다크 배경용 |
|------|------|------|------|
| 긍정/성공 | #15803D | #DCFCE7 | #22c55e |
| 부정/에러 | #B91C1C | #FEE2E2 | #ef4444 |
| 중립/기본 | #78716C | — | #525252 |

Primary는 브랜드 강조색 전용으로 쓰고 성공/에러 등 상태 표시에는 쓰지 않는다(의미 혼동 방지).

**참고**: 실제 컴포넌트의 에러 텍스트는 이 표의 값이 아니라 아래 "테마 시스템"의 `error` 토큰(테마별 값)을 쓴다 — 이 표는 테마 시스템 도입 전 정의된 라이트/다크 기본 팔레트용이라 값이 서로 다르다. 두 체계를 하나로 정리할지는 미정.

## 테마 시스템 ([[ADR-009]])
캐릭터 직업 고유 컬러 기반 다중 테마를 지원할 예정이다. **정정(2026-07-12)**: 테마마다 Primary 하나만 바뀌고 나머지는 공식으로 파생한다는 원래 방식은 폐기됐다 — 테마는 아래 13개 시맨틱 토큰을 값으로 직접 갖는다. 현재 등록된 테마는 "레테"(다크, 현재 기본)와 "렌" 2개다.

| 토큰 | 용도 | 레테 | 렌 |
|------|------|------|------|
| `bg` | 페이지 배경 | `#0C080F` | `#F6F5F5` |
| `surface` | 카드/표면 | `#1A1720` | `#FFFFFF` |
| `surface-2` | 2단계 표면(강조 영역) | `#28232E` | `#E5E6E9` |
| `border` | 기본 보더 | `#37323E` | `#DBD3D6` |
| `border-strong` | 강조 보더 | `#54444E` | `#C8C1C6` |
| `primary` | 채움 배경(버튼 등) — 위에 흰 글자 OK | `#9975B3` | `#DC171D` |
| `primary-hover` | hover/눌림 상태(배경) | `#85639F` | `#B33946` |
| `primary-text` | 빨강 텍스트·링크 전용 | `#61417B` | `#803440` |
| `secondary` | 보조 강조(배지 등) | `#D1C093` | `#437B71` |
| `info-tint` | 정보성 배경 틴트 전용 | `#C9D6F2` | `#C9EEF2` |
| `error` | 에러/위험 텍스트 | `#D8608F` | `#B91C1C` |
| `text` | 기본 텍스트 | `#E8DFEC` | `#171721` |
| `text-muted` | 보조 텍스트 | `#B89CBD` | `#525475` |
| `text-disabled` | 비활성 텍스트 | `#8A758D` | `#8A8089` |

**정정(2026-07-12, 렌 재수정)**: 렌이 다크(잉크블랙+블러드레드)에서 라이트(실버/아이보리+블러드레드)로 전면 교체됐다. 토큰 이름도 2개 변경: ~~`primary-deep`~~→`primary-text`(용도를 "진한 강조"에서 "빨강 텍스트·링크 전용"으로 명확화), ~~`info`~~→`info-tint`(배경 틴트 전용임을 명시). 두 이름은 스키마 전체(레테 포함)에 소급 적용 — 레테의 값 자체는 안 바뀌었다. `error`(`#B91C1C`)는 렌이 라이트가 되면서 위 "데이터/시맨틱 색상" 표에 이미 있던 라이트 배경용 부정/에러 값을 그대로 재사용했다(신규 보간 아님) — 두 체계 불일치 메모는 렌에 한해 자연 해소됨.

컴포넌트 마이그레이션(렌 라이트 적용과 함께 진행): 버튼 hover 배경(`hover:bg-primary-deep`, 3곳)은 `hover:bg-primary-hover`로, 링크/아이콘 텍스트(`text-primary hover:text-primary-deep`, 4곳)는 `text-primary-text hover:text-primary-hover`로 변경 — 기본 상태부터 `primary-text`(텍스트·링크 전용 톤)를 쓰고 hover에서 `primary-hover`로 진하게. 활성 탭 라벨·배지·별 아이콘 등 나머지 `text-primary`/`bg-primary` 사용처는 "강조 색상" 용도라 그대로 둔다.

레테는 기존 `src/index.css` 값을 그대로 확정한 것이다(단, `primary-hover`/`secondary`/`info-tint`/`error`/`text-disabled` 5개는 기존 팔레트에 대응값이 없어 사용자 위임 하에 보간·재활용해 채움 — `secondary`는 기존 `gold`, `error`는 기존 `magenta` 재활용). 기존 `gold-bright`/`neutral-warm` 토큰은 스키마에 자리가 없어 폐기하고, `neutral-warm` 사용처는 `text-muted`로 통합한다.

- **구현 범위 축소(2026-07-12)**: 런타임 전환 없이 "렌" 값을 `src/index.css`의 `@theme` 블록에 정적으로 반영해 현재 활성 팔레트를 레테→렌으로 교체하는 것까지만 한다. `job-themes.json` 데이터 파일, Zustand 스토어, `storage/` 영속화, `:root[data-theme]` 오버라이드, 설정/토글 UI는 모두 보류 — 전환 기능이 실제로 필요해지면 다시 착수한다. 아래 "데이터 출처"·"적용 방식"·"상태 관리"는 그 시점의 목표 설계다.
- **재개(2026-07-12, 설정 화면 task 범위 포함)**: 위에서 보류했던 항목을 이번에 구현한다 — 설정 화면(신규 하단 탭)에서 레테/렌 중 하나를 고르는 최소 범위 선택 UI를 제공한다(직업 기반 자동 매핑은 여전히 미정이라 범위 밖). 상세는 `docs/ADR.md` ADR-009 "재개" 항목, `docs/ARCHITECTURE.md` "테마 시스템" 참고.
- **데이터 출처(목표 설계, 미구현)**: `src/data/job-themes.json`(테마 이름을 키로 하는 참조 테이블, [[ADR-006]] CRITICAL 규칙 적용 — 위 표 값은 사용자 확인 완료, 아직 파일에는 미반영)
- **적용 방식(목표 설계, 미구현)**: Tailwind v4 `@theme` 블록(`src/index.css`)은 기본 테마 값을 유지하고, `:root[data-theme="..."] { --color-*: ...; }` 로 오버라이드한다. Tailwind v4 유틸리티(`bg-primary`, `text-text` 등)는 이미 `var(--color-*)`를 참조하므로 컴포넌트 코드는 그대로 두고 `data-theme` 속성만 바꾸면 전환된다.
- **상태 관리(목표 설계, 미구현)**: 선택된 테마는 다른 전역 클라이언트 상태와 동일하게 Zustand로 관리하고 `storage/`에 영속화
- **확정(2026-07-09), 2026-07-12 해소**: 테마 미선택 시 기본값은 오렌지(#FF7033) 라이트 팔레트를 쓴다는 방향이 있었고, 다크(레테)만 구현돼 불일치했던 상태는 렌이 라이트 팔레트로 바뀌면서 사실상 해소됐다(오렌지 대신 블러드레드 브랜드 컬러를 쓴다는 차이는 남지만, 라이트 배경 기조는 일치).
- **미정 — 추후 확정 필요**: 테마 이름과 실제 직업(전직)의 매핑, 테마 단위(직업 대분류 vs 5차 전직 세부). 테마 전환 UX는 설정 화면 내 수동 선택 UI(레테/렌 중 선택)로 확정(2026-07-12) — 직업 기반 자동 적용은 아님

## 컴포넌트
**라운딩 스케일 (확정, 2026-07-09)**: 캐주얼함을 "다 rounded-2xl로 통일"이 아니라 컴포넌트 성격별로 라운딩을 다르게 줘서 표현한다(AI 슬롭 안티패턴의 "모든 카드에 동일한 rounded-2xl" 금지 조항과 일치) — 카드는 중간(14px), Primary 버튼·배지는 완전 캡슐형(pill), 인풋은 그보다 각진(10px).

### 카드
```
라이트(기본): rounded-[14px] bg-white border border-[#F0DFD1] shadow-[0_1px_2px_rgba(43,27,16,0.04),0_4px_12px_rgba(255,112,51,0.06)] p-6
다크(보조):   rounded-[14px] bg-[#141414] border border-neutral-800 p-6
```
그림자는 검정이 아니라 텍스트색·Primary색을 아주 옅게 섞은 웜톤이다 — 애니메이션 없는 정적 그림자로, AI 슬롭 안티패턴의 "box-shadow 글로우 애니메이션"과는 다르다(그로우 아님, 은은한 elevation용).

### 버튼
```
Primary(라이트): rounded-full bg-[#FF7033] text-[#2B1206] font-semibold hover:bg-[#E6652E] px-5 py-2.5
Primary(다크):   rounded-full bg-[#FF7033] text-[#2B1206] font-semibold hover:bg-[#E6652E] px-5 py-2.5
Text(라이트):    text-[#8A7362] hover:text-[#5B4636]
Text(다크):      text-neutral-500 hover:text-neutral-300
```

### 입력 필드
```
라이트(기본): rounded-[10px] bg-white border border-[#F0DFD1] px-4 py-3 text-[#2B1B10]
다크(보조):   rounded-[10px] bg-neutral-900 border border-neutral-800 px-4 py-3
```

### 아코디언 (드롭다운 리스트) — 확정, 2026-07-11, [[ADR-014]]
보스 수익 계산기의 캐릭터별 드롭다운에서 처음 도입. 카드 스타일을 그대로 쓰고 펼침 여부만 토글한다 — 별도 색상/그림자를 새로 정의하지 않는다.
```
헤더(카드와 동일): rounded-[14px] bg-white border border-[#F0DFD1] p-4, 클릭 시 펼침/접힘 토글
헤더 텍스트: text-sm font-semibold text-[#2B1B10] (캐릭터명 + 그 캐릭터의 "이번 주" 합계)
펼침 아이콘: lucide-react `ChevronDown`(접힘)/`ChevronUp`(펼침), strokeWidth 2, 배경 없음
내용: 헤더 카드 바로 아래 space-y-2로 보스별 행 나열(기존 보스 행 스타일 재사용)
```
기본 상태는 **전부 접힘**으로 시작한다(추적 캐릭터가 많을 때 화면이 과도하게 길어지는 것을 방지, [[ADR-014]] 트레이드오프 참고). 펼침/접힘 애니메이션은 아직 정의하지 않음(위 "애니메이션" 섹션 원칙대로 필요해지면 추가).

### 캐릭터 카드 그리드 (다중 선택) — 확정, 2026-07-12, [[ADR-015]]
"캐릭터 관리" 피커(`CharacterTrackingPicker`)에서 체크박스 목록을 대체. **3열 그리드**로 배치하고 카드 자체가 토글 버튼이다(체크박스 엘리먼트 없음, `aria-pressed`로 선택 상태 노출) — `AccountSelectionList`의 하이라이트 버튼과 동일한 선택 상태 색상 규칙을 재사용한다.
```
카드: rounded-[14px] border, 선택 시 border-primary bg-primary/15, 미선택 시 border-border hover:bg-primary/15
아바타 프레임: 56px 원형(rounded-full), overflow-hidden, 확대된 <img>를 절대 위치로 얼굴 부분에 맞춰 크롭
즐겨찾기 표시: 배경 원 없이 lucide-react Star 아이콘만, 카드(버튼) 오른쪽 위 모서리 기준 top-1.5 right-1.5(카드 상단·우측 여백이 항상 동일)
  - 미선택: text-text-muted, 아웃라인만(채움 없음)
  - 선택: fill-primary text-primary, 채움
텍스트: 이름 text-xs font-semibold text-text, 레벨 text-xs text-text-muted (직업은 표시하지 않음)
```
후보 목록은 **즐겨찾기(선택)한 캐릭터가 먼저, 그다음 나머지** 순으로 정렬하고 각 그룹 내부는 레벨 내림차순이다([[ADR-015]]) — 즐겨찾기를 토글하면 그 즉시 재배치된다. `character/basic` 조회가 실패한 캐릭터는 이미지 대신 `BossPortrait`의 "?" 플레이스홀더와 동일한 방식으로 폴백하되, 이름·레벨은 그대로 표시해 선택은 계속 가능하다. 이미지 크롭에 `<img>`를 쓸 때는 Tailwind preflight의 `img { max-width: 100% }`가 확대 크기를 다시 눌러버리므로 `max-w-none`을 반드시 함께 준다(구현 중 발견한 버그, [[ADR-015]]).

**모달 헤더 및 크기 — 확정, 2026-07-12**: 그리드 위에 제목(`h2`, `text-lg font-semibold text-text`, "캐릭터 관리")과 설명(`p`, `text-sm text-text-muted`, "체크한 캐릭터만 스케줄러 목록에 표시됩니다.")을 `mb-4 space-y-1`로 묶어 배치한다. 그리드의 세로 스크롤 한도는 `max-h-[60vh]`에서 `max-h-[70vh]`로 늘렸다 — 헤더가 추가돼 차지하는 공간만큼 그리드가 과도하게 좁아지지 않도록 하기 위함이다. 모달 바깥 컨테이너에는 `overflow-hidden`을 주지 않는다(그리드 내부의 `overflow-y-auto`만으로 스크롤을 처리하고, 헤더·버튼 영역이 실수로 잘리는 것을 방지).

### 온보딩 예열 진행률 바 — 확정, 2026-07-12, [[ADR-016]]
컨텐츠 스케줄러의 일간 콘텐츠 진행률(`role="progressbar"` + `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, track `h-1.5 w-full rounded-full bg-surface-2` + fill `h-1.5 rounded-full bg-primary`)과 동일한 시각 스타일을 그대로 재사용한다 — 새 색상/모양을 만들지 않는다. 진행률 위에 안내 문구(예: "캐릭터 정보를 준비하고 있어요 (18/45)")를 `text-sm text-text-muted`로 표시한다.

### 설정 리스트 행 + 모달 — 확정, 2026-07-13
설정 화면은 카드형 섹션 나열이 아니라, **하나의 리스트 컨테이너**(`rounded-[14px] bg-surface border border-border px-6`) 안에 행(`SettingsRow`)을 `divide-y divide-border`로 이어붙이는 방식이다. 각 행은 `py-4`, 왼쪽 라벨(`text-sm font-medium text-text`, 위험한 동작은 `text-error`) + 오른쪽 콘텐츠(기본은 `lucide-react` `ChevronRight`, `strokeWidth 2`, `text-text-muted` — 필요 없으면 `showChevron={false}`)로 구성되고, 행 전체가 버튼이라 탭하면 그 항목에 맞는 모달이 열린다("API 키 재입력"·"계정 변경"·"테마" 3개 행 전부 이 패턴, "연결 해제"만 예외로 확인 모달을 직접 연다).
- **모달 컴포넌트(`components/Modal`)**: `CharacterTrackingPicker`/`DisconnectConfirm`에서 반복되던 오버레이(`fixed inset-0 flex items-center justify-center bg-bg/70` + 안쪽 카드 `onClick` 시 `stopPropagation`)를 공용화했다. 기본은 카드(`rounded-[14px] border border-border bg-surface p-6`)를 제공하지만, `card={false}`를 주면 위치 고정용 래퍼만 남기고 카드 스타일은 생략한다 — `ApiKeyForm`/`AccountSelectionList`처럼 이미 자체 카드를 가진 컴포넌트를 그대로 재사용할 때 카드-안-카드 중첩을 피하기 위함이다.
- **테마 대표 컬러 점(`ThemeSwatchDots`)**: 테마의 `primary`/`secondary`/`error` 3개 토큰 값을 `h-4 w-4 rounded-full` 점으로 겹쳐(`-space-x-1`) 보여준다. 테마 행의 오른쪽 콘텐츠(점 3개 + 현재 테마 이름을 `rounded-full border border-border px-3 py-1 text-xs` 배지로)와 테마 모달 안의 선택지 각각에 재사용한다. `src/data/job-themes.json`을 직접 import해 값을 읽는다 — 활성화되지 않은 테마의 색도 미리보기로 보여줘야 해서 CSS 커스텀 프로퍼티(현재 활성 테마 값만 노출)로는 부족하기 때문이다.

### 탭 토글(주간/월간, 일간/주간 등) — 확정, 2026-07-13, [[ADR-018]]
컨텐츠 스케줄러·보스 스케줄러의 캐릭터 드롭다운 아래 탭 전환 UI. **드롭다운·탭·(있다면) 카운트 배지를 별도 카드로 묶지 않는다** — 배경 위에 바로 놓는다(카드가 하나 더 늘어나는 걸 피하기 위해 카드로 묶는 안은 검토 후 기각, 2026-07-13).
```
탭 행: flex items-center gap-4 (드롭다운 다음 줄)
활성 탭: rounded-full bg-primary/15 text-primary px-3 py-[5px] text-sm font-semibold — 배지에 이미 쓰던 pill 스타일 그대로 재사용(새 스타일 신설 금지)
비활성 탭: 배경 없음, text-sm font-medium text-text-muted, 좌우 패딩은 활성 탭과 동일(px-3)해서 탭 전환 시 다른 탭이 밀리지 않게 함
카운트 배지(있는 화면만, 예: 보스 스케줄러 주간 탭의 n/12): 탭 행과 같은 줄, justify-between으로 오른쪽 끝에 배치 — "활성 탭 = 이 수치"라는 관계를 같은 행 배치로 표현. rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1 (기존 배지 스타일 그대로)
```
활성/비활성 색 차이(`text-primary` vs `text-text-muted`)만으로는 레테처럼 저채도 팔레트에서 구분이 약해서 배경 pill을 반드시 함께 쓴다 — 굵기(`font-semibold`/`font-medium`) 차이만으로 대체하지 않는다.

### 보스 카드 — 확정, 2026-07-13, [[ADR-018]]
보스 스케줄러의 보스 목록. 기존에는 보스 전체를 하나의 카드(`<ul>`)에 담고 왼쪽 체크 도형으로 완료 여부를 표시했으나, 보스별 독립 카드 + 일러스트 bleed 방식으로 바꾼다. **목록을 감싸는 상위 카드는 두지 않는다** — 카드끼리 `space-y-2`로 나열만 한다.
```
카드: rounded-[14px] border border-border bg-surface, height 80px, overflow-hidden, position relative
일러스트(있는 보스만): position absolute inset-0, background-size/position은 보스별 설정 값(src/data/boss-portrait-crops.json, 없으면 cover/center) — 블러 필터 없음(2026-07-13 확정, 흐리지 않고 선명하게), saturate(.85) brightness(.8)로 살짝 톤다운, opacity .65
  페이드: mask-image: linear-gradient(90deg, #000 0%, #000 38%, transparent 76%) — 왼쪽 38%까지 선명, 76%부터 완전 투명(카드 배경에 자연스럽게 녹아듦). 일러스트 없는 보스는 이 레이어 자체를 생략(플레이스홀더 배경색만)
콘텐츠 행: flex items-center justify-between, padding 0 14px(좌우 동일 — 일러스트 위에 바로 얹히므로 별도 좌측 여백 없이 카드 가장자리에 붙임, 2026-07-13 확정)
  왼쪽: 난이도 뱃지 + 보스명(순서: 뱃지 → 이름), 이름에는 text-shadow(0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6))로 일러스트 위에서도 대비 확보
  오른쪽: 완료 시에만 완료 뱃지, 미완료는 빈 공간
```
**완료 뱃지**: `rounded-full bg-secondary text-bg text-xs font-bold px-2.5 py-1`, 텍스트 "완료". 기존 `StatusDot`의 체크 완료 색이 이미 `bg-secondary`(레테 기준 #D1C093, 골드)였으므로 새 색을 만들지 않고 그대로 재사용한다. 왼쪽 체크 도형(`StatusDot`)은 제거.

**난이도 뱃지**: 텍스트("· 하드") 대신 게임 내 난이도 뱃지와 같은 시각 언어(글로시 캡슐형)로 표시. 실제 게임 UI 스크린샷에서 픽셀 색을 추출한 근사값(1px 단위 재현 아님):
```
공통: rounded-full, height 20px, padding 0 10px, font-size 10px, font-weight 800, letter-spacing .03em
이지    background: linear-gradient(180deg,#aab4bc,#7d8891)  border: 1px solid #67717a   color: #f5f6f7 (흰 텍스트, text-shadow 0 1px 1px rgba(0,0,0,.3))
노멀    background: linear-gradient(180deg,#5cc2dd,#2b93b0)  border: 1px solid #1f7690   color: #ffffff (text-shadow 0 1px 1px rgba(0,0,0,.25))
하드    background: linear-gradient(180deg,#e784a6,#c04b74)  border: 1px solid #9c3a5c   color: #ffffff (text-shadow 0 1px 1px rgba(0,0,0,.25))
카오스  background: linear-gradient(180deg,#3c3c3c,#221f1f)  border: 1px solid #caa87f   color: #f0d8b8
익스트림 background: linear-gradient(180deg,#3c3c3c,#1c1414) border: 1.5px solid #ef5d78 color: #f4794f
```
**보스별 일러스트 크기·위치**: 인물 구도가 보스마다 달라 고정값 하나로는 두상이 잘리거나 안 보이는 경우가 많다(카링·스우 두 예시만으로도 서로 다른 `background-size`가 필요했음, ADR-018 참고). `src/data/boss-portrait-crops.json`에서 `portraitSlug`별로 개별 지정 — 이 파일은 게임 데이터가 아니라 UI 표시 파라미터라 값은 AI가 임의로 채우지 않고 사용자가 이미지를 넣을 때마다 직접 조정한다. 세부 조회 로직은 `docs/ARCHITECTURE.md` 참고.

## 레이아웃
- 전체 너비: 모바일 뷰포트 기준 단일 컬럼, 별도 max-width 제한 없음(Capacitor 하이브리드 앱이라 데스크톱 와이드 레이아웃은 고려하지 않음, 확정 2026-07-11)
- 정렬: 좌측 정렬 기본
- 간격: 화면 전체 패딩 `p-4`, 콘텐츠 블록 사이 `space-y-4`, 카드 안쪽 패딩 `p-4`(확정 2026-07-11 — 일간/주간 스케줄러 화면 구현 기준)
- 하단 고정 탭바 도입(확정, 2026-07-11): 화면 목록이 2개 이상이 되는 시점부터 `border-t` 구분선 + 아이콘(위)·라벨(아래) 세로 배치 탭 항목을 화면 하단에 고정. 아직 화면이 없는 기능(사냥타이머·물욕템)의 탭은 그 기능이 실제로 만들어지기 전까지 추가하지 않는다. **확정(2026-07-12)**: 설정 화면은 4번째 탭으로 하단 탭바에 추가한다(별도 헤더 아이콘 방식 아님)

## 타이포그래피
| 용도 | 스타일 |
|------|--------|
| 페이지 제목(h1) | `text-lg font-semibold text-[#2B1B10]` |
| 섹션/카드 제목(h2) | `text-sm font-semibold text-[#2B1B10]` |
| 본문 | `text-sm text-[#5B4636]` |
| 보조/캡션 | `text-sm text-[#8A7362]` |
| 에러 문구 | `text-sm text-[#B91C1C]` |

(확정 2026-07-11 — 일간/주간 스케줄러·온보딩 화면 구현 기준으로 정리)

## 애니메이션
- 확정된 애니메이션 없음(2026-07-11) — hover 시 색상 전환(`hover:bg-...`/`hover:text-...`) 정도만 Tailwind 기본 유틸리티로 처리하고, 페이드·슬라이드 등 명시적 트랜지션은 아직 도입하지 않았다. 필요해지면 이 섹션에 추가

## 아이콘
- **라이브러리: `lucide-react`(확정, 2026-07-11)** — 새 아이콘이 필요하면 이 라이브러리에서만 가져온다. 다른 아이콘 라이브러리를 섞어 쓰지 않는다
- `strokeWidth`: 하단 탭바 내비게이션 아이콘은 `1.5`, 새로고침 등 소형 액션 아이콘은 `2`
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다 — 강조색 아이콘을 배경 없이 단독으로 쓴다(원형 배경으로 감쌌다가 제거하고 이 방식으로 확정, 2026-07-11)
- 현재 쓰이는 아이콘: 하단 탭바 `ListChecks`(컨텐츠)/`Swords`(보스, 활성 시 `#C2410C`·비활성 시 `#B7A490`, [[ADR-013]] 화면 개편에 따라 기존 `CalendarCheck`(일간)/`CalendarRange`(주간)에서 변경, 2026-07-11 — 제안 수준, 실제 적용 시 다른 조합으로 바뀔 수 있음), 새로고침 버튼 `RefreshCw`(`#C2410C`, 배경 없음)

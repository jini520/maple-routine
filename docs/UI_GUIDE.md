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
캐릭터 직업 고유 컬러 기반 다중 테마를 지원할 예정이다. **정정(2026-07-12)**: 테마마다 Primary 하나만 바뀌고 나머지는 공식으로 파생한다는 원래 방식은 폐기됐다 — 테마는 아래 시맨틱 토큰을 값으로 직접 갖는다. 현재 등록된 테마는 "레테"(다크)·"렌"(라이트)·"머쉬맘"(라이트, **기본**, 2026-07-14 추가)·"혼테일"(다크, **시스템 다크 모드 기본**, 2026-07-14 추가) 4개다.

| 토큰 | 용도 | 레테 | 렌 | 머쉬맘 | 혼테일 |
|------|------|------|------|------|------|
| `bg` | 페이지 배경 | `#0C080F` | `#F6F5F5` | `#F2F0E2` | `#0B0B0B` |
| `surface` | 카드/표면 | `#1A1720` | `#FFFFFF` | `#FDFCF6` | `#241110` |
| `surface-2` | 2단계 표면(강조 영역) | `#28232E` | `#E5E6E9` | `#E4E1CE` | `#362120` |
| `border` | 기본 보더 | `#37323E` | `#DBD3D6` | `#CFC9AE` | `#524344` |
| `border-strong` | 강조 보더 | `#54444E` | `#C8C1C6` | `#A3996E` | `#695E5F` |
| `primary` | 채움 배경(버튼 등) — 위에 흰 글자 OK | `#9975B3` | `#DC171D` | `#F58B0F` | `#E86A16` |
| `primary-hover` | hover/눌림 상태(배경) | `#85639F` | `#B33946` | `#C55907` | `#C34204` |
| `primary-text` | 빨강 텍스트·링크 전용 | `#61417B` | `#803440` | `#9C4304` | `#F09A55` |
| `secondary` | 보조 강조(배지 등) | `#D1C093` | `#437B71` | `#F7D00D` | `#7B777A` |
| `secondary-text` | `secondary` 계열이지만 텍스트로 쓸 때 대비를 보장하는 변형 | `#D1C093` | `#3E7369` | `#7A5E00` | `#B8B2B4` |
| `third` | 3차 강조(카운트 배지·진행률 바 등 틴트 배경용) | `#D8608F` | `#C9EEF2` | `#CA763A` | `#936E68` |
| `third-text` | `third` 계열이지만 텍스트로 쓸 때 대비를 보장하는 변형 | `#DA6995` | `#21808A` | `#8F4E1F` | `#C79A92` |
| `info-tint` | 정보성 배경 틴트 전용 | `#C9D6F2` | `#E4F6F8` | `#FBF3D0` | `#3A3235` |
| `error` | 에러/위험 텍스트 | `#D8608F` | `#A31118` | `#B3200B` | `#E85447` |
| `text` | 기본 텍스트 | `#E8DFEC` | `#171721` | `#241208` | `#E6E1E2` |
| `text-muted` | 보조 텍스트 | `#B89CBD` | `#525475` | `#645C42` | `#9F9594` |
| `text-disabled` | 비활성 텍스트 | `#8A758D` | `#8A8089` | `#9A9070` | `#7A6E6F` |

**3번째 테마 `mushmom` 추가 + 기본 테마 교체(2026-07-14)**: 사용자가 17토큰 값을 전부 제공([[ADR-006]] 확인 완료)하고 이 프로덕트의 기본 테마로 지정 요청. 기존에는 "렌"이 `src/index.css`의 `@theme` 기본 블록 값(코드상 사실상 기본 테마)이었는데, 이번에 `mushmom`이 그 자리를 대체하고 "렌"은 "레테"와 동일하게 `:root[data-theme='렌']` 오버라이드 블록을 갖는 선택지로 전환된다. 상세는 `docs/ADR.md` ADR-009 참고.

**테마 이름 한글화 + 4번째 테마 "혼테일" 추가 + 시스템 다크 모드 연동(2026-07-14)**: 사용자가 `mushmom`의 표기를 다른 테마와 동일하게 한글 "머쉬맘"으로 정정하고, 4번째 테마 "혼테일"(다크)을 17토큰 값과 함께 추가([[ADR-006]] 확인 완료)했다. 동시에 "시스템 컬러에 따라 자동으로 라이트/다크 전환"을 요청 — `restoreFromStorage()`에서 저장된 테마가 없을 때 `window.matchMedia('(prefers-color-scheme: dark)')`로 OS 설정을 확인해 라이트면 "머쉬맘", 다크면 "혼테일"을 기본값으로 쓴다(앱 실행 시점에 1회 판정 — 앱 실행 중 OS 설정을 바꿔도 재시작 전까지는 반영되지 않음, 실시간 반영은 범위 밖). 사용자가 설정 화면에서 테마를 한 번이라도 명시적으로 선택하면 그 값이 저장되어 이후에는 시스템 설정과 무관하게 그 값을 쓴다. `src/index.css`의 `@theme` 기본 블록은 계속 "머쉬맘" 값이고, "혼테일"은 "레테"·"렌"과 동일하게 `:root[data-theme='혼테일']` 오버라이드 블록을 갖는다.

**`-text` 계열 토큰(2026-07-14)**: `primary-text`가 이미 "채움용 색과 텍스트용 색을 분리"하는 선례였다 — 캐릭터별 대표 컬러를 추출해 테마를 늘려갈 계획이라, 밝기가 제각각인 색이 `bg-X/15 text-X` 틴트 배지 패턴에 그대로 쓰이면 대비가 깨지는 문제가 반복될 걸 대비해 `secondary`/`third`에도 같은 원칙을 적용했다. 값은 원래 색의 색상(H)을 유지한 채 밝기만 조정해 `bg-X/15` 틴트 배경(surface 위에 15% 합성) 대비 WCAG AA(4.5:1) 이상이 되도록 AI가 계산한 제안값이다 — 사용자 최종 확인 전까지는 잠정치로 취급한다.

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

### 아코디언 (드롭다운 리스트) — 확정, 2026-07-11, [[ADR-014]]; 내부 구조 재설계, 2026-07-14, [[ADR-023]]
보스 수익 계산기의 캐릭터별 드롭다운에서 처음 도입. **정정(2026-07-14, [[ADR-023]])**: 펼쳤을 때 헤더와 목록이 각각 독립된 카드처럼 보여 "펼친 결과"로 안 읽힌다는 문제, 보스 행이 카드-in-카드로 겹겹이 쌓이던 문제, 캐릭터명이 헤더와 행에 중복 표시되던 문제, 파티원 입력·정산 금액이 행마다 제각각 배치되던 문제, "가격 미확정" 행만 레이아웃이 다르던 문제를 실제 코드를 그대로 옮긴 와이어프레임으로 여러 라운드 검토해 아래 구조로 재설계했다.

**헤더+본문 결합 — 접혔을 때와 펼쳤을 때의 셸이 다르다**:
```
접힘 상태(단독 카드, 기존과 동일): rounded-[14px] bg-surface border border-border p-4
펼침 상태(헤더+본문을 하나의 셸로): 바깥 wrapper — rounded-[14px] bg-surface border border-border overflow-hidden
  ㄴ 헤더: 바깥 wrapper 안에서 자체 border/rounded/bg 없음(투명), p-4, flex items-center gap-3
  ㄴ 본문: 헤더 바로 아래, border-t border-border 하나만으로 헤더-본문 경계 표시(간격 없음)
```
지금까지는 헤더도 본문(보스 행 목록)도 각각 독립 카드라 그 사이 간격이 다른 무관한 블록들과 똑같았다 — 그래서 "펼친 결과"가 아니라 "우연히 붙어 있는 별개의 두 블록"처럼 보였다. 펼쳤을 때만 위 결합 셸을 쓰고, 접힌 상태(다른 캐릭터가 아직 안 펼쳐진 경우)는 기존처럼 완결된 단독 카드로 둔다.

**헤더 — 캐릭터명·합계 텍스트 조합을 아바타+분리 레이아웃으로**:
```
아바타: h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-text (캐릭터명 첫 글자)
이름: flex-1 text-sm font-semibold text-text truncate
금액: text-sm font-bold text-text tabular-nums (우측, 세로선 정렬)
펼침 아이콘: 기존과 동일 — lucide-react ChevronDown(접힘)/ChevronUp(펼침), strokeWidth 2
```
지금까지는 헤더 텍스트가 `"{캐릭터명} · {합계} 메소"` 한 줄로 이어붙어 있었다 — 원형 아바타(보스 아이콘의 사각형 `BossPortrait`와 형태로 구분)를 도입해 캐릭터를 텍스트가 아니라 형태로도 나타내고, 이름과 금액을 각자의 자리로 분리한다. **미확정**: 아바타를 이니셜로 둘지, `character/basic`의 `character_image`([[ADR-015]]에서 이미 다른 화면용으로 캐싱 중)를 재사용해 실제 캐릭터 이미지로 바꿀지는 정하지 않았다.

**본문 — 보스 행을 개별 카드에서 하나의 통합 리스트로**:
```
행: flex items-start gap-3 p-4 border-b border-border last:border-b-0 (자체 rounded/bg/border 없음 — 바깥 셸에 얹힘)
아이콘: 기존 BossPortrait 그대로(h-10 w-10, 원형)
1번째 줄(이름): flex items-baseline gap-1.5 flex-wrap — 보스명(text-sm font-semibold text-text, 길어도 줄바꿈) + 난이도 뱃지
2번째 줄(조작): flex items-center justify-between gap-2 mt-2 — 파티원 스테퍼(좌) / 정산 금액(우, tabular-nums)
```
캐릭터명은 헤더에 이미 있으므로 각 행에서 제거한다. 보스명·난이도는 그 줄 폭 전체를 쓰다가 필요하면 줄바꿈되도록 비워두고, 파티원 스테퍼·정산 금액은 그 아래 별도 줄에서 좌우로 벌어진다 — 이름 길이와 무관하게 금액이 항상 같은 위치에서 우측 정렬을 유지한다. **"가격 미확정" 행도 같은 두 줄 구조를 그대로 유지**한다 — 정산 금액 자리에 기존 배지(`rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary`, `BossProfitScreen.tsx`에 이미 있는 스타일 그대로 재사용)를 넣고, 파티원 스테퍼는 `opacity-40`(선택/비활성 표시에 이미 쓰이는 값, [[ADR-019]] "파티 관리 모달" 참고)으로 비활성 처리한다 — 입력칸·금액이 통째로 빠져 레이아웃이 달라지지 않게 한다.

**파티원 입력 — 숫자 인풋에서 −/+ 스테퍼로**:
```
스테퍼: inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5
버튼: h-[18px] w-[18px] rounded-full bg-surface-2 flex items-center justify-center text-text
값: text-xs tabular-nums (증가/감소 버튼 사이)
```
[[ADR-019]] "파티 관리" 모달과 동일한 조작 방식(-/+ 버튼, 경계에서 비활성화)으로 통일한다 — 자리수가 바뀌어도 스테퍼 폭이 고정되고, 탭 한 번으로 조정할 수 있다.

**소계 — 헤더에만 있던 걸 목록 하단에도**:
```
footer: flex items-center justify-between px-4 py-3 bg-surface-2 text-sm
왼쪽: "{캐릭터명} 합계" text-text-muted
오른쪽: 금액 font-semibold tabular-nums text-text
```
지금은 소계가 접힌 헤더에만 있어 행을 보는 동안 합계와 단절된다 — 같은 셸 안, 목록 바로 아래 이 footer를 붙여 "지금 보고 있는 이 보스들의 합"이 바로 확인되게 한다.

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

### 온보딩 API 키 검증 중 — 폼 유지 + 버튼 스피너 — 확정, 2026-07-16
API 키를 제출하면 즉시 캐릭터 목록 조회(`GET /character/list` 단일 요청 = 별도 검증 엔드포인트 없이 이 호출 자체가 키 검증)를 시작하고, 응답이 올 때까지 **화면을 이동시키지 않고 API 키 입력 폼을 그대로 유지**한다. 기존에 폼을 지우고 띄우던 "캐릭터 목록을 확인하고 있어요..." 문구는 제거한다 — 정상 경로가 1초 미만이라 문구가 깜빡 떴다 사라지는 게 오히려 거슬렸다.
- 검증 중(`verifyingApiKey`)에는 `ApiKeyForm`을 `isSubmitting`으로 유지한다. 폼 위치·입력값은 그대로 두고, 제출 버튼 내용만 "확인" 텍스트 → 로딩 스피너로 바꾸고 버튼을 비활성화(재제출 방지)한다.
- 검증이 끝나면 다음 상태(계정 선택 / 예열 진행률 바)로 전이한다. 예열(prefetching)처럼 수 초 이상 걸릴 수 있는 작업은 이 규칙에서 제외 — 진행률 바를 그대로 보여준다.
- 버튼 스피너: `h-5 w-5 rounded-full border-2 border-bg/30 border-t-bg animate-spin motion-reduce:animate-none`. 보스 수익 자동 재조회 스피너(중립 배경 위 `border-border border-t-primary`)와 달리, 솔리드 primary 버튼 안이라 버튼 글자색(`bg` 토큰)을 그대로 써서 호(arc)를 `border-t-bg`로 둔다. 접근성: 로딩 중 버튼에 `aria-busy`를 주고, 텍스트가 사라지는 동안 접근 가능한 이름을 `aria-label="확인 중"`으로 유지하며, 스피너 자체는 `aria-hidden`.
- 설정의 API 키 재입력·계정 변경(`AccountFlowStatus`의 `verifying`)에도 같은 문구가 남아 있으나 이번 단계 범위 밖 — 추후 별도 단계에서 통일 여부 결정.

### 설정 리스트 행 + 모달 — 확정, 2026-07-13
설정 화면은 카드형 섹션 나열이 아니라, **하나의 리스트 컨테이너**(`rounded-[14px] bg-surface border border-border px-6`) 안에 행(`SettingsRow`)을 `divide-y divide-border`로 이어붙이는 방식이다. 각 행은 `py-4`, 왼쪽 라벨(`text-sm font-medium text-text`, 위험한 동작은 `text-error`) + 오른쪽 콘텐츠(기본은 `lucide-react` `ChevronRight`, `strokeWidth 2`, `text-text-muted` — 필요 없으면 `showChevron={false}`)로 구성되고, 행 전체가 버튼이라 탭하면 그 항목에 맞는 모달이 열린다("API 키 재입력"·"계정 변경"·"테마" 3개 행 전부 이 패턴, "연결 해제"만 예외로 확인 모달을 직접 연다).
- **모달 컴포넌트(`components/Modal`)**: `CharacterTrackingPicker`/`DisconnectConfirm`에서 반복되던 오버레이(`fixed inset-0 flex items-center justify-center bg-bg/70` + 안쪽 카드 `onClick` 시 `stopPropagation`)를 공용화했다. 기본은 카드(`rounded-[14px] border border-border bg-surface p-6`)를 제공하지만, `card={false}`를 주면 위치 고정용 래퍼만 남기고 카드 스타일은 생략한다 — `ApiKeyForm`/`AccountSelectionList`처럼 이미 자체 카드를 가진 컴포넌트를 그대로 재사용할 때 카드-안-카드 중첩을 피하기 위함이다.
- **테마 대표 컬러 점(`ThemeSwatchDots`)**: 테마의 `primary`/`secondary`/`error` 3개 토큰 값을 `h-4 w-4 rounded-full` 점으로 겹쳐(`-space-x-1`) 보여준다. 테마 행의 오른쪽 콘텐츠(점 3개 + 현재 테마 이름을 `rounded-full border border-border px-3 py-1 text-xs` 배지로)와 테마 모달 안의 선택지 각각에 재사용한다. `src/data/job-themes.json`을 직접 import해 값을 읽는다 — 활성화되지 않은 테마의 색도 미리보기로 보여줘야 해서 CSS 커스텀 프로퍼티(현재 활성 테마 값만 노출)로는 부족하기 때문이다.

### 스크롤 영역 — 확정, 2026-07-13
컨텐츠 스케줄러·보스 스케줄러 화면은 제목부터 탭(보스는 솔로/파티 서브 필터까지)을 화면 상단에 고정하고, 그 아래 목록(컨텐츠 리스트 / 보스 카드 목록)만 스크롤되게 한다. `position: sticky`로 구현한다 — 목록 영역을 별도 `overflow-y-auto` 컨테이너로 분리하고 높이를 계산(`calc(100dvh - ...)`)하는 방식 대신, 페이지 자체의 자연스러운 스크롤 위에서 헤더 블록만 `sticky top-0`으로 붙인다. `App.tsx`의 레이아웃(높이 모델)을 전혀 건드리지 않아도 되고, 다른 화면(보스 수익 계산기·설정 등)의 기존 페이지 스크롤 방식과도 충돌하지 않는다.
```
화면 루트: space-y-4 (패딩 없음 — 패딩은 아래 두 블록이 각자 갖는다)
헤더 블록: sticky top-0 z-10 bg-bg px-4 pt-4 pb-2 (position 컨텍스트 + 배경 + 패딩만 담당)
  ㄴ 콘텐츠 래퍼(space-y-4): 제목+관리 버튼 행, 캐릭터 드롭다운+새로고침 행, 상태/로딩 메시지, 탭 행, (보스 화면만) 솔로/파티 필터 행까지 전부 포함
  ㄴ 페이드 오버레이: 아래 "헤더-목록 경계 페이드" 참고
목록 블록: px-4 pb-4 space-y-4 — 화면 루트의 직계 자식(헤더 블록의 형제)
```
`bg-bg`는 뒤에서 스크롤되는 카드/리스트 항목이 헤더 밑으로 비쳐 보이지 않도록 막는 용도이고, `z-10`은 문서 순서상 헤더보다 나중에 그려지는 목록이 스크롤 시 헤더 위로 올라와 덮지 않도록 한다. 빈 목록 안내문("표시할 항목이 없습니다" 등)은 헤더가 아니라 목록 영역에 둔다 — 그 자체가 "목록이 있어야 할 자리의 내용"이기 때문이다.

**정정(2026-07-13) — 패딩은 화면 루트가 아니라 헤더/목록 블록에 각각 줘야 한다**: 처음에는 화면 루트에 `p-4`를 주고 헤더를 그 자식으로 뒀는데, 그러면 루트의 `padding-top`(1rem)만큼 스크롤해야 헤더가 완전히 `top: 0`에 고정되고 그 전까지는 헤더가 스크롤을 따라 조금씩 움직이는 문제가 있었다(sticky 엘리먼트의 정지 위치는 조상의 padding이 아니라 자기 자신의 padding-box를 기준으로 계산되므로, padding이 sticky 엘리먼트보다 앞쪽 조상에 있으면 그만큼의 스크롤 거리 동안은 그냥 일반 흐름처럼 밀려 올라간다). 그래서 화면 루트에서 패딩을 완전히 빼고, 헤더 블록 자신에게 `px-4 pt-4`를, 목록 블록에 `px-4 pb-4`를 준다 — 헤더는 스크롤 시작과 동시에 정확히 `top: 0`에 고정된다.

**헤더-목록 경계 페이드 — 확정, 2026-07-13**: sticky 헤더의 불투명 배경이 카드/리스트 항목을 스크롤 도중 한 프레임 만에 완전히 가려버려 경계가 딱 끊어져 보이는 문제가 있었다. 헤더 블록(콘텐츠 래퍼의 형제, `position: sticky`가 이미 포지셔닝 컨텍스트라 `relative` 불필요)에 페이드 오버레이를 추가한다:
```
pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-bg to-transparent backdrop-blur-sm
style: maskImage/WebkitMaskImage: linear-gradient(to bottom, black, transparent)
```
`top-full`로 헤더 바로 아래(헤더의 실제 콘텐츠 높이는 밀지 않음, absolute라 레이아웃에 관여하지 않음)에 32px 높이의 오버레이를 겹친다. **블러만으로는 부족하다** — 배경색(`bg-gradient-to-b from-bg to-transparent`)과 블러 강도(`backdrop-blur-sm`에 동일한 `mask-image` 그라데이션을 함께 적용)를 같은 그라데이션으로 동시에 옅어지게 해야, 색은 흐려지는데 블러는 그대로 남아 오히려 부자연스러운 경계가 생기는 걸 막을 수 있다(사용자 확인, 2026-07-13). `mask-image`는 Tailwind 유틸리티로 표현하기 애매해 인라인 스타일로 직접 준다 — 보스 카드 일러스트 페이드(`BossCard`)와 동일한 패턴.

### 탭 토글(주간/월간, 일간/주간 등) — 확정, 2026-07-13, [[ADR-018]]
컨텐츠 스케줄러·보스 스케줄러의 캐릭터 드롭다운 아래 탭 전환 UI. **드롭다운·탭·(있다면) 카운트 배지를 별도 카드로 묶지 않는다** — 배경 위에 바로 놓는다(카드가 하나 더 늘어나는 걸 피하기 위해 카드로 묶는 안은 검토 후 기각, 2026-07-13).
```
탭 행: flex items-center gap-4 (드롭다운 다음 줄)
활성 탭: rounded-full bg-primary/15 text-primary px-3 py-[5px] text-sm font-semibold — 배지에 이미 쓰던 pill 스타일 그대로 재사용(새 스타일 신설 금지)
비활성 탭: 배경 없음, text-sm font-medium text-text-muted, 좌우 패딩은 활성 탭과 동일(px-3)해서 탭 전환 시 다른 탭이 밀리지 않게 함
카운트 배지(있는 화면만, 예: 보스 스케줄러 주간 탭의 n/12): 탭 행과 같은 줄, justify-between으로 오른쪽 끝에 배치 — "활성 탭 = 이 수치"라는 관계를 같은 행 배치로 표현. rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1 (기존 배지 스타일 그대로)
```
활성/비활성 색 차이(`text-primary` vs `text-text-muted`)만으로는 레테처럼 저채도 팔레트에서 구분이 약해서 배경 pill을 반드시 함께 쓴다 — 굵기(`font-semibold`/`font-medium`) 차이만으로 대체하지 않는다.

### 솔로/파티 서브 필터 — 확정, 2026-07-13, [[ADR-019]] (설계만·구현 전)
보스 스케줄러의 주간/월간 탭 행 바로 아래 한 줄 추가되는 필터. 위 탭 토글과 동일한 pill 스타일을 그대로 재사용하되(새 스타일 신설 금지), 탭보다 한 단계 낮은 위계임을 나타내기 위해 폰트 크기를 `text-xs`로 한 단계 줄인다.
```
필터 행: flex items-center gap-2 (탭 행 바로 다음 줄)
활성 필터: rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-semibold
비활성 필터: 배경 없음, text-xs font-medium text-text-muted, 좌우 패딩 동일(px-3)
옵션: 전체 / 솔로 / 파티 (이 순서 고정)
```
필터는 현재 활성 탭(주간 또는 월간) 안에서만 적용된다. 두 탭의 필터 선택 상태는 서로 독립적으로 유지한다(예: 주간 탭에서 "파티"를 고른 상태로 월간 탭으로 전환해도 월간 탭은 그대로 "전체").

### 보스 수익 — 주간/월간 탭 + 기간 네비게이터 — 확정, 2026-07-14, [[ADR-023]] (설계만·구현 전)
보스 수익 계산기("보스 수익") 화면 상단, 제목 바로 아래. 탭 자체는 위 "탭 토글" 레시피를 그대로 재사용한다(새 스타일 신설 금지) — 주간/월간 두 탭만 있고 카운트 배지는 없다.
```
탭 행: 위 "탭 토글(주간/월간, 일간/주간 등)" 그대로
기간 네비게이터: flex items-center justify-center gap-4 (탭 행 바로 다음 줄)
이전/다음 버튼: h-7 w-7 rounded-full border border-border flex items-center justify-center text-text disabled:opacity-30
기간 라벨(가운데): text-center
  ㄴ 1번째 줄: text-sm font-semibold text-text (상대 표현 또는 절대 표기, 아래 "기간 라벨 규칙" 참고)
  ㄴ 2번째 줄: text-xs text-text-muted tabular-nums mt-0.5 (정확한 날짜/월, 항상 표시)
```
다음 방향 버튼은 최신 기간(오늘 기준 이번 주/이번 달)에서 `disabled`로 비활성화한다 — 아직 일어나지 않은 미래 데이터는 없다.

**기간 라벨 규칙**: 가장 최근 두 기간까지만 상대 표현("이번 주"/"지난 주", "이번 달"/"지난 달")을 쓴다. 그보다 이전은 "N주 전"처럼 세는 표현 대신, **그 기간이 속한 달 안에서 몇 번째 주인지("OO월 N주차")** 또는 "OO년 O월"로 표기한다 — 몇 주 전인지 암산할 필요 없이, 아래 "월간 탭" 서브섹션의 주차 표기(1주차·2주차···)와 같은 언어를 쓴다. 정확한 날짜는 2번째 줄에 항상 작게 남긴다. 한 주가 두 달에 걸치면(목요일 리셋 주가 월말에 걸리는 경우) **그 주가 시작하는 목요일이 속한 달** 기준으로 몇 주차인지 정한다 — 예: 6.25(목)~7.1(수) 주는 7월이 아니라 "6월 4주차".

**기간 미보유 — 자동 재조회 스피너**: 저장된 기록이 없는 과거 기간으로 처음 이동하면, 버튼 없이 자동으로 재조회하며 기존 빈 상태 박스 스타일(`rounded-[14px] border border-dashed border-border p-4`, `BossProfitScreen.tsx`의 "추적 중인 캐릭터가 없습니다" 등과 동일한 스타일)을 재사용한다.
```
컨테이너: rounded-[14px] border border-dashed border-border p-6 flex flex-col items-center gap-3 text-center
스피너: h-6 w-6 rounded-full border-[3px] border-border border-t-primary animate-spin motion-reduce:animate-none
안내문: text-xs text-text-muted (예: "5월 2주차 기록을 불러오는 중...")
```
`animate-spin`은 Tailwind 기본 유틸리티를 그대로 쓰고 별도 커스텀 keyframes를 만들지 않는다. 회전하는 호(arc)는 `border-t-primary`로 — 이미 진행률 바 fill(`bg-primary`)과 활성 탭(`bg-primary/15 text-primary`)에 쓰이는 "지금 진행 중/활성"이라는 의미의 primary를 그대로 잇는다. 조회 결과는 로컬에 영구 저장되므로, 같은 기간으로 다시 돌아오면 스피너 없이 바로 목록이 보인다. 그 기간에 캐릭터가 실제로 접속하지 않았으면 재조회해도 여전히 데이터가 없을 수 있다(API 자체 제약, [[ADR-023]] 참고) — 이 경우의 문구는 미정.

**월간 탭 — 주차별 합계 + 월간 보스**: 월간 탭은 보스를 하나하나 나열하지 않고, 그 달 안에서 벌어들인 주간 보스 수익을 주차별 합계로 먼저 보여준 뒤 그 아래에 월간 보스(현재 검은마법사 1종) 상세를 이어 붙인다. 위 "아코디언" 본문 셸 안에 두 서브섹션을 나눈다:
```
서브섹션 라벨: px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2 (예: "주간 보스 수익 · 주차별 합계", "월간 보스 수익")
주차 행: flex items-center gap-3 p-4 border-b border-border (보스 아이콘 없음 — 이 행은 개별 보스가 아니라 그 주 전체의 합계이므로 표시할 이미지가 없다)
  ㄴ 라벨: text-sm font-semibold text-text ("N주차") + text-xs text-text-muted tabular-nums (날짜 범위)
  ㄴ 진행 중 배지(현재 진행 중인 주에만): rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5 ("진행 중")
  ㄴ 금액(우측): text-sm font-semibold text-text tabular-nums, 또는 아직 시작하지 않은 주는 text-xs text-text-muted ("예정")
아직 시작하지 않은 주의 행 전체: opacity-40 (선택/비활성 표시에 이미 쓰이는 값, [[ADR-019]] 참고)
월간 보스 상세 행: 위 "아코디언 — 본문" 레시피 그대로(아이콘·2줄 구조·스테퍼)
```
이미 끝난 주는 확정 금액을, 지금 진행 중인 주는 "진행 중" 배지와 함께 지금까지의 잠정 합계를, 아직 시작하지 않은 주는 "예정"으로 흐리게 표시해 데이터가 없다는 걸 명확히 한다. 주차 행에는 그 주에 어떤 보스로 벌었는지의 상세를 다시 보여주지 않는다 — 확인하려면 주간 탭에서 그 주로 이동한다(중복 방지).

### 보스 카드 — 확정, 2026-07-13, [[ADR-018]]
보스 스케줄러의 보스 목록. 기존에는 보스 전체를 하나의 카드(`<ul>`)에 담고 왼쪽 체크 도형으로 완료 여부를 표시했으나, 보스별 독립 카드 + 일러스트 bleed 방식으로 바꾼다. **목록을 감싸는 상위 카드는 두지 않는다** — 카드끼리 `space-y-2`로 나열만 한다.

**정정(2026-07-13) — 카드 배경/보더/보스명 텍스트만 앱 테마와 무관하게 레테(다크) 고정**: 일러스트 bleed·페이드·text-shadow가 어두운 배경을 전제로 튜닝되어, 렌(라이트) 테마에서 `bg-surface`/`border-border`/`text-text` 같은 테마 토큰을 쓰면 대비가 깨진다. 그래서 보스 카드(`BossScreen.tsx`의 `BossCard`)의 카드 배경·보더·보스명 텍스트만 레테 값을 리터럴 hex로 고정한다 — 앱이 렌 테마여도 이 세 값은 항상 다크로 보인다(각각 `#1A1720`/`#37323E`/`#E8DFEC`). 반면 **완료 뱃지는 앱 전체가 공유하는 "완료/성공" 의미 색(secondary)이라 고정하지 않고 테마 토큰(`bg-secondary`/`text-bg`) 그대로 유지** — 렌 테마에서는 완료 뱃지 색도 렌의 secondary(#437B71)로 바뀐다(정정, 2026-07-13).
```
카드: rounded-[14px] border border-[#37323E] bg-[#1A1720](레테 고정), height 80px, overflow-hidden, position relative
일러스트(있는 보스만): position absolute inset-0, background-size/position은 보스별 설정 값(src/data/boss-portrait-crops.json, 없으면 cover/center) — 블러 필터 없음(2026-07-13 확정, 흐리지 않고 선명하게), saturate(.85) brightness(.8)로 살짝 톤다운, opacity .65
  페이드: mask-image: linear-gradient(90deg, #000 0%, #000 38%, transparent 76%) — 왼쪽 38%까지 선명, 76%부터 완전 투명(카드 배경에 자연스럽게 녹아듦). 일러스트 없는 보스는 이 레이어 자체를 생략(플레이스홀더 배경색만)
콘텐츠 행: flex items-center justify-between, padding 0 14px(좌우 동일 — 일러스트 위에 바로 얹히므로 별도 좌측 여백 없이 카드 가장자리에 붙임, 2026-07-13 확정)
  왼쪽: 난이도 뱃지 + 보스명 + 파티 배지(설정된 경우, 순서: 뱃지 → 이름 → 파티 배지), 이름에는 text-shadow(0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6))로 일러스트 위에서도 대비 확보(**정정, 2026-07-13** — 파티 배지는 원래 오른쪽 완료 배지 옆이었으나 왼쪽으로 이동)
  오른쪽: 완료 시에만 완료 배지, 미완료는 빈 공간([[ADR-019]] 반영)
```
**완료 뱃지**: `rounded-full bg-secondary text-bg text-xs font-bold px-2.5 py-1`(테마 토큰, 카드 배경과 달리 고정하지 않음). 기존 `StatusDot`의 체크 완료 색이 이미 `bg-secondary`(레테 기준 #D1C093, 골드)였으므로 새 색을 만들지 않고 그대로 재사용한다. 왼쪽 체크 도형(`StatusDot`)은 제거.

**파티 배지 — 확정, 2026-07-13, [[ADR-019]] (설계만·구현 전)**: 파티 인원이 2인 이상으로 설정된 보스 카드에만 표시. 카드 배경·보더·보스명과 마찬가지로 일러스트 위에 얹히는 카드 로컬 요소라 테마 토큰이 아니라 레테 고정 리터럴 값을 쓴다(완료 뱃지처럼 앱 전역 의미색이 아니므로 고정 대상).
```
rounded-full bg-white/20 text-[#E8DFEC] text-xs font-semibold px-2 py-1, flex items-center gap-1(**정정, 2026-07-13** — 왼쪽으로 이동 후 일러스트가 진한 구간 위에 얹혀 대비가 약해져 bg-white/10 → bg-white/20으로 상향)
아이콘: lucide-react `Users`, size 12, strokeWidth 2
텍스트: "n인"(예: "4인")
```
설정 안 함 또는 1인(솔로)이면 이 배지 자체를 렌더링하지 않는다 — 별도의 "솔로" 뱃지는 두지 않는다(빈 공간으로 솔로를 표현).

**파티 관리 진입점 — 재정정, 2026-07-13, [[ADR-019]]**: 보스 카드에서 직접 설정하는 방식(카드 안 아이콘 버튼 → 단일 보스 모달)은 폐기했다. 대신 보스 스케줄러 화면 상단 "캐릭터 관리" 버튼 옆에 **"파티 관리" 버튼**을 추가한다(둘 다 같은 스타일 `text-sm font-medium text-text-muted hover:text-text`, 아이콘 없이 텍스트만 — 기존 "캐릭터 관리" 버튼과 동일한 톤). 탭하면 모달(`PartyManagementModal`)이 열린다. 보스 카드 자체에는 더 이상 진입 버튼이 없다 — 파티 배지(아래)만 표시한다.

**파티 관리 모달 — `PartyManagementModal`, `components/Modal/Modal` 재사용**: 전체 목록을 한 번에 나열하지 않고, **보스 드롭다운 → 난이도 뱃지 선택 → 파티원 수 입력** 3단 폼으로 한 번에 하나의 (보스, 난이도) 조합만 편집한다(**재정정, 2026-07-13** — 전체 목록 나열 방식에서 변경).
```
보스: <select> — 정정(2026-07-13) 캐릭터가 스케줄러에 등록한 보스가 아니라 항상 전체 보스 목록(weekly-bosses.json의 weekly+eventWeekly+monthly 전체, 중복 제거) — 아직 등록하지 않은 보스도 미리 설정해둘 수 있다. 라벨 "보스"(text-xs font-medium text-text-muted), 인풋은 CharacterSelectDropdown과 동일한 톤(border-border bg-surface px-4 py-3 text-sm text-text, 다만 폭은 w-full)
난이도: 라벨 "난이도" 아래 flex flex-wrap gap-2로 뱃지 버튼 나열 — 선택 가능한 난이도는 boss-crystal-prices.json에서 해당 보스명으로 조회(새 게임 데이터 아님, ADR-006. 가격 데이터가 아직 없는 보스는 "이 보스는 아직 파티 설정을 지원하지 않습니다" 안내로 대체). 각 버튼은 보스 카드와 동일한 DifficultyBadge(BossScreen.tsx에서 export)를 그대로 감싸 재사용 — 새 뱃지 스타일 신설 금지. **정정(2026-07-13)** — 선택 표시에 쓰던 `ring-2 ring-primary` 테두리를 제거하고 투명도 차이만으로 구분한다: 선택된 난이도는 불투명(기본), 비선택은 opacity-40 hover:opacity-70(대비를 더 주기 위해 기존 50→40으로 낮춤)
파티원 수: -/+ 스테퍼. flex items-center gap-3 — 감소 버튼(h-9 w-9 rounded-full border border-border, lucide-react `Minus`) · 가운데 현재 값(w-8 text-center text-sm font-semibold) · 증가 버튼(동일 스타일, `Plus`). 라벨 "파티원 수 (최대 N인)"으로 상한을 항상 노출. 감소 버튼은 값이 1일 때, 증가 버튼은 값이 해당 (보스,난이도)의 maxPartySize일 때 disabled — 범위 밖 값 자체를 입력할 방법이 없다. 저장 버튼(rounded-full bg-primary) 클릭 시 현재 값 그대로 store.setPartySize를 호출한다
```
보스/난이도를 바꾸면 스테퍼 값이 그 조합의 저장된 값(1~maxPartySize로 clamp)으로 초기화된다(React `key` 리셋 관용구 — 이전 조합의 값이 새 조합에 남지 않음). **정정(2026-07-13)**: 난이도 기본 선택은 그 보스가 캐릭터의 스케줄러에 등록돼있으면 등록된 난이도, 아니면 boss-crystal-prices.json 등록 순서상 첫 난이도다 — 보스 목록 자체는 등록 여부와 무관하게 항상 전체를 보여주지만, 난이도 기본값만큼은 실제로 플레이 중인 난이도를 우선한다.

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

### 일일퀘스트 카드 — 확정, 2026-07-14, [[ADR-020]] (구현 전)

컨텐츠 스케줄러 일간 탭에서 `kind: 'quest'`인 항목(지역별 반복 필드 퀘스트)에만 적용. `kind: 'contents'`인 항목은 아래 "몬스터파크 카드"(예외 하나)를 빼면 기존 "이름 · now/max + 진행률 바" 표시를 그대로 유지 — 이 섹션은 그 외 신규 퀘스트 카드만 다룬다. 카드 골격은 [[ADR-018]]의 보스 카드를 그대로 재사용한다(같은 상수·색값을 새로 정의하지 않음).

```
카드: rounded-[14px] border border-[#37323E] bg-[#1A1720](레테 고정, 보스 카드와 동일), height 80px, overflow-hidden, position relative
일러스트(지역 매칭된 경우만): position absolute inset-0, background-size/position은 src/data/daily-quest-region-crops.json(없으면 cover/center) — saturate(.85) brightness(.8), opacity .65, mask-image: linear-gradient(90deg, #000 0%, #000 38%, transparent 76%) — 보스 카드와 완전히 동일한 값
콘텐츠 행: flex items-center justify-between, padding 0 14px
  왼쪽: 지역 아이콘(있는 경우만, h-6 w-6 object-contain) + 퀘스트명 — "[일일 퀘스트] " 접두어를 제거한 나머지 전체(예: "레헬른의 평온한 밤"), text-shadow는 보스명과 동일(0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6))
  오른쪽: quest_state 3단 뱃지(아래) — 보스 카드는 미완료 시 빈 공간이었지만, 여기는 0/1/2 세 상태를 모두 뱃지로 구분해서 보여준다
```

**지역 아이콘(확정, 2026-07-14)**: `src/assets/maps/icons/{slug}.{png|webp}`(배경과 동일한 슬러그, 확장자는 파일마다 다를 수 있음)를 이름 왼쪽에 표시. 매칭되는 아이콘이 없으면 생략(이름만 표시).

**quest_state 뱃지(확정, 2026-07-14)**:
```
완료(2):    rounded-full bg-secondary text-bg text-xs font-bold px-2.5 py-1, 문구 "완료" — 보스 카드 완료 뱃지와 동일 스타일 재사용
진행 중(1): rounded-full bg-white/20 text-[#E8DFEC] text-xs font-semibold px-2.5 py-1, 문구 "진행 중" — 파티 배지와 같은 톤의 반투명 pill
시작 안함(0): rounded-full bg-white/10 text-[#E8DFEC]/70 text-xs font-semibold px-2.5 py-1, 문구 "시작 안함"
```

**지역 배경 매칭**: `src/data/daily-quest-regions.json`(지역명 → 슬러그)과 `src/data/daily-quest-region-crops.json`(슬러그 → 크롭)을 통해 `src/assets/maps/{slug}.webp`를 조회(`lib/daily-quest-backgrounds.ts`, `boss-icons.ts`와 동일 패턴). 접두어를 제거한 퀘스트 표시명 전체가 아니라, 공백을 제거한 표시명이 공백 제거한 지역명으로 시작하는지(`startsWith`)로 매칭한다(예: "레헬른의평온한밤".startsWith("레헬른")). 매칭되지 않는 경우는 보스 카드가 `portraitUrl === null`일 때와 동일하게 일러스트 레이어 자체를 생략하고 카드 배경색만 표시한다. 세부 데이터 구조·매칭 로직은 `docs/ARCHITECTURE.md` 참고.

**디버그 프리뷰**: `BossCardPreview.tsx`/`/debug/boss-cards`와 동일한 목적의 `/debug/quest-cards`(`DailyQuestCardPreview.tsx`)에서 방향키/줌 버튼으로 크롭 값을 조정하고 결과를 복사해 `daily-quest-region-crops.json`에 반영한다.

### 몬스터파크 카드 — 확정, 2026-07-14, [[ADR-020]] (구현 전)

일간 탭의 `kind: 'contents'` 항목 중 "몬스터파크" 하나에만 적용되는 예외 카드. 카드 배경(레테 고정)·bleed는 위 일일퀘스트 카드와 동일하되, 진행률 바를 담아야 해서 높이는 **112px**(`h-28`, 위 카드의 80px보다 큼 — 확정, 2026-07-14, 진행률 바가 답답해 보인다는 피드백 반영)로 키운다.

```
레이아웃(확정, 2026-07-14 — "이름·뱃지 위치는 다른 카드와 동일하게, 늘어난 높이만큼만 진행률 바 영역" 피드백 반영):
  바깥 컨테이너: flex flex-col h-full(패딩 없음)
  위 h-20(80px, shrink-0): 아이콘+이름(왼쪽) · 진행률 뱃지(오른쪽) — 다른 카드들과 완전히 같은 80px 행 위치
  아래 flex-1: 진행률 바 영역, items-start + pt-0(행 바로 아래 여백 없이 붙여서 시작 — **정정, 2026-07-14**: pt-2→pt-3→pt-1→pt-0 순으로 조정된 최종값)
진행률 뱃지: rounded-full bg-third/20 text-third text-xs font-semibold px-2.5 py-1, 문구 "{nowCount}/{maxCount}". **정정(2026-07-14)**: ~~rounded-full bg-primary/15 text-primary(앱 전역 "카운트 배지"와 동일 스타일)~~ → 카드 내부 점수 배지는 `third`를 쓰기로 변경(사용자 지시). 중간에 `bg-black/20 text-third`(두 테마 모두 AA 통과, 렌 14.97:1·레테 5.28:1)로 한 번 바꿨다가, **재정정**: `bg-third/20 text-third`(자기 색 틴트)로 다시 변경(사용자 지시) — 렌은 8.18:1로 여유 있으나 **레테는 3.88:1로 AA(4.5:1) 미달**, 현재 이 상태로 유지 중. 탭 토글 섹션의 n/12 배지(화면 헤더, 카드 아님)는 계속 `bg-primary/15 text-primary` 그대로다 — 이 정정은 "카드 내부" 배지에만 적용.
진행률 바: maxCount > 0일 때만 표시. 기존 plain 카드의 진행률 바와 동일한 형태(role="progressbar"). **정정(2026-07-14)**: 트랙은 기존대로 흰색 반투명 고정(`bg-white/15`, 레테 고정 배경 위에서 읽히도록), 채움만 흰색 반투명(`bg-white/80`) 대신 `bg-third`로 변경(사용자 지시) — 채움은 불투명 솔리드라 텍스트 대비 문제가 없어 그대로 테마 토큰을 쓸 수 있었다.
```

이름·아이콘·배경은 "몬스터파크"로 고정(별도 매핑 테이블 없이 이름 직접 비교) — 다른 `kind: 'contents'` 항목이 생기면 그때 일반화 여부를 재검토한다. **이 "메인 행은 80px 고정 + 늘어난 높이는 하단 확장 영역" 레이아웃 원칙은 아래 "주간 콘텐츠 카드" 중 길드 카드에도 그대로 재사용된다.**

### 주간 콘텐츠 카드 — 확정, 2026-07-14, [[ADR-021]] (구현 전)

주간 탭도 일간 탭과 동일하게 카드화한다. 카드 골격(rounded-[14px], 레테 고정 배경/보더 `bg-[#1A1720]`/`border-[#37323E]`, 80px 기본 높이)은 위 카드들과 전부 동일하고, 카테고리별로 4가지 변형만 다르다.

**① 에픽 던전 카드**: 보스 카드와 동일한 좌우 배치 — 왼쪽 `[카테고리 뱃지: "에픽 던전"] [던전명]`(접두어 "에픽 던전 : " 제거), 오른쪽에 `QuestStateBadge`(0→시작 안함, 완료는 2로 매핑 — 1/진행 중은 쓰지 않음). 배경은 던전별 전용 일러스트(`src/assets/bosses/`, `boss-icons.ts`로 조회) bleed, 나머지 시각 스펙(마스크·opacity·saturate 등)은 보스 카드와 완전히 동일. 높이 80px.

**카테고리 뱃지("에픽 던전"/"길드")**: `rounded-full bg-[#4DD2FF]/20 text-[#4DD2FF] text-xs font-semibold px-2.5 py-1` — 카드 로컬 고정색. **정정(2026-07-14)**: ~~bg-white/20 text-[#E8DFEC](파티 배지와 같은 중립 톤)~~ → 길드 카드 배경(아르카누스)의 푸른 전기빛과 맞춘 파란색으로 변경(사용자 지시). 이름 앞에 배치.

**② 주간 지역 퀘스트 카드**: 왼쪽 `[지역 아이콘] [콘텐츠명]`(접두어 없음, 일일퀘스트 카드와 동일한 아이콘+이름 배치), 오른쪽에 `QuestStateBadge`(0→시작 안함, 1→완료로 매핑). 배경·아이콘은 일일퀘스트 카드와 완전히 같은 지역 에셋 재사용. 높이 80px.

**③ 무릉도장 카드**: 배경·뱃지 없음. 카드 껍데기(레테 고정 배경/보더, 80px)만 유지하고 이름 텍스트만 가운데(수직) 배치.

**④ 길드 카드**: 위 몬스터파크 카드와 동일한 레이아웃 원칙(메인 행 80px 고정 + 늘어난 높이는 하단 확장 영역) 재사용. 높이 112px(`h-28`, 몬스터파크와 동일 — **정정, 2026-07-14**: 처음엔 두 줄로 나눠 128px(`h-32`)까지 키웠으나, 사용자 지시로 한 줄로 합치면서 몬스터파크와 같은 높이로 되돌림).
```
메인 행(80px, 다른 카드와 동일 위치): 왼쪽 [카테고리 뱃지: "길드"] ["지하 수로"] · 오른쪽 점수 뱃지
점수 뱃지: rounded-full bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1, 문구 "{nowCount}점" — 몬스터파크 진행률 뱃지와 동일한 테마 토큰
하단 확장 영역: 한 줄 — "주간 미션 포인트: {nowCount} · 플래그 레이스: {nowCount}", text-xs text-[#E8DFEC]/70, items-start pt-0(**정정, 2026-07-14** — 몬스터파크 진행률 바와 동일한 값을 유지하며 pt-2→pt-3→pt-1→pt-0 순으로 함께 조정)
**정렬(확정, 2026-07-14)**: 뱃지·제목·하단 문구를 flex로만 배치하면 하단 문구가 "길드" 뱃지 밑에서 시작해 "지하 수로" 제목과 왼쪽이 어긋난다. `grid-template-columns: auto 1fr`로 1열(뱃지)/2열(제목 행 + 하단 문구)을 나눠, 뱃지 너비와 무관하게 하단 문구가 항상 "지하 수로" 제목과 같은 x좌표에서 시작하게 한다(사용자 지시로 발견·수정).
배경: arcanus(boss-icons.ts로 조회) bleed, 나머지는 다른 카드와 동일
```
**폴백**: "[길드] 주간 미션 포인트"·"[길드] 플래그 레이스" 둘 다 게임 내 미등록(`registration_flag: false`)이면 이 묶음 카드 대신, 등록된 길드 항목(대개 "[길드] 지하 수로"만)을 기존 plain 카드(테마 토큰 `bg-surface`/`border-border`, `이름 · now/max` 텍스트)로 그대로 표시한다 — 접두어 제거나 뱃지 변환도 하지 않는 완전한 기본형이다.
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
- 현재 쓰이는 아이콘: 하단 탭바 `ListChecks`(컨텐츠)/`Swords`(보스, 활성 시 `#C2410C`·비활성 시 `#B7A490`, [[ADR-013]] 화면 개편에 따라 기존 `CalendarCheck`(일간)/`CalendarRange`(주간)에서 변경, 2026-07-11 — 제안 수준, 실제 적용 시 다른 조합으로 바뀔 수 있음), 새로고침 버튼 `RefreshCw`(`#C2410C`, 배경 없음), 보스 카드 파티 배지 `Users`(size 12, strokeWidth 2, [[ADR-019]]), 파티 관리 모달 파티원 수 스테퍼 `Minus`/`Plus`(size 16, strokeWidth 2, [[ADR-019]])

# 테마 시스템 (Theme)

> **범위**: 직업 고유 컬러 기반 다중 테마의 시맨틱 토큰 스키마·테마별 컬러 값·런타임 전환·시스템 다크 모드 연동. 기본 팔레트·시맨틱 색 체계는 [../foundation/design-system.md](../foundation/design-system.md).
> **관련 소스**: `features/theme/`(Zustand store) · `storage/theme.ts` · `src/index.css`(`@theme` + `:root[data-theme]`) · `src/data/job-themes.json` · `AppShell`(`restoreFromStorage`).
> **관련 ADR**: [[ADR-009]] [[ADR-006]]. **관련 문서**: [../foundation/design-system.md](../foundation/design-system.md), [settings.md](./settings.md).

## 정책
테마마다 **17개 시맨틱 토큰**을 값으로 직접 갖는다(Primary 하나만 파생하는 방식은 폐기). 현재 등록: **"레테"(다크)·"렌"(라이트)·"머쉬맘"(라이트, 기본)·"혼테일"(다크, 시스템 다크 기본)**.

- `src/index.css` `@theme` 기본 블록 = **머쉬맘** 값. 나머지 테마는 `:root[data-theme='레테'|'렌'|'혼테일'] { --color-*: ...; }` 오버라이드. Tailwind v4 유틸(`bg-primary`·`text-text` 등)이 이미 `var(--color-*)` 를 참조하므로 컴포넌트 코드는 그대로 두고 `data-theme` 속성만 바꾸면 전환된다.
- 선택 테마는 Zustand(`features/theme/store.ts`) + `storage/theme.ts`(Preferences 어댑터) 영속화, `AppShell` `restoreFromStorage` 흐름에서 앱 시작 시 hydration.
- **시스템 다크 모드 연동(2026-07-14)**: `restoreFromStorage()` 가 저장된 테마가 없을 때 `window.matchMedia('(prefers-color-scheme: dark)')` 로 OS 설정을 확인해 라이트="머쉬맘"/다크="혼테일"을 기본값으로 씀(앱 실행 시 1회 판정, 실행 중 OS 변경은 재시작 전까지 미반영). 사용자가 설정에서 한 번이라도 명시 선택하면 그 값이 저장돼 이후 시스템과 무관.
- 설정 화면에선 등록된 테마 중 하나를 고르는 최소 선택 UI만([settings.md](./settings.md)). 직업 기반 자동 매핑은 미정이라 범위 밖.
- 값 소스: `src/data/job-themes.json`([[ADR-006]] — 위 표 값은 사용자 확인 완료).

## 17토큰 컬러 값
| 토큰 | 용도 | 레테 | 렌 | 머쉬맘 | 혼테일 |
|---|---|---|---|---|---|
| `bg` | 페이지 배경 | `#0C080F` | `#F6F5F5` | `#F2F0E2` | `#0B0B0B` |
| `surface` | 카드/표면 | `#1A1720` | `#FFFFFF` | `#FDFCF6` | `#241110` |
| `surface-2` | 2단계 표면 | `#28232E` | `#E5E6E9` | `#E4E1CE` | `#362120` |
| `border` | 기본 보더 | `#37323E` | `#DBD3D6` | `#CFC9AE` | `#524344` |
| `border-strong` | 강조 보더 | `#54444E` | `#C8C1C6` | `#A3996E` | `#695E5F` |
| `primary` | 채움 배경(위 흰 글자 OK) | `#9975B3` | `#DC171D` | `#F58B0F` | `#E86A16` |
| `primary-hover` | hover/눌림 배경 | `#85639F` | `#B33946` | `#C55907` | `#C34204` |
| `primary-text` | 빨강 텍스트·링크 전용 | `#61417B` | `#803440` | `#9C4304` | `#F09A55` |
| `secondary` | 보조 강조(배지 등) | `#D1C093` | `#437B71` | `#F7D00D` | `#7B777A` |
| `secondary-text` | secondary 텍스트용 변형 | `#D1C093` | `#3E7369` | `#7A5E00` | `#B8B2B4` |
| `third` | 3차 강조(카운트·진행률 틴트) | `#D8608F` | `#C9EEF2` | `#CA763A` | `#936E68` |
| `third-text` | third 텍스트용 변형 | `#DA6995` | `#21808A` | `#8F4E1F` | `#C79A92` |
| `info-tint` | 정보성 배경 틴트 전용 | `#262A3A` | `#E4F6F8` | `#FBF3D0` | `#3A3235` |
| `error` | 에러/위험 텍스트 | `#D8608F` | `#A31118` | `#B3200B` | `#E85447` |
| `text` | 기본 텍스트 | `#E8DFEC` | `#171721` | `#241208` | `#E6E1E2` |
| `text-muted` | 보조 텍스트 | `#B89CBD` | `#525475` | `#645C42` | `#9F9594` |
| `text-disabled` | 비활성 텍스트 | `#8A758D` | `#8A8089` | `#9A9070` | `#7A6E6F` |

- **`-text` 계열(2026-07-14)**: `primary-text` 가 "채움용 색 ≠ 텍스트용 색" 선례. 캐릭터별 대표 컬러로 테마를 늘릴 계획이라 밝기 제각각인 색이 `bg-X/15 text-X` 틴트 배지에 그대로 쓰이면 대비가 깨지는 문제 대비해 `secondary`/`third` 에도 적용. 값은 원 색상(H) 유지하고 밝기만 조정해 `bg-X/15` 틴트 배경 대비 WCAG AA(4.5:1) 이상이 되도록 AI 계산한 제안값 — 사용자 최종 확인 전까지 잠정치.
- 마이그레이션: 기존 `gold`→`secondary`, `magenta`→`error`, `neutral-warm`→`text-muted` 통합, `gold-bright` 는 미사용 확인 후 폐기.

## 열린 질문
- 테마 이름과 실제 직업(전직) 매핑, 테마 단위(직업 대분류 vs 5차 전직 세부) 미정.
- `-text` 계열 잠정치 사용자 최종 확인.

## 폐기된 정책 (history)
- ~~테마마다 Primary 하나만 바뀌고 나머지는 파생 공식~~ → 17토큰 직접 저장으로 전환([[ADR-009]], 2026-07-12).
- ~~런타임 전환 없이 "렌" 값을 `@theme` 에 정적 반영만~~ → 런타임 전환 인프라 구현 재개([[ADR-009]], 설정 task 범위).
- ~~기본 테마 = "렌"(`@theme` 기본 블록)~~ → "머쉬맘"이 기본 블록 대체, "렌"은 오버라이드 선택지로(2026-07-14).
- ~~레테 `info-tint` = `#C9D6F2`(밝은 파스텔 블루)~~ → `#262A3A`(어두운 방향)로 교체(2026-07-22, `text` 대비 1.13:1 → 약 11:1). 즉석으로 채운 5토큰 중 하나가 다른 다크 테마와 방향이 달랐던 문제.
- ~~토큰 이름 `primary-deep`/`info`~~ → `primary-text`/`info-tint` 로 개명(2026-07-12, 스키마 전체 소급).

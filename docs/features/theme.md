# 테마

캐릭터 대표 색으로 만든 테마를 고르는 기능이다. 색 토큰 38개와 그 파생 규칙, 테마 고르기 모달, 배경 그림이 여기에 속한다.
색과 고르기는 [[ADR-054]], 배경 그림은 [[ADR-055]] 에 이유가 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `src/data/job-themes.json` | 테마마다 토큰 38개 · `mode` · `category` · 선택 `background`. 값의 원본 |
| `types/theme.ts` | 테마 이름(JSON 키에서 만든다) · 토큰 · 배경 형식 |
| `lib/theme/theme-registry.ts` | 테마 목록과 표시 순서 · 분류 묶음 · 기본 테마 |
| `lib/theme/theme-derive.ts` | 시드에서 토큰을 만드는 규칙 · 미디어 스코프 · 대비 측정 |
| `lib/color.ts` | 색 공간 변환과 대비 계산 |
| `features/theme/store.ts` · `storage/theme.ts` | 고른 테마와 저장(Preferences `theme`) |
| `theme/theme-vars.ts` | 변수 맵 만들기 · `panel-border` · `card-body` · `stats-section` · 결산 색 · 시트 스코프 |
| `theme/ThemeProvider.tsx` · `context.ts` · `appearance-store.ts` | 렌더 트리에 변수 내리기 · 지금 테마 읽기 |
| `theme/MediaScope.tsx` | 일러스트 카드 안에서 토큰 다시 선언 |
| `theme/screen-backdrop-policy.ts` | 화면이 배경을 직접 그리는지(안드로이드) |
| `components/templates/ThemeBackdrop/` | 배경 그림 · 좌표 계산 · 화면별 배경 |
| `tailwind.config.js` | 토큰 이름과 `var(--color-*)` 연결 |
| `app/settings/ThemeModal.tsx` · `ThemeSelector.tsx` | 테마 고르기 모달 |
| `src/assets/themes/` · `src/assets/generated/themes.ts` | 배경 그림과 그 목록 |

## 등록된 테마

| 분류 | 테마 | 모드 | 배경 그림 |
|---|---|---|---|
| `기본` | 머쉬맘 | 라이트(앱 기본값) | 없음 |
| `기본` | 혼테일 | 다크(OS 가 다크일 때 기본값) | 얼음 동굴 |
| `직업` | 레테 | 다크 | 없음 |
| `직업` | 렌 | 라이트 | 없음 |
| `직업` | 엔젤릭버스터 | 라이트 | 없음 |
| `보스` | 검은마법사 | 다크 | 보스 맵 |

## 토큰

| 묶음 | 토큰 |
|---|---|
| 표면 | `bg` · `surface` · `surface-2` · `track` · `border` · `border-strong` |
| 글자 | `text` · `text-muted` · `text-disabled` |
| 강조 | `primary` · `primary-hover` 와, `primary` · `secondary` · `third` · `error` 각각의 `X` · `on-X` · `X-tint` · `X-ink` |
| 정보 · 증감 | `info-tint` · `info-ink` · `rise-tint` · `rise-ink` · `fall-tint` · `fall-ink` |
| 그림 위 | `media-surface` · `media-border` · `media-ink` · `media-ink-muted` |
| 덮개 | `scrim` · `shadow-color` |

| 쓰는 곳 | 토큰 |
|---|---|
| 채운 버튼 위 글자 | `on-X` |
| 옅은 배지 · 활성 탭 바탕 | `X-tint` |
| 강조색 글자 · 아이콘 · 링크 | `X-ink` |
| 오른 값 · 내린 값 · 수입 · 지출 | `rise-*` · `fall-*` |
| 일러스트 카드 안 | `MediaScope` 로 감싸면 같은 클래스가 카드 기준으로 풀린다 |
| 다크 바텀시트 안 | 시트가 표면 네 토큰을 한 단계 밝혀 다시 선언한다 |

토큰 말고 계산해서 내리는 색이 넷 있다. `panel-border`(스크림 위 패널 테두리) · `card-body`(펼친 캐릭터 카드 본문) ·
`stats-section`(통계 카드) · `settlement-*`(결산 안내 줄)이다.

## 테마를 더하는 방법

1. 사용자에게 시드 세 색(`primary` · `secondary` · `third`)과 모드, 분류를 확인받는다.
2. `deriveTheme` 로 38개를 만들고, `measureThemeContrast` 결과와 실제 화면을 함께 본다. 규칙이 맞지 않는 토큰만 `overrides` 로 바꾼다.
3. `job-themes.json` 의 그 분류 블록 끝에 테마를 더한다. 새 `primary` 는 휴 26~27 을 피한다.
4. 배경 그림이 있으면 하늘을 알파로 비운 webp 를 `src/assets/themes/<슬러그>.webp` 로 넣고 `npm run assets:gen` 을 돌린 뒤
   `background` 블록을 적는다. `position` 과 `dim` 은 화면을 보며 정한다.

다른 파일은 고치지 않는다. 테스트는 값이 아니라 형식과 규칙을 검사하므로 테마가 늘어도 늘지 않는다.

## 테마 고르기

`설정 > 테마` 가 모달을 연다.

| 부분 | 내용 |
|---|---|
| 필터 칩 | `전체 · 라이트 · 다크`. 저장하지 않는다 |
| 목록 | 분류(`기본` · `직업` · `보스`)마다 2열 미리보기 타일. 거른 결과가 없는 분류는 감춘다 |
| 타일 | 그 테마 색으로 그린 작은 화면 · 이름 · ☀ 또는 ☾ |
| 버튼 | `완료` 하나 |

타일을 누르면 바로 적용되고 모달은 열린 채 남는다. 저장된 테마가 없으면 앱을 켤 때 OS 설정을 한 번 보고 머쉬맘이나 혼테일을 쓴다.

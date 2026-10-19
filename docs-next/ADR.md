# Architecture Decision Records (인덱스)

결정 원장의 인덱스다. 전문은 [`adr/`](./adr/) 에 파일 하나씩 있다. 필요한 결정만 열고, 전체를
컨텍스트에 올리지 말 것. 아래 결정 목록에는 **한 파일에 한 줄**만 넣는다. 요약을 쌓으면 이 파일이
다시 불어난다(옛 인덱스는 507KB 까지 불었다).

> **재작성 중 (2026-10-19 시작).** 이 폴더(`docs-next/`)에 새 규칙으로 문서를 쓰고 있다. 옛 문서는
> `docs/` 에 그대로 있고, 다 쓰면 `docs/` 를 지우고 이 폴더를 `docs/` 로 바꾼다. 옛 ADR 을 옮길 때는
> 같은 기능의 옛 파일을 한 파일로 합치고, 새 번호를 `ADR-001` 부터 매기고, 옛 번호는 문서 머리의
> `옛 번호` 줄에만 남긴다. 이 폴더의 `[[ADR-NNN]]` 은 새 번호다.

## 파일 이름 규칙

```
ADR-{번호목록}_{카테고리}_{기능}.md

ADR-001_boss-profit_drop-records.md
ADR-001+010_boss-profit_drop-records.md    결정이 바뀌어 010 을 덧붙인 뒤
```

- **번호**는 세 자리다. 여러 개면 `+` 로 잇고, 처음 생긴 번호가 맨 앞에 온다. 그래서 정렬 순서가
  바뀌지 않는다.
- **카테고리**는 아래 카테고리 표의 slug 만 쓴다.
- **기능**은 그 카테고리 안에서 이 문서가 다루는 대상이다. 코드에 있는 이름을 영어 slug(소문자와
  `-`)로 쓴다.
- 대괄호 · 쉼표 · 공백 · 한글은 넣지 않는다. 대괄호는 zsh 의 패턴 문자라 매번 따옴표가 필요하다.
  한글은 macOS 와 GitHub 의 유니코드 정규화가 달라 같은 파일이 다른 이름으로 잡힌다.

**한 기능의 결정은 한 파일에 둔다.** 그 기능의 결정이 바뀌면 새 파일을 만들지 않는다. 새 번호를
파일 이름 끝에 `+NNN` 으로 덧붙이고 같은 파일에 이어 쓴다.

**문서끼리는 번호로 가리킨다**(`[[ADR-NNN]]`). 번호가 붙을 때마다 파일 이름이 바뀌므로 경로로
걸면 링크가 끊어진다. 번호는 파일 이름이 바뀌어도 남는다.

## 상태

| 배지 | 뜻 |
|---|---|
| 🟢 유효 | 지금 앱이 이 결정대로 돈다 |
| ⚪ 미구현 | 결정만 있고 코드가 없다. 착수 전에 다시 읽을 것 |

상태는 이 둘뿐이다. 결정 일부가 뒤집히면 죽은 결정을 본문에서 지우고, 남은 결정만으로 다시 쓴다.
결정이 전부 죽으면 파일을 지우고, 인덱스 행과 문서의 `[[…]]` 인용도 걷는다. 죽은 정책이 파일에
남아 있으면 다음 세션이 그것을 읽고 되살리기 때문이다. 옛 내용은 git 히스토리에 있다.

## 카테고리

카테고리 하나가 기능 문서 하나와 짝이다. 옛 ADR 을 나누다 맞지 않는 것이 나오면 이 표를 먼저
고친다.

| slug | 다루는 것 | 기능 문서 |
|---|---|---|
| `auth` | API 키 입력 · 검증 · 넥슨 로그인 | `features/auth.md` |
| `app-entry` | 앱을 켜면 서는 화면 · 캐릭터 설정 | `features/app-entry.md` |
| `character` | 추적 캐릭터 · 캐릭터 관리 · 캐릭터 선택 · 초상화 | (재작성 때 정한다) |
| `content-scheduler` | 일간 · 주간 컨텐츠 진행 | `features/content-scheduler.md` |
| `boss-scheduler` | 보스 진행 · 파티 인원 · 분배 비율 | `features/boss-scheduler.md` |
| `boss-profit` | 보스 수익 기록 · 기간 | `features/boss-profit.md` |
| `item-drop` | 드롭 아이템 기록 · 드롭 히스토리 | `features/item-drop.md` |
| `today` | 첫 화면 위젯 격자 | `features/today.md` |
| `utility` | 도구 목록 · 판매 분배금 계산기 | `features/utility.md` |
| `cashbook` | 수익 · 지출 캘린더 · 손입력 | `features/cashbook.md` |
| `stats` | 기간별 수익 · 지출 통계 | `features/stats.md` |
| `mvp-grade` | MVP 등급 · 수수료 · 할인 | `features/mvp-grade.md` |
| `party-appointments` | 파티 약속 · 약속 알림 | `features/party-appointments.md` |
| `settings` | 설정 화면 · 안내 · 계정 데이터 | `features/settings.md` |
| `theme` | 테마 · 색 토큰 · 배경 | `features/theme.md` |
| `notifications` | 로컬 알림 · 공지 푸시 | `features/notifications.md` |
| `live-update` | OTA 업데이트 | `features/live-update.md` |
| `splash` | 스플래시 | `features/splash.md` |
| `ads` | 광고 | `features/ads.md` |
| `site` | 안내 사이트 | `features/site.md` |
| `notice` | 운영자 공지 · 넥슨 공지 | (재작성 때 정한다) |
| `navigation` | 하단바 · 스택 · 화면 전환 | (재작성 때 정한다) |
| `server` | 서버 자체 · 서버 계정 · 서버 배포 | (재작성 때 정한다) |
| `server-sync` | 앱이 서버로 보내는 값 | (기능 문서 없음, 재작성 때 정한다) |
| `architecture` | 디렉터리 · 레이어 · 어댑터 경계 · 테스트 | `foundation/architecture.md` |
| `nexon-api` | 넥슨 Open API 호출 · 정규화 · 호출 제한 | `foundation/nexon-api.md` |
| `error-resilience` | 실패 처리 · 빈 상태 · 이어서 하는 작업 | `foundation/error-resilience.md` |
| `design-system` | 공용 컴포넌트 · 시트 · 타이포 · 아이콘 | `foundation/design-system.md` |
| `game-data` | 보스 표 · 드롭 표 등 게임 수치 데이터 | `foundation/game-data.md` |
| `release` | 스토어 빌드 · 서명 · 버전 | `foundation/release.md` |
| `persistence` | 기기 저장소 · SQLite 스키마 · 옛 저장소 읽기 | `persistence/` |
| `docs` | 문서 · 주석 · ADR 자체의 규칙 | `README.md` |

## 문서 형식

```markdown
# ADR-001+010 보스 수익 드롭 기록

> 🟢 유효
> 옛 번호: ADR-067 · ADR-113 · ADR-127
> 관련 소스: `features/boss-profit/` · `storage/boss-profit`

## 배경
이 결정이 왜 필요했는지.

## 결정

### 결정 1. 한 줄로 쓴 결정
이유를 같은 자리에 쓴다.

## 테스트
| 파일 | 확인하는 것 |
|---|---|
| `features/boss-profit/__tests__/store.test.ts` | 이 결정이 깨지면 무엇이 실패하는지 |

## 열린 질문
반드시 풀어야 하는 것만 남긴다.

## 번호 기록
- ADR-001 (2026-10-20): 처음 작성
- ADR-010 (2026-11-02): 결정 3 을 바꿨다. 이유 한 줄
```

- `### 결정 N.` 제목 형식을 지킨다. 그래야 `[[ADR-NNN]] 결정 3` 같은 인용을 테스트가 검사할 수 있다.
  결정 번호는 파일 안에서 하나씩 늘린다. 덧붙인 번호도 같은 줄을 잇는다.
- **테스트** 표에는 이 결정을 지키는 테스트만 적는다. 값 하나를 그대로 비교하거나 입력과 출력이
  뻔한 테스트는 코드에서 지운다.
- **번호 기록**은 파일 이름의 번호마다 무엇을 더하거나 바꿨는지 한 줄씩 적는다. 지운 결정의 본문은
  남기지 않는다.

## 결정 목록

파일 하나에 한 줄이다. 행 형식은 `| [ADR-001+010](./adr/ADR-001+010_boss-profit_drop-records.md) | 🟢 | boss-profit | 보스 수익 드롭 기록 |` 이다.

| ADR | 상태 | 카테고리 | 제목 |
|---|---|---|---|
| [ADR-001](./adr/ADR-001_utility_item-split.md) | 🟢 | utility | 판매 분배금 계산기 |

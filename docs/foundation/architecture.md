# 아키텍처

앱 코드를 어디에 두고, 각 디렉터리가 무엇에 의존하는지를 정리한 문서다. React Native 하나로 만드는 이유는
[[ADR-005]], 저장소 · 네이티브 경계는 [[ADR-004]], 테스트 규칙은 [[ADR-006]] 에 있다.

## 지켜야 하는 규칙

- `features/*` 는 로컬 저장소와 네이티브 라이브러리를 직접 부르지 않고 `storage/` · `native/` 를 거친다
  ([[ADR-004]] 결정 1).
- `app/` 은 `storage/` 에서 타입만 가져온다. 저장된 값은 `features/` 의 함수나 스토어로 읽고 쓴다([[ADR-065]] 결정 8).
- 게임 수치(`src/data/`)는 짐작해서 적지 않고 사용자 확인을 받아 넣는다([[ADR-019]]).
- 화면은 `app/`, 기능의 상태와 로직은 `features/`, 공용 UI 는 `components/`, 타입은 `types/`, 범용 함수는
  `lib/` 에 둔다.
- 한 파일이 관심사를 둘 이상 다루면 나눈다. 줄 수는 기준이 아니다([[ADR-004]] 결정 7).
- 런타임 import 사이클을 만들지 않는다. 값은 정의한 파일에서 바로 가져온다([[ADR-005]] 결정 7).

## 디렉터리

```
index.ts          진입점. 포트 주입 → 게임 데이터 덮어쓰기 → 스플래시 유지 → 백그라운드 핸들러 등록 → registerRootComponent
App.tsx           루트 컴포넌트
app.json · app.config.js · metro.config.js · babel.config.js · jest.config.js · tsconfig.json
modules/          로컬 Expo 모듈 셋(capacitor-storage · app-background · app-system-bars)
android/ · ios/   커밋된 네이티브 프로젝트. expo prebuild 를 돌리지 않는다
ota/              Capacitor 앱 사용자를 스토어로 보내는 매니페스트(ADR-005 결정 6)
scripts/          에셋 목록 생성 · OTA 발행 · 게임 데이터 동기화 · 안내 사이트 빌드
workers/          Cloudflare Worker(OTA 매니페스트)
site/             안내 사이트(mapleroutine.store)
src/
├── app/          화면. 기능별 디렉터리와 AppShell · prehydrate
├── navigation/   react-navigation 배선. 루트 스택 · 탭 · 하단바 그룹 표 · 라우트 표
├── features/     기능별 상태(zustand 스토어)와 로직
├── components/   공용 UI. atoms · molecules · organisms · templates 네 단계
├── hooks/        화면이 같이 쓰는 훅
├── theme/        ThemeProvider · NativeWind 변수
├── constants/    domain(게임 규칙 상수) · style(스타일 상수)
├── lib/          범용 함수. 화면 상태를 갖지 않는다
├── nexon/        넥슨 Open API 클라이언트와 응답 정규화
├── server/       우리 서버(mapleroutine.store/v1) 클라이언트
├── storage/      기기 저장소 어댑터. ports.ts · adapters/ · sqlite/
├── native/       네이티브 기능 어댑터. ports.ts · adapters/
├── data/         게임 레퍼런스 데이터(JSON) · 릴리스 노트 · 기능 안내
├── assets/       그림. generated/ 에 커밋된 목록이 있다(ADR-009)
├── types/        공용 타입
├── boot.ts       포트 주입(installPorts) · 게임 데이터 덮어쓰기(loadGameData)
└── boot-splash.ts  첫 렌더까지 스플래시를 유지하는 실패 안전 타이머
```

## 레이어

| 디렉터리 | 의존하는 것 | 하는 일 |
|---|---|---|
| `app/` | `features/` · `components/` · `hooks/` · `navigation/` | 화면을 그린다. `storage/` 에서는 타입만, 햅틱 같은 네이티브 기능은 `native/` 에서 가져온다 |
| `features/` | `storage/` · `native/` · `nexon/` · `server/` · `lib/` | 기능 상태와 흐름. 플랫폼 라이브러리를 모른다 |
| `storage/` · `native/` | 자기 `ports.ts` | 저장소 · 네이티브 기능을 감싼다. 플랫폼 라이브러리는 `adapters/rn-*` 만 부른다 |
| `nexon/` · `server/` | `lib/` | 외부 API 를 감싼다. 응답을 앱 타입으로 정규화한다 |
| `lib/` · `types/` · `data/` | 없음 | 순수 함수 · 타입 · 정적 데이터 |

## 부팅 순서

`index.ts` 가 모듈 최상위에서 이 순서로 부른다.

1. `installPorts()` 가 포트 열아홉(저장소 둘 · 네이티브 열일곱)을 주입한다. 주입 전에 포트를 쓰면 던지므로 가장
   먼저 부른다([[ADR-004]] 결정 2).
2. `loadGameData()` 가 기기 사본과 서버 응답으로 게임 데이터 표를 덮어쓴다. Preferences 를 읽으므로 포트 주입 뒤다.
   결과는 기다리지 않는다([[ADR-020]]).
3. `holdSplashUntilAppReady()` 가 첫 렌더까지 스플래시를 유지한다([[ADR-013]]).
4. FCM 백그라운드 메시지 핸들러와 notifee 백그라운드 이벤트 핸들러를 등록한다. OS 가 꺼진 앱을 깨울 때
   핸들러를 찾으려면 모듈 최상위에 있어야 한다([[ADR-056]] · [[ADR-057]]).
5. `registerRootComponent(App)`.

첫 렌더 뒤에는 `AppShell` 이 인증 · 진입 단계 · 테마 · 추적 모드 · 드롭 연출 설정을 저장소에서 읽어 오고, 탭
스토어 선하이드레이션은 `app/prehydrate.ts` 가 동적 import 로 부른다([[ADR-027]]).

## 상태

| 무엇 | 어디 |
|---|---|
| 화면과 기능의 클라이언트 상태(선택 캐릭터 · 테마 · 인증 · 동기화 결과) | `features/*/store.ts` 의 zustand 스토어 |
| 서버에 원본이 있는 게임 데이터 표 | `lib/game-data/` 의 표. `features/game-data/sync.ts` 가 받아 `storage/game-data-copy.ts`(SQLite)와 문서 디렉터리에 둔다([[ADR-020]]) |
| 기기에 남는 값 | `storage/`. 키와 스키마는 `persistence/` 문서에 있다 |

## 네이티브 기능

| 기능 | 라이브러리 | 감싸는 곳 |
|---|---|---|
| Key-Value 저장소 | 로컬 모듈 `modules/capacitor-storage` | `storage/adapters/rn-preferences.ts` |
| SQLite | `@op-engineering/op-sqlite` | `storage/adapters/rn-sqlite.ts` |
| OTA | `expo-updates` | `native/adapters/rn-live-update.ts`([[ADR-011]]) |
| 로컬 알림 · 원격 푸시 | `@notifee/react-native` · `@react-native-firebase/messaging` | `native/adapters/rn-notifications.ts` · `rn-push.ts`([[ADR-056]]) |
| 광고 | `react-native-google-mobile-ads` | `native/adapters/rn-ads.ts`([[ADR-014]]) |
| 인앱 브라우저 | `expo-web-browser` | `native/adapters/rn-browser.ts` |
| 햅틱 | `expo-haptics` | `native/adapters/rn-haptics.ts` |
| 앱 안 리뷰 요청 | `expo-store-review` | `native/adapters/rn-store-review.ts`([[ADR-052]] 결정 10) |
| 기울기 | `expo-sensors`(가속도계) | `native/adapters/rn-tilt.ts`([[ADR-092]] 결정 2) |
| uuid | `expo-crypto` | `native/adapters/rn-uuid.ts`([[ADR-074]] 결정 13) |
| 스플래시 · 상태바 · 시스템 바 · 키보드 · 뒤로 가기 · 색 모드 · 테마 표면 | Expo 모듈 · 로컬 모듈 `app-system-bars` · `app-background` | `native/adapters/rn-*.ts` |
| 이미지 내보내기 | `react-native-view-shot` · `expo-sharing` · `expo-media-library` · `expo-file-system` | 아직 없다. 바이너리에만 들어 있다([[ADR-004]] 결정 4) |

## 런타임 import 사이클을 만들지 않는다

값은 그 값을 정의한 파일에서 바로 가져온다. 재수출(`index.ts`)을 거쳐 가져오면 자기 자신으로 돌아오는 고리가
생기기 쉽다. 타입만 필요할 때는 `import type` 이 빌드에서 지워지므로 재수출을 거쳐도 된다. 이유는 [[ADR-005]] 결정 7 에
있고, `src/__tests__/require-cycle-policy.test.ts` 가 `src/` 전체를 검사한다.

## 테스트

러너는 jest 하나다. `*.spec.ts(x)` 는 RN 을 렌더하지 않는 테스트, `*.test.ts(x)` 는 RN 을 렌더하거나 RN 모듈을
목으로 바꾸는 테스트다. 작업 중에는 바꾼 경로만 저장소 루트에서 돌린다.

```bash
npx jest src/lib src/app/utility --testPathIgnorePatterns /node_modules/ /.claude/
npx tsc --noEmit
npx eslint src
```

규칙과 이유는 [[ADR-006]] 에 있다.

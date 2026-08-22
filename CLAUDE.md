# 프로젝트: 메이플 루틴 (Maple Routine)

## 기술 스택
- React Native (Expo · Hermes · Metro) — 앱 하나로 Android/iOS ([[ADR-128]] 전환 완료 · [[ADR-155]] 캐패시터 소스 삭제)
- TypeScript
- NativeWind (Tailwind v3 문법을 RN 스타일로 컴파일)

## 아키텍처 규칙
- CRITICAL: `features/*` 코드에서 로컬 저장소·네이티브 API(알림, 사냥 타이머 상시 알림 등)에 직접 접근하지 말 것. 반드시 `storage/`·`native/` 어댑터 레이어를 거칠 것 ([[ADR-003]], [[ADR-005]])
- CRITICAL: 게임 레퍼런스 수치 데이터(보스 목록·결정 가격·드랍 테이블, `src/data/`)는 AI가 임의로 추정해 하드코딩하지 말 것. 반드시 사용자(도메인 전문가) 확인을 거쳐 반영할 것 ([[ADR-006]])
- 화면은 `app/`, 기능별 상태·로직은 `features/`, 공용 UI는 `components/`, 타입은 `types/`, 범용 유틸은 `lib/`에 분리

## 문서
- 설계 문서는 기능 단위로 계층화됨 — `docs/README.md`가 인덱스(기능→문서→소스 파일). 작업 전 여기서 read/write 대상 문서를 판단할 것
- `docs/features/*`(기능별 정책) · `docs/foundation/*`(공통 토대: architecture·nexon-api·error-resilience·design-system·game-data·product)
- ADR: `docs/ADR.md`는 슬림 인덱스 — 전문은 `docs/adr/ADR-NNN.md` 개별 파일. 필요한 ADR만 열고 **ADR 전체를 컨텍스트에 로드하지 말 것**. 새 결정은 `docs/adr/`에 파일 추가 + 인덱스에 한 줄
- CRITICAL: ADR을 근거로 쓰기 전에 **상태 배지**를 먼저 볼 것(인덱스 표 · 각 파일 제목 바로 아래). 🟢 유효 / 🟡 부분 폐기 / ⛔ 폐기 / ⚪ 미구현 / 🗑 삭제. **⛔·🗑 를 새 구현의 근거로 인용하지 말 것** — 그 파일들은 «무엇을 결정했었나» 요약 몇 줄로 줄여 두었고(정책 본문은 git 히스토리에 있다) 살아 있는 문서에서 그리로 가는 `[[…]]` 인용도 끊었다. 단 웹뷰 시대 ADR 21개는 «결정 몇 개»가 RN 코드로 넘어왔고, 그런 파일은 배너에 **🔗 줄**로 «지금도 코드가 따르는 결정»을 못박아 뒀다 — **그 줄에 있는 것만 살아 있다**
- 결정을 폐기할 땐 ADR 본문을 **요약으로 줄일 것**(전문은 git 이 들고 있다). 죽은 정책이 파일로 남아 있으면 다음 세션이 그것을 읽고 되살린다
- 정책을 바꿀 땐 옛 내용을 지우지 말고 각 문서 하단 "폐기된 정책 (history)" 섹션으로 이동
- `docs/features/*`를 읽고 작업할 때 '열린 질문' 항목이 이미 구현됐는지 확인하고, 완료됐으면 열린 질문에서 제거·정리할 것
- ADR도 '설계, 구현 전'으로 남는 경우가 많음 — 구현 완료 시 `docs/adr/`와 `docs/ADR.md` 인덱스 상태를 '구현 완료'로 명시할 것. 결정을 뒤집을 땐 **옛 ADR의 배지를 🟡/⛔로 내리고 대체 ADR 번호를 적을 것**(그래야 다음 세션이 죽은 결정으로 회귀하지 않는다)

## 개발 프로세스
- CRITICAL: 작업 전 관련 문서를 먼저 작성/갱신하고(docs-first), 작업 완료 후 문서를 다시 점검해 완료된 항목을 반영(체크)할 것
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- CRITICAL: 작업 중 검증은 **변경 영향 범위의 경로만** 지정해 돌릴 것 — `npx jest <바꾼 디렉터리…>`. 전체 실행은 269 스위트·3,880여 테스트로 40초가 넘고, 애니메이션이 무거운 스위트(`DropEffectOverlay` 등)에서 **내 변경과 무관한 워커 플레이크**를 내 해석에 시간이 샌다. 공유 상수·유틸을 뽑아 다른 소비자를 건드렸으면 그 경로도 함께 넣을 것. 배선 누락은 `npx tsc --noEmit` 가 전역으로 잡으므로 그것 때문에 전체를 돌릴 필요는 없다
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (전체 — 최종 확인용)

npx tsc --noEmit                 # 타입 (전역, 빠르다)
npx eslint src                   # 린트
npx jest src/lib src/app/utility # 테스트 — **영향 범위만** 지정하는 것이 기본

import type { ReleaseNote, ReleaseNoteCategory } from '../types'

/** 묶음 제목·매니페스트 머리표에 쓰는 이름 — 이슈 접두사와 **글자까지 같다**(ADR-119 결정 9). */
export const RELEASE_NOTE_CATEGORY_LABELS: Record<ReleaseNoteCategory, string> = {
  feature: '기능',
  improvement: '개선',
  fix: '버그',
}

/**
 * 화면에 묶음이 나오는 순서(ADR-119 결정 9). **데이터 순서와 무관하게 이 순서로 그린다** —
 * 노트를 쓰는 사람이 항목을 어떤 순서로 적든 화면은 늘 같아야 한다.
 * 새로 생긴 것 → 나아진 것 → 고친 것 순이다.
 */
export const RELEASE_NOTE_CATEGORY_ORDER: readonly ReleaseNoteCategory[] = [
  'feature',
  'improvement',
  'fix',
]

// 릴리스 노트의 진실 원천 한 벌(ADR-119 결정 1) — 개발 노트 화면과 `latest.json` 의 `notes` 가
// 여기서 갈라져 나간다. 노트를 두 곳에 쓰면 언젠가 반드시 갈라지고, 갈라진 순간 어느 쪽이
// 사실인지 알 방법이 없다.
//
// **최신이 먼저 오도록 버전 내림차순으로 손으로 유지한다.** 화면은 이 배열을 그대로 그리고
// 정렬하지 않는다 — 런타임 정렬은 잘못 쓴 파일을 조용히 통과시키므로 순서·중복·형식은
// 테스트가 강제한다(`__tests__/release-notes.test.ts`).
//
// **과거 버전의 근거는 GitHub 마일스톤이다**(결정 4 정정, 2026-08-09). 커밋 로그를 읽고 사람이
// 재구성한 것이 아니라, 그 버전 마일스톤에 **닫힌 이슈**가 저장소에 남아 있는 기록이고 그것을
// 사용자용 문장으로 옮긴 것이다. 날짜는 `chore(release)` 커밋 날짜다.
// - `1.0.1` 은 **마일스톤이 없어 건너뛴다**(사용자 결정) — 근거가 없는 버전을 지어내지 않는다.
//   그래서 목록에 1.0.2 다음이 1.0.0 인 빈틈이 있고, 그것이 정상이다.
// - `1.0.3` 이후로는 배포 스크립트가 노트 없는 배포를 막으므로(결정 6) 빈 버전이 생길 수 없다.
//
// 이 파일은 순수 데이터다 — `features/`·`storage/`·`native/` 를 import 하지 않는다.
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.4',
    // 이 노트는 마일스톤 v1.0.4 의 닫힌 이슈(#156·#166·#185·#191·#164)를 근거로 릴리스 **전에**
    // 미리 썼고(이슈 #198, 사용자 결정), 배포하며 `date` 를 작성일에서 `chore(release)` 커밋
    // 날짜로 정정했다(ADR-119 — 날짜의 근거는 그 커밋이다).
    date: '2026-08-11',
    // 업데이트 모달이 **받기 전에** 보여줄 핵심 목록(ADR-126 결정 2·3, 사용자가 직접 정한 3줄).
    // 아래 items 에서 파생한 것이 아니다 — 순서도 문장도 다르고, 마지막 줄은 여러 항목을 뭉친
    // 것이라 어떤 규칙으로도 나오지 않는다.
    highlights: [
      '보스 카드 클릭 시 인원 변경 기능 추가',
      '아이템 가격 입력 기능 추가',
      '일부 버그 및 사용성 개선',
    ],
    items: [
      {
        category: 'feature',
        text: '드롭한 아이템에 판매 가격을 입력해 주간·월간 수익에 합산',
        guideId: 'drop-item-price',
      },
      {
        category: 'feature',
        text: '기능 설명 추가 — 기능별 사용법을 분류해 안내',
      },
      {
        category: 'improvement',
        text: '총 수익을 결정석과 아이템으로 나눠 보기',
        // 같은 안내의 **다른 마디**를 가리킨다(ADR-125 결정 7) — 위 「판매 가격」 항목은
        // `where` 로, 이 항목은 갈라 보는 자리로 간다. 그래서 참조 규칙이 막는 것은
        // "같은 안내"가 아니라 **같은 (안내, 마디)** 쌍이다.
        guideId: 'drop-item-price',
        guideSectionId: 'total',
      },
      {
        // 사라진 것도 적는다 — 말없이 없어지면 고장으로 읽힌다. **다시 넣겠다고 쓰지 않는다**:
        // ADR-124 결정 7 은 "통계 기능이 생기면 그쪽으로 옮긴다"까지만 정했고, 노트에 적는 순간
        // 그것은 계획이 아니라 약속이 된다.
        category: 'improvement',
        text: '총 수익의 지난 기간 대비 증감 표시 제거',
      },
      {
        category: 'improvement',
        text: '보스 카드를 탭해 파티 인원·난이도를 그 자리에서 수정',
        guideId: 'boss-party',
        // 이 릴리스에서 바뀐 것은 파티 인원 기능 전체가 아니라 **카드에서 바로 고치는 것**
        // 하나다 — 안내 첫머리에 떨어뜨리면 그 마디를 다시 찾아야 한다(ADR-125 결정 7).
        guideSectionId: 'card',
      },
      {
        category: 'improvement',
        text: '하위 화면이 밀려 들어오고, 왼쪽 가장자리를 쓸어 되돌아가기',
      },
      {
        // 위 항목과 가른 이유가 ADR-119 결정 3 그 자체다. 스와이프 백은 OTA 로 가지만 이 항목은
        // `AndroidManifest.xml` 의 `enableOnBackInvokedCallback` 이라 **번들로 못 간다**(커밋
        // b51f5a1). 둘을 한 항목으로 묶으면 OTA 로 이미 받은 스와이프 백까지 "스토어 업데이트
        // 필요"로 읽힌다.
        category: 'improvement',
        text: '안드로이드 시스템 뒤로가기가 화면 순서를 따라감',
        requiresStoreUpdate: true,
      },
      {
        category: 'fix',
        text: 'iOS 에서 당겨서 새로고침할 때 화면 위쪽에 흐릿한 띠가 남던 문제 수정',
      },
    ],
  },
  {
    version: '1.0.3',
    date: '2026-08-09',
    items: [
      { category: 'feature', text: '개발 노트 추가 — 버전별 변경 내역 확인' },
      { category: 'feature', text: 'API 키 발급 가이드 추가' },
      { category: 'improvement', text: '설정 화면 항목별 정리' },
      { category: 'improvement', text: 'API 키 만료·오류 시 재입력 화면으로 바로 이동' },
      { category: 'improvement', text: '드롭 연출 설정이 반대로 동작하던 것을 정정' },
      {
        category: 'fix',
        text: 'API 호출 한도 초과 시 앱이 멈추거나 계정·캐릭터 목록이 잘못 보이던 문제 수정',
      },
      { category: 'fix', text: '업데이트 적용 후 시작 화면에서 멈추던 문제 수정' },
      { category: 'fix', text: '앱 실행 후 보스 수익 첫 진입에서 금액이 0으로 보이던 문제 수정' },
      {
        category: 'fix',
        text: '확인이 끝나기 전 계정 선택 목록이 떠서 못 쓰는 계정을 고를 수 있던 문제 수정',
      },
      { category: 'fix', text: '보스 수익 기간 이동 시 로딩 카드가 튀던 문제 수정' },
    ],
  },
  {
    version: '1.0.2',
    date: '2026-08-07',
    items: [
      { category: 'improvement', text: '테마 선택 화면 카테고리 분류 + 미리보기 추가' },
      { category: 'improvement', text: '스케줄러 탭·필터 선택이 화면 이동 후에도 유지' },
      { category: 'improvement', text: '고가 아이템 드롭 연출 속도 개선' },
      { category: 'fix', text: '캐릭터 레벨·외형이 바로 갱신되지 않던 문제 수정' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-04',
    items: [{ category: 'feature', text: '앱 출시' }],
  },
]

/**
 * 그 버전의 노트를 찾는다. 없으면 **던지지 않고 `undefined`** 다 —
 * "노트가 없다"의 판정은 호출부가 한다(배포 가드는 중단하고, 화면은 그냥 안 그린다).
 */
export function findReleaseNote(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((note) => note.version === version)
}

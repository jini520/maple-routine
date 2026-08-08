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

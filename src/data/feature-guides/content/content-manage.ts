import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: 아래 주석을 풀고 `src/assets/guide/content-manage/` 에 파일을 두면 된다.
// 명시적 import 라 파일명이 틀리면 **빌드가 실패한다**([[ADR-125]] 결정 4) — glob 조회처럼
// `undefined` 가 되어 이미지만 빠진 채 통과하지 않는다.
//
// import modeImage from '../../../assets/guide/content-manage/01-mode.webp'
// import autoImage from '../../../assets/guide/content-manage/02-auto.webp'
// import manualImage from '../../../assets/guide/content-manage/03-manual.webp'

export const contentManageGuide: FeatureGuide = {
  id: 'content-manage',
  title: '컨텐츠 관리 방법',
  groups: ['content'],
  sections: [
    {
      id: 'mode',
      title: '자동과 수동, 무엇이 다른가',
      blocks: [
        // TODO(#198): 설정 › 스케줄 관리 방법 모달(자동/수동 두 선택지)
        // { image: { src: modeImage, alt: '스케줄 관리 방법 모달의 자동·수동 선택지' } },
        {
          text: '컨텐츠 목록을 채우는 방법이 두 가지입니다. 설정 › 스케줄 관리 방법에서 고릅니다.',
        },
        {
          text: '「자동」은 게임 안 스케줄러에 등록해 둔 컨텐츠가 그대로 반영됩니다. 앱에서는 목록을 고치지 않고 보기만 합니다.',
        },
        {
          text: '「수동」은 앱에서 직접 컨텐츠를 골라 담습니다. 게임 안에서 스케줄러에 무엇을 추가하든 앱 목록은 따라가지 않습니다.',
        },
      ],
    },
    {
      id: 'auto',
      title: '자동 — 게임 등록을 그대로 본다',
      blocks: [
        // TODO(#198): 컨텐츠 스케줄러 자동 모드 화면(일간·주간 탭 + 진행률)
        {
          text: '게임 스케줄러에 실제로 등록된 것만 나옵니다. 진행 수치도 게임 값 그대로라, 몬스터파크라면 7/14 처럼 보입니다.',
        },
        {
          text: '자동 모드에서는 앱에서 완료 체크를 할 수 없습니다. 게임에서 진행한 만큼만 바뀝니다.',
        },
        {
          text: '등록한 컨텐츠가 하나도 없으면 목록이 빕니다. 이때는 게임 안 스케줄러에서 먼저 등록해야 합니다 — 앱에서 채울 수 있는 것이 아닙니다.',
        },
      ],
    },
    {
      id: 'manual',
      title: '수동 — 컨텐츠 관리 화면에서 고른다',
      blocks: [
        // TODO(#198): 컨텐츠 스케줄러 수동 모드 헤더(「컨텐츠 관리」 버튼이 보이는 상태)
        {
          text: '수동 모드일 때만 화면 위쪽에 「컨텐츠 관리」가 생깁니다. 눌러 들어가 일간·주간 컨텐츠를 고릅니다.',
        },
        // TODO(#198): 컨텐츠 관리 화면(체크로 고르는 목록)
        {
          text: '관리 화면 위쪽 드롭다운으로 대상 캐릭터를 바꿀 수 있고, 돌아가면 스케줄러도 같은 캐릭터를 보고 있습니다.',
        },
        {
          text: '고른 것이 하나도 없으면 스케줄러가 비어 보입니다. 빈 화면의 「컨텐츠 관리」를 눌러 바로 고르러 갈 수 있습니다.',
        },
      ],
    },
  ],
}

import type { FeatureGuide } from '../../../types'
// 이미지는 `packages/core/src/assets/guide/content-manage/` 에 두고 여기서 import 한다. 명시적 import 라
// 파일명이 틀리면 **빌드가 실패한다**. glob 조회처럼 `undefined` 가 되어
// 이미지만 빠진 채 통과하지 않는다.
import autoImage from '../../../assets/guide/content-manage/02-auto.webp'
import dropdownImage from '../../../assets/guide/content-manage/05-dropdown.webp'
import manualImage from '../../../assets/guide/content-manage/03-manual.webp'
import manualImage2 from '../../../assets/guide/content-manage/04-manual.webp'
import modeImage from '../../../assets/guide/content-manage/01-mode.webp'

export const contentManageGuide: FeatureGuide = {
  id: 'content-manage',
  title: '컨텐츠 관리 방법',
  groups: ['content'],
  sections: [
    {
      id: 'mode',
      title: '자동모드와 수동모드',
      blocks: [
        {
          image: {
            src: modeImage,
            alt: '‘스케줄러를 어떻게 관리할까요?’ 모달. 자동·수동 두 선택지와 계속하기 버튼',
          },
        },
        {
          text: '컨텐츠 목록을 채우는 방법이 두 가지입니다. 설정 › 스케줄 관리 방법에서 고릅니다.',
        },
        {
          text: '‘자동 모드’ 는 게임 안 스케줄러에 등록해 둔 컨텐츠가 그대로 반영됩니다. 앱에서는 목록을 고치지 않고 보기만 합니다.',
        },
        {
          text: '‘수동 모드’ 는 초기 1회만 인게임 스케줄러와 동기화하고 이후로는 앱에서 직접 컨텐츠를 골라 담습니다. 게임 안에서 스케줄러에 무엇을 추가하든 앱 목록은 따라가지 않습니다.',
        },
      ],
    },
    {
      id: 'auto',
      title: '자동 모드',
      blocks: [
        {
          image: {
            src: autoImage,
            alt: '‘자동’ 선택지 카드. 게임 내 스케줄러에 등록한 컨텐츠가 그대로 반영된다는 설명',
          },
        },
        {
          text: '게임 스케줄러에 실제로 등록된 것만 나옵니다. 진행 수치도 게임 값 그대로라, 몬스터파크라면 7/14 처럼 보입니다.',
        },
        {
          text: '등록한 컨텐츠가 하나도 없으면 목록이 빕니다. 이때는 게임 안 스케줄러에서 먼저 등록해야 합니다.',
        },
      ],
    },
    {
      id: 'manual',
      title: '수동 모드 (자동 모드와 통합 예정)',
      blocks: [
        {
          image: {
            src: manualImage,
            alt: '‘수동’ 선택지 카드. 직접 컨텐츠를 선택하고 관리한다는 설명',
          },
        },
        {
          text: '수동 모드일 때만 화면 위쪽에 ‘컨텐츠 관리’가 생깁니다. 눌러 들어가 일간·주간 컨텐츠를 고릅니다.',
        },
        {
          image: {
            src: manualImage2,
            alt: '컨텐츠 관리 화면. 일간·주간 탭과 몬스터파크·일일 퀘스트 목록, 고른 항목이 주황으로 강조된 상태',
          },
        },
        {
          text: '관리 화면 위쪽 드롭다운으로 대상 캐릭터를 바꿀 수 있고, 돌아가면 스케줄러도 같은 캐릭터를 보고 있습니다.',
        },
        {
          image: {
            src: dropdownImage,
            alt: '화면 위쪽의 캐릭터 드롭다운. 캐릭터 이름과 펼침 화살표',
          },
        },
        {
          text: '고른 것이 하나도 없으면 스케줄러가 비어 보입니다. 빈 화면의 ‘컨텐츠 관리’ 를 눌러 바로 고르러 갈 수 있습니다.',
        },
      ],
    },
  ],
}

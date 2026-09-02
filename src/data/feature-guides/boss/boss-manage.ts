import type { FeatureGuide } from '../../../types'
// 이미지는 `src/assets/guide/boss-manage/` 에 두고 여기서 import 한다. 명시적 import 라
// 파일명이 틀리면 **빌드가 실패한다**. glob 조회처럼 `undefined` 가 되어
// 이미지만 빠진 채 통과하지 않는다.
//
// 모드 관련 셋은 `content-manage/` 것을 그대로 쓴다. 컨텐츠와 보스가 **같은 설정 모달**을 보므로
// 같은 그림 한 벌이 맞다(사본을 만들면 모달이 바뀔 때 한쪽만 낡는다).
import autoImage from '../../../assets/guide/content-manage/02-auto.webp'
import manualImage from '../../../assets/guide/content-manage/03-manual.webp'
import manualImage2 from '../../../assets/guide/boss-manage/04-manual.webp'
import modeImage from '../../../assets/guide/content-manage/01-mode.webp'

export const bossManageGuide: FeatureGuide = {
  id: 'boss-manage',
  title: '보스 관리 방법',
  groups: ['boss'],
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
          text: '컨텐츠와 같은 설정을 씁니다. 설정 › 스케줄 관리 방법이 ‘자동 모드’ 이면 게임에 등록한 보스를 그대로 따라가고, ‘수동 모드’ 이면 앱에서 직접 고릅니다.',
        },
      ],
    },
    {
      id: 'auto',
      title: '자동 모드',
      blocks: [
        // TODO(#198): 자동 모드의 **보스 관리 화면**(상단 안내 + `등록된 보스만 보기` 토글).
        // 지금 서 있는 것은 설정 모달의 `자동` 카드라 이 마디가 말하는 화면이 아니다.
        {
          image: {
            src: autoImage,
            alt: '‘자동’ 선택지 카드. 게임 내 스케줄러에 등록한 컨텐츠가 그대로 반영된다는 설명',
          },
        },
        {
          text: '자동 모드에서는 보스 관리 화면에 체크가 없습니다. 목록이 게임 등록 기준이라, 여기서 할 수 있는 것은 파티 인원을 정하는 일입니다.',
        },
        {
          // 토글의 이름과 방향이 앱 버전에 따라 다르다(RN 앱은 `모든 보스
          // 보기`(기본 꺼짐), 웹뷰 앱은 `등록된 보스만 보기`(기본 켜짐)). **기본 결과는 같으므로**
          // 결과를 먼저 말하고 토글은 **바꾸면** 으로 묶는다(`character-manage` 와 같은 처리).
          text: '기본으로는 게임에 등록한 보스만 보입니다. 위쪽의 ‘모든 보스 보기’ 토글을 켜면(앱 버전에 따라 ‘등록된 보스만 보기’를 끄면) 등록하지 않은 보스도 함께 보이고, 미리 파티 인원을 정해 둘 수 있습니다.',
        },
      ],
    },
    {
      id: 'manual',
      title: '수동 모드 (자동 모드와 통합 예정)',
      blocks: [
        // TODO(#198): 수동 모드의 **보스 관리 화면**(체크 목록 + 난이도).
        // 지금 서 있는 것은 설정 모달의 `수동` 카드라 이 마디가 말하는 화면이 아니다.
        {
          image: {
            src: manualImage,
            alt: '‘수동’ 선택지 카드. 직접 컨텐츠를 선택하고 관리한다는 설명',
          },
        },
        // 여는 자리가 앱 버전에 따라 다르다(RN 앱은 스케줄 그룹의 하위 탭,
        // 웹뷰 앱은 스케줄러 헤더의 버튼). `character-manage` 와 같은 처리다.
        {
          text: '스케줄의 ‘보스 관리’로 들어가 보스와 난이도를 고릅니다. 그 자리가 보이지 않는다면 보스 스케줄러 위쪽의 ‘보스 관리’ 버튼이 같은 화면을 엽니다.',
        },
        {
          text: '목록에는 그 캐릭터가 실제로 고를 수 있는 보스만 나옵니다. 아직 출시되지 않은 보스는 빠지고, 시즌 보스는 챌린저스 월드 캐릭터에게만 보입니다.',
        },
      ],
    },
    {
      id: 'limit',
      title: '수동 모드 (주간 보스는 12개까지)',
      blocks: [
        {
          image: {
            src: manualImage2,
            alt: '보스 관리 화면. 주간·월간 탭과 오른쪽 위 12/12 카운터, 고른 보스에 난이도 칩과 파티 인원 스테퍼가 붙은 상태',
          },
        },
        {
          text: '한 캐릭터가 한 주에 잡을 수 있는 주간 보스는 12개입니다. 앱도 같은 한도를 지키므로 13번째는 고를 수 없습니다.',
        },
        {
          text: '이미 고른 보스의 난이도만 바꾸는 것은 개수가 늘지 않으므로 한도에 걸리지 않습니다.',
        },
      ],
    },
  ],
}

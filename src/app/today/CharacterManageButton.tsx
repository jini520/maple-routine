/**
 * today 머리의 캐릭터 관리 버튼. 원 안에 대표 캐릭터 얼굴 한 장이 선다.
 *
 * @see docs/features/today.md 머리의 캐릭터 관리 버튼
 */
import { Pressable, View } from 'react-native'

import { CircleUserRoundIcon } from '../../components/atoms'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { PORTRAIT_HEADER } from '../../components/organisms/CharacterPortrait/portrait-metrics'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { tapFeedback } from '../../native/haptics'
import { useThemeMode } from '../../theme/context'
import type { RepresentativeView } from './view-model'

/**
 * 원 안의 여백이 드러내는 바탕. **순백과 순검정**이다(사용자 지시).
 *
 * 테마 토큰으로는 낼 수 없는 값이다. `surface` 가 순백인 테마는 렌 하나뿐이고, 라이트의 `bg` 는
 * 테마마다 물들어 있다(엔젤릭버스터 `#F9E9F1`). 그래서 토큰을 쓰지 않고 값으로 박는다.
 *
 * **3자리 hex(`#fff`)를 쓰지 말 것.** 안드로이드 `Color.parseColor` 가 거부해 화면이 죽는다.
 *
 * 가르는 기준은 `mode` 다. 테마 이름으로 가르면 테마가 늘 때마다 목록을 고쳐야 하고 빠뜨리면
 * 조용히 틀린다(`theme/context.ts` 의 `useThemeMode`).
 */
const CIRCLE_BACKGROUND = { light: '#ffffff', dark: '#000000' } as const

/**
 * 테두리 두께(사용자 지시로 1 에서 올렸다).
 *
 * 클래스(`border-2`)로 쓰지 않는다. 이 저장소에서 아무도 안 쓰던 유틸리티라, NativeWind 가 CSS 를
 * 서버가 뜰 때 한 번 컴파일하는 탓에 **두께가 조용히 0 이 된다**(`mr-2` 에서 겪은 그 자리).
 * 색은 `border-primary` 가 이미 쓰이는 클래스라 그쪽에 남는다.
 *
 * 이 값이 원 안의 여백(원 48 − 얼굴 40 의 절반 = 4)을 넘으면 여백이 선에 먹힌다. 2 가 그
 * 바닥이라, 더 두껍게 하려면 `PORTRAIT_HEADER.faceSize` 를 함께 줄여야 한다.
 */
const CIRCLE_BORDER_PX = 2

/**
 * 얼굴을 원 안에서 작게 보이게 하는 배수(사용자 지시).
 *
 * 크롭 표는 얼굴만 원에 꽉 채우도록 잡혀 있어서, 원이 48 까지 커지자 머리통만 크게 보였다. 박스를
 * 35% 넓게 잡아 어깨 쪽까지 조금 더 들인다. 얼굴 상자(40)와 원(48)은 그대로다.
 *
 * 이 값을 주는 곳은 여기뿐이다. `faceCropStyle` 의 기본값은 1 이라 나머지 초상화 여덟 자리는
 * 안 움직인다.
 */
const HEADER_FACE_ZOOM = 1.35

export function CharacterManageButton(props: {
  /** 대표 캐릭터. 없으면 사람 아이콘이 선다. */
  portrait: Pick<RepresentativeView, 'name' | 'imageUrl'> | null
}): React.JSX.Element {
  const navigation = useScreenNavigation()
  const mode = useThemeMode()

  return (
    <Pressable
      role="button"
      // 원 안에 글자가 없다. 이 이름이 무엇이 열리는지 말하는 유일한 자리다.
      aria-label="캐릭터 관리"
      // 화면이 바뀌는 이동이라 두드림을 낸다.
      onPress={() => {
        tapFeedback()
        navigation.navigate('SettingsCharacters')
      }}
      /*
       * 오른쪽 8 은 헤더가 쥔 `px-4` 위에 이 버튼만 더 미는 값이다(사용자 지시). 원이 화면
       * 가장자리에 붙어 보이던 것을 떼어 놓는다. 다른 탭 화면의 세그먼트보다 그만큼 안쪽이다.
       *
       * 클래스(`mr-2`)로 쓰지 말 것. 이 저장소에서 아무도 안 쓰던 유틸리티라, NativeWind 가 CSS 를
       * 서버가 뜰 때 한 번 컴파일하고 그 결과를 계속 돌려주는 탓에 **여백이 조용히 0 이 된다**
       * (Metro 를 다시 띄워야 나온다). 값으로 적으면 그 함정이 없다.
       */
      style={{
        width: PORTRAIT_HEADER.slot,
        height: PORTRAIT_HEADER.slot,
        marginRight: 8,
        backgroundColor: CIRCLE_BACKGROUND[mode],
        borderWidth: CIRCLE_BORDER_PX,
      }}
      /*
       * 테두리 색은 **테마 컬러**이고 두께는 `CIRCLE_BORDER_PX` 다(사용자 지시). 알파가 아니라
       * 굵기로 낸다.
       * 반투명하게 깔면 얼굴 그림 위에서 색이 섞여 탁해지고, 테마마다 원색의 밝기가 달라 다크에서
       * 선이 사라지는 테마가 생긴다. 레일 칸의 링도 같은 토큰으로 초상화를 두른다
       * (`CharacterPortrait` 의 `EmptyRing`).
       */
      className="shrink-0 items-center justify-center rounded-full border-primary"
    >
      {props.portrait !== null && (
        <CharacterAvatar
          testID="character-manage-face-box"
          imageTestID="character-manage-face"
          imageUrl={props.portrait.imageUrl}
          name={props.portrait.name}
          size={PORTRAIT_HEADER.faceSize}
          faceZoom={HEADER_FACE_ZOOM}
        />
      )}

      {/* 빈 원이나 지어낸 얼굴을 세우지 않는다. 추적이 없는 첫 실행에서도 문은 열려 있어야 한다.
          아이콘에 `testID` 를 직접 주지 않는 것은 그것이 SVG 부품이라 프롭이 어디까지 내려가는지가
          이 파일의 약속이 아니기 때문이다.

          24 인 것은 원이 40 이기 때문이다. 20 은 그 안에서 헐거웠다. */}
      {props.portrait === null && (
        <View testID="character-manage-fallback">
          <CircleUserRoundIcon className="h-6 w-6 text-text-muted" strokeWidth={2} aria-hidden />
        </View>
      )}
    </Pressable>
  )
}

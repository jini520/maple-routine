/**
 * 카카오톡 원형 아이콘. 카카오디벨로퍼스 `카카오 로그인` 리소스의 `kakao_login_light.svg` 를 좌표 그대로 옮긴 것.
 *
 * **색과 모양을 받지 않는다.** 카카오 운영정책이 상표의 수정 · 변형을 금지해서, 테마 색으로 칠하거나 네모로
 * 자르면 안 된다. 그래서 `className` 을 받는 `Svg` 가 아니라 `react-native-svg` 의 것을 쓴다.
 */
import Svg, { Path, Rect } from 'react-native-svg'

/**
 * 노란 원 위의 말풍선.
 *
 * @example
 * // 문의 모달의 오픈채팅 칸
 * <KakaoTalkIcon size={32} />
 */
export function KakaoTalkIcon(props: { size: number }): React.JSX.Element {
  return (
    <Svg testID="kakaotalk-icon" width={props.size} height={props.size} viewBox="0 0 48 48" aria-hidden>
      <Rect width={48} height={48} rx={24} fill="#FEE500" />
      <Path
        d="M24.0014 14C17.9241 14 13 18.0219 13 22.9825C13 26.1711 15.0368 28.9728 18.1057 30.5656L17.0681 34.5677C17.0295 34.6871 17.0598 34.8151 17.1424 34.9033C17.2029 34.9659 17.2855 35 17.3653 35C17.4341 35 17.5029 34.9772 17.5607 34.9289L22.0196 31.8171C22.661 31.911 23.3215 31.9622 23.9986 31.9622C30.0732 31.9622 35 27.9403 35 22.9797C35 18.0191 30.0759 14 24.0014 14Z"
        fill="#191919"
      />
    </Svg>
  )
}

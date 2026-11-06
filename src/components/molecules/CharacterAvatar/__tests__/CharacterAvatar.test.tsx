// 여덟 자리가 각자 그리던 얼굴 원을 이 부품이 든다.
import { within } from '@testing-library/react-native'
import { View } from 'react-native'

import { FACE_CROP_BOX, FACE_SOURCE_IMAGE_SIZE } from '../../../../lib/face-crop'
import { findAllOfType, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { Text } from '../../../atoms'
import { CharacterAvatar } from '../CharacterAvatar'

const 폴백 = (
  <View testID="폴백">
    <Text>?</Text>
  </View>
)

describe('CharacterAvatar', () => {
  // 그림 뒤로 비치던 회색은 걷었다. 바탕이 필요한 것은 폴백뿐이라 그쪽이
  // 자기 몫으로 든다. 부품이 기본값으로 깔면 그 결정이 여덟 자리에서 한꺼번에 되살아난다.
  it('원에는 배경색을 두지 않는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl="https://example.test/a.png" name="아무개" size={36} />,
    )

    expect(flattenStyle(getByTestId('얼굴').props.style).backgroundColor).toBeUndefined()
  })

  //  이 걷으려는 그것이다. 복사본이 셋 있었고 하나는 값이 달랐다.
  it('크롭은 `lib/face-crop` 의 표에서 나온다. 지름에 따라 배율이 바뀐다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="아무개" size={56} />,
    )

    const 배율 = 56 / FACE_CROP_BOX.size
    expect(flattenStyle(getByTestId('그림').props.style)).toMatchObject({
      position: 'absolute',
      width: FACE_SOURCE_IMAGE_SIZE * 배율,
      left: -FACE_CROP_BOX.x * 배율,
      top: -FACE_CROP_BOX.y * 배율,
    })
  })

  it('그림이 없으면 받은 폴백을 그 자리에 그린다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl={null} name="아무개" size={36} fallback={폴백} />,
    )

    expect(queryByTestId('그림')).toBeNull()
    expect(getByTestId('폴백')).toBeDefined()
  })

  // 대표 캐릭터 위젯은 `imageUrl` 이 `string` 이라 폴백이 없다. 그 자리에서 빈 원이 나오면 안 된다.
  it('폴백을 안 받으면 그림이 없을 때 아무것도 안 그린다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar testID="얼굴" imageUrl={null} name="아무개" size={36} />,
    )

    expect(getByTestId('얼굴').children).toHaveLength(0)
  })
})

// 줄의 왼쪽 끝에 서는 얼굴은 오른쪽을 봐야 한다. 넥슨 그림은 왼쪽을 본다.
describe('mirrored', () => {
  it('그림을 좌우로 뒤집는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="아무개" size={36} mirrored />,
    )

    expect(flattenStyle(getByTestId('그림').props.style).transform).toEqual([{ scaleX: -1 }])
  })

  // 원째로 뒤집으면 머리글자 폴백이 거울상이 된다.
  it('폴백은 뒤집지 않는다', async () => {
    const { toJSON } = await renderAtom(
      <CharacterAvatar imageUrl={null} name="아무개" size={36} mirrored fallback={폴백} />,
    )

    const 뒤집힌 = findAllOfType(toJSON(), 'View').filter(
      (node) => flattenStyle(node.props.style).transform !== undefined,
    )
    expect(뒤집힌).toHaveLength(0)
  })
})

// 원 전체를 덮어야 작은 얼굴에서도 어느 캐릭터가 조회 불가인지 보인다. 원이 자르는 상자 안에
// 그려야 덮개가 원 밖으로 삐져나오지 않는다.
describe('조회 불가', () => {
  it('그림을 흐리고 덮개를 원 안에 얹는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar
        testID="얼굴"
        imageTestID="그림"
        imageUrl="https://example.test/a.png"
        name="지내우시"
        size={26}
        unavailable
      />,
    )

    expect(getByTestId('그림').props.blurRadius).toBeGreaterThan(0)
    expect(within(getByTestId('얼굴')).getByTestId('portrait-unavailable')).toBeTruthy()
  })

  it('조회할 수 있으면 흐리지도 덮지도 않는다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="지내우시" size={26} />,
    )

    expect(getByTestId('그림').props.blurRadius).toBeUndefined()
    expect(queryByTestId('portrait-unavailable')).toBeNull()
  })

  // 얼굴이 자리마다 다르다(카드 26 · 레일 40). 고정값이면 작은 얼굴은 형체가 지워지고 큰 얼굴은
  // 덜 흐려 보인다.
  it('흐림과 아이콘이 얼굴 지름을 따라 커진다', async () => {
    const 작은 = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="가" size={20} unavailable />,
    )
    const 큰 = await renderAtom(
      <CharacterAvatar imageTestID="그림" imageUrl="https://example.test/a.png" name="나" size={44} unavailable />,
    )

    expect(큰.getByTestId('그림').props.blurRadius).toBeGreaterThan(작은.getByTestId('그림').props.blurRadius)
    const 아이콘폭 = (view: typeof 작은): number => {
      const [아이콘] = findAllOfType(view.toJSON(), 'RNSVGSvgView')
      return Number(flattenStyle(아이콘?.props.style).width)
    }
    expect(아이콘폭(큰)).toBeGreaterThan(아이콘폭(작은))
  })

  // 머리글자 얼굴도 조회 불가는 같은 모양으로 읽혀야 한다.
  it('그림이 없어도 폴백 위에 덮개를 얹는다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar imageUrl={null} name="지내우시" size={26} fallback={폴백} unavailable />,
    )

    expect(getByTestId('폴백')).toBeTruthy()
    expect(getByTestId('portrait-unavailable')).toBeTruthy()
  })
})

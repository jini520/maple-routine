/**
 * 입력 카드. 시트의 칸 하나를 키보드 위에서 받는다.
 *
 * 여기서 지키는 것은 **값이 언제 나가고 언제 안 나가는가**다. 카드가 어디에 앉는지(키보드 높이를
 * 따라가는 것)는 `keyboard-offset` 의 훅이 지고 이 테스트는 안 본다.
 */
import { act, fireEvent, within } from '@testing-library/react-native'
import { Keyboard } from 'react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { InputCard, type InputCardProps } from '../InputCard'

const 메소칩 = [
  { label: '+1억', value: 100_000_000 },
  { label: '+100만', value: 1_000_000 },
] as const

async function 그리기(props: Partial<InputCardProps> = {}) {
  const onConfirm = jest.fn()
  const onCancel = jest.fn()
  const view = await renderOverlay(
    <InputCard
      label="조각 가격"
      value=""
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { view, onConfirm, onCancel }
}

type 화면 = Awaited<ReturnType<typeof renderOverlay>>

/** 상태가 한 번 흐른 뒤에 다음 줄을 읽게 한다. 안 감싸면 누르기가 옛 값을 들고 나간다. */
async function 치기(view: 화면, text: string): Promise<void> {
  await act(async () => {
    fireEvent.changeText(view.getByTestId('input-card-value'), text)
  })
}

async function 누르기(view: 화면, 대상: string): Promise<void> {
  await act(async () => {
    fireEvent.press(대상.startsWith('input-card-') ? view.getByTestId(대상) : view.getByText(대상))
  })
}

/** 비율 고르개는 testID 가 아니라 라벨로 찾는다. 한 카드에 칸이 여럿이라 이름이 가른다. */
async function 누르기카드(view: { getByLabelText: (label: string) => unknown }, label: string): Promise<void> {
  await fireEvent.press(view.getByLabelText(label) as never)
}

describe('InputCard', () => {
  it('칸 이름과 맥락 줄을 머리에 그린다', async () => {
    const { view } = await 그리기({ context: '솔 에르다 조각 · 개당' })

    expect(view.getByText('조각 가격')).toBeTruthy()
    expect(view.getByText('솔 에르다 조각 · 개당')).toBeTruthy()
  })

  it('시트가 든 지금 값을 씨앗으로 받는다. 숫자는 콤마로 끊어 보인다', async () => {
    const { view } = await 그리기({ value: '12000000' })

    expect(view.getByTestId('input-card-value').props.value).toBe('12,000,000')
  })

  /** 들고 있는 값은 숫자만이다. 콤마는 보이는 자리에서만 붙고 확인할 때는 안 나간다. */
  it('콤마가 섞여 들어와도 값은 숫자만 나간다', async () => {
    const { view, onConfirm } = await 그리기()

    await 치기(view, '12,000,000')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('12000000')
  })

  /** 빈 칸과 0 은 뜻이 다르다. 사냥의 조각 가격에서 빈 칸은 보관이고 0 은 0 메소에 판 것이다. */
  it('0 은 빈 칸으로 접지 않는다', async () => {
    const { view } = await 그리기({ value: '0' })

    expect(view.getByTestId('input-card-value').props.value).toBe('0')
  })

  it('확인을 누르면 친 값이 나간다', async () => {
    const { view, onConfirm } = await 그리기({ value: '12000000' })

    await 치기(view, '34000000')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('34000000')
  })

  it('닫기를 누르면 값이 안 나가고 취소만 알린다', async () => {
    const { view, onConfirm, onCancel } = await 그리기({ value: '12000000' })

    await 치기(view, '34000000')
    await 누르기(view, 'input-card-close')

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })

  /**
   * 카드를 닫는 것은 ✕ 뿐이다(사용자 지정). 스크림은 판의 빈 자리와 같은 일을 해서 카드 안팎이
   * 한 규칙이다. 키보드만 내리고 치던 값은 남는다.
   */
  it('스크림을 누르면 키보드만 내린다. 안 닫히고 치던 값도 남는다', async () => {
    const 내리기 = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined)
    const { view, onConfirm, onCancel } = await 그리기({ value: '12000000' })

    await 치기(view, '34000000')
    await 누르기(view, 'input-card-scrim')

    expect(내리기).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.getByTestId('input-card-value').props.value).toBe('34,000,000')
    내리기.mockRestore()
  })

  it('숫자 칸은 숫자만 남긴다', async () => {
    const { view, onConfirm } = await 그리기()

    await 치기(view, '1,200만')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('1200')
  })

  it('칩을 누르면 값이 그 눈금만큼 오른다', async () => {
    const { view, onConfirm } = await 그리기({ value: '1000000', chips: 메소칩 })

    await 누르기(view, '+1억')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('101000000')
  })

  it('빈 칸에서 칩을 누르면 그 눈금이 곧 값이다', async () => {
    const { view, onConfirm } = await 그리기({ chips: 메소칩 })

    await 누르기(view, '+100만')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('1000000')
  })

  it('읽기를 켜면 한국어 단위를 보조로 적는다', async () => {
    const { view } = await 그리기({ value: '12000000', reading: true })

    expect(view.getByTestId('input-card-reading')).toHaveTextContent('1200만')
  })

  it('읽기를 켜도 값이 비면 그 자리는 비운다', async () => {
    const { view } = await 그리기({ reading: true })

    expect(view.getByTestId('input-card-reading')).toHaveTextContent('')
  })

  it('글자 칸은 친 글자를 그대로 내고 칩이 없다', async () => {
    const { view, onConfirm } = await 그리기({ label: '내용', text: true, chips: 메소칩 })

    await 치기(view, '펜살리르 장갑')
    await 누르기(view, 'input-card-confirm')

    expect(onConfirm).toHaveBeenCalledWith('펜살리르 장갑')
    expect(view.queryByText('+1억')).toBeNull()
  })

  it('글자 칸은 글자판을 부른다. 숫자 칸은 숫자판이다', async () => {
    const { view: 글자 } = await 그리기({ text: true })
    expect(글자.getByTestId('input-card-value').props.keyboardType).toBeUndefined()

    const { view: 숫자 } = await 그리기()
    expect(숫자.getByTestId('input-card-value').props.keyboardType).toBe('number-pad')
  })

  it('필수 칸은 값이 차도 별표가 남는다', async () => {
    const { view } = await 그리기({ label: '시세 · 1억당', required: true, value: '1350' })

    expect(view.getByTestId('input-card-required')).toBeTruthy()
  })

  /**
   * 손에 익은 동작이다. 판이 누르개가 아니면 RN 은 터치가 닿은 가장 위 뷰에서 멈추고 뒤의
   * 스크림으로 흘려보내지 않아, 아무 일도 안 일어난다(사용자가 실기에서 물었다).
   */
  it('판의 빈 자리를 누르면 키보드만 내린다. 카드는 안 닫힌다', async () => {
    const 내리기 = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined)
    const { view, onConfirm, onCancel } = await 그리기({ value: '84' })

    await 누르기(view, 'input-card-panel')

    expect(내리기).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(view.getByTestId('input-card-value').props.value).toBe('84')
    내리기.mockRestore()
  })

  it('단위는 값 오른쪽에 선다', async () => {
    const { view } = await 그리기({ unit: '메소' })

    expect(view.getByText('메소')).toBeTruthy()
  })

  /**
   * 드롭 판매가의 모양. 가격 입력 시트가 없어지면서 그 시트가 들던 분배 인원과 기록 안함이
   * 카드로 왔다. 부품은 도메인 낱말을 모르고 라벨은 호출부가 준다.
   */
  describe('한 아이템의 한 기록을 받는 모양', () => {
    const 균등 = { label: '분배 비율', myShare: 1, sharesTotal: 3, maxPartySize: 6 }
    const 비율 = { label: '분배 비율', myShare: 2, sharesTotal: 3, maxPartySize: 6 }

    // 드롭 하나의 값이라 결정석 카드가 없다. 파티 모달과 다른 점은 그것뿐이다.
    it('내 비율이 1 이면 기본으로 열려 파티 인원 스테퍼가 선다', async () => {
      const { view } = await 그리기({ share: 균등 })

      expect(view.getByText('파티 인원')).toBeTruthy()
      expect(view.getByText('최대 6명')).toBeTruthy()
      expect(view.queryByTestId('share-field-ratio-분배 비율')).toBeNull()
    })

    it('기본에서 인원을 올리면 확인이 1/N 을 준다', async () => {
      const { view, onConfirm } = await 그리기({ share: 균등, value: '100' })

      await act(async () => {
        fireEvent.press(view.getByLabelText('분배 비율 파티원 수 증가'))
      })
      await act(async () => {
        fireEvent.press(view.getByTestId('input-card-confirm'))
      })

      expect(onConfirm).toHaveBeenCalledWith('100', { myShare: 1, sharesTotal: 4 })
    })

    it('비율로 바꾸면 비율 카드 한 장이 서고 인원 스테퍼가 사라진다', async () => {
      const { view } = await 그리기({ share: 균등 })

      await act(async () => {
        fireEvent.press(view.getByText('비율'))
      })

      expect(view.getByTestId('share-field-ratio-분배 비율')).toBeTruthy()
      expect(view.queryByText('파티 인원')).toBeNull()
      expect(view.queryByText('결정석')).toBeNull()
    })

    it('내 비율이 1 이 아니면 비율로 열린다', async () => {
      const { view } = await 그리기({ share: 비율 })

      expect(view.getByTestId('share-field-ratio-분배 비율')).toHaveTextContent('66.7%')
      expect(view.queryByText('파티 인원')).toBeNull()
    })


    it('비율을 넘기면 값 칸 아래에 그 라벨로 선다. 낱말은 호출부가 준다', async () => {
      const { view } = await 그리기({ share: 비율 })

      expect(view.getByText('분배 비율')).toBeTruthy()
      expect(view.getByTestId('share-field-ratio-분배 비율')).toHaveTextContent('66.7%')
    })

    /** 친 값과 같이 **카드가 든다**. 그래야 확인 한 번에 둘이 함께 나간다. */
    it('비율은 카드가 들고 확인이 친 값과 함께 내보낸다', async () => {
      const { view, onConfirm } = await 그리기({ share: 비율 })

      await 누르기카드(view, '분배 비율 비율 3')
      expect(view.getByTestId('share-field-ratio-분배 비율')).toHaveTextContent('100%')

      await 치기(view, '3250000000')
      await 누르기(view, 'input-card-confirm')

      expect(onConfirm).toHaveBeenCalledWith('3250000000', { myShare: 3, sharesTotal: 3 })
    })

    // 안 맞추면 내 비율이 합보다 커져 내 몫이 100%를 넘는다.
    it('합을 내 비율 아래로 줄이면 내 비율이 따라 내려간다', async () => {
      const { view } = await 그리기({ share: { ...비율, myShare: 3 } })

      await 누르기카드(view, '분배 비율 비율 합 감소')

      expect(view.getByTestId('share-field-ratio-분배 비율')).toHaveTextContent('100%')
    })

    it('확인 라벨을 호출부가 바꾼다', async () => {
      const { view } = await 그리기({ confirmLabel: '저장' })

      expect(view.getByText('저장')).toBeTruthy()
      expect(view.queryByText('확인')).toBeNull()
    })

    /**
     * **친 값이 있나에 따라 확인이 다른 말을 한다.** 저장과 다음을 두 버튼으로 두었더니 어느
     * 쪽이 값을 쓰는지가 안 읽혔다(사용자 지적). 버튼은 하나이고 글자가 지금 누르면 무슨 일이
     * 나는가를 말한다.
     */
    it('빈 칸이면 빈 칸용 라벨이 선다', async () => {
      const { view } = await 그리기({ confirmLabel: '저장 후 다음(3/3)', confirmEmptyLabel: '다음(3/3)' })

      expect(view.getByText('다음(3/3)')).toBeTruthy()

      await 치기(view, '100')
      expect(view.getByText('저장 후 다음(3/3)')).toBeTruthy()
      expect(view.queryByText('다음(3/3)')).toBeNull()
    })

    it('빈 칸용 라벨을 안 넘기면 둘이 같은 말을 한다', async () => {
      const { view } = await 그리기({ confirmLabel: '완료' })

      expect(view.getByText('완료')).toBeTruthy()
    })

    /** 셋 다 지금 아이템을 처리하고 넘어가는 길이라 한 줄에 선다. */
    it('기록 안함과 이전을 확인과 한 줄에 세운다', async () => {
      const onExclude = jest.fn()
      const onPrev = jest.fn()
      const { view } = await 그리기({
        confirmLabel: '저장 후 다음(3/3)',
        exclude: { label: '기록 안함', onPress: onExclude },
        prev: { label: '이전(1/3)', onPress: onPrev },
      })

      await 누르기(view, 'input-card-exclude')
      expect(onExclude).toHaveBeenCalled()

      await 누르기(view, 'input-card-prev')
      expect(onPrev).toHaveBeenCalled()
    })

    /** 확인이 더 넓다. 앞뒤로 오가는 동안 손이 가는 자리가 안 흔들린다. */
    it('확인이 이전보다 넓다', async () => {
      const { view } = await 그리기({
        confirmLabel: '저장 후 다음(3/3)',
        prev: { label: '이전(1/3)', onPress: jest.fn() },
      })

      const 이전 = flattenStyle(view.getByTestId('input-card-prev').props.style)
      const 확인 = flattenStyle(view.getByTestId('input-card-confirm').props.style)
      expect(Number(확인.flexGrow)).toBeGreaterThan(Number(이전.flexGrow))
    })

    /**
     * 이전도 친 값을 내보낸다(사용자 지정). 앞뒤로 오가는 동안 값이 안 날아간다. 그래서 확인과
     * **같은 것을 넘긴다**. 쓸지 말지는 받는 쪽이 정한다.
     */
    it('이전도 친 값과 비율을 함께 넘긴다', async () => {
      const onPrev = jest.fn()
      const { view } = await 그리기({
        share: 비율,
        prev: { label: '이전(1/3)', onPress: onPrev },
      })

      await 치기(view, '3250000000')
      await 누르기(view, 'input-card-prev')

      expect(onPrev).toHaveBeenCalledWith('3250000000', { myShare: 2, sharesTotal: 3 })
    })

    // 드롭은 경매장에 팔 때 한 번, 파티원에게 보낼 때 한 번 수수료를 문다.
    describe('판매 · 분배 수수료', () => {
      const 수수료 = {
        autoFee: { grade: 'diamond' as const, percent: 3 },
        sale: { auto: true, percent: null },
        split: { auto: true, percent: null },
      }

      it('비율 아래에 판매 · 분배 수수료 줄이 자동으로 선다', async () => {
        const { view } = await 그리기({ share: 비율, fees: 수수료 })

        expect(view.getByTestId('input-card-sale-fee')).toBeTruthy()
        expect(view.getByTestId('input-card-split-fee')).toBeTruthy()
        expect(view.getAllByLabelText('MVP 다이아')).toHaveLength(2)
      })

      // 판의 반쪽씩이다. 위아래로 두면 카드가 키보드를 밀어낸다.
      it('왼쪽이 분배이고 오른쪽이 수수료 둘이다', async () => {
        const { view } = await 그리기({ share: 비율, fees: 수수료 })

        const 줄 = view.getByTestId('input-card-split-fees')
        expect(flattenStyle(줄.props.style).flexDirection).toBe('row')
        expect(within(줄).getByTestId('share-field-track')).toBeTruthy()
        expect(within(줄).getByTestId('input-card-sale-fee')).toBeTruthy()
      })

      // 판의 반쪽이라 합을 트랙 옆에 두면 트랙이 30px 밖에 안 남는다.
      it('비율 카드의 합은 트랙 아래에 선다', async () => {
        const { view } = await 그리기({ share: 비율, fees: 수수료 })

        expect(view.getByLabelText('분배 비율 비율 합 증가')).toBeTruthy()
        expect(flattenStyle(view.getByTestId('share-field-track').props.style).flexDirection).not.toBe('row')
      })

      // 좁은 자리라 이름과 값이 한 줄을 다투면 세그먼트가 찌부러진다.
      it('수수료 줄은 이름과 값을 위아래로 나눈다', async () => {
        const { view } = await 그리기({ share: 비율, fees: 수수료 })

        expect(view.getByTestId('input-card-sale-fee-head')).toBeTruthy()
        expect(view.getByTestId('input-card-sale-fee-value')).toBeTruthy()
      })

      it('혼자면 분배 수수료 줄이 안 선다. 보낼 곳이 없다', async () => {
        const { view } = await 그리기({ share: { ...비율, sharesTotal: 1 }, fees: 수수료 })

        expect(view.getByTestId('input-card-sale-fee')).toBeTruthy()
        expect(view.queryByTestId('input-card-split-fee')).toBeNull()
      })

      it('확인이 자동이면 등급 요율을, 손으로 고르면 그 요율을 수수료와 함께 내보낸다', async () => {
        const { view, onConfirm } = await 그리기({ share: 비율, fees: 수수료 })
        await 치기(view, '1000000000')

        // 분배 수수료만 끄고 5% 를 고른다
        await act(async () => {
          fireEvent.press(within(view.getByTestId('input-card-split-fee')).getByRole('checkbox'))
        })
        await act(async () => {
          fireEvent.press(within(view.getByTestId('input-card-split-fee')).getByLabelText('5%'))
        })
        await 누르기(view, 'input-card-confirm')

        expect(onConfirm).toHaveBeenCalledWith('1000000000', { myShare: 2, sharesTotal: 3 }, {
          saleFeePercent: 3,
          saleFeeAuto: true,
          splitFeePercent: 5,
          splitFeeAuto: false,
        })
      })
    })

    it('안 넘기면 곁들이 버튼도 비율 고르개도 안 선다', async () => {
      const { view } = await 그리기()

      expect(view.queryByTestId('share-field-track')).toBeNull()
      expect(view.queryByTestId('input-card-exclude')).toBeNull()
      expect(view.queryByTestId('input-card-prev')).toBeNull()
    })
  })
})

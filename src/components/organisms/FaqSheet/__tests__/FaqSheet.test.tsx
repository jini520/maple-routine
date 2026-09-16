// 설명이 필요한 자리가 여는 공용 시트.
//
// 여기가 지키는 것은 **전부 펼친 채 선다**는 것이다. 접고 펴는 장치를 두지 않는 이유는 여는
// 사람이 이미 질문을 들고 왔기 때문이다. 목차부터 보이면 답까지 한 번 더 눌러야 한다.
import type { ReactNode } from 'react'

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, { testID: 'sheet-backdrop', ...props }),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.View, props),
    useBottomSheetInternal: () => null,
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetTextInput: (props: Record<string, unknown>) =>
      React.createElement(ReactNative.TextInput, props),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { screen } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { FaqSheet } from '../FaqSheet'
import type { FaqItem } from '../FaqSheet'

const 문답: FaqItem[] = [
  {
    question: '결산이 무엇인가요?',
    answer: [{ kind: 'paragraph', text: '넥슨이 기록을 모아 확정하는 작업입니다.' }],
  },
  {
    question: '어떻게 해야 하나요?',
    answer: [
      { kind: 'paragraph', text: '기다려주세요.' },
      { kind: 'paragraph', text: '다음 조회에서 앱이 맞춥니다.' },
    ],
  },
]

async function 그리기(items: FaqItem[] = 문답): Promise<void> {
  await renderOverlay(<FaqSheet title="스케줄러 결산" items={items} onClose={jest.fn()} />)
}

it('머리에는 그 화면의 말이 선다', async () => {
  await 그리기()

  expect(screen.getByText('스케줄러 결산')).toBeTruthy()
  // 「자주 묻는 질문」 은 무엇에 대한 설명인지를 안 말한다.
  expect(screen.queryByText('자주 묻는 질문')).toBeNull()
})

it('질문과 답이 전부 펼쳐져 있다', async () => {
  await 그리기()

  expect(screen.getByText('결산이 무엇인가요?')).toBeTruthy()
  expect(screen.getByText('넥슨이 기록을 모아 확정하는 작업입니다.')).toBeTruthy()
  expect(screen.getByText('어떻게 해야 하나요?')).toBeTruthy()
  expect(screen.getByText('기다려주세요.')).toBeTruthy()
})

it('한 답의 문단 여럿을 순서대로 그린다', async () => {
  await 그리기()

  expect(screen.getByText('다음 조회에서 앱이 맞춥니다.')).toBeTruthy()
})

// 접고 펴는 장치가 없다. 셰브런이 있으면 누를 것이 있다는 뜻이 되어 거짓말이 된다.
it('펼치는 누르개가 없다', async () => {
  await 그리기()

  expect(screen.queryAllByRole('button')).toHaveLength(0)
})

it('문답마다 테스트 아이디가 붙어 몇 개인지 셀 수 있다', async () => {
  await 그리기()

  expect(screen.getAllByTestId(/^faq-item-/)).toHaveLength(2)
})

it('문답이 없으면 머리만 선다', async () => {
  await 그리기([])

  expect(screen.getByText('스케줄러 결산')).toBeTruthy()
  expect(screen.queryAllByTestId(/^faq-item-/)).toHaveLength(0)
})

// 껍데기의 스크롤 본문에는 좌우 여백이 없다. 머리와 바닥 줄만 16 을 갖고 자식은 자기 여백을 진다.
// 안 주면 글자가 화면 끝에 붙고 문답 사이 선이 시트를 가로질러 통째로 갈라 놓는다(실측으로 잡았다).
it('좌우 16 을 자기가 준다', async () => {
  await 그리기()

  const 목록 = screen.getByTestId('faq-item-0').parent
  expect(flattenStyle(목록?.props.style).paddingLeft).toBe(16)
  expect(flattenStyle(목록?.props.style).paddingRight).toBe(16)
})

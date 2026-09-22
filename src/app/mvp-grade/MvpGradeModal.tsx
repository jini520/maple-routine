/**
 * MVP 등급을 묻는 모달. 고르기와 확인 두 화면을 오가고, 주간 확인은 확인 화면부터 선다.
 *
 * 머리는 `NoticeModal` 과 같은 규격(배지 56 · 제목 · 설명)이지만 폭이 `max-w-sm` 이다. `NoticeModal` 의
 * `max-w-xs` 에는 등급 일곱과 ID 표시가 함께 안 들어간다.
 *
 * @see docs/features/mvp-grade.md 묻는 자리
 */
import { useState } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'

import { Button, CrownIcon, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'
import { historyFloorDateKey } from '../../features/cashbook/range'
import type { MvpAsk } from '../../features/mvp-grade/ask'
import type { MvpAskAccount, MvpAskResult } from '../../features/mvp-grade/flow-store'
import { resetWeekStartOf } from '../../lib/calendar'
import type { MvpGradeKey } from '../../lib/mvp/grades'
import { MvpCheckRow, MvpConfirmCard, MvpPickCard, MvpWeeklyOffRow } from './MvpGradeCards'

export interface MvpGradeModalProps {
  ask: MvpAsk
  accounts: MvpAskAccount[]
  /** 저장된 `앞으로 등급은 직접 바꿀게요`. 새 ID 흐름이 켜 둔 값을 끄지 않게 그 값으로 선다 */
  weeklyOff: boolean
  /** 오늘(KST `YYYY-MM-DD`) */
  todayDateKey: string
  /** 답을 적는 중. `맞아요` 가 대기로 선다 */
  busy: boolean
  onDone: (result: MvpAskResult) => void
}

type Screen = 'pick' | 'confirm'

const COPY = {
  select: { title: 'MVP 등급을 알려주세요', description: '고른 캐릭터의 메이플 ID마다 골라 주세요. 고르지 않으면 일반으로 계산해요.' },
  newId: {
    title: '새 메이플 ID의 MVP 등급을 알려주세요',
    description: '방금 등록한 캐릭터가 이 메이플 ID에 있어요. 고르지 않으면 일반으로 계산해요.',
  },
  weeklyPick: { title: '바뀐 등급을 골라 주세요', description: '바꾼 메이플 ID는 그 등급이 시작된 주를 함께 받아요.' },
  confirm: { title: '이 등급이 맞나요?', description: '경매장 수수료와 스타포스 비용을 이 등급으로 계산해요.' },
  weeklyConfirm: { title: '이번 주 MVP 등급이 맞나요?', description: '등급이 바뀌었으면 수정을 눌러 주세요.' },
} as const

function initialGradeOf(account: MvpAskAccount): MvpGradeKey {
  return account.currentGrade ?? 'normal'
}

export function MvpGradeModal(props: MvpGradeModalProps): React.JSX.Element {
  const { ask, accounts } = props
  const weekly = ask.kind === 'weekly'
  const thisWeek = resetWeekStartOf(props.todayDateKey)
  const floorWeek = historyFloorDateKey(props.todayDateKey)
  const { height: windowHeight } = useWindowDimensions()

  const [screen, setScreen] = useState<Screen>(weekly ? 'confirm' : 'pick')
  const [grades, setGrades] = useState<Record<string, MvpGradeKey>>(() =>
    Object.fromEntries(accounts.map((account) => [account.accountId, initialGradeOf(account)])),
  )
  const [starts, setStarts] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((account) => [account.accountId, thisWeek])),
  )
  const [weeklyOff, setWeeklyOff] = useState(props.weeklyOff)
  const [bulkApply, setBulkApply] = useState(false)

  const gradeOf = (account: MvpAskAccount): MvpGradeKey => grades[account.accountId] ?? initialGradeOf(account)
  const startOf = (account: MvpAskAccount): string => starts[account.accountId] ?? thisWeek
  // 주간 확인은 바꾼 ID 만 시작 주를 받는다. 처음 고르는 흐름은 모든 ID 가 새 기록이다.
  const changedOf = (account: MvpAskAccount): boolean => !weekly || gradeOf(account) !== initialGradeOf(account)
  const startLabel = weekly ? '바뀐 등급 적용 시작 주' : '적용 시작 주'

  const copy =
    screen === 'confirm'
      ? weekly
        ? COPY.weeklyConfirm
        : COPY.confirm
      : weekly
        ? COPY.weeklyPick
        : ask.kind === 'newId'
          ? COPY.newId
          : COPY.select

  function done(): void {
    props.onDone({
      choices: accounts.map((account) => ({
        accountId: account.accountId,
        grade: gradeOf(account),
        startWeek: startOf(account),
        changed: changedOf(account),
      })),
      weeklyOff,
      bulkApply,
    })
  }

  return (
    // 답을 받아야 끝나는 흐름이라 바깥 탭 · 뒤로가기로 안 닫힌다. 고르지 않은 ID 는 `일반` 으로 이미 서 있다.
    <Modal onClose={() => {}} testId="mvp-grade" align="center">
      <Modal.Card tight={screen === 'confirm'}>
        <View className="gap-5">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-tint">
              <CrownIcon className="h-7 w-7 text-primary-ink" strokeWidth={1.75} aria-hidden />
            </View>
            <View className="w-full gap-2">
              <Text className="text-center text-base font-semibold leading-snug text-text">{copy.title}</Text>
              <Text className="text-center text-xs text-text-muted">{copy.description}</Text>
            </View>
          </View>

          {/* 머리 · 체크박스 · 버튼을 뺀 높이만 쓴다. ID 가 여럿이면 카드끼리 스크롤한다. */}
          <ScrollView style={{ maxHeight: Math.max(windowHeight - 440, 180) }} contentContainerClassName="gap-2">
            {accounts.map((account) =>
              screen === 'pick' ? (
                <MvpPickCard
                  key={account.accountId}
                  account={account}
                  grade={gradeOf(account)}
                  onGrade={(grade) => setGrades({ ...grades, [account.accountId]: grade })}
                  start={changedOf(account) ? startOf(account) : null}
                  startLabel={startLabel}
                  floorWeek={floorWeek}
                  thisWeek={thisWeek}
                  onStart={(week) => setStarts({ ...starts, [account.accountId]: week })}
                />
              ) : (
                <MvpConfirmCard
                  key={account.accountId}
                  account={account}
                  grade={gradeOf(account)}
                  start={changedOf(account) ? startOf(account) : null}
                  startLabel={startLabel}
                />
              ),
            )}
          </ScrollView>

          {screen === 'confirm' && (
            <View className="gap-3">
              <MvpWeeklyOffRow checked={weeklyOff} onChange={setWeeklyOff} />
              {ask.kind !== 'weekly' && ask.bulk && (
                <MvpCheckRow
                  label="지난 기록에도 수수료 적용하기"
                  hint="적용 시작 주부터의 판매 기록에 수수료를 반영해요. 직거래 기록은 나중에 없음으로 고칠 수 있어요."
                  checked={bulkApply}
                  onChange={setBulkApply}
                />
              )}
            </View>
          )}

          <View className="items-center gap-1">
            <Button
              variant="primary"
              onPress={screen === 'pick' ? () => setScreen('confirm') : done}
              busy={screen === 'confirm' && props.busy}
              className="w-full items-center"
              textClassName="text-sm"
            >
              {screen === 'pick' ? '다음' : '맞아요'}
            </Button>
            {screen === 'confirm' && (
              <Button
                variant="text"
                onPress={() => setScreen('pick')}
                disabled={props.busy}
                className="w-full items-center px-4 py-1.5"
                textClassName="text-xs"
              >
                수정
              </Button>
            )}
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}

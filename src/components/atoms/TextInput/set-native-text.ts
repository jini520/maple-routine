/**
 * 입력 칸의 글자와 커서를 앱이 고치는 함수. RN 이 `value` 로 통제하는 칸에 쓰는 명령과 같다.
 *
 * 칸은 `object` 로 받는다. `react-native` 의 `TextInput` 은 타입이라도 `TextInput.tsx` 밖에서 가져오지 않는다.
 */
import { codegenNativeCommands } from 'react-native'

interface TextInputCommands {
  setTextAndSelection(input: object, eventCount: number, text: string | null, start: number, end: number): void
}

const commands = codegenNativeCommands<TextInputCommands>({ supportedCommands: ['setTextAndSelection'] })

/**
 * @param input 고칠 칸
 * @param eventCount 고칠 입력의 `onChange` 차례. 칸의 마지막 입력 차례와 다르면 칸이 명령을 버린다
 * @param text 칸에 둘 글자
 * @param caret 커서 자리(UTF-16 위치)
 */
export function setNativeText(input: object, eventCount: number, text: string, caret: number): void {
  commands.setTextAndSelection(input, eventCount, text, caret, caret)
}

import ExpoModulesCore

/**
 기존 사용자 데이터를 그대로 읽고 쓰는 모듈([[ADR-127]] 결정 5, `docs/migration/data.md` 결정 1).
 복사도 변환도 하지 않는다 — `UserDefaults` 는 프레임워크가 아니라 앱 번들 ID 에 귀속되므로 같은
 `com.mapleroutine.app` 이면 Capacitor 가 쓰던 값이 그냥 읽힌다.

 **키는 손대지 않는다.** Capacitor 는 이 저장소를 `"CapacitorStorage."` 접두사로 네임스페이싱하는데
 (`Preferences.swift` 의 `group + "."`), 그 접두사는 JS 쪽
 `src/storage/adapters/capacitor-storage-keys.ts` 가 붙이고 뗀다 — 문자열 연산이라 그쪽에 두면 실기기
 없이 검증된다. 그래서 `getAllKeys()` 도 **거르지 않고** 날 것 그대로 돌려주고, 거르는 일은 같은
 파일이 맡는다.

 네 연산이 **같은 `UserDefaults.standard`** 를 본다. 읽기와 쓰기가 갈리면 앱을 쓸수록 데이터가 갈라진다.
 */
public class CapacitorStorageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CapacitorStorage")

    AsyncFunction("getValue") { (key: String) -> String? in
      UserDefaults.standard.string(forKey: key)
    }

    AsyncFunction("setValue") { (key: String, value: String) in
      UserDefaults.standard.set(value, forKey: key)
    }

    AsyncFunction("removeValue") { (key: String) in
      UserDefaults.standard.removeObject(forKey: key)
    }

    AsyncFunction("getAllKeys") { () -> [String] in
      Array(UserDefaults.standard.dictionaryRepresentation().keys)
    }
  }
}

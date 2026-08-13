package com.mapleroutine.capacitorstorage

import android.content.Context
import android.content.SharedPreferences
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `@capacitor/preferences` 가 쓰던 SharedPreferences 파일 이름 그대로다
 * (`Preferences.java` — `context.getSharedPreferences(configuration.group, MODE_PRIVATE)`,
 * 그룹 기본값 `CapacitorStorage`). 이 이름이 곧 Android 쪽 네임스페이스이므로 **키에는 접두사를
 * 붙이지 않는다.**
 */
private const val STORAGE_NAME = "CapacitorStorage"

/**
 * 기존 사용자 데이터를 그대로 읽고 쓰는 모듈([[ADR-127]] 결정 5, `docs/migration/data.md` 결정 1).
 * 복사도 변환도 하지 않는다 — 저장소는 프레임워크가 아니라 앱 번들 ID 에 귀속되므로 같은
 * `com.mapleroutine.app` 이면 그냥 열린다.
 *
 * 네 연산이 **같은 파일 하나**를 본다. 읽기와 쓰기가 갈리면 앱을 쓸수록 데이터가 갈라진다.
 */
class CapacitorStorageModule : Module() {
  private val preferences: SharedPreferences
    get() {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      return context.getSharedPreferences(STORAGE_NAME, Context.MODE_PRIVATE)
    }

  override fun definition() = ModuleDefinition {
    Name("CapacitorStorage")

    AsyncFunction("getValue") { key: String ->
      preferences.getString(key, null)
    }

    // `apply()` 는 Capacitor 구현과 같다(`Preferences.java` 의 `executeOperation`) — 전환 전후로
    // 쓰기의 내구성 동작이 달라지지 않게 맞춘 것이다.
    AsyncFunction("setValue") { key: String, value: String ->
      preferences.edit().putString(key, value).apply()
    }

    AsyncFunction("removeValue") { key: String ->
      preferences.edit().remove(key).apply()
    }

    AsyncFunction("getAllKeys") {
      preferences.all.keys.toList()
    }
  }
}

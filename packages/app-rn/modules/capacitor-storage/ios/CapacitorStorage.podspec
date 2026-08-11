Pod::Spec.new do |s|
  s.name           = 'CapacitorStorage'
  s.version        = '0.1.0'
  s.summary        = 'Capacitor 시절 UserDefaults 저장소를 그대로 읽는 로컬 모듈'
  s.description    = '기존 사용자 데이터를 옮기지 않고 그대로 쓰기 위한 어댑터(ADR-127 결정 5).'
  s.author         = ''
  s.homepage       = 'https://mapleroutine.store'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

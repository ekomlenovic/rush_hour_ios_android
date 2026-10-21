Pod::Spec.new do |s|
  s.name           = 'RushWidget'
  s.version        = '1.0.0'
  s.summary        = 'Data of the Rush Hours home screen widget'
  s.description    = 'Writes what the home screen widget shows where the widget extension reads it (issue 151)'
  s.author         = ''
  s.homepage       = 'https://github.com/ekomlenovic/rush_hour_ios_android'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

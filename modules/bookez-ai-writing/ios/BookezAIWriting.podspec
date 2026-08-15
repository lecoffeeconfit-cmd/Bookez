Pod::Spec.new do |s|
  s.name           = 'BookezAIWriting'
  s.version        = '1.0.0'
  s.summary        = 'Private on-device writing assistance for Bookez'
  s.description    = 'Connects Bookez writing tools to Apple Foundation Models.'
  s.author         = 'Bookez'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_framework = 'FoundationModels'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

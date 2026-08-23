require 'fileutils'
require 'xcodeproj'

root = File.expand_path('..', __dir__)
project_path = File.join(root, 'ios', 'Still.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find { |target| target.name == 'Still' }
abort 'Still app target not found' unless app_target

def add_source(project, target, group_path, file_path)
  group = project.main_group.find_subpath(group_path, true)
  reference = group.files.find { |file| file.real_path.to_s == file_path } || group.new_file(file_path)
  target.source_build_phase.add_file_reference(reference, true) unless target.source_build_phase.files_references.include?(reference)
end

native = File.join(root, 'ios', 'StillNative')
add_source(project, app_target, 'StillNative', File.join(native, 'SharedRestrictionState.swift'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillRestrictionEngine.swift'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillRestrictionEngine.m'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillActivityReportView.swift'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillActivityReportView.m'))

extensions = {
  'StillShieldAction' => {
    bundle: 'com.still.screentime.shield-action',
    point: 'com.apple.ManagedSettings.shield-action-service',
    principal: '$(PRODUCT_MODULE_NAME).ShieldActionExtension',
    sources: ['StillShieldAction/ShieldActionExtension.swift', 'StillNative/SharedRestrictionState.swift']
  },
  'StillShieldConfiguration' => {
    bundle: 'com.still.screentime.shield-configuration',
    point: 'com.apple.ManagedSettingsUI.shield-configuration-service',
    principal: '$(PRODUCT_MODULE_NAME).ShieldConfigurationExtension',
    sources: ['StillShieldConfiguration/ShieldConfigurationExtension.swift']
  },
  'StillDeviceActivityMonitor' => {
    bundle: 'com.still.screentime.device-activity-monitor',
    point: 'com.apple.deviceactivity.monitor-extension',
    principal: '$(PRODUCT_MODULE_NAME).DeviceActivityMonitorExtension',
    sources: ['StillDeviceActivityMonitor/DeviceActivityMonitorExtension.swift', 'StillNative/SharedRestrictionState.swift']
  },
  'StillDeviceActivityReport' => {
    bundle: 'com.still.screentime.device-activity-report',
    point: 'com.apple.deviceactivity.report-extension',
    sources: ['StillDeviceActivityReport/DeviceActivityReportExtension.swift']
  }
}

embed = app_target.copy_files_build_phases.find { |phase| phase.name == 'Embed App Extensions' } || app_target.new_copy_files_build_phase('Embed App Extensions')
embed.dst_subfolder_spec = '13'

extensions.each do |name, spec|
  directory = File.join(root, 'ios', name)
  plist = {
    'CFBundleDevelopmentRegion' => '$(DEVELOPMENT_LANGUAGE)',
    'CFBundleDisplayName' => name.sub('Still', 'Still '),
    'CFBundleExecutable' => '$(EXECUTABLE_NAME)',
    'CFBundleIdentifier' => '$(PRODUCT_BUNDLE_IDENTIFIER)',
    'CFBundleInfoDictionaryVersion' => '6.0',
    'CFBundleName' => '$(PRODUCT_NAME)',
    'CFBundlePackageType' => 'XPC!',
    'CFBundleShortVersionString' => '$(MARKETING_VERSION)',
    'CFBundleVersion' => '$(CURRENT_PROJECT_VERSION)',
    'NSExtension' => { 'NSExtensionPointIdentifier' => spec[:point] }
  }
  plist['NSExtension']['NSExtensionPrincipalClass'] = spec[:principal] if spec[:principal]
  Xcodeproj::Plist.write_to_path(plist, File.join(directory, 'Info.plist'))
  entitlements = {
    'com.apple.developer.family-controls' => true,
    'com.apple.security.application-groups' => ['group.com.still.screentime']
  }
  Xcodeproj::Plist.write_to_path(entitlements, File.join(directory, "#{name}.entitlements"))

  target = project.targets.find { |existing| existing.name == name } || project.new_target(:app_extension, name, :ios, '16.4')
  target.build_configurations.each do |configuration|
    settings = configuration.build_settings
    settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
    settings['CODE_SIGN_ENTITLEMENTS'] = "#{name}/#{name}.entitlements"
    settings['CURRENT_PROJECT_VERSION'] = '1'
    settings['GENERATE_INFOPLIST_FILE'] = 'NO'
    settings['INFOPLIST_FILE'] = "#{name}/Info.plist"
    settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
    settings['MARKETING_VERSION'] = '0.1.0'
    settings['PRODUCT_BUNDLE_IDENTIFIER'] = spec[:bundle]
    settings['PRODUCT_MODULE_NAME'] = name
    settings['PRODUCT_NAME'] = name
    settings['SKIP_INSTALL'] = 'YES'
    settings['SWIFT_VERSION'] = '5.0'
    settings['TARGETED_DEVICE_FAMILY'] = '1'
  end
  spec[:sources].each { |source| add_source(project, target, source.split('/').first, File.join(root, 'ios', source)) }
  app_target.add_dependency(target) unless app_target.dependencies.any? { |dependency| dependency.target == target }
  embed.add_file_reference(target.product_reference, true) unless embed.files_references.include?(target.product_reference)
end

project.save
puts 'Configured Still Screen Time extension targets.'

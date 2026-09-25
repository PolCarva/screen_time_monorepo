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
# The App Intent is only discoverable by Shortcuts if it is compiled into the app target.
add_source(project, app_target, 'StillNative', File.join(native, 'StillShortcutIntent.swift'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillPauseAppIntent.swift'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillRestrictionEngine.m'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillActivityReportView.swift'))
add_source(project, app_target, 'StillNative', File.join(native, 'StillActivityReportView.m'))

extension_names = %w[
  StillShieldAction
  StillShieldConfiguration
  StillDeviceActivityMonitor
  StillDeviceActivityReport
]
extension_bundle_ids = %w[
  com.still.screentime.shield-action
  com.still.screentime.shield-configuration
  com.still.screentime.device-activity-monitor
  com.still.screentime.device-activity-report
]

# The App Store release uses the Shortcuts App Intent. Keep the former Screen
# Time experiment in source control, but do not ship its extension targets: a
# Family Controls distribution entitlement would otherwise be required for
# the app and every extension bundle ID.
extension_names.each do |name|
  app_target.dependencies
    .select { |dependency| dependency.name == name }
    .each do |dependency|
      dependency.target_proxy&.remove_from_project
      dependency.remove_from_project
    end
  target = project.targets.find { |existing| existing.name == name }
  next unless target

  target.build_phases.each(&:remove_from_project)
  target.build_configurations.each(&:remove_from_project)
  target.build_configuration_list.remove_from_project
  target.product_reference&.remove_from_project
  target.remove_from_project
end

embed = app_target.copy_files_build_phases.find { |phase| phase.name == 'Embed App Extensions' }
embed&.remove_from_project

extension_names.each do |name|
  group = project.main_group.children.find { |child| child.display_name == name }
  group&.recursive_children&.each(&:remove_from_project)
  group&.remove_from_project
end

project.objects.grep(Xcodeproj::Project::Object::XCBuildConfiguration).each do |configuration|
  bundle_id = configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER']&.delete('"')
  configuration.remove_from_project if extension_bundle_ids.include?(bundle_id)
end

project.save
puts 'Configured Still Shortcuts App Intent without Screen Time extension targets.'

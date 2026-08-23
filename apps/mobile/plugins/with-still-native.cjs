const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

module.exports = function withStillNative(config) {
  config = withInfoPlist(config, (result) => {
    result.modResults.NSFamilyControlsUsageDescription =
      "Still uses Screen Time only to pause apps you choose. Your selection stays on this device.";
    return result;
  });

  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.queries = manifest.queries ?? [];
    manifest.queries.push({ intent: [{ action: [{ $: { "android:name": "android.intent.action.MAIN" } }], category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }] }] });
    return result;
  });
};

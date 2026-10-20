const { withXcodeProject } = require('expo/config-plugins');

// Xcode can compile an old Pods project while Metro bundles newly added native
// imports. Stop that archive before it becomes a broken TestFlight release.
module.exports = function withIOSNativeCheck(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const name = 'Check Bookez native modules';
    const target = project.getFirstTarget();
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    if (!Object.values(phases).some((phase) => typeof phase === 'object' && phase.name === `"${name}"`)) {
      const phase = project.addBuildPhase([], 'PBXShellScriptBuildPhase', name, target.uuid, {
        shellPath: '/bin/sh',
        shellScript: [
          'set -e',
          'if [ -f "$SRCROOT/.xcode.env" ]; then . "$SRCROOT/.xcode.env"; fi',
          'if [ -f "$SRCROOT/.xcode.env.local" ]; then . "$SRCROOT/.xcode.env.local"; fi',
          '"${NODE_BINARY:-node}" "$SRCROOT/../scripts/check-ios-native-modules.mjs"',
        ].join('\\n'),
      });
      const references = target.firstTarget.buildPhases;
      const index = references.findIndex((reference) => reference.value === phase.uuid);
      // Run after CocoaPods' manifest check and before compiling/bundling.
      references.splice(1, 0, references.splice(index, 1)[0]);
    }
    return config;
  });
};

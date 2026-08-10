const { withFinalizedMod } = require('expo/config-plugins');
const plist = require('@expo/plist').default;
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withLocalBadgeOnly(config) {
  return withFinalizedMod(config, [
    'ios',
    async (configured) => {
      const projectName = configured.modRequest.projectName;
      const entitlementPath = path.join(
        configured.modRequest.platformProjectRoot,
        projectName,
        `${projectName}.entitlements`,
      );
      if (!fs.existsSync(entitlementPath)) return configured;
      const entitlements = plist.parse(fs.readFileSync(entitlementPath, 'utf8'));
      delete entitlements['aps-environment'];
      fs.writeFileSync(entitlementPath, plist.build(entitlements));
      return configured;
    },
  ]);
};

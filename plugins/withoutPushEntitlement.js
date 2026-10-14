const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * The app only uses local notifications. expo-notifications adds the push (APNs)
 * entitlement, which unsigned / sideloaded builds (SideStore) cannot always provide:
 * remove it. Must be listed before "expo-notifications" in app.json so it runs after it.
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};

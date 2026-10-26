/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'RealQuickWidgets',
  displayName: 'Real Quick',
  deploymentTarget: '17.0',
  colors: {
    $accent: '#2B2350',
    $widgetBackground: '#FFF8F0',
    ink: '#2B2350',
    blush: '#FF9EB5',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});

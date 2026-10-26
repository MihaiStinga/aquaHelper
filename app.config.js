// Extends app.json with values that come from CI: the release tag sets the
// version name, the workflow run number sets Android's versionCode (it must
// grow with every release for updates to install cleanly).
module.exports = ({ config }) => ({
  ...config,
  version: process.env.APP_VERSION?.replace(/^v/, '') || config.version,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE || 1),
  },
});

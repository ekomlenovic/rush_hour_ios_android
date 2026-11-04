const { AndroidConfig, withAndroidManifest, withStringsXml } = require('expo/config-plugins');

const APP_ID_KEY = 'com.google.android.gms.games.APP_ID';
const STRING_NAME = 'game_services_project_id';

/**
 * Play Games Services (issue 320, synchro automatique de la progression): the project id of the game
 * in the Play Console (Play Jeux → Configuration), as the `projectId` option or the
 * PLAY_GAMES_PROJECT_ID environment variable of the build. Without it nothing is added and the app
 * never contacts Play Games (modules/rush-play-games: isAvailable is false).
 *
 * The id is a number: written as a string resource, as Play Games asks (a number in the manifest
 * would be read as an integer).
 */
module.exports = function withPlayGames(config, options = {}) {
  const projectId = String(options.projectId ?? process.env.PLAY_GAMES_PROJECT_ID ?? '').trim();
  if (!/^\d+$/.test(projectId)) return config;

  config = withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: STRING_NAME, translatable: 'false' }, _: projectId }],
      config.modResults,
    );
    return config;
  });

  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, APP_ID_KEY, `@string/${STRING_NAME}`);
    return config;
  });
};

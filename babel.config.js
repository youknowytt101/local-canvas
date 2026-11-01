module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo adds react-native-worklets/plugin (Reanimated 4) by itself
    presets: ['babel-preset-expo'],
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
  };
};

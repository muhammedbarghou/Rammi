const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// @colyseus/sdk falls back to the Node `ws` package only when there is no global WebSocket. React Native has one.
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) =>
  name === "ws" ? { type: "empty" } : (resolve ?? context.resolveRequest)(context, name, platform);

module.exports = config;

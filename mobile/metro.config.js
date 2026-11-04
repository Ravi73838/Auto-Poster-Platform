const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable resolving .js imports to .ts/.tsx files (TS NodeNext style imports)
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const baseName = moduleName.slice(0, -3);
    try {
      return (defaultResolveRequest || context.resolveRequest)(context, baseName, platform);
    } catch {
      // fallback
    }
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

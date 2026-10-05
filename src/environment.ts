import packageJson from '../package.json' with { type: 'json' };
import { buildInfo } from './generated/build-info.js';

export const env = {
  app: {
    name: packageJson.name,
    displayName: packageJson.displayName,
    version: packageJson.version,
    addonId: packageJson.addonId,
  },

  external: {
    githubRef: buildInfo.githubRef,
    assetsURL: buildInfo.assetsURL
  },

  runtime: process.env.NODE_ENV,
} as const;
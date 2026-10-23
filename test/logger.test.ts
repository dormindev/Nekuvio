import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


/*
 * logger.ts reads process.env.LOG_LEVEL once at module-eval time, so each
 * scenario re-imports a fresh module instance with the desired level.
 */
async function loadLogger(level?: string) {
  vi.resetModules();

  if (level === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = level;
  }

  return import('../src/utils/logger.js');
}

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it('emits all levels when LOG_LEVEL is debug', async () => {
    const { logger } = await loadLogger('debug');

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(console.debug).toHaveBeenCalledWith('[DEBUG]', 'd');
    expect(console.info).toHaveBeenCalledWith('[INFO]', 'i');
    expect(console.warn).toHaveBeenCalledWith('[WARN]', 'w');
    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'e');
  });

  it('suppresses levels below error when LOG_LEVEL is error', async () => {
    const { logger } = await loadLogger('error');

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'e');
  });

  it('suppresses every level, including error, when LOG_LEVEL is off', async () => {
    const { logger } = await loadLogger('off');

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('falls back to info for an unrecognised LOG_LEVEL', async () => {
    const { logger } = await loadLogger('not-a-level');

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith('[INFO]', 'i');
    expect(console.warn).toHaveBeenCalledWith('[WARN]', 'w');
    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'e');
  });

  it('defaults to info when LOG_LEVEL is unset', async () => {
    const { logger } = await loadLogger(undefined);

    logger.debug('d');
    logger.info('i');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith('[INFO]', 'i');
  });
});

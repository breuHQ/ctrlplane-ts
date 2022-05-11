import { getContext } from './interceptors';

export async function createEnvironment() {
  const { logger } = getContext();
  logger.info('Starting Test Environment');
  return;
}

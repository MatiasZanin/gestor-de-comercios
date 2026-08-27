import type { ScheduledHandler } from 'aws-lambda';
import { cleanupExpiredRegistrations } from '../services/registrationUseCase';

export const handler: ScheduledHandler = async () => {
  const result = await cleanupExpiredRegistrations();
  console.info('Expired registration cleanup completed', result);
};

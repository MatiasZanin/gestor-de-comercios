export type TransactionalEmailTemplate = 'WELCOME' | 'TRIAL_ACTIVATED';
export type TransactionalEmailStatus = 'pending' | 'queued' | 'sent' | 'failed';

export interface TransactionalEmailRecord {
  PK: string;
  SK: 'NOTIFICATION';
  type: 'TRANSACTIONAL_EMAIL';
  notificationId: string;
  template: TransactionalEmailTemplate;
  status: TransactionalEmailStatus;
  to: string;
  firstName: string;
  merchantName: string;
  subscriptionUrl?: string;
  appUrl: string;
  logoUrl: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionalEmailMessage {
  notificationId: string;
  recordKey: { PK: string; SK: 'NOTIFICATION' };
}

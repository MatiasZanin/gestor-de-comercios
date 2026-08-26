import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { TransactionalEmailMessage } from '../models/transactionalEmail';
import { deliverTransactionalEmail } from '../services/transactionalEmail';

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  await Promise.all(
    event.Records.map(async record => {
      try {
        await deliverTransactionalEmail(
          JSON.parse(record.body) as TransactionalEmailMessage
        );
      } catch (error) {
        console.error('Transactional email delivery failed', {
          messageId: record.messageId,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : 'unknown',
        });
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    })
  );
  return { batchItemFailures };
}

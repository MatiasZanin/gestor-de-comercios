import type { DynamoDBStreamEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { TransactionalEmailRecord } from '../models/transactionalEmail';
import { enqueueTransactionalEmail } from '../services/transactionalEmail';

function emailFrom(
  record: DynamoDBStreamEvent['Records'][number]
): TransactionalEmailRecord | null {
  const image = record.dynamodb?.NewImage;
  if (!image) return null;
  const item = unmarshall(
    image as Parameters<typeof unmarshall>[0]
  ) as TransactionalEmailRecord;
  if (item.type !== 'TRANSACTIONAL_EMAIL' || item.status !== 'pending')
    return null;
  return item;
}

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  for (const streamRecord of event.Records) {
    const email = emailFrom(streamRecord);
    if (!email) continue;
    await enqueueTransactionalEmail(email);
    console.info('Transactional email published', {
      notificationId: email.notificationId,
      template: email.template,
    });
  }
}

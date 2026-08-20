import type { DynamoDBStreamEvent } from "aws-lambda"
import { unmarshall } from "@aws-sdk/util-dynamodb"
import type { BillingCancellationRecord } from "../models/billing"
import { enqueueCancellationFeedback } from "../services/cancellationFeedback"

function cancellationFrom(record: DynamoDBStreamEvent["Records"][number]): BillingCancellationRecord | null {
  const image = record.dynamodb?.NewImage
  if (!image) return null
  const item = unmarshall(image as Parameters<typeof unmarshall>[0]) as BillingCancellationRecord
  if (
    item.type !== "BILLING_CANCELLATION" ||
    item.status !== "completed" ||
    item.notificationStatus !== "pending"
  ) {
    return null
  }
  return item
}

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  for (const streamRecord of event.Records) {
    const cancellation = cancellationFrom(streamRecord)
    if (!cancellation) continue
    await enqueueCancellationFeedback(cancellation)
    console.info("Cancellation feedback published", {
      commerceId: cancellation.commerceId,
      cancellationId: cancellation.cancellationId,
    })
  }
}

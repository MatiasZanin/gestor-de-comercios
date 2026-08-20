import type { SQSBatchResponse, SQSEvent } from "aws-lambda"
import type { CancellationFeedbackMessage } from "../models/billing"
import { deliverCancellationFeedback } from "../services/cancellationFeedback"

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = []
  await Promise.all(
    event.Records.map(async record => {
      try {
        const message = JSON.parse(record.body) as CancellationFeedbackMessage
        await deliverCancellationFeedback(message)
      } catch (error) {
        console.error("Cancellation feedback delivery failed", {
          messageId: record.messageId,
          error: error instanceof Error ? { name: error.name, message: error.message } : "unknown",
        })
        batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }),
  )
  return { batchItemFailures }
}

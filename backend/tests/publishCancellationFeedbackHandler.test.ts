const enqueueCancellationFeedback = jest.fn()

jest.mock("../src/services/cancellationFeedback", () => ({ enqueueCancellationFeedback }))

import type { DynamoDBStreamEvent } from "aws-lambda"
import { handler } from "../src/handlers/publishCancellationFeedback"

function streamEvent(notificationStatus: "pending" | "queued" | "sent" | "failed"): DynamoDBStreamEvent {
  return {
    Records: [
      {
        eventID: "event-1",
        eventName: "MODIFY",
        eventVersion: "1.1",
        eventSource: "aws:dynamodb",
        awsRegion: "us-east-1",
        eventSourceARN: "arn:stream",
        dynamodb: {
          StreamViewType: "NEW_AND_OLD_IMAGES",
          NewImage: {
            PK: { S: "COM#commerce-1" },
            SK: { S: "BILLING#CANCELLATION#hash" },
            type: { S: "BILLING_CANCELLATION" },
            commerceId: { S: "commerce-1" },
            cancellationId: { S: "cancel-1" },
            idempotencyKeyHash: { S: "hash" },
            status: { S: "completed" },
            notificationStatus: { S: notificationStatus },
            subscriptionId: { S: "subscription-1" },
            merchantName: { S: "Mi comercio" },
            ownerEmail: { S: "owner@example.com" },
            reason: { S: "No lo necesito" },
            createdAt: { S: "2026-08-20T12:00:00.000Z" },
            updatedAt: { S: "2026-08-20T12:00:00.000Z" },
            ttl: { N: "1800000000" },
          },
          SequenceNumber: "1",
          SizeBytes: 1,
        },
      },
    ],
  }
}

describe("publish cancellation feedback handler", () => {
  beforeEach(() => jest.clearAllMocks())

  it("publishes a durable pending outbox record", async () => {
    enqueueCancellationFeedback.mockResolvedValue("queued")
    await handler(streamEvent("pending"))
    expect(enqueueCancellationFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ cancellationId: "cancel-1", reason: "No lo necesito" }),
    )
  })

  it.each(["queued", "sent", "failed"] as const)("ignores %s delivery records to avoid stream loops", async status => {
    await handler(streamEvent(status))
    expect(enqueueCancellationFeedback).not.toHaveBeenCalled()
  })

  it("lets publication failures retry through the stream event source", async () => {
    enqueueCancellationFeedback.mockRejectedValue(new Error("SQS unavailable"))
    await expect(handler(streamEvent("pending"))).rejects.toThrow("SQS unavailable")
  })
})

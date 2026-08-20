import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { SendMessageCommand } from "@aws-sdk/client-sqs"
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import type { BillingCancellationRecord } from "../src/models/billing"

const mockSqsSend = jest.fn()
const mockSesSend = jest.fn()
const mockDynamoSend = jest.fn()

jest.mock("@aws-sdk/client-sqs", () => {
  const actual = jest.requireActual("@aws-sdk/client-sqs")
  return { ...actual, SQSClient: jest.fn(() => ({ send: mockSqsSend })) }
})

jest.mock("@aws-sdk/client-sesv2", () => {
  const actual = jest.requireActual("@aws-sdk/client-sesv2")
  return { ...actual, SESv2Client: jest.fn(() => ({ send: mockSesSend })) }
})

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb")
  return {
    ...actual,
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDynamoSend })) },
  }
})

import { deliverCancellationFeedback, enqueueCancellationFeedback } from "../src/services/cancellationFeedback"

const record: BillingCancellationRecord = {
  PK: "COM#commerce-1",
  SK: "BILLING#CANCELLATION#hash",
  type: "BILLING_CANCELLATION",
  commerceId: "commerce-1",
  cancellationId: "cancel-1",
  idempotencyKeyHash: "hash",
  status: "completed",
  notificationStatus: "pending",
  subscriptionId: "preapproval-1",
  merchantName: "Comercio Uno",
  ownerEmail: "owner@example.com",
  actorEmail: "actor@example.com",
  billingPayerEmail: "payer@example.com",
  reason: "Ya no lo necesito",
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
  cancelledAt: "2026-08-20T12:00:00.000Z",
  ttl: 1_800_000_000,
}

describe("cancellation feedback outbox", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TABLE_NAME = "table"
    process.env.CANCELLATION_FEEDBACK_QUEUE_URL = "https://sqs.test/cancellations.fifo"
    process.env.CANCELLATION_EMAIL_FROM = "clientes@gestionystock.com"
    process.env.CANCELLATION_EMAIL_TO = "clientes@gestionystock.com"
  })

  it("publishes one deterministic FIFO message and marks the outbox queued", async () => {
    mockSqsSend.mockResolvedValue({ MessageId: "message-1" })
    mockDynamoSend.mockResolvedValue({})

    await expect(enqueueCancellationFeedback(record)).resolves.toBe("queued")

    const message = mockSqsSend.mock.calls[0][0]
    expect(message).toBeInstanceOf(SendMessageCommand)
    expect(message.input).toMatchObject({
      MessageGroupId: "commerce-1",
      MessageDeduplicationId: "cancel-1",
    })
    expect(mockDynamoSend.mock.calls[0][0]).toBeInstanceOf(UpdateCommand)
  })

  it("delivers the plain-text email and records success", async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: record }).mockResolvedValueOnce({})
    mockSesSend.mockResolvedValue({ MessageId: "ses-1" })

    await deliverCancellationFeedback({
      cancellationId: record.cancellationId,
      commerceId: record.commerceId,
      recordKey: { PK: record.PK, SK: record.SK },
    })

    expect(mockDynamoSend.mock.calls[0][0]).toBeInstanceOf(GetCommand)
    const email = mockSesSend.mock.calls[0][0]
    expect(email).toBeInstanceOf(SendEmailCommand)
    expect(email.input.Content.Simple.Body.Text.Data).toContain("Motivo:\nYa no lo necesito")
    expect(email.input.Content.Simple.Body.Text.Data).toContain("preapproval-1")
    expect(mockDynamoSend.mock.calls[1][0].input.ExpressionAttributeValues).toMatchObject({
      ":sent": "sent",
    })
  })

  it("does not send a duplicate after the outbox is marked sent", async () => {
    mockDynamoSend.mockResolvedValueOnce({
      Item: { ...record, notificationStatus: "sent" },
    })

    await deliverCancellationFeedback({
      cancellationId: record.cancellationId,
      commerceId: record.commerceId,
      recordKey: { PK: record.PK, SK: record.SK },
    })

    expect(mockSesSend).not.toHaveBeenCalled()
  })

  it("marks failures so SQS can retry and eventually route to the DLQ", async () => {
    mockDynamoSend.mockResolvedValueOnce({ Item: record }).mockResolvedValueOnce({})
    mockSesSend.mockRejectedValue(new Error("SES unavailable"))

    await expect(
      deliverCancellationFeedback({
        cancellationId: record.cancellationId,
        commerceId: record.commerceId,
        recordKey: { PK: record.PK, SK: record.SK },
      }),
    ).rejects.toThrow("SES unavailable")

    expect(mockDynamoSend.mock.calls[1][0].input.ExpressionAttributeValues).toMatchObject({
      ":failed": "failed",
    })
  })
})

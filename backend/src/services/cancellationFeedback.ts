import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import type { BillingCancellationRecord, CancellationFeedbackMessage } from "../models/billing"

const sqs = new SQSClient({})
const ses = new SESv2Client({})
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function enqueueCancellationFeedback(record: BillingCancellationRecord): Promise<"queued"> {
  const message: CancellationFeedbackMessage = {
    cancellationId: record.cancellationId,
    commerceId: record.commerceId,
    recordKey: { PK: record.PK, SK: record.SK },
  }
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: env("CANCELLATION_FEEDBACK_QUEUE_URL"),
      MessageBody: JSON.stringify(message),
      MessageGroupId: record.commerceId,
      MessageDeduplicationId: record.cancellationId,
    }),
  )
  await documentClient.send(
    new UpdateCommand({
      TableName: env("TABLE_NAME"),
      Key: { PK: record.PK, SK: record.SK },
      UpdateExpression: "SET notificationStatus = :queued, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":queued": "queued",
        ":updatedAt": new Date().toISOString(),
      },
    }),
  )
  return "queued"
}

function feedbackText(record: BillingCancellationRecord): string {
  return [
    "Se canceló una suscripción desde Gestión & Stock.",
    "",
    `Comercio: ${record.merchantName || "No disponible"}`,
    `ID del comercio: ${record.commerceId}`,
    `Email del propietario: ${record.ownerEmail || "No disponible"}`,
    `Email del usuario: ${record.actorEmail || "No disponible"}`,
    `Email de Mercado Pago: ${record.billingPayerEmail || "No disponible"}`,
    `ID de la suscripción: ${record.subscriptionId}`,
    `Fecha: ${record.cancelledAt || record.updatedAt}`,
    "",
    "Motivo:",
    record.reason,
  ].join("\n")
}

export async function deliverCancellationFeedback(message: CancellationFeedbackMessage): Promise<void> {
  const result = await documentClient.send(
    new GetCommand({
      TableName: env("TABLE_NAME"),
      Key: message.recordKey,
      ConsistentRead: true,
    }),
  )
  const record = result.Item as BillingCancellationRecord | undefined
  if (!record || record.type !== "BILLING_CANCELLATION" || record.status !== "completed") return
  if (record.notificationStatus === "sent") return

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: env("CANCELLATION_EMAIL_FROM"),
        Destination: { ToAddresses: [env("CANCELLATION_EMAIL_TO")] },
        Content: {
          Simple: {
            Subject: {
              Data: `Motivo de baja — ${record.merchantName || record.commerceId}`,
              Charset: "UTF-8",
            },
            Body: { Text: { Data: feedbackText(record), Charset: "UTF-8" } },
          },
        },
      }),
    )
    await documentClient.send(
      new UpdateCommand({
        TableName: env("TABLE_NAME"),
        Key: message.recordKey,
        UpdateExpression: "SET notificationStatus = :sent, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":sent": "sent",
          ":updatedAt": new Date().toISOString(),
        },
      }),
    )
  } catch (error) {
    await documentClient
      .send(
        new UpdateCommand({
          TableName: env("TABLE_NAME"),
          Key: message.recordKey,
          UpdateExpression: "SET notificationStatus = :failed, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":failed": "failed",
            ":updatedAt": new Date().toISOString(),
          },
        }),
      )
      .catch(() => undefined)
    throw error
  }
}

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { BadRequestError, buildErrorResponse, ForbiddenError } from "../helpers/errors"
import { formatJSONResponse } from "../utils/api-response"
import { validateMercadoPagoWebhookSignature } from "../helpers/mercadoPagoWebhook"
import { processMercadoPagoWebhook } from "../services/billingUseCase"

function parseBody(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    throw new BadRequestError("Missing body")
  }

  try {
    return JSON.parse(event.body) as {
      id?: string
      action?: string
      topic?: string
      type?: string
      data?: { id?: string | number }
    }
  } catch {
    throw new BadRequestError("Invalid JSON body")
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
    if (!secret) {
      throw new Error("MERCADO_PAGO_WEBHOOK_SECRET is required")
    }

    const signature = event.headers?.["x-signature"] || event.headers?.["X-Signature"]
    const requestId = event.headers?.["x-request-id"] || event.headers?.["X-Request-Id"]
    if (!signature || !requestId) {
      throw new ForbiddenError("Missing Mercado Pago webhook headers")
    }

    const body = parseBody(event)
    const dataId = body.data?.id !== undefined ? String(body.data.id) : undefined
    validateMercadoPagoWebhookSignature({
      signature,
      requestId,
      dataId,
      secret,
    })

    const result = await processMercadoPagoWebhook({
      eventId: body.id ?? requestId,
      requestId,
      eventType: body.type ?? body.topic ?? body.action ?? "unknown",
      dataId,
      topic: body.topic ?? body.type ?? undefined,
      action: body.action,
    })

    return formatJSONResponse(result)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda"
import { BadRequestError, buildErrorResponse } from "../helpers/errors"
import { assertCommerceOwner } from "../helpers/assertCommerceOwner"
import { createBillingSubscription } from "../services/billingUseCase"
import { formatJSONResponse } from "../utils/api-response"

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  try {
    const commerceId = event.pathParameters?.commerceId
    if (!commerceId || !event.body) throw new BadRequestError("Missing commerceId or body")
    await assertCommerceOwner(event, commerceId)
    const body = JSON.parse(event.body) as { payerEmail?: unknown }
    if (typeof body.payerEmail !== "string") throw new BadRequestError("Missing payerEmail")
    const idempotencyKey = event.headers?.["idempotency-key"] ?? event.headers?.["Idempotency-Key"]
    if (!idempotencyKey) throw new BadRequestError("Missing Idempotency-Key")
    return formatJSONResponse(await createBillingSubscription(commerceId, body.payerEmail, idempotencyKey), 201)
  } catch (error) {
    return buildErrorResponse(error)
  }
}

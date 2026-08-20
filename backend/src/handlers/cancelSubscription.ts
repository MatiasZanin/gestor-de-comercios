import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda"
import { BadRequestError, buildErrorResponse } from "../helpers/errors"
import { assertCommerceOwner, authenticatedEmail, authenticatedSubject } from "../helpers/assertCommerceOwner"
import { formatJSONResponse } from "../utils/api-response"
import { cancelBilling } from "../services/billingUseCase"

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  try {
    const commerceId = event.pathParameters?.commerceId
    if (!commerceId || !event.body) throw new BadRequestError("Missing commerceId or body")

    await assertCommerceOwner(event, commerceId)
    const body = JSON.parse(event.body) as { reason?: unknown }
    if (typeof body.reason !== "string") throw new BadRequestError("Missing cancellation reason")
    const idempotencyKey = event.headers?.["idempotency-key"] ?? event.headers?.["Idempotency-Key"]
    if (!idempotencyKey) throw new BadRequestError("Missing Idempotency-Key")

    const result = await cancelBilling({
      commerceId,
      reason: body.reason,
      idempotencyKey,
      actorSub: authenticatedSubject(event),
      actorEmail: authenticatedEmail(event),
    })
    return formatJSONResponse(result)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

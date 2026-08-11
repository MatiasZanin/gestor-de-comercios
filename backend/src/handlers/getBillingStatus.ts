import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda"
import { BadRequestError, buildErrorResponse, NotFoundError } from "../helpers/errors"
import { assertCommerceAccess } from "../helpers/assertCommerceAccess"
import { formatJSONResponse } from "../utils/api-response"
import { getProtectedBillingStatus } from "../services/billingUseCase"

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const commerceId = event.pathParameters?.commerceId
    if (!commerceId) {
      throw new BadRequestError("Missing commerceId")
    }

    assertCommerceAccess(event, commerceId)

    const status = await getProtectedBillingStatus(commerceId)
    if (!status) {
      throw new NotFoundError("Billing profile not found")
    }

    return formatJSONResponse(status)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

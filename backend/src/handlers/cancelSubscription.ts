import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda"
import { BadRequestError, buildErrorResponse } from "../helpers/errors"
import { assertCommerceAccess } from "../helpers/assertCommerceAccess"
import { formatJSONResponse } from "../utils/api-response"
import { cancelBilling } from "../services/billingUseCase"

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const commerceId = event.pathParameters?.commerceId
    if (!commerceId) {
      throw new BadRequestError("Missing commerceId")
    }

    assertCommerceAccess(event, commerceId)

    const result = await cancelBilling(commerceId)
    return formatJSONResponse(result)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

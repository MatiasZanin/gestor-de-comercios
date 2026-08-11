import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { BadRequestError, buildErrorResponse } from "../helpers/errors"
import { formatJSONResponse } from "../utils/api-response"
import { getRegistrationStatus } from "../services/billingUseCase"

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const registrationId = event.pathParameters?.registrationId
    if (!registrationId) {
      throw new BadRequestError("Missing registrationId")
    }

    const status = await getRegistrationStatus(registrationId)
    return formatJSONResponse(status)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

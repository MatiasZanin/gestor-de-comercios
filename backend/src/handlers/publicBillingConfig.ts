import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { buildErrorResponse } from "../helpers/errors"
import { formatJSONResponse } from "../utils/api-response"
import { getPublicBillingConfig } from "../services/billingUseCase"

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const config = await getPublicBillingConfig(event.queryStringParameters?.promo)
    return formatJSONResponse(config)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

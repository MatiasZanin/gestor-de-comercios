import type { APIGatewayProxyResultV2 } from "aws-lambda"
import { buildErrorResponse } from "../helpers/errors"
import { formatJSONResponse } from "../utils/api-response"
import { getPublicBillingConfig } from "../services/billingUseCase"

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
  try {
    const config = await getPublicBillingConfig()
    return formatJSONResponse(config)
  } catch (err) {
    return buildErrorResponse(err)
  }
}

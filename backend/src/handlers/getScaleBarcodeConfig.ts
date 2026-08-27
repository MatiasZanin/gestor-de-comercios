import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda"
import { assertCommerceAccess } from "../helpers/assertCommerceAccess"
import { assertRole } from "../helpers/assertRole"
import { BadRequestError, NotFoundError, buildErrorResponse } from "../helpers/errors"
import type { CommerceProfile } from "../models/commerce"
import { formatJSONResponse } from "../utils/api-response"

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME
    if (!tableName) throw new Error("TABLE_NAME env var is required")

    const commerceId = event.pathParameters?.commerceId
    if (!commerceId) throw new BadRequestError("Missing commerceId")

    await assertCommerceAccess(event, commerceId, { requireSubscription: false })
    assertRole(event, "admin", "vendedor")

    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { PK: `COM#${commerceId}`, SK: "PROFILE" },
      ProjectionExpression: "scaleBarcodeConfig",
    }))
    const profile = result.Item as Pick<CommerceProfile, "scaleBarcodeConfig"> | undefined
    if (!profile?.scaleBarcodeConfig) {
      throw new NotFoundError("Scale barcode config not found")
    }

    return formatJSONResponse({ scaleBarcodeConfig: profile.scaleBarcodeConfig })
  } catch (error) {
    return buildErrorResponse(error)
  }
}

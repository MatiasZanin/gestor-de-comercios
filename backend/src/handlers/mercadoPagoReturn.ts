import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda"
import { billingConfig } from "../config/billing"
import { reconcileBillingFromMercadoPagoReturn } from "../services/billingUseCase"

function frontendReturnUrl(preapprovalId?: string) {
  const target = new URL(billingConfig.publicRegistrationPath, billingConfig.frontendBaseUrl)
  target.searchParams.set("mercadopago_return", "1")
  if (preapprovalId) target.searchParams.set("preapproval_id", preapprovalId)
  return target.toString()
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const preapprovalId = event.queryStringParameters?.preapproval_id

  if (preapprovalId) {
    try {
      await reconcileBillingFromMercadoPagoReturn(preapprovalId)
    } catch (error) {
      // The frontend status read retries reconciliation. Returning the customer
      // to the application must not be blocked by a temporary Mercado Pago error.
      console.warn("Mercado Pago return reconciliation failed", {
        preapprovalId,
        error: error instanceof Error ? { name: error.name, message: error.message } : "unknown",
      })
    }
  }

  return {
    statusCode: 302,
    headers: {
      "Cache-Control": "no-store",
      Location: frontendReturnUrl(preapprovalId),
    },
  }
}

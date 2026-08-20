import type { SQSEvent } from "aws-lambda"
import { handler } from "../src/handlers/sendCancellationFeedback"
import { deliverCancellationFeedback } from "../src/services/cancellationFeedback"

jest.mock("../src/services/cancellationFeedback", () => ({
  deliverCancellationFeedback: jest.fn(),
}))
const deliver = jest.mocked(deliverCancellationFeedback)

function sqsEvent(): SQSEvent {
  return {
    Records: [
      {
        messageId: "message-1",
        body: JSON.stringify({
          cancellationId: "cancel-1",
          commerceId: "commerce-1",
          recordKey: { PK: "COM#commerce-1", SK: "BILLING#CANCELLATION#1" },
        }),
      },
    ],
  } as SQSEvent
}

describe("cancellation feedback worker", () => {
  it("acknowledges successful deliveries", async () => {
    deliver.mockResolvedValueOnce(undefined)
    await expect(handler(sqsEvent())).resolves.toEqual({
      batchItemFailures: [],
    })
  })

  it("asks SQS to retry failed deliveries", async () => {
    deliver.mockRejectedValueOnce(new Error("SES unavailable"))
    await expect(handler(sqsEvent())).resolves.toEqual({
      batchItemFailures: [{ itemIdentifier: "message-1" }],
    })
  })
})

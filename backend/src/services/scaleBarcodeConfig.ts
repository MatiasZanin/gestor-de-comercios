import { BadRequestError } from "../helpers/errors"
import type { ScaleBarcodeConfig } from "../models/commerce"

function assertExactKeys(value: Record<string, unknown>, allowedKeys: string[]): void {
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.includes(key))
  if (unknownKey) {
    throw new BadRequestError(`Unknown scale barcode config field: ${unknownKey}`)
  }
}

export function parseScaleBarcodeConfig(value: unknown): ScaleBarcodeConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("scaleBarcodeConfig must be an object")
  }

  const config = value as Record<string, unknown>
  if (!Number.isInteger(config.decimals) || (config.decimals as number) < 0 || (config.decimals as number) > 5) {
    throw new BadRequestError("decimals must be an integer between 0 and 5")
  }

  if (config.valueType === "weight") {
    assertExactKeys(config, ["valueType", "unit", "decimals"])
    if (config.unit !== "kg" && config.unit !== "g") {
      throw new BadRequestError("unit must be kg or g for weight barcodes")
    }
    return { valueType: "weight", unit: config.unit, decimals: config.decimals as number }
  }

  if (config.valueType === "price") {
    assertExactKeys(config, ["valueType", "decimals"])
    return { valueType: "price", decimals: config.decimals as number }
  }

  throw new BadRequestError("valueType must be weight or price")
}

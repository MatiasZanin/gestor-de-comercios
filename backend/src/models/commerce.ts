export type ScaleBarcodeConfig =
  | {
      valueType: "weight"
      unit: "kg" | "g"
      decimals: number
    }
  | {
      valueType: "price"
      decimals: number
    }

export const DEFAULT_SCALE_BARCODE_CONFIG: ScaleBarcodeConfig = {
  valueType: "weight",
  unit: "kg",
  decimals: 3,
}

export interface CommerceProfile {
  PK: string
  SK: "PROFILE"
  type: "COMMERCE"
  commerceId: string
  merchantName: string
  ownerCognitoSub: string
  ownerEmail: string
  scaleBarcodeConfig: ScaleBarcodeConfig
  createdAt: string
  updatedAt: string
}

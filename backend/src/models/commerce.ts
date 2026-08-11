export interface CommerceProfile {
  PK: string
  SK: "PROFILE"
  type: "COMMERCE"
  commerceId: string
  merchantName: string
  ownerCognitoSub: string
  ownerEmail: string
  createdAt: string
  updatedAt: string
}

export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type ScopeType = 'PRODUCT' | 'CATEGORY' | 'BRAND';

export interface OfferScope {
    type: ScopeType;
    values: string[];
}

export interface Offer {
    PK: string;              // COM#<commerceId>
    SK: string;              // OFFER#<offerId>
    offerId: string;
    commerceId: string;
    name: string;
    discountType: DiscountType;
    discountValue: number;   // 0-100 for PERCENTAGE, absolute amount for FIXED
    startDate: string;       // ISO 8601
    endDate: string;         // ISO 8601
    scope: OfferScope;
    createdAt: string;
    updatedAt: string;
    createdBy: string;       // userId
}

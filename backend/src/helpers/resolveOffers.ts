import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Offer } from '../models/offer';
import { SaleItem } from '../models/sale';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface AppliedDiscount {
    discountApplied: number;  // Monto de descuento por unidad
    finalPrice: number;       // Precio final por unidad
    offerName: string;
    offerId: string;
}

/**
 * Para cada item de la venta, busca la mejor oferta activa aplicable.
 * Prioridad: PRODUCT > CATEGORY > BRAND. Si hay múltiples del mismo tipo, aplica la de mayor descuento.
 */
export async function resolveOffers(
    commerceId: string,
    items: SaleItem[],
    tableName: string
): Promise<Map<string, AppliedDiscount>> {
    const pk = `COM#${commerceId}`;
    const now = new Date().toISOString();

    // Traer todas las ofertas del comercio
    let allOffers: Offer[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const result = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':prefix': 'OFFER#',
                },
                ExclusiveStartKey: lastEvaluatedKey,
            })
        );

        allOffers = allOffers.concat((result.Items ?? []) as Offer[]);
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Filtrar solo ofertas activas en este momento exacto
    const activeOffers = allOffers.filter(
        (offer) => now >= offer.startDate && now <= offer.endDate
    );

    if (activeOffers.length === 0) {
        return new Map();
    }

    const discountMap = new Map<string, AppliedDiscount>();

    for (const item of items) {
        let bestDiscount = 0;
        let bestOffer: Offer | null = null;

        for (const offer of activeOffers) {
            let applies = false;

            switch (offer.scope.type) {
                case 'PRODUCT':
                    applies = offer.scope.values.includes(item.code);
                    break;
                case 'CATEGORY':
                    applies = !!(item as any).category && offer.scope.values.includes((item as any).category);
                    break;
                case 'BRAND':
                    applies = !!(item as any).brand && offer.scope.values.includes((item as any).brand);
                    break;
            }

            if (!applies) continue;

            // Calcular descuento unitario
            let discount = 0;
            if (offer.discountType === 'PERCENTAGE') {
                discount = (item.priceSale * offer.discountValue) / 100;
            } else {
                discount = Math.min(offer.discountValue, item.priceSale); // No puede superar el precio
            }

            if (discount > bestDiscount) {
                bestDiscount = discount;
                bestOffer = offer;
            }
        }

        if (bestOffer && bestDiscount > 0) {
            discountMap.set(item.code, {
                discountApplied: Math.round(bestDiscount * 100) / 100,
                finalPrice: Math.round((item.priceSale - bestDiscount) * 100) / 100,
                offerName: bestOffer.name,
                offerId: bestOffer.offerId,
            });
        }
    }

    return discountMap;
}

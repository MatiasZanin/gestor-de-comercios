import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Offer } from '../models/offer';
import { SaleItem } from '../models/sale';
import { resolveDiscounts as resolveDiscountsFromCatalog } from '../services/domain';

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
export function resolveOffersFromCatalog(
    offers: Offer[],
    items: SaleItem[],
    iso: string
): Map<string, AppliedDiscount> {
    return resolveDiscountsFromCatalog(offers, items, iso);
}

export async function resolveOffers(
    commerceId: string,
    items: SaleItem[],
    tableName: string,
    iso: string = new Date().toISOString()
): Promise<Map<string, AppliedDiscount>> {
    const pk = `COM#${commerceId}`;
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
    return resolveOffersFromCatalog(allOffers, items, iso);
}

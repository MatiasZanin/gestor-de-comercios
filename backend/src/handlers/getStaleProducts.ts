import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ProductItem {
    code: string;
    name: string;
    stock: number;
    lastSaleDate?: string;
}

interface DeadStockItem {
    code: string;
    name: string;
    stock: number;
    lastSaleDate: string | null;
}

interface OverstockItem {
    code: string;
    name: string;
    stock: number;
    lastSaleDate: string | null;
    monthlySales: number;
    coverageMonths: number;
}

interface StaleProductsResponse {
    deadStock: DeadStockItem[];
    overstock: OverstockItem[];
}

/**
 * Formatea una fecha restando N días.
 * Retorna formato YYYY-MM-DD
 */
function subtractDays(date: Date, days: number): string {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result.toISOString().split('T')[0];
}

/**
 * Obtiene todos los productos activos del comercio usando GSI-Productos-Activos.
 * Implementa paginación automática para obtener todos los registros.
 */
async function getActiveProducts(
    tableName: string,
    commerceId: string
): Promise<ProductItem[]> {
    const products: ProductItem[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const result = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: 'GSI-Productos-Activos',
                KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :skPrefix)', // Agregamos condición SK
                ExpressionAttributeValues: {
                    ':pk': `COM#${commerceId}`,          // Quitamos el #ACTIVE
                    ':skPrefix': 'PRODUCT#true',         // Filtramos activos por la SK que mostraste
                },
                ProjectionExpression: 'code, #name, stock, lastSaleDate',
                ExpressionAttributeNames: {
                    '#name': 'name',
                },
                ExclusiveStartKey: lastEvaluatedKey,
            })
        );

        if (result.Items) {
            products.push(...(result.Items as ProductItem[]));
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return products;
}

interface MonthlyRankingItem {
    code: string;
    monthlyUnits: number;
}

/**
 * Obtiene el ranking mensual de ventas usando GSI-Ranking-Mensual.
 * Retorna un Map de código de producto -> unidades vendidas en el mes.
 */
async function getMonthlyRanking(
    tableName: string,
    commerceId: string,
    month: string
): Promise<Map<string, number>> {
    const salesMap = new Map<string, number>();
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
        const result = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: 'GSI-Ranking-Mensual',
                KeyConditionExpression: 'statPK = :pk',
                ExpressionAttributeValues: {
                    ':pk': `COM#${commerceId}#${month}`,
                },
                ProjectionExpression: 'code, monthlyUnits',
                ExclusiveStartKey: lastEvaluatedKey,
            })
        );

        if (result.Items) {
            for (const item of result.Items as MonthlyRankingItem[]) {
                salesMap.set(item.code, item.monthlyUnits);
            }
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return salesMap;
}

/**
 * Handler para obtener productos estancados (dead stock) y sobrestock.
 * 
 * Reglas de clasificación:
 * - Dead Stock 💀: Productos sin venta (lastSaleDate null) o última venta hace más de 90 días
 * - Overstock 🐢: Productos con stock para más de 6 meses según ventas actuales
 */
export const handler = async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
    try {
        const tableName = process.env.TABLE_NAME;
        if (!tableName) {
            throw new Error('TABLE_NAME env var is required');
        }

        const commerceId = event.pathParameters?.commerceId;
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }

        // Validar acceso del usuario al comercio
        assertCommerceAccess(event, commerceId);

        const now = new Date();

        // Threshold de 90 días para "Dead Stock"
        const deadThresholdDate = subtractDays(now, 90);

        // Mes actual para obtener ranking de ventas (YYYY-MM)
        const currentMonth = now.toISOString().slice(0, 7);

        // Ejecutar ambas queries en paralelo para eficiencia
        const [products, monthlySalesMap] = await Promise.all([
            getActiveProducts(tableName, commerceId),
            getMonthlyRanking(tableName, commerceId, currentMonth),
        ]);
        console.log('AAAAAAAAAAAAAAA products', products);
        console.log('monthlySalesMap', monthlySalesMap);

        const deadStock: DeadStockItem[] = [];
        const overstock: OverstockItem[] = [];

        // Clasificar productos
        for (const product of products) {
            // Solo analizar productos con stock > 0
            if (product.stock <= 0) {
                continue;
            }

            const lastSaleDate = product.lastSaleDate || null;

            // REGLA 1: Dead Stock 💀
            // Sin fecha de venta o última venta hace más de 90 días
            if (!lastSaleDate || lastSaleDate < deadThresholdDate) {
                deadStock.push({
                    code: product.code,
                    name: product.name,
                    stock: product.stock,
                    lastSaleDate,
                });
                continue; // No evaluar overstock si ya es dead stock
            }

            // REGLA 2: Overstock / Lento 🐢
            // Calculamos cobertura en meses
            let monthlySales = monthlySalesMap.get(product.code) || 0;

            // Si no hay ventas este mes, asumimos 0.5 para evitar división por cero
            // y considerar que las ventas son muy lentas
            if (monthlySales === 0) {
                monthlySales = 0.5;
            }

            const coverageMonths = product.stock / monthlySales;

            // Si tenemos stock para más de 6 meses, es overstock
            if (coverageMonths > 6) {
                overstock.push({
                    code: product.code,
                    name: product.name,
                    stock: product.stock,
                    lastSaleDate,
                    monthlySales: monthlySalesMap.get(product.code) || 0,
                    coverageMonths: Math.round(coverageMonths * 10) / 10, // Redondear a 1 decimal
                });
            }
        }

        // Ordenar resultados para mejor legibilidad
        // Dead stock: por última venta (más antiguos primero)
        deadStock.sort((a, b) => {
            if (!a.lastSaleDate) return -1;
            if (!b.lastSaleDate) return 1;
            return a.lastSaleDate.localeCompare(b.lastSaleDate);
        });

        // Overstock: por cobertura (mayor cobertura primero)
        overstock.sort((a, b) => b.coverageMonths - a.coverageMonths);

        const response: StaleProductsResponse = {
            deadStock,
            overstock,
        };

        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };
    } catch (err) {
        return buildErrorResponse(err);
    }
};

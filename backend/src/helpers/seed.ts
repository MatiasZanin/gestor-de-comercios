import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// CONFIGURACIÓN
const TABLE_NAME = 'CommerceData-dev'; // Asegúrate de que coincida con tu tabla en AWS o local
const COMMERCE_ID = 'gs';
const REGION = 'us-east-1'; // Ajusta a tu región

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// DATOS DE PRUEBA
const PRODUCTS = [
    { code: 'FERNET', name: 'Fernet Branca 750ml', priceBuy: 8000, priceSale: 12500, stock: 100, minStock: 10, uom: 'UN' },
    { code: 'COCA', name: 'Coca-Cola 2.25L', priceBuy: 2200, priceSale: 3500, stock: 150, minStock: 20, uom: 'UN' },
    { code: 'HIELO', name: 'Bolsa de Hielo', priceBuy: 500, priceSale: 1500, stock: 50, minStock: 5, uom: 'UN' }
];

const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const NOW = new Date().toISOString();

async function main() {
    console.log(`🚀 Iniciando Seeding para COM#${COMMERCE_ID}...`);

    // 1. LIMPIEZA
    console.log('🧹 Eliminando datos existentes...');
    let itemsToDelete: any[] = [];
    let lastEvaluatedKey;

    do {
        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': `COM#${COMMERCE_ID}` }
        }));
        if (result.Items) itemsToDelete.push(...result.Items);
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const deletePromises = itemsToDelete.map(item =>
        docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: item.PK, SK: item.SK }
        }))
    );
    await Promise.all(deletePromises);
    console.log(`✅ ${itemsToDelete.length} items eliminados.`);

    // 2. CREAR PRODUCTOS
    console.log('📦 Creando productos...');
    for (const p of PRODUCTS) {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `COM#${COMMERCE_ID}`,
                SK: `PRODUCT#${p.code}`,
                commerceId: COMMERCE_ID,
                ...p,
                isActive: true,
                createdAt: NOW,
                updatedAt: NOW,
                unitsSold: 0, revenue: 0, profit: 0,
                GSI2PK: `COM#${COMMERCE_ID}`,
                GSI2SK: `PRODUCT#true#${NOW}`
            }
        }));
    }
    console.log('✅ Productos creados.');

    // 3. SIMULAR VENTAS (Con lógica de agregación)
    console.log('💰 Simulando ventas...');

    // Venta 1: Efectivo (1 Fernet + 2 Cocas)
    await createFullSale([
        { code: 'FERNET', qty: 1 },
        { code: 'COCA', qty: 2 }
    ], 'CASH', 'Venta mostrador mañana');

    // Venta 2: Tarjeta (2 Fernets)
    await createFullSale([
        { code: 'FERNET', qty: 2 }
    ], 'CARD', 'Cliente habitual');

    // Venta 3: Efectivo (2 Hielos)
    await createFullSale([
        { code: 'HIELO', qty: 2 }
    ], 'CASH', 'Solo hielo');

    console.log('✅ Ventas creadas exitosamente.');
    console.log('🏁 Seeding finalizado.');
}

// Helper para simular toda la lógica de backend
async function createFullSale(itemsShort: { code: string, qty: number }[], method: 'CASH' | 'CARD', notes: string) {
    const saleId = randomUUID();
    let total = 0;
    let profit = 0;
    const fullItems = [];

    // Calcular totales y construir items
    for (const item of itemsShort) {
        const product = PRODUCTS.find(p => p.code === item.code)!;
        const itemTotal = product.priceSale * item.qty;
        const itemProfit = (product.priceSale - product.priceBuy) * item.qty;

        total += itemTotal;
        profit += itemProfit;

        fullItems.push({
            ...item,
            name: product.name,
            priceSale: product.priceSale,
            priceBuy: product.priceBuy,
            uom: product.uom
        });

        // A. Actualizar Stock y Stats del Producto (Simplificado)
        await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: `COM#${COMMERCE_ID}`, SK: `PRODUCT#${item.code}` },
            UpdateExpression: 'ADD stock :negQty, unitsSold :qty, revenue :rev, profit :prof',
            ExpressionAttributeValues: {
                ':negQty': -item.qty,
                ':qty': item.qty,
                ':rev': itemTotal,
                ':prof': itemProfit
            }
        }));
    }

    // B. Actualizar Resumen Diario (SUMMARY) - Vital para reportes rápidos
    const methodKey = `method_${method}`;
    await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `COM#${COMMERCE_ID}`, SK: `SUMMARY#${TODAY}` },
        UpdateExpression: `ADD txCount :one, totalDay :total, ${methodKey} :total`,
        ExpressionAttributeValues: {
            ':one': 1,
            ':total': total
        }
    }));

    // C. Crear la Venta (SALE) - Vital para Arqueo de Caja
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: `COM#${COMMERCE_ID}`,
            SK: `SALE#${NOW}#${saleId}`,
            GSI1PK: `COM#${COMMERCE_ID}#${TODAY}`,
            GSI1SK: NOW,
            commerceId: COMMERCE_ID,
            saleId,
            createdAt: NOW,
            day: TODAY,
            paymentMethod: method,
            items: fullItems,
            total,
            profit,
            notes,
            ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
        }
    }));
}

main().catch(console.error);
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    BatchWriteCommand,
    QueryCommand,
    QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';

// --- CONFIGURACIÓN ---
const TABLE_NAME = process.env.TABLE_NAME || 'CommerceData-dev';
const COMMERCE_ID = 'gs';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// --- UTILIDADES ---

// DynamoDB BatchWrite tiene un límite de 25 items por request
const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );

const randomDate = (start: Date, end: Date) => {
    return new Date(
        start.getTime() + Math.random() * (end.getTime() - start.getTime())
    ).toISOString();
};

const categories = ['Bebidas', 'Almacén', 'Limpieza', 'Electrónica', 'Kiosco'];
const brands = ['Arcor', 'Coca-Cola', 'Sony', 'Samsung', 'Generico', 'Natura'];
const uoms = ['un', 'kg', 'lt', 'mt'];

// --- FUNCIONES PRINCIPALES ---

/**
 * 1. Eliminar todos los datos existentes del comercio
 */
const cleanCommerceData = async () => {
    console.log(`🧹 Buscando datos existentes para COM#${COMMERCE_ID}...`);

    let itemsToDelete: any[] = [];
    let lastEvaluatedKey: QueryCommandOutput['LastEvaluatedKey'];

    // Escanear/Query de todos los items con esa PK
    while (true) {
        const response = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': `COM#${COMMERCE_ID}`,
            },
            ExclusiveStartKey: lastEvaluatedKey,
        }));
        if (response.Items) {
            itemsToDelete.push(...response.Items);
        }
        if (!response.LastEvaluatedKey) break;
        lastEvaluatedKey = response.LastEvaluatedKey;
    }

    if (itemsToDelete.length === 0) {
        console.log('✅ No hay datos para eliminar.');
        return;
    }

    console.log(`🗑️ Eliminando ${itemsToDelete.length} items...`);

    // Convertir items a DeleteRequests
    const deleteRequests = itemsToDelete.map((item) => ({
        DeleteRequest: {
            Key: {
                PK: item.PK,
                SK: item.SK,
            },
        },
    }));

    // Ejecutar en lotes de 25
    const batches = chunkArray(deleteRequests, 25);
    for (const batch of batches) {
        await docClient.send(
            new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: batch,
                },
            })
        );
    }
    console.log('✅ Limpieza completada.');
};

/**
 * 2. Generar y sembrar productos
 */
const seedProducts = async () => {
    console.log('🌱 Generando 30 productos variados...');
    const products = [];

    for (let i = 1; i <= 30; i++) {
        const isOdd = i % 2 !== 0;

        // Variedad de Stock:
        // - Algunos negativos (error de inventario)
        // - Algunos en 0
        // - Algunos bajos (para activar alerta)
        // - Algunos altos
        let stock;
        if (i === 1) stock = -5; // Caso borde negativo
        else if (i === 2) stock = 0; // Sin stock
        else if (i <= 10) stock = Math.floor(Math.random() * 5) + 1; // Stock bajo
        else stock = Math.floor(Math.random() * 100) + 10; // Stock normal

        // MinStock: A veces definido, a veces 0
        const minStock = i % 3 === 0 ? 0 : 5; // Cada 3, no tiene alerta configurada

        // isActive: El producto 29 y 30 estarán inactivos
        const isActive = i <= 28;

        // Fechas
        const now = new Date().toISOString();
        const createdAt = randomDate(new Date(2023, 0, 1), new Date(2024, 0, 1));
        // Last sale date: A veces null (nunca vendido), a veces muy vieja, a veces hoy
        let lastSaleDate = now;
        if (i === 30) lastSaleDate = createdAt; // Nunca se vendió desde creado (simulado)
        else if (i % 5 === 0) lastSaleDate = randomDate(new Date(2023, 0, 1), new Date(2023, 6, 1)); // Vieja

        const code = `PROD-${1000 + i}`;
        const name = `Producto ${categories[i % categories.length]} ${i}`;
        const priceBuy = Math.floor(Math.random() * 500) + 100;

        // Calcular alertStatus (Lógica idéntica al handler)
        const effectiveMinStock = minStock > 0 ? minStock : 0;
        const shouldSetAlert = effectiveMinStock > 0 && stock <= effectiveMinStock;

        const item = {
            PK: `COM#${COMMERCE_ID}`,
            SK: `PRODUCT#${code}`,
            commerceId: COMMERCE_ID,
            code,
            name,
            priceBuy,
            priceSale: priceBuy * 1.5, // 50% margen
            notes: isOdd ? `Nota para el producto ${i}` : undefined,
            stock,
            unitsSold: Math.floor(Math.random() * 500),
            revenue: 0, // Simplificado
            profit: 0,  // Simplificado
            createdAt: createdAt,
            updatedAt: now,
            lastSaleDate,
            uom: uoms[i % uoms.length],
            isActive,
            qtyStep: 1,
            category: categories[i % categories.length],
            brand: brands[i % brands.length],

            // Índices Secundarios (Crítico para que funcionen los filtros)
            GSI2PK: `COM#${COMMERCE_ID}`,
            GSI2SK: `PRODUCT#${isActive ? 'true' : 'false'}#${createdAt}`, // Ordenado por fecha creación

            minStock: effectiveMinStock > 0 ? effectiveMinStock : undefined,

            // Sparse Index para alertas
            ...(shouldSetAlert && { alertStatus: 'LOW' }),
        };

        products.push({
            PutRequest: {
                Item: item,
            },
        });
    }

    // Insertar en lotes
    const batches = chunkArray(products, 25);
    let count = 0;
    for (const batch of batches) {
        await docClient.send(
            new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: batch,
                },
            })
        );
        count += batch.length;
        console.log(`   ... insertado lote de ${batch.length} productos.`);
    }

    console.log(`✅ ${count} productos insertados exitosamente.`);
};

// --- EJECUCIÓN ---
const run = async () => {
    try {
        await cleanCommerceData();
        await seedProducts();
        console.log('🚀 Seed finalizado correctamente.');
    } catch (error) {
        console.error('❌ Error ejecutando el seed:', error);
    }
};

run();
export const hasNextPage = (originalTotalItems: number | undefined, limit: number): boolean => {
    return originalTotalItems !== undefined && originalTotalItems > limit;
}

export const removeLastItem = (items: any[] | undefined, limit: number): any[] => {
    if (items && items.length > limit) {
        items.pop();
    }
    return items ?? [];
}

export const getNextCursor = (
    returnedItems: any[], // El array YA recortado a 10 elementos
    dynamoLastKey: Record<string, any> | undefined, // El cursor original del elemento 11
    originalTotal: number | undefined, // La cantidad original (ej: 11)
    limit: number // El límite original del cliente (ej: 10)
): string | undefined => {
    if (!hasNextPage(originalTotal, limit) || !dynamoLastKey || returnedItems.length === 0) {
        return undefined;
    }

    const lastValidItem = returnedItems[returnedItems.length - 1];

    const customLastKey: Record<string, any> = {};

    Object.keys(dynamoLastKey).forEach(key => {
        customLastKey[key] = lastValidItem[key];
    });

    return Buffer.from(JSON.stringify(customLastKey)).toString('base64');
}
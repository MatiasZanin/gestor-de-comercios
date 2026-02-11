import { APIGatewayProxyResult } from "aws-lambda";

export const formatJSONResponse = (
    response: Record<string, any> | Array<any>,
    statusCode: number = 200
): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            // Aquí puedes agregar otros headers globales si los necesitas en el futuro
            // 'Access-Control-Allow-Origin': '*', 
        },
        body: JSON.stringify(response),
    };
};

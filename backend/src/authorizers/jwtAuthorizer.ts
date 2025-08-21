import {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';

interface JwtPayload {
  [key: string]: any;
}

/**
 * Lambda authorizer personalizado para API Gateway HTTP. Extrae la información del rol
 * y los IDs de comercio del token JWT emitido por Cognito. Verifica que el
 * `commerceId` de la ruta esté incluido en los claims del usuario. Si no,
 * rechaza la solicitud.
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<
  APIGatewaySimpleAuthorizerWithContextResult<{
    role: string;
    commerceIds: string;
  } | null>
> => {
  try {
    const token = event.headers?.authorization || event.headers?.Authorization;
    if (!token || !token.startsWith('Bearer ')) {
      return { isAuthorized: false, context: null };
    }
    const jwt = token.substring('Bearer '.length);
    const parts = jwt.split('.');
    if (parts.length < 2) {
      return { isAuthorized: false, context: null };
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    ) as JwtPayload;
    // Determinar rol a partir de los grupos de Cognito (cognito:groups)
    let role: string | undefined;
    const groups: string[] | undefined = payload['cognito:groups'];
    if (Array.isArray(groups)) {
      if (groups.includes('admin')) {
        role = 'admin';
      } else if (groups.includes('vendedor')) {
        role = 'vendedor';
      }
    }
    // Extraer lista de comercios del atributo personalizado
    const commerceIdsString: string | undefined = payload['custom:commerceIds'];
    const commerceIds: string[] = commerceIdsString
      ? commerceIdsString.split(',')
      : [];
    // Determinar commerceId a partir de la ruta
    const path: string = event.requestContext?.http?.path || '';
    const segments = path.split('/').filter(Boolean);
    const commerceId = segments[0];
    const isAuthorized = !!role && commerceIds.includes(commerceId);
    return {
      isAuthorized,
      context: {
        role: role || '',
        commerceIds: commerceIds.join(','),
      },
    };
  } catch (err) {
    // En caso de error inesperado, rechazar
    return { isAuthorized: false, context: null };
  }
};

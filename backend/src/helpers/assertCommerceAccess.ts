import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError } from './errors';

/**
 * Verifica que el usuario autenticado tenga acceso al comercio solicitado.
 * El atributo `custom:commerceIds` de Cognito contiene los IDs de comercio
 * separados por coma a los que el usuario tiene acceso.
 *
 * @throws ForbiddenError si el usuario no tiene acceso al comercio
 */
export function assertCommerceAccess(
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
    commerceId: string
): void {
    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const commerceIdsStr = claims['custom:commerceIds'] as string | undefined;

    if (!commerceIdsStr) {
        throw new ForbiddenError('User has no commerce access configured');
    }

    const allowedCommerces = commerceIdsStr.split(',').map((id) => id.trim());

    if (!allowedCommerces.includes(commerceId)) {
        throw new ForbiddenError(`Access denied to commerce ${commerceId}`);
    }
}

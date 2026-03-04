import { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { ForbiddenError } from './errors';

export type Role = 'admin' | 'vendedor';

/**
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * El atributo `cognito:groups` del JWT contiene los grupos (roles) del usuario.
 *
 * @param event  Evento de API Gateway con autorización JWT
 * @param allowedRoles  Roles que tienen permiso para acceder al endpoint
 * @throws ForbiddenError si el usuario no tiene ninguno de los roles permitidos
 */
export function assertRole(
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
    ...allowedRoles: Role[]
): void {
    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const groups = claims['cognito:groups'];

    // cognito:groups puede venir como string o como string[] según el JWT
    let userRoles: string[];

    if (Array.isArray(groups)) {
        userRoles = groups;
    } else if (typeof groups === 'string') {
        // Puede venir como "[admin, vendedor]" o "admin"
        userRoles = groups
            .replace(/[\[\]]/g, '')
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean);
    } else {
        userRoles = [];
    }

    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
        throw new ForbiddenError(
            `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`
        );
    }
}

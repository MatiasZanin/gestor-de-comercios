# Comercio MVP

Este repositorio contiene un MVP de un sistema de stock y ventas multi‑tenant basado en AWS Lambda, API Gateway, Cognito y DynamoDB. El objetivo es permitir que distintos comercios gestionen sus productos, registren ventas (o devoluciones) y consulten reportes diarios o por rango de fechas.

## Estructura del proyecto

```
commerce-mvp/
├── sam/               # Plantilla SAM para desplegar la infraestructura
│   └── template.yaml
├── src/
│   ├── authorizers/
│   │   └── jwtAuthorizer.ts
│   ├── handlers/
│   │   ├── createProduct.ts
│   │   ├── updateProduct.ts
│   │   ├── listProducts.ts
│   │   ├── createSale.ts
│   │   ├── listSales.ts
│   │   ├── getDailyReport.ts
│   │   └── getRangeReport.ts
│   ├── helpers/
│   │   ├── sanitizeForRole.ts
│   │   ├── updateStock.ts
│   │   ├── updateDailyStats.ts
│   │   └── errors.ts
│   └── models/
│       ├── product.ts
│       └── sale.ts
├── tests/
│   └── createSale.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Tabla Dynamo

La plantilla `sam/template.yaml` crea una tabla DynamoDB denominada `CommerceData-<CommerceStage>` con clave de partición `PK` y clave de ordenamiento `SK`. Los productos se almacenan con `PK = COM#<commerceId>` y `SK = PRODUCT#<code>`, mientras que las ventas se almacenan con `SK = SALE#<ISO-date>#<saleId>`. La GSI `GSI-Ventas-Por-Día` permite consultas por día (`GSI1PK = COM#<commerceId>#YYYY-MM-DD`).

### Despliegue

1. Instale las dependencias:

   ```bash
   npm install
   ```

2. Compile el código TypeScript a JavaScript:

   ```bash
   npm run build
   ```

3. Configure un archivo `samconfig.toml` o ejecute `sam deploy --guided`. Asegúrese de exportar o definir en sus secretos:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`

   También puede definir los parámetros `CommerceStage` y `RetentionDays` al desplegar.

4. Ejecute el despliegue:

   ```bash
   cd sam
   sam build --use-container
   sam deploy --guided
   ```

### Configuración de Cognito

La plantilla crea un User Pool con un atributo personalizado `custom:commerceIds` y dos grupos (`admin` y `vendedor`). Para crear usuarios y asignarles comercios, utilice AWS CLI. Ejemplo:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <POOL_ID> \
  --username juan@example.com \
  --user-attributes Name="email",Value="juan@example.com" \
  --user-attributes Name="custom:commerceIds",Value="1,2" \
  --temporary-password "Contraseña123!"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <POOL_ID> \
  --username juan@example.com \
  --group-name admin
```

### Uso de la API

Las funciones Lambda están expuestas a través de una API HTTP. El parámetro `{commerceId}` es obligatorio en todas las rutas. Un token JWT válido emitido por Cognito debe enviarse en la cabecera `Authorization`.

Endpoints principales:

| Método y ruta                         | Descripción                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **POST /{commerceId}/products**       | Crear producto (solo admin).                                                                   |
| **PUT /{commerceId}/products/{code}** | Actualizar producto (solo admin).                                                              |
| **GET /{commerceId}/products**        | Listar productos. Admite `lastKey` para paginación.                                            |
| **POST /{commerceId}/sales**          | Registrar venta o devolución (admin o vendedor).                                               |
| **GET /{commerceId}/sales**           | Listar ventas. Acepta filtros por día (`day=YYYY-MM-DD`), rango (`start` y `end`) y `lastKey`. |
| **GET /{commerceId}/reports/daily**   | Reporte diario por comercio y día.                                                             |
| **GET /{commerceId}/reports/range**   | Reporte por rango de fechas.                                                                   |

### Testing

Se incluye un archivo de pruebas `tests/createSale.test.ts` con el esqueleto para Jest. Para ejecutar las pruebas:

```bash
npm test
```

Deberá implementar los mocks de DynamoDB y completar los casos de prueba.

### Notas

- Todas las fechas se guardan en UTC. El campo `day` se calcula como `YYYY-MM-DD` a partir de `createdAt`.
- Las devoluciones son ventas con cantidades negativas. El stock se actualiza en la misma transacción.
- Para mantener el single-responsibility, la función `sanitizeForRole` oculta campos sensibles (`priceBuy`, `profit`) cuando el usuario es un `vendedor`.
- Las ventas caducan automáticamente gracias al TTL configurado según `RetentionDays`.

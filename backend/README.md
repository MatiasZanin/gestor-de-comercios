# Comercio MVP

Este repositorio contiene un MVP de un sistema de stock y ventas multi‑tenant basado en AWS Lambda, API Gateway, Cognito y DynamoDB. El objetivo es permitir que distintos comercios gestionen sus productos, registren ventas (o devoluciones) y consulten reportes diarios o por rango de fechas.

## Estructura del proyecto

```
commerce-mvp/
├── sam/               # Plantilla SAM para desplegar la infraestructura
│   └── template.yaml
├── src/
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

La plantilla `sam/template.yaml` crea una tabla DynamoDB denominada `GestionComercios-<CommerceStage>` con clave de partición `PK` y clave de ordenamiento `SK`. Los productos se almacenan con `PK = COM#<commerceId>` y `SK = PRODUCT#<code>`, mientras que las ventas se almacenan con `SK = SALE#<ISO-date>#<saleId>`. La GSI `GSI-Ventas-Por-Día` permite consultas por día (`GSI1PK = COM#<commerceId>#YYYY-MM-DD`).

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

   `MercadoPagoAccessToken` y `MercadoPagoWebhookSecret` no se guardan en `samconfig`. Entréguelos desde el gestor de secretos del CI o como `--parameter-overrides` al desplegar.

### Registro, Cognito y billing

Desarrollo usa el User Pool V2 `gestor-comercios-dev`; el pool `commerce-mvp-dev` se conserva como legado hasta completar una migración y baja explícitas. El pool V2 usa email como alias de acceso no sensible a mayúsculas, verifica y recupera únicamente por email, no usa MFA/SMS y mantiene `phone_number` como atributo estándar opcional de Cognito. Las relaciones internas siempre se escriben con el `sub`; el email es un dato mutable.

El alta pública tiene dos fases. `POST /public/registrations` valida todos los campos, normaliza teléfono/email, crea un identificador aleatorio y guarda sólo un registro temporal indexado por hash del email. La ventana de confirmación es de 48 horas: supera la vigencia habitual de 24 horas del código de Cognito y permite retomar el flujo después de cerrar el navegador. El atributo TTL conserva el registro siete días adicionales para que la tarea horaria pueda eliminar de forma segura la identidad `UNCONFIRMED`; si encuentra una identidad ya confirmada, completa la materialización en lugar de borrarla.

Después de `ConfirmSignUp`, una transacción idempotente crea comercio, billing, perfil y relación usuario-comercio. La recuperación por email (`POST /public/registrations/recover`) y el reenvío devuelven siempre una respuesta genérica, tienen cooldown persistido en DynamoDB y no revelan si existe una cuenta. El cambio de email (`PUT /public/registrations/{registrationId}/email`) exige el identificador opaco del alta, sólo admite usuarios `UNCONFIRMED`, valida nuevamente la contraseña, actualiza el atributo sobre el mismo usuario Cognito y reenvía un OTP al email nuevo. El `username` interno y el `sub` permanecen estables; la contraseña nunca se persiste.

La arquitectura, los flujos de activación/cancelación, las reglas de conciliación y el inventario completo de registros DynamoDB están documentados en [SUSCRIPCIONES_MERCADO_PAGO.md](./SUSCRIPCIONES_MERCADO_PAGO.md).

Las altas públicas usan el email normalizado como username y confirman su propiedad mediante el código OTP de Cognito. Al crear la identidad se genera un comercio UUID, se escriben `custom:commerceIds`, `custom:accountStatus` y `custom:regId`, y el usuario se incorpora a `admin`.

El grupo define permisos, pero no habilita las operaciones de escritura. Las lecturas, exportaciones y solicitudes de soporte permanecen disponibles; las mutaciones comerciales consultan `COM#<commerceId>/BILLING#PROFILE` y responden HTTP 402 con `SUBSCRIPTION_REQUIRED` cuando corresponde. Las rutas `/{commerceId}/billing/*` también siguen disponibles cuando la cuenta está bloqueada.

Los IDs de plan se conservan para compatibilidad y conciliación de suscripciones históricas. Para nuevas altas, el backend crea un `/preapproval` individual sin plan asociado en estado `pending`, replica la frecuencia, importe y trial configurados, lo vincula al comercio mediante `external_reference`, persiste su ID y devuelve el `init_point` alojado por Mercado Pago. Esta modalidad permite que el medio de pago se elija dentro del checkout de Mercado Pago. La aplicación no solicita, recibe ni almacena tarjeta, CVV o tokens de tarjeta.

Solo el `sub` de Cognito guardado en `COM#<commerceId>/PROFILE.ownerCognitoSub` puede consultar los datos sensibles o ejecutar acciones de gestión. `GET /{commerceId}/billing/status` conserva para los demás integrantes únicamente el estado mínimo de acceso. `POST /{commerceId}/billing/subscribe` y `POST /{commerceId}/billing/cancel` requieren `Idempotency-Key`; la cancelación recibe `{ "reason": "..." }`. La elegibilidad para la prueba se decide en el backend usando los marcadores del perfil y todo el historial `SUBSCRIPTION#*`.

El medio de pago no se captura ni se almacena en esta aplicación. Su modificación se deriva al área oficial de suscripciones de Mercado Pago, evitando tarjetas, tokens y `card_token_id` en los contratos propios.

Cada baja conserva un registro operativo `BILLING_CANCELLATION` como outbox durable. Un publicador conectado al stream de DynamoDB recupera registros pendientes y envía un mensaje determinístico a una cola SQS FIFO cifrada; un worker idempotente entrega el motivo por SES y actualiza el estado `pending`, `queued`, `sent` o `failed`. La cola tiene reintentos, DLQ y alarma de CloudWatch. Para desplegar, configure `CancellationEmailFrom` con una identidad verificada en SES; `CancellationEmailTo` usa `clientes@gestionystock.com` de forma predeterminada.

El access token, ambos planes y el secret del webhook deben pertenecer a la misma aplicación y ambiente de Mercado Pago. Configure los tópicos `payment`, `subscription_preapproval` y `subscription_authorized_payment`. El `back_url` de cada plan debe apuntar a `GET /billing/mercadopago/return`: esa ruta reconcilia el `preapproval_id` y redirige a `FRONTEND_BASE_URL/BILLING_PUBLIC_REGISTRATION_PATH`. La ruta protegida `GET /{commerceId}/billing/status` vuelve a reconciliar periódicamente como respaldo. Este retorno es especialmente importante en pruebas, donde Mercado Pago no emite webhooks reales para pagos creados con credenciales de prueba.

Después de desplegar los atributos correctos puede auditar las altas existentes con `npm run reconcile-billing-users`. Para aplicar la reconciliación, agregue `-- --apply`; el comando no elimina registros ni usuarios.

### Uso de la API

Las funciones Lambda están expuestas a través de una API HTTP. El parámetro `{commerceId}` es obligatorio en todas las rutas. Un token JWT válido emitido por Cognito debe enviarse en la cabecera `Authorization`.

Endpoints principales:

| Método y ruta                                     | Descripción                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **POST /{commerceId}/products**                   | Crear producto (solo admin).                                                                   |
| **PUT /{commerceId}/products/{code}**             | Actualizar producto (solo admin).                                                              |
| **GET /{commerceId}/products**                    | Listar productos. Admite `lastKey` para paginación.                                            |
| **POST /{commerceId}/sales**                      | Registrar venta o devolución (admin o vendedor).                                               |
| **GET /{commerceId}/sales**                       | Listar ventas. Acepta filtros por día (`day=YYYY-MM-DD`), rango (`start` y `end`) y `lastKey`. |
| **GET /{commerceId}/reports/daily**               | Reporte diario por comercio y día.                                                             |
| **GET /{commerceId}/reports/range**               | Reporte por rango de fechas.                                                                   |
| **POST /public/registrations**                    | Crear el alta temporal y enviar OTP por email.                                                 |
| **POST /public/registrations/{id}/confirm-email** | Confirmar el email y crear las entidades definitivas.                                          |
| **POST /public/registrations/recover**            | Recuperar/reenviar de forma genérica un alta pendiente.                                        |
| **POST /public/registrations/confirm-email**      | Confirmar desde recuperación directa por email.                                                |
| **PUT /public/registrations/{id}/email**          | Corregir el email de un alta no confirmada.                                                    |
| **POST /{commerceId}/billing/subscribe**          | Iniciar trial o reactivación; requiere propietario e `Idempotency-Key`.                        |
| **POST /{commerceId}/billing/cancel**             | Cancelar cobros futuros con `{ reason }`; requiere propietario e `Idempotency-Key`.            |
| **GET /{commerceId}/billing/status**              | Consultar entitlement; limita los datos de gestión al propietario.                             |

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

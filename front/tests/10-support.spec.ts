import { expect, test, type Page } from "@playwright/test";

const activeAuth = {
  isAuthenticated: true,
  user: {
    username: "demo@example.com",
    email_verified: true,
    sub: "user-sub",
    email: "demo@example.com",
    "cognito:groups": ["vendedor"],
    commerceId: "commerce-uuid",
    commerceList: ["commerce-uuid"],
    accountStatus: "active",
    role: "vendedor",
  },
  token: "token",
  commerceId: "commerce-uuid",
  accountStatus: "active",
  role: "vendedor",
  isCommerceOwner: false,
};

async function setup(page: Page) {
  let payload: Record<string, unknown> | null = null;
  await page.addInitScript(
    (state) => localStorage.setItem("authState", JSON.stringify(state)),
    activeAuth,
  );
  await page.route("**/commerce-uuid/billing/status*", (route) =>
    route.fulfill({
      json: {
        commerceId: "commerce-uuid",
        merchantName: "Comercio Demo",
        status: "active",
        viewState: "active",
        canManageSubscription: false,
        trialConsumed: true,
        trialEligible: false,
      },
    }),
  );
  await page.route("**/commerce-uuid/support-requests", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { message: "Solicitud enviada", sentAt: new Date().toISOString() },
    });
  });
  return { payload: () => payload };
}

test.describe("support requests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("validates conditional fields, submits once and confirms success", async ({
    page,
  }) => {
    const request = await setup(page);
    await page.goto("/dashboard/ayuda");

    await expect(
      page.getByRole("heading", { name: "Necesito ayuda" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/5491134822010",
    );
    await expect(
      page.getByRole("link", { name: /clientes@gestionystock.com/ }),
    ).toHaveAttribute("href", "mailto:clientes@gestionystock.com");

    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(
      page.getByText("Ingresá un título de al menos 3 caracteres"),
    ).toBeVisible();
    await expect(
      page.getByText("Seleccioná un tipo de problema"),
    ).toBeVisible();

    await page.getByLabel("Título").fill("No encuentro una venta");
    await page.getByLabel("Tipo de problema").click();
    await page.getByRole("option", { name: "Ventas" }).click();
    await expect(page.getByLabel(/Número de ticket/)).toBeVisible();
    await expect(page.getByLabel(/Código del producto/)).toHaveCount(0);
    await page.getByLabel(/Número de ticket/).fill("T-123");
    await page.getByLabel(/Número de teléfono/).fill("+54 11 5555-5555");
    await page
      .getByLabel("Descripción del problema")
      .fill("La venta fue realizada pero no aparece en el listado de hoy.");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();

    await expect
      .poll(() => request.payload())
      .toMatchObject({
        title: "No encuentro una venta",
        problemType: "SALES",
        saleTicketNumber: "T-123",
        phone: "+54 11 5555-5555",
      });
    await expect(
      page.getByRole("dialog").getByText("Solicitud enviada"),
    ).toBeVisible();
    await expect(page.getByLabel("Título")).toHaveValue("");
  });
});

import { expect, test } from "@playwright/test";

const billingConfig = {
  monthlyAmount: 35000,
  currencyId: "ARS",
  trialDays: 30,
  graceDays: 3,
  planReason: "G&S Comercios",
};

async function mockConfig(page: import("@playwright/test").Page) {
  await page.route("**/public/billing/config", (route) =>
    route.fulfill({ json: billingConfig }),
  );
}

test.describe("public signup and confirmation", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("validates each step, preserves values and navigates to the permanent OTP route", async ({
    page,
  }) => {
    await mockConfig(page);
    await page.route("**/public/registrations", (route) =>
      route.fulfill({
        status: 201,
        json: {
          registrationId: "reg-opaque",
          status: "email_verification_pending",
          maskedEmail: "d***@example.com",
          email: "demo@example.com",
          cooldownSeconds: 60,
          deliveryMedium: "EMAIL",
        },
      }),
    );
    await page.goto("/registrarme");
    await expect(page.getByText("Paso 1 de 3")).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(
      page.getByText("Ingresá el nombre del comercio"),
    ).toBeVisible();

    await page.locator("#merchantName").fill("Mi comercio");
    await page.locator("#firstName").fill("Demo");
    await page.locator("#lastName").fill("Usuario");
    await page.locator("#phoneNumber").fill("11 2345-6789");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Paso 2 de 3")).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page.locator("#merchantName")).toHaveValue("Mi comercio");
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.locator("#email").fill("demo@example.com");
    await page.locator("#password").fill("Password1!");
    await expect(page.getByText("un carácter especial")).toHaveClass(
      /text-emerald-700/,
    );
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await page.locator("#acceptTerms").click();
    await page
      .getByRole("button", { name: "Crear cuenta y continuar" })
      .click();
    await expect(page).toHaveURL(/\/confirmar-cuenta$/);
    await expect(page.getByText("Paso 3 de 3")).toBeVisible();
    await expect(page.getByText("demo@example.com")).toBeVisible();
    await expect(page.getByText(/Spam o Correo no deseado/)).toBeVisible();
  });

  test("direct access recovers generically, accepts a pasted OTP and redirects to Login", async ({
    page,
  }) => {
    await page.route("**/public/registrations/recover", (route) =>
      route.fulfill({
        json: {
          sent: true,
          cooldownSeconds: 1,
          message:
            "Si existe un alta pendiente para ese email, enviaremos un nuevo código. Revisá también Spam o Correo no deseado.",
        },
      }),
    );
    await page.route("**/public/registrations/confirm-email", (route) =>
      route.fulfill({
        json: {
          registrationId: "reg-opaque",
          status: "pending_subscription",
          loginUrl: "/login?confirmed=1",
        },
      }),
    );
    await page.goto("/confirmar-cuenta");
    await page.locator("#recoveryEmail").fill("demo@example.com");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await expect(page.getByText(/Si existe un alta pendiente/)).toBeVisible();
    await page.locator("#confirmationCode").fill("123456");
    await page.getByRole("button", { name: "Confirmar cuenta" }).click();
    await expect(
      page.getByText("Cuenta confirmada. Ya podés ingresar."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login\?confirmed=1/);
  });

  test("a registration token enables protected email correction and clears the old OTP", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem(
        "pendingRegistrationNavigation",
        JSON.stringify({
          registrationId: "reg-opaque",
          email: "wrong@example.com",
          source: "signup",
          attemptId: "attempt-signup",
        }),
      ),
    );
    await page.route("**/public/registrations/reg-opaque/email", (route) => {
      const body = route.request().postDataJSON() as { password?: string };
      return route.fulfill({
        json: body.password
          ? {
              passwordRequired: false,
              email: "right@example.com",
              maskedEmail: "r***@example.com",
              cooldownSeconds: 60,
            }
          : {
              passwordRequired: true,
              message: "Volvé a ingresar tu contraseña para aplicar el cambio.",
            },
      });
    });
    await page.goto("/confirmar-cuenta");
    await page.locator("#confirmationCode").fill("123456");
    await page.getByRole("button", { name: "Editar" }).click();
    await page.locator("#newEmail").fill("right@example.com");
    await page.locator("#changeEmailPassword").fill("Password1!");
    await page.getByRole("button", { name: "Actualizar y reenviar" }).click();
    await expect(page.getByText("right@example.com")).toBeVisible();
    await expect(page.locator("#confirmationCode")).toHaveValue("");
  });

  test("UserNotConfirmedException redirects from Login and automatic resend runs only once across refresh", async ({
    page,
  }) => {
    let resendCalls = 0;
    let accessCalls = 0;
    await page.route(
      "https://cognito-idp.us-east-1.amazonaws.com/**",
      (route) =>
        route.fulfill({
          status: 400,
          contentType: "application/x-amz-json-1.1",
          headers: { "x-amzn-errortype": "UserNotConfirmedException:" },
          body: JSON.stringify({
            __type: "UserNotConfirmedException",
            message: "User is not confirmed.",
          }),
        }),
    );
    await page.route("**/public/registrations/recover", (route) => {
      resendCalls += 1;
      return route.fulfill({
        json: {
          sent: true,
          cooldownSeconds: 60,
          message: "Si existe un alta pendiente, enviaremos un código.",
        },
      });
    });
    await page.route("**/public/registrations/recover-access", (route) => {
      accessCalls += 1;
      expect(route.request().postDataJSON()).toEqual({
        email: "pending@example.com",
        password: "Password1!",
      });
      return route.fulfill({
        json: {
          registrationId: "reg-from-login",
          email: "pending@example.com",
        },
      });
    });
    await page.goto("/login");
    await page.locator("#username").fill("pending@example.com");
    await page.locator("#password").fill("Password1!");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/confirmar-cuenta$/);
    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
    await expect(page.getByText("Reiniciar el alta")).toHaveCount(0);
    expect(accessCalls).toBe(1);
    await expect.poll(() => resendCalls).toBe(1);
    await page.reload();
    await page.waitForTimeout(300);
    expect(resendCalls).toBe(1);
  });

  test("authenticated active users are redirected to dashboard", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "authState",
        JSON.stringify({
          isAuthenticated: true,
          user: {
            username: "demo",
            email_verified: true,
            sub: "sub",
            email: "demo@example.com",
            "cognito:groups": ["admin"],
            commerceId: "commerce",
            commerceList: ["commerce"],
            accountStatus: "active",
            role: "admin",
          },
          token: "token",
          commerceId: "commerce",
          accountStatus: "active",
          role: "admin",
        }),
      ),
    );
    await mockConfig(page);
    await page.goto("/registrarme");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

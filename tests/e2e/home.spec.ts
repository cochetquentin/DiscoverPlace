import { expect, test } from "@playwright/test";

test("generates and displays a trip", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Combien de temps");
  await page.getByRole("button", { name: "Trouve-moi une sortie" }).click();
  await expect(page.getByText("Retour au point de départ")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Autre idée" })).toBeVisible();
});

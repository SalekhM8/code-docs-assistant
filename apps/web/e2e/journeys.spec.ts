import { expect, test, type Page } from "@playwright/test";

const question = (page: Page) => page.getByRole("textbox", { name: "Question" });

test("reviewer journey on the seeded sample repo", async ({ page }) => {
  await page.goto("/");

  // Journey 1 (seeded): the sample repo indexes on start and becomes ready.
  const repoLink = page.getByRole("link", { name: /tj\/commander\.js/ });
  await expect(repoLink).toBeVisible({ timeout: 60_000 });
  await expect(repoLink).toContainText(/Ready · \d+ files/, { timeout: 150_000 });

  // Journey 2: overview and suggested questions.
  await repoLink.click();
  await expect(page.getByRole("region", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Suggested questions" })).toBeVisible();

  // Journey 3: ask; the answer streams in with checked citations.
  await question(page).fill("Where is the help text formatted?");
  await question(page).press("Enter");
  await expect(page).toHaveURL(/\/c\//);
  await expect(page.getByRole("list", { name: "What the assistant is doing" })).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ citations verified/)).toBeVisible({ timeout: 30_000 });

  // Journey 4: a citation opens the code beside the chat, lines highlighted.
  await page.locator("article").getByRole("button", { name: /^Open / }).first().click();
  await expect(page.getByRole("region", { name: /^Code of / })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Code viewer" })).toContainText(/commit [0-9a-f]{7}/);

  // Journeys 5 and 10: a follow-up, stopped mid stream with Escape.
  await question(page).fill("And how are options parsed?");
  await question(page).press("Enter");
  await expect(page.getByRole("button", { name: /Stop the answer/ })).toBeVisible();
  await expect(page.getByText("(Fake model").nth(1)).toBeVisible({ timeout: 30_000 });
  await question(page).press("Escape");
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();

  // Journey 10: regenerate replaces the stopped answer with a full one.
  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByText(/\d+ of \d+ citations verified/)).toHaveCount(2, { timeout: 30_000 });

  // Journey 11: feedback, stored against the trace.
  const thumbsUp = page.getByRole("button", { name: "Good answer" }).first();
  await thumbsUp.click();
  await expect(thumbsUp).toHaveAttribute("aria-pressed", "true");

  // Journey 12: trace panel with real searches and steps.
  await page.getByRole("button", { name: "Trace" }).first().click();
  await expect(page.getByText("How this answer was made")).toBeVisible();
  await expect(page.getByText(/Searches \(\d+\)/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Journey 7: conversations persist across a reload.
  await page.reload();
  await expect(page.getByText("Where is the help text formatted?").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Good answer" }).first()).toHaveAttribute("aria-pressed", "true");

  // Journey 9: delete the conversation.
  const conversations = page.getByRole("region", { name: "Conversations" });
  const before = await conversations.getByRole("listitem").count();
  await conversations.getByRole("listitem").first().hover();
  await conversations.getByRole("button", { name: "Delete conversation" }).first().click();
  await conversations.getByRole("button", { name: "Yes" }).click();
  await expect(conversations.getByRole("listitem")).toHaveCount(before - 1);
});

test("adding a non-GitHub URL explains what to paste", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Add a public GitHub repo" }).fill("https://gitlab.com/a/b");
  await page.getByRole("button", { name: "Add repo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Paste a public GitHub repo URL" })).toContainText("https://github.com/owner/repo");
});

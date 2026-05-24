import { expect, test } from '@playwright/test';

test.describe('Public routes', () => {
  test('opens landing page and navigates to signup', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: /Корпоративный мессенджер, в котором проекты, роли и задачи живут в одном интерфейсе/i,
      })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Зарегистрироваться' }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: /Создайте аккаунт TeamBridge/i })).toBeVisible();
  });

  test('shows client-side validation errors on signup before any network action', async ({ page }) => {
    await page.goto('/signup');

    await page.getByLabel('Имя пользователя').fill('ab');
    await page.getByLabel('Полное имя').fill('A');
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Пароль').fill('123');

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    await expect(page.getByText('Минимум 3 символа')).toBeVisible();
    await expect(page.getByText('Слишком короткое имя')).toBeVisible();
    await expect(page.getByText('Некорректный email')).toBeVisible();
    await expect(page.getByText('Пароль должен быть не менее 6 символов')).toBeVisible();
  });

  test('opens forgot password flow, validates empty email and returns to login', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Забыли пароль?' }).click();
    await expect(page).toHaveURL(/\/password-recovery$/);
    await expect(page.getByRole('heading', { name: /Восстановите доступ без лишних шагов/i })).toBeVisible();

    await page.getByRole('button', { name: 'Отправить ссылку' }).click();
    await expect(page.getByText('Введите email')).toBeVisible();

    await page.getByRole('button', { name: '← Назад ко входу' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Войдите в TeamBridge/i })).toBeVisible();
  });
});

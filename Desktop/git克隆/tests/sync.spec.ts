import { test, expect } from '@playwright/test';

test('用户ID生成与数据同步', async ({ page }) => {
  await page.goto('/');
  
  // 验证用户ID生成
  const userId = await page.evaluate(() => {
    return localStorage.getItem('userId');
  });
  expect(userId).toMatch(/^\d{6}$/);

  // 测试本地存储模式
  await page.evaluate(() => {
    localStorage.setItem('testKey', 'localValue');
  });
  const localValue = await page.evaluate(() => localStorage.getItem('testKey'));
  expect(localValue).toBe('localValue');

  // 测试云同步模式
  await page.evaluate(async () => {
    await window.saveData('testKey', 'cloudValue');
  });
  await page.waitForTimeout(1000); // 等待同步完成
  const cloudValue = await page.evaluate(() => localStorage.getItem('testKey'));
  expect(cloudValue).toBe('cloudValue');
});
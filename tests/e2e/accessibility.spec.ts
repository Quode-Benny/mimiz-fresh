import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('menu and meal dialogs meet automated WCAG AA checks', async ({ page }) => {
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'A little taste of home.'})).toBeVisible();
 const home=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(home.violations).toEqual([]);
 await page.getByRole('button',{name:'Add Smoky Ghana jollof to bag',exact:true}).click();
 const meal=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(meal.violations).toEqual([]);
 await page.keyboard.press('Escape');
 await page.locator('header').getByRole('button',{name:'Open bag, 0 items'}).click();
 const bag=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(bag.violations).toEqual([]);
});

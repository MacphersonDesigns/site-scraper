import type { Page } from 'playwright';

/**
 * CSS to disable all animations, transitions, and scroll behavior
 */
const DISABLE_ANIMATIONS_CSS = `
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
`;

/**
 * Disable all CSS and JavaScript animations on a page
 * This ensures consistent screenshots without animation artifacts
 */
export async function disablePageAnimations(page: Page): Promise<void> {
  // Inject CSS to disable animations
  await page.addStyleTag({
    content: DISABLE_ANIMATIONS_CSS,
  });

  // Override JavaScript animation APIs
  await page.evaluate(() => {
    // Override requestAnimationFrame to immediately execute callbacks
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    };

    // Override cancelAnimationFrame to do nothing
    window.cancelAnimationFrame = (): void => {};

    // Try to cancel any pending animations via Web Animations API
    try {
      const animations = document.getAnimations?.() || [];
      for (const animation of animations) {
        animation.finish();
      }
    } catch {
      // Web Animations API may not be available, ignore
    }
  });
}

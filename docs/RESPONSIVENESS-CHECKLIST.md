# Responsiveness & Compatibility Checklist

Antes do lançamento em produção, validar responsividade e compatibilidade em diferentes dispositivos e navegadores.

## Desktop Browsers

### Chrome (Latest)
- [ ] Login page loads correctly
- [ ] Dashboard displays all metrics
- [ ] Properties list is readable
- [ ] Forms are usable (inputs, selects, buttons clickable)
- [ ] Tables have proper spacing
- [ ] Modal dialogs are centered
- [ ] Scrollbars appear when needed

### Firefox (Latest)
- [ ] Same checks as Chrome
- [ ] Font rendering is clear
- [ ] CSS animations are smooth
- [ ] Form validation messages display

### Safari (Latest)
- [ ] Layout doesn't break
- [ ] Touch target sizes are adequate
- [ ] Hover effects work
- [ ] Fonts render correctly

## Mobile Devices

### iPhone 12/13/14 (375x667, 390x844)
- [ ] Text is readable without zoom
- [ ] Buttons are easy to tap (min 44px)
- [ ] Forms stack vertically
- [ ] Navigation menu is accessible
- [ ] Modal dialogs fit screen
- [ ] Keyboard doesn't hide critical content
- [ ] Horizontal scroll not needed

### iPad (768x1024)
- [ ] Layout utilizes wider screen
- [ ] Sidebar visible or collapsible
- [ ] Tables display properly
- [ ] Form fields properly sized

### Android Phone (360x640)
- [ ] Same as iPhone checks
- [ ] Back button handling correct
- [ ] Orientation change handled

## Tablet Devices

### iPad (1024x1366)
- [ ] Two-column layout works
- [ ] Sidebar visible
- [ ] Touch targets adequate

### Android Tablet (1280x800)
- [ ] Multi-column layout works
- [ ] Navigation accessible

## Responsive Breakpoints

Test at these widths:

- [ ] **Mobile (375px)** — iPhone SE
- [ ] **Mobile (390px)** — iPhone 14
- [ ] **Mobile (540px)** — Large Android phone
- [ ] **Tablet (768px)** — iPad
- [ ] **Laptop (1024px)** — iPad Pro
- [ ] **Desktop (1440px)** — Standard desktop
- [ ] **Wide (1920px)** — 4K display

## Orientation

- [ ] **Portrait** — all pages load correctly
- [ ] **Landscape** — proper layout, not cut off
- [ ] **Rotation** — smooth transition, content stays accessible

## Keyboard Navigation

- [ ] Tab order is logical
- [ ] Visible focus indicators on all interactive elements
- [ ] Can navigate entire page with keyboard
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals

## Touch Interaction (Mobile)

- [ ] Buttons are at least 44px × 44px
- [ ] Form inputs are easily tappable
- [ ] Scrolling is smooth
- [ ] No "double-tap to zoom" delays (unless intended)
- [ ] Pinch-zoom works for content

## Performance (Mobile)

- [ ] Page loads within 3 seconds on 4G
- [ ] First Contentful Paint (FCP) < 1.5s
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] Fonts don't cause layout shift

## Accessibility

- [ ] Color contrast >= 4.5:1 for text
- [ ] Color contrast >= 3:1 for UI components
- [ ] Error messages are clearly visible
- [ ] Form labels are associated with inputs
- [ ] Images have alt text
- [ ] Page has proper heading hierarchy

## Common Issues to Test

- [ ] Long text doesn't break layout
- [ ] Numbers and currency format correctly
- [ ] Dates format correctly for locale
- [ ] Large tables are scrollable
- [ ] Images scale properly
- [ ] Icons render consistently
- [ ] Gradient backgrounds display smoothly
- [ ] Animations don't cause janky scrolling

## Testing Tools

### Browser DevTools
```
Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
Firefox DevTools → Responsive Design Mode (Ctrl+Shift+M)
Safari → Develop → Enter Responsive Design Mode
```

### Playwright E2E
```bash
npm run test:e2e
# Automatically tests: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
```

### Manual Testing Sites
- [BrowserStack](https://www.browserstack.com/) — Real devices
- [CrossBrowserTesting](https://crossbrowsertesting.com/) — Virtual machines
- [LambdaTest](https://www.lambdatest.com/) — Cloud testing

### Performance Tools
```bash
# Lighthouse in Chrome DevTools
# Google PageSpeed Insights: https://pagespeed.web.dev/
# WebPageTest: https://www.webpagetest.org/

# k6 load testing (simulates 50 concurrent users)
npm run load-test
```

## Locales to Test (if applicable)

- [ ] English (US)
- [ ] Portuguese (BR)
- [ ] Spanish (ES)
- [ ] Currency formatting correct
- [ ] Date formatting correct
- [ ] RTL languages (if supported)

## Dark Mode

- [ ] Toggle works correctly
- [ ] Colors contrast adequately
- [ ] Images/icons visible in dark mode
- [ ] Text is readable

## Network Conditions

Test on:
- [ ] WiFi (normal conditions)
- [ ] 4G (mobile)
- [ ] 3G (slow connection)
- [ ] Offline mode handling

## Before Shipping

**Final Checklist:**
- [ ] All critical flows work on mobile
- [ ] No console errors (DevTools)
- [ ] No layout shifts (DevTools → Core Web Vitals)
- [ ] Load time acceptable (< 3s on 4G)
- [ ] Mobile screenshot for reference
- [ ] Accessibility score >= 90 (Lighthouse)
- [ ] SEO score >= 90 (Lighthouse)
- [ ] Performance score >= 90 (Lighthouse)
- [ ] Best Practices score >= 90 (Lighthouse)

## Monitoring Production

Once live:
- [ ] Monitor Core Web Vitals in Google Analytics
- [ ] Track 404 errors
- [ ] Monitor API response times
- [ ] Track user session duration by device
- [ ] Monitor error logs from Sentry/similar

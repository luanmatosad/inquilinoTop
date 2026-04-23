---
name: InquilinoTop Core
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#414754'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#727786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005ac3'
  primary: '#0057be'
  on-primary: '#ffffff'
  primary-container: '#006fee'
  on-primary-container: '#fefbff'
  inverse-primary: '#aec6ff'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fd8b00'
  on-secondary-container: '#603100'
  tertiary: '#5a5c5d'
  on-tertiary: '#ffffff'
  tertiary-container: '#737475'
  on-tertiary-container: '#fcfcfd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#aec6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004396'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#e2e2e3'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1d'
  on-tertiary-fixed-variant: '#454748'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
  mono-sm:
    fontFamily: ui-monospace
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The brand personality is professional yet energetic, bridging the gap between serious real estate management and the vibrant lifestyle of modern tenants. This design system adopts a **Modern & Vibrant** style, heavily inspired by the high-performance aesthetic of HeroUI. 

The UI prioritizes clarity and speed, utilizing high-contrast surfaces to ensure property data is instantly digestible. The atmosphere is confident and trustworthy, achieved through generous whitespace, bold accent colors, and a card-based architecture that makes complex management tasks feel organized and approachable.

## Colors

This design system uses a high-energy palette designed for high visibility. 

- **Primary (#006FEE):** A deep, electric blue used for main actions, active states, and primary branding. It communicates reliability and technology.
- **Secondary (#FF8C00):** A vibrant orange used for attention-grabbing elements, warnings, or "Urgent" status indicators. It provides a warm contrast to the primary blue.
- **Neutral / Background:** Pure white (#FFFFFF) is used for the main canvas, while the light gray (#F4F4F5) serves as a subtle secondary surface for cards and background sections to create depth.
- **Text & Accents:** Pure black (#000000) is reserved for high-contrast typography and iconography to ensure maximum readability against the vibrant accents.

## Typography

The typography system relies exclusively on **Inter** for its utilitarian and systematic qualities, ensuring the app feels like a high-end SaaS tool. 

- **Headlines:** Use Bold (700) and SemiBold (600) weights with slightly tighter letter spacing to create a strong visual anchor.
- **Body Text:** Standard weights (400) provide high legibility for lease agreements and property descriptions.
- **Labels:** Used for badges, captions, and secondary information, often utilizing medium or semibold weights to maintain hierarchy at smaller sizes.
- **Monospace:** `ui-monospace` is used sparingly for data-heavy strings such as transaction IDs, bank accounts, or unit numbers.

## Layout & Spacing

This design system employs a **Fluid Grid** model with fixed maximum widths for desktop viewing. The layout is built on a 4px baseline grid to ensure mathematical harmony.

- **Grid:** A 12-column grid is used for desktop dashboards, collapsing to a 1-column layout for mobile.
- **Rhythm:** Containers use a 16px (md) or 24px (lg) internal padding to create a spacious, airy feel characteristic of modern UI frameworks.
- **Card Spacing:** Elements within cards should follow a consistent 16px gap to maintain a clean "HeroUI-like" vertical rhythm.

## Elevation & Depth

To achieve the "clean and vibrant" look, this design system avoids heavy, muddy shadows. Instead, it uses **Ambient Shadows** and **Tonal Layers**.

- **Surfaces:** The primary background is #FFFFFF. Secondary surfaces (like the app sidebar or card backgrounds) use #F4F4F5.
- **Shadows:** Use a "Soft Lift" shadow for cards and modals: `0px 10px 15px -3px rgba(0, 0, 0, 0.05)`. This creates a sense of floating without adding visual clutter.
- **Borders:** In place of heavy shadows, use a subtle 1px border (#E4E4E7) to define card boundaries, especially when sitting on a white background.

## Shapes

The shape language is defined by "Large" roundedness, moving away from corporate stiffness toward a more modern, friendly interface.

- **Base Components:** Buttons and Input fields use a 0.5rem (8px) radius.
- **Containers:** Cards and large sections (Large) use a 1rem (16px) radius.
- **Modals/Banners:** Use Extra-Large (1.5rem / 24px) for prominent floating elements.
- **Badges:** Use a full pill-shape (9999px) to distinguish them clearly from interactive buttons.

## Components

The component library focuses on accessibility and touch-friendly targets.

- **Buttons:** Primary buttons use the #006FEE background with white text. High-contrast hover states are essential; use a slightly darker blue or 90% opacity on hover. CTA buttons should be tall (min 44px) with semi-bold labels.
- **Cards:** The core of the UI. Cards must have a 1px subtle border and the "Soft Lift" shadow. Property images within cards should inherit the card's top rounded corners.
- **Badges/Status Indicators:** Use highly saturated backgrounds with white text. 
    - *Paid:* Primary Blue.
    - *Pending:* Secondary Orange.
    - *Overdue:* High-contrast Red.
- **Input Fields:** Use a subtle #F4F4F5 background with no border in their default state, transitioning to a primary blue border on focus.
- **Property List:** Items should be separated by whitespace and cards rather than simple dividers to maintain the "HeroUI" modular look.
- **Additional Elements:** Progress bars for lease terms and "Quick Action" floating buttons for adding new tenants or maintenance requests.
---
version: alpha
name: SEAL Dark Event Platform
description: Warm dark product UI with a single FPT-orange interaction accent.
colors:
  canvas: "#120F0E"
  surface: "#1A1512"
  surface-raised: "#241D19"
  primary: "#FF6B2C"
  primary-hover: "#FF7B42"
  on-primary: "#17110E"
  text: "#F8F5F2"
  text-muted: "#A39690"
  border: "#3A302B"
  error: "#F87171"
typography:
  headline-lg: { fontFamily: Inter, fontSize: 36px, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.02em }
  headline-md: { fontFamily: Inter, fontSize: 24px, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.02em }
  body-md: { fontFamily: Inter, fontSize: 16px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontFamily: Inter, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  label-md: { fontFamily: Inter, fontSize: 14px, fontWeight: 600, lineHeight: 1.4 }
rounded: { sm: 8px, md: 12px, lg: 16px, xl: 24px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px }
components:
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: 56px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: 56px
---

# SEAL Design System

## Overview

SEAL is a dark, event-focused product interface for students, judges, mentors,
and organizers. It uses warm charcoal surfaces and one orange accent. Forms
must feel direct, readable, and reliable rather than decorative.

## Colors

- Orange (`primary`) is reserved for primary actions, selection, focus, and
  concise informational emphasis.
- Warm charcoal layers separate the page, dialog, and nested controls.
- Secondary text uses `text-muted` but must retain WCAG AA contrast.
- React code should prefer the semantic Tailwind tokens (`background`, `card`,
  `popover`, `primary`, `muted`, `border`, `foreground`) defined in
  `FE/app/globals.css`; the hex values above document their visual intent.

## Typography

Use the project's Inter stack. Headings use tight tracking and strong weight;
form labels use sentence case and weight 600. Body copy stays at 14-16px.

## Layout

Use an 8px rhythm. Dialogs cap their width, use 24-48px responsive padding,
and collapse two-column information grids to one column below 640px.

## Elevation & Depth

Create depth with tonal surface changes and a subtle border. Avoid large outer
glows and multi-color gradients in product forms.

## Shapes

Dialogs use 24px corners. Nested cards use 16px. Inputs and buttons use 12px.
Icon buttons are at least 44x44px.

## Components

- Primary buttons are solid orange with dark text and a slightly lighter hover.
- Inputs are 56px high with a visible orange focus ring.
- Informational banners use an orange-tinted surface, never an unrelated blue.
- Validation appears inline and is connected to its field for screen readers.

## Do's and Don'ts

- Do keep one orange accent throughout a screen.
- Do preserve clear required and optional labels.
- Do use responsive grids and 44px minimum touch targets.
- Don't mix orange and rose gradients on primary actions.
- Don't use low-contrast gray placeholder or helper text.
- Don't hide the reason a submit action is unavailable.

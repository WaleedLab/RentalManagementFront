---
name: rental-saudi-plate
description: >-
  Saudi vehicle plate visual standard for fleet/vehicle list cards. Use when
  building or redesigning vehicle cards, plate components, or fleet list UX in
  the rental management frontend.
---

# Saudi Plate Design Standard

## Vehicle List Enhancement

The plate number must never be displayed as plain text.

The plate should visually resemble a real Saudi vehicle plate.

This becomes the primary visual identifier of the vehicle card.

---

# Plate Component Layout

Display:

Arabic Letters
Arabic Numbers

English Letters
English Numbers

Example:

┌─────────────────────┐
│       السعودية      │
│                     │
│ ١٢٣٤   أ ب ج       │
│ ABC     1234       │
└─────────────────────┘

---

# Visual Style

Use a dedicated plate component.

Class:

vehicle-saudi-plate

Implementation: `src/app/shared/ui/vehicle-saudi-plate/`

---

# Plate Structure

Top Area

Small Saudi emblem or text:

السعودية

---

Middle Area

Arabic characters

Arabic numbers

Largest typography.

---

Bottom Area

English transliteration

English numbers

Smaller typography.

---

# Dimensions

Desktop:

Width:
220px

Height:
80px

Mobile:

Width:
180px

Height:
65px

---

# Plate Colors

Light Theme

Background:
#FFFFFF

Border:
#2B2B2B

Text:
#111111

Divider:
#BFC6D1

---

Dark Theme

Background:
#F8FAFC

Border:
#1E293B

Text:
#0F172A

Divider:
#CBD5E1

Plate must remain realistic even inside dark mode.

Never make the plate dark.

Real plates remain white.

---

# Card Hierarchy

Vehicle Card

1. Vehicle Image

2. Vehicle Plate (largest element)

3. Vehicle Status

4. Vehicle Information

5. Actions

The plate must be more visually prominent than:

* Category
* Branch
* Daily Price

---

# Status Integration

Status badge overlays corner of plate.

Available

Green

Booked

Amber

Maintenance

Red

Inactive

Gray

Sold

Purple

---

# Vehicle Card Layout

Media Area

Vehicle Image

Status Badge

Year Badge

---

Plate Area

Saudi Plate Component

---

Information Area

Category

Branch

Daily Price

---

Action Area

Details

Edit

Tracking

Status

Delete

---

# Fleet UX Rule

Reception employees identify vehicles faster by:

1. Plate Number

2. Vehicle Photo

3. Vehicle Status

Not by serial number.

Therefore:

Plate Number must always be visually prioritized over serialNumber.

Serial Number becomes secondary metadata.

---

# Hover Interaction

On hover:

Plate receives subtle elevation.

Vehicle image slightly scales.

Status badge becomes more visible.

No aggressive animations.

Enterprise style only.

---

# Accessibility

Plate contrast:

WCAG AA minimum.

Arabic and English text must remain readable at all zoom levels.

---

# Final Goal

A user scanning 100 vehicles should identify a vehicle by its Saudi plate within less than one second.

The plate should become the visual anchor of the entire vehicle card.

---

# Vehicle Card Proportions (Fleet List)

Recommended vertical rhythm on each vehicle card:

1. Vehicle image — 40%

2. Saudi plate (realistic component) — 25%

3. Status and year badges — 10%

4. Category, branch, daily price — 15%

5. Action buttons — 10%

This layout should feel like a major rental fleet system, not a generic CRUD grid.

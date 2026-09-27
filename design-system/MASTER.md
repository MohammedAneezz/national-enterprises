# NATIONAL ENTERPRISES — Design System MASTER
# Generated via UI-UX-Pro-Max (Minimalism & Swiss Style)

## Brand
- App: NATIONAL ENTERPRISES (EMI collections)
- Style: Minimalism & Swiss — clean, spacious, grid, functional
- Primary #0F172A (trust navy), Secondary #1E3A8A, CTA #A16207 (gold), BG #F8FAFC, Card #FFFFFF, Text #020617, Muted #475569, Border #E2E8F0, Danger #DC2626
- Type: Lexend (head) + Source Sans 3 (body)
- Icons: Lucide SVG only, no emojis. Sharp shadows, 200ms transitions, 4.5:1 contrast, reduced-motion respected.
- Mobile first 375px. Bottom tabs: Dashboard | Customers | Collect | Stock | Reports. Admin root: A-Line / B-Line / C-Line cards.

## Collect component rules (100/200/500 + manual)
- Row of 3 outline chips [+100][+200][+500] + [Clear]. Tap adds to amount state (string->int math).
- Amount TextInput numeric, fully editable after chips. Validate >0.
- Mode toggle: [Cash|UPI] segmented, default Cash. If UPI show UPI Ref input (required).
- Save -> POST /payments {line_id, sale_id, amount, mode, upi_ref}. Show receipt toast.
- Charts: Bar (daily sales), Donut (Cash vs UPI). Dues as list, never color-only (label PAID/PARTIAL/DUE/OVERDUE).

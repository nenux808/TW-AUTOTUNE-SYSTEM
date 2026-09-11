# TW AutoTune Workshop Management System

A secure, cloud-based workshop management application built for automotive service and repair operations. The system helps workshop staff manage customers, vehicles, repair orders, inspections, diagnostic notes, invoices, payments, inventory, suppliers, expenses, service packages, reminders, and owner reporting from one connected platform.

Developed by **Nenux Web Solutions**.

---

## Overview

TW AutoTune Workshop Management System is designed to replace manual paperwork, scattered spreadsheets, and disconnected invoice tools with a single web application. It connects the full workshop workflow:

```txt
Customer → Vehicle → Job Card → Inspection → Invoice → Payment → Reports
```

The application is built with **Next.js**, **Supabase**, and modern security controls including staff authentication, role-aware access, protected API routes, public invoice token hardening, rate limiting, no-cache headers, and Content Security Policy headers.

---

## Key Features

### Staff Login and Access Control

- Secure staff login using Supabase Authentication.
- Protected internal pages.
- Owner, mechanic, and front-desk style access patterns.
- Public access limited to customer invoice links only.

### Dashboard

- Live overview of workshop activity.
- Quick customer, vehicle, job, and invoice search.
- Today’s jobs and open jobs.
- Unpaid invoice totals.
- Customer and supplier balances.
- Monthly revenue and profit overview.
- Low-stock and service reminder indicators.

### Customer Management

- Add and manage customer records.
- Store phone, email, address, customer type, status, and notes.
- Link customers to multiple vehicles.
- Search and manage customer history.

### Vehicle Management

- Add and edit customer vehicles.
- Track registration, make, model, year, odometer, fuel type, transmission, VIN, engine number, colour, type, and notes.
- Correct vehicle details after entry, including wrong odometer/mileage values.
- Connect vehicles to jobs, inspections, invoices, and service reminders.

### Job Cards / Repair Orders

- Create repair orders from selected customer and vehicle records.
- Track job type, priority, status, safety status, odometer, customer request, mechanic notes, diagnosis, work completed, and recommendations.
- Search jobs by customer name, phone number, registration, vehicle details, job number, status, and odometer.
- Create invoices from job cards.

### Inspection Checklist

- Digital mechanic inspection workflow.
- Customer-visible summary and internal mechanic notes.
- Checklist item status such as good, monitor, attention required, urgent, repaired, and not applicable.
- Attention/monitor items can be shown on customer invoices.

### Diagnostic Codes

- Record scan-tool error codes.
- Store code, system, description, status, severity, mechanic note, recommendation, and cleared status.
- Attach diagnostic records to job cards and invoice/service reports.

### Invoice Management

- Generate invoice drafts from job cards.
- Add service packages, labour, inventory parts, manual parts, and custom charges.
- Track subtotal, GST, total, paid amount, balance due, and payment status.
- Edit invoices after creation.
- Separate customer invoice view from owner copy/profit information.
- Send customer invoice links by email.

### Public Customer Invoice Links

- Public invoice links use secure random tokens.
- Links can be enabled/disabled.
- Public invoice expiry support.
- Server-side public invoice reads using service-role client.
- Public invoice rate limiting by IP and token.
- Customer-facing invoice excludes internal owner-only information.

### Inventory and Stock Control

- Manage sellable parts, consumables, tools, and stock items.
- Store SKU/part number, category, supplier, stock quantity, reorder level, cost price, and selling price.
- Track stock cost value and billable profit.
- Highlight low-stock items.
- Add inventory items to invoices.

### Suppliers and Purchase Records

- Add and manage supplier details.
- Track supplier contact information, phone, email, ABN, address, and notes.
- Support supplier purchase and bought-invoice workflows.

### Shop Expenses

- Record operating expenses such as rent, utilities, consumables, tools, subscriptions, and workshop costs.
- Track amount, GST, total, payment method, payment status, supplier, reference number, and notes.
- Expenses feed into owner reporting and net profit calculations.

### Service Packages

- Configure fixed-price service packages and promotions.
- Store package name, category, base price, price note, description, and active status.
- Add packages directly to invoice drafts.

### Owner Reports

- Analyse revenue, paid amount, customer balance, supplier balance, parts cost, parts sales, parts profit, expenses, GST collected, GST on expenses, net profit, and net margin.
- Filter by date range, payment status, customer, invoice number, vehicle registration, supplier, part, expense, and reference.
- View best-selling parts and expense breakdowns.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Application | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Email | Resend |
| Hosting | Vercel |
| Security | RLS, CSP, rate limiting, protected routes, server-only service-role operations |

---

## Project Structure

```txt
src/
  app/
    dashboard/
    customers/
    vehicles/
    jobs/
    inspections/
    invoices/
    invoice-view/
    inventory/
    expenses/
    owner-reports/
    packages/
    settings/
    api/
  components/
    auth/
    customers/
    vehicles/
    jobs/
    inspections/
    invoices/
  lib/
    auth/
    email/
    security/
    supabase/
  types/
supabase/
  schema.sql
  inspection_seed.sql
  security_hardening.sql
  rate_limit_security.sql
```

---

## Environment Variables

Create a `.env.local` file for local development.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EMAIL_FROM=TW AutoTune <noreply@your-domain.com>
```

### Important Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Never rename service keys with `NEXT_PUBLIC_`.
- Keep production secrets inside Vercel environment variables.
- Do not commit `.env.local` to GitHub.

---

## Database Setup

Run the SQL files in Supabase SQL Editor in the correct project.

Recommended order:

```txt
1. supabase/schema.sql
2. supabase/inspection_seed.sql
3. supabase/security_hardening.sql
4. supabase/rate_limit_security.sql
```

After schema changes, refresh PostgREST schema cache if needed:

```sql
notify pgrst, 'reload schema';
```

---

## Local Development

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Build production version locally:

```bash
npm run build
```

---

## Deployment

The application is designed for deployment on Vercel.

Before deploying:

1. Add all required environment variables in Vercel.
2. Confirm Supabase database migrations are applied.
3. Confirm RLS policies are enabled.
4. Confirm `SUPABASE_SERVICE_ROLE_KEY` is configured.
5. Run `npm run build` locally when possible.

---

## Security Controls

The application includes several security controls:

- Staff authentication using Supabase Auth.
- Protected API routes for sensitive actions.
- Owner-only email test route.
- Public invoice token protection.
- Public invoice expiry support.
- Server-side public invoice access through service-role client.
- Rate limiting for invoice email sending and public invoice views.
- No-store cache headers for sensitive pages.
- Content Security Policy headers.
- X-Frame-Options, Referrer-Policy, Permissions-Policy, and HSTS headers.
- Supabase Row Level Security support.
- Restricted anonymous access to private business tables.

---

## Recommended Workflow

A normal workshop workflow is:

```txt
1. Staff logs in.
2. Customer record is created or selected.
3. Vehicle record is created or selected.
4. Job card / repair order is created.
5. Mechanic completes inspection and diagnostic notes.
6. Invoice draft is generated from the job card.
7. Labour, parts, packages, GST, and payment details are added.
8. Invoice is saved, edited if required, and sent to the customer.
9. Customer payment is recorded.
10. Owner reviews dashboard and reports.
```

---

## Maintenance Checklist

- Keep customer and vehicle records accurate.
- Correct odometer or vehicle mistakes using the vehicle edit option.
- Review unpaid invoices regularly.
- Check low-stock items weekly.
- Record supplier purchases and expenses properly.
- Review owner reports monthly.
- Remove inactive staff access.
- Keep Supabase invoices/billing active.
- Keep environment variables secure.
- Run security checks after major changes.

---

## Branding

This system is developed and maintained by **Nenux Web Solutions**.

The workshop-facing interface currently uses TW AutoTune branding. The underlying system architecture can be adapted for other automotive workshops with configurable business settings, invoice details, bank details, and workflow customisation.

---

## License and Ownership

This is a private/custom workshop management system. Do not redistribute, resell, copy, or expose source code without permission from the owner/developer.

---

## Support

For setup, deployment, feature updates, security checks, or customisation, contact **Nenux Web Solutions**.

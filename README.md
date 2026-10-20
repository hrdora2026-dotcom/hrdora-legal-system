# Opinion Ledger Lighthouse

# H R DORA, ADVOCATE — COMPLETE LEGAL OPINION & BILLING MANAGEMENT SOFTWARE

Build a complete, professional, responsive web application for **H R DORA, ADVOCATE** to replace our handwritten legal opinion record book and manually maintained billing register.

The application must work online across Sir's computer, staff computers and mobile phones using a shared database.

**IMPORTANT REQUIREMENTS**
- No payment gateway integration.
- No Razorpay, UPI API, bank API or online payment processing.
- No payment slip, receipt printing or payment receipt PDF generation.
- Sir manually enters the payment amount received after collecting money.
- Staff can immediately see the updated payment status and outstanding balance.
- Support full payment, partial payment, multiple payments and approved final settlements.
- Support manual record entry and importing existing Excel records.

Build the actual working application, not just a dashboard mockup.

## 1. Technology and design

Use React, TypeScript, Vite, Tailwind CSS and Supabase/PostgreSQL.

Design a premium legal-office dashboard with:
- Firm name: H R DORA, ADVOCATE.
- Navy blue, white and subtle gold branding.
- Professional typography and clean layouts.
- Responsive desktop, tablet and mobile screens.
- Sidebar navigation, searchable tables, filter controls and status badges.
- INR currency formatting and Indian date format (DD-MM-YYYY).

Use a connected Supabase project for shared online data. Implement secure authentication and database-level permissions. Never expose privileged database credentials in frontend code.

## 2. User roles

### Admin / Sir
Sir must be able to:
- View all opinions, bills and payments.
- Manually record payments received.
- Record full or partial payments.
- View pending amounts by borrower, bank and branch.
- Approve discounts, write-offs and final settlements.
- Correct payment errors through an audited reversal process.
- Manage banks, branches and staff permissions.
- View dashboard analytics and export reports.
- Import historical Excel records.

### Staff
Staff must be able to:
- Create and update legal opinion records.
- Enter documents received dates.
- Update opinion preparation and submission status.
- Enter bill charges.
- View payment status and outstanding balances.
- Search bills by borrower, bank and branch.
- Export permitted operational reports.

Staff must not record or alter payments, approve discounts or reverse transactions unless Sir explicitly authorizes the permission.

## 3. Dashboard

Create a professional dashboard with live database figures.

Display:
- Total opinions received.
- Opinions in progress.
- Opinions ready for submission.
- Opinions submitted.
- Opinions not yet submitted.
- Total bills generated.
- Total billed amount.
- Total amount received.
- Total outstanding amount.
- Partially paid bills.
- Fully paid bills.
- Approved discounts and write-offs.

Add charts for:
- Monthly billing versus collections.
- Bank-wise outstanding amounts.
- Branch-wise pending bills.
- Opinion status distribution.


Provide date filters for today, this week, this month, previous month, financial year and custom date range.

All statistics must use actual database data. Do not use hardcoded sample amounts in production.

## 4. Legal opinion register

Create a New Opinion form with:
- Automatically generated unique opinion number.
- Borrower name entered manually.
- Bank selected from the saved bank list.
- Branch selected from the saved branches for that bank.
- Documents received date.
- Description of documents received.
- Assigned staff member.
- Remarks.
- Opinion status.
- Submission date, when applicable.
- Submission reference, if available.

Statuses:
- Received.
- In Progress.
- Ready for Submission.
- Submitted.
- On Hold.

Allow editing with permission checks and preserve change history.

Provide a searchable register with filters for borrower, opinion number, bank, branch, received date, submission date, staff member, opinion status and payment status.

Warn about possible duplicate records without blocking legitimate repeat cases.

## 5. Bank and branch management

Create a bank and branch master module.

Allow authorized users to add, edit and deactivate banks and branches.

Each branch page must show:
- Total opinions.
- Opinions not submitted.
- Total bills.
- Total billed amount.
- Total manually recorded payments.
- Total outstanding amount.
- Number of unpaid bills.
- Number of partially paid bills.
- Number of fully paid or settled bills.

Provide a branch-wise register with links to individual opinions, bills and payment histories.

Do not hardcode bank names or branch names.

## 6. Billing system

Every opinion can have its own bill and individual charge items.

Allow staff to enter:
- Legal Opinion charges.
- EC charges.
- Single Search charges.
- Document charges.
- Other charges.
- Additional custom charges.

For each charge item, provide description, quantity if applicable, rate and calculated amount.

Automatically calculate the bill total. Do not use a fixed charge for every opinion.

Provide draft and finalized bill statuses, bill numbers, bill dates and links to the associated opinion, borrower, bank and branch.

Allow authorized corrections while preserving the financial history.

Do not generate or print payment slips or payment receipts.

## 7. Manual payment entry — most important feature

Build a simple **Record Payment** page exclusively for Sir or other specifically authorized users.

This is NOT an online payment system. Sir collects money through whatever method the firm normally uses and manually records the amount received in this software.

### Record Payment form

Sir must be able to:
1. Search for a borrower, opinion number, bill number, bank or branch.
2. Select the correct bill.
3. View the original bill total.
4. View the amount already received.
5. View the current outstanding balance.
6. Select Full Payment, Partial Payment or Final Settlement.
7. Enter the actual amount received manually.
8. Enter the date the payment was received.
9. Optionally enter payment method, transaction reference and remarks.
10. Save the record.

Do not connect any payment gateway or bank account.

### Automatic calculations

For example:

Bill total: ₹3,000.

- First payment received: ₹1,000.
- Total received: ₹1,000.
- Balance pending: ₹2,000.
- Second payment received: ₹1,500.
- Total received: ₹2,500.
- Balance pending: ₹500.

The software must update all relevant screens immediately after Sir saves the payment.

### Payment statuses

- Unpaid: No payment has been recorded.
- Partially Paid: Some amount has been received and a balance remains.
- Paid: The entire bill amount has been received.
- Settled by Approved Adjustment: Sir has approved a discount or write-off that clears the remaining balance.

If Sir receives less than the bill amount but accepts it as full and final settlement, require an authorized adjustment and reason. Do not falsely record the missing amount as money received.

### Payment history

Each bill must display a list of manually recorded payments:
- Payment date.
- Amount received.
- Optional payment method.
- Optional transaction reference.
- Remarks.
- Recorded by.
- Entry timestamp.

Allow multiple payments against the same bill.

Provide a simple edit-protected payment history. Do not silently delete or overwrite payments. Correct mistakes through an authorized reversal process with a reason.

Prevent accidental duplicate payment entries caused by repeated clicks or network retries.

## 8. Pending bills

Create a dedicated Pending Bills page with:
- Borrower name.
- Opinion number.
- Bank.
- Branch.
- Submission date.
- Bill total.
- Total amount received.
- Outstanding balance.
- Last payment date.
- Payment status.

Add filters for bank, branch, borrower, date range, outstanding amount and payment status.

Include ageing categories:
- 0–30 days.
- 31–60 days.
- 61–90 days.
- Over 90 days.

Allow staff to add follow-up notes without changing financial records.

A fully paid or properly settled bill must not appear as pending.

## 9. Excel import of existing records

Create an Excel Import page that supports .xlsx, .xls and .csv files where compatible.

Workflow:
1. Upload the existing register.
2. Select the worksheet if needed.
3. Preview the data.
4. Map Excel columns to database fields.
5. Validate dates, amounts and required information.
6. Flag duplicates and inconsistent totals.
7. Preview accepted and rejected records.
8. Confirm the import.
9. Show the final import summary and rejected-row report.

Support fields such as:
- Borrower name.
- Bank.
- Branch.
- Opinion number.
- Documents received date.
- Submission date.
- Legal opinion charges.
- EC charges.
- Single Search charges.
- Other charges.
- Total bill.
- Amount already received.
- Outstanding balance.
- Payment date, if available.
- Remarks.

Not every Excel file will contain all fields. Allow column mapping.

Do not invent missing amounts, dates or individual payments. If historical data only contains a total received amount without payment details, preserve it as a clearly identified historical balance or collection entry and disclose this in the import preview.

Warn about duplicate imports. Never overwrite existing payments automatically. Validate that bill totals, received amounts and outstanding balances reconcile before finalizing an import.

Provide an import batch history and downloadable error report.

## 10. Reports and exports

Provide Excel, CSV and data-report exports for:
- Monthly billed amount.
- Monthly payments actually received.
- Bank-wise outstanding bills.
- Branch-wise pending bills.
- Opinions not submitted.
- Submitted opinions with unpaid bills.
- Paid and partially paid bills.
- Borrower-wise billing and payment history.
- Date-wise manually recorded payments.
- Approved discounts and write-offs.
- Staff activity.
- Excel import results.

Apply current filters to exported data and include appropriate totals.

PDF or browser printing may be used for general reports if needed, but **do not build payment slips, payment receipts or receipt-printing features**.

## 11. Database and audit history

Create normalized PostgreSQL tables for:
- User profiles and roles.
- Banks.
- Branches.
- Opinions.
- Document metadata.
- Bills.
- Bill line items.
- Manual payment records.
- Payment reversals.
- Approved adjustments.
- Follow-up notes.
- Excel import batches and row results.
- Audit logs.

Use exact decimal types for financial amounts, foreign keys, indexes and appropriate constraints.

Maintain a reliable payment ledger and calculate outstanding amounts from bill totals, actual payments and approved adjustments.

Record who created or updated an opinion, bill, payment or adjustment and when.

Enforce Supabase Row Level Security on all exposed tables. Restrict payment actions to authorized users.

## 12. Functional testing

Use test records to verify the following:

Test 1: Create an opinion and verify it appears in the register.

Test 2: Update its submission status and verify dashboard counts change.

Test 3: Create a bill with ₹2,000 Legal Opinion charges, ₹500 EC charges and ₹300 Single Search charges. Verify the total is ₹2,800.

Test 4: Sir manually records ₹1,000 received. Verify outstanding is ₹1,800.

Test 5: Sir records another ₹1,000. Verify total received is ₹2,000 and outstanding is ₹800.

Test 6: Sir approves an ₹800 write-off with a reason. Verify the bill is settled, actual collections remain ₹2,000 and the adjustment is reported separately.

Test 7: Verify staff can see updated balances but cannot record payments without permission.

Test 8: Verify changes synchronize between two authorized devices.

Test 9: Import an Excel test workbook and verify validation, duplicate detection and financial reconciliation.

Test 10: Export filtered bank-wise and branch-wise pending bill reports and verify the totals.

Test 11: Verify payment corrections preserve the original audit history.

Test 12: Verify no payment gateway, online payment processing or payment receipt/slip generation is implemented.

## 13. Final instructions

Implement the entire application in the current Lovable project. Connect all pages, forms, filters, charts and actions to the real database.

Prioritize the working opinion register, flexible billing, manual payment entry, automatic pending-balance calculation, bank/branch filters, Excel import and reports.

Do not stop at a static UI or sample dashboard.

If the Supabase connection or required deployment configuration needs my action, tell me exactly what to do. Do not claim successful integration or testing unless it has actually succeeded.

At completion, report:
- Pages and features implemented.
- Database tables and permissions configured.
- Tests performed and results.
- Remaining setup steps.
- How to create the first Admin account.
- How to add staff.
- How to import the firm's existing Excel register.
- How to access the software online from multiple devices.

Build a practical, secure and easy-to-use **H R DORA, ADVOCATE Legal Opinion & Billing Management System**.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://opinion-ledger-lighthouse.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/922aa3b9-f36e-4b1c-8229-c8bf2c7918a8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

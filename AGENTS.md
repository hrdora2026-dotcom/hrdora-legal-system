<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Money changes (payments, reversals, adjustments, imports) go only through SECURITY DEFINER SQL functions (record_payment, reverse_payment, approve_adjustment, reverse_adjustment, commit_import); tables have no direct write grants — keeps the ledger audited and permission-checked.
- Balances/statuses come from the `bill_summary` view, never stored — outstanding is always total − valid payments − active adjustments.
- First signup becomes admin; later signups need an admin to grant a role (is_member) before RLS lets them see data.
- App pages live under src/routes/_authenticated (client-only, ssr:false) and read via the browser client with RLS; realtime invalidates React Query caches for multi-device sync.

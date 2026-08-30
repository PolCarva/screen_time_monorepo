-- These pseudonyms belong to the disposable automated accounts used before
-- the production launch. They are enumerated explicitly so future privacy
-- deletions and their retained financial audit records are never affected.
alter table public.token_ledger disable trigger token_ledger_no_update;

delete from public.token_ledger
where user_id is null
  and former_user_hash in (
    '37fcf2ffb74fddb8efaf8f442b7ebdca7e6b86ac08beec8b784ed762eebbcb03',
    'a9a1f8eee4539d376c42bd7be51ca32dab8a295af69af38e3ebe4760466ac0c8',
    'b647271cb6a0cbe61459eed4802281224aab45b4d282f9829d7aea0c71c79a9a',
    'cd82ad1626465be9a8cde66a2e894b495fa04c77a0d90e7305cf8b86aef49647',
    'cfa459e8d55f344db7975aef385764eb9571c2768299e637bd88d31ebc83909e'
  )
  and metadata->>'retainedForFinancialAudit' = 'true';

alter table public.token_ledger enable trigger token_ledger_no_update;

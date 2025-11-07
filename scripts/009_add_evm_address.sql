-- Add EVM address column to profiles table for MaxFlow integration
-- This allows users to link their Ethereum address to get MaxFlow ego scores

alter table public.profiles 
add column if not exists evm_address text;

-- Add index for faster lookups
create index if not exists idx_profiles_evm_address on public.profiles(evm_address) 
where evm_address is not null;

-- Add comment
comment on column public.profiles.evm_address is 'Ethereum address (0x format) for MaxFlow ego scoring';


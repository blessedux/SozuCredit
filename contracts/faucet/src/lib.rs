//! Sozu Faucet vault (testnet V1).
//!
//! Holds a SEP-41 token (Circle USDC SAC on testnet) and releases it to
//! claimants. All abuse rules (cooldowns, budgets) live server-side in V1;
//! the contract only enforces that the Sozu backend (admin) authorizes every
//! payout. The claim amount is passed per call so the app DB stays the single
//! source of truth, with a stored default for future direct-claim modes.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    ClaimAmount,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FaucetError {
    InvalidAmount = 1,
    InsufficientBalance = 2,
}

const DAY_LEDGERS: u32 = 17_280; // ~1 day at 5s/ledger
const TTL_THRESHOLD: u32 = DAY_LEDGERS * 7;
const TTL_EXTEND_TO: u32 = DAY_LEDGERS * 30;

fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn read_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

fn read_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Token).unwrap()
}

#[contract]
pub struct SozuFaucet;

#[contractimpl]
impl SozuFaucet {
    /// Deploy-time setup: admin (Sozu backend signer), token to dispense,
    /// and the default claim amount in token minor units (7 decimals).
    pub fn __constructor(env: Env, admin: Address, token: Address, claim_amount: i128) {
        if claim_amount <= 0 {
            panic!("claim_amount must be positive");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage()
            .instance()
            .set(&DataKey::ClaimAmount, &claim_amount);
        extend_instance(&env);
    }

    /// Release `amount` (minor units) to `to`. Admin-gated: only the Sozu
    /// backend can trigger payouts in V1. Pass 0 to use the stored default.
    pub fn claim(env: Env, to: Address, amount: i128) -> Result<i128, FaucetError> {
        read_admin(&env).require_auth();

        let amount = if amount == 0 {
            env.storage()
                .instance()
                .get(&DataKey::ClaimAmount)
                .unwrap()
        } else {
            amount
        };
        if amount <= 0 {
            return Err(FaucetError::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &read_token(&env));
        let vault = env.current_contract_address();
        if token_client.balance(&vault) < amount {
            return Err(FaucetError::InsufficientBalance);
        }

        token_client.transfer(&vault, &to, &amount);
        extend_instance(&env);
        Ok(amount)
    }

    /// Update the stored default claim amount (minor units). Admin only.
    pub fn set_claim_amount(env: Env, claim_amount: i128) -> Result<(), FaucetError> {
        read_admin(&env).require_auth();
        if claim_amount <= 0 {
            return Err(FaucetError::InvalidAmount);
        }
        env.storage()
            .instance()
            .set(&DataKey::ClaimAmount, &claim_amount);
        extend_instance(&env);
        Ok(())
    }

    /// Drain funds back to the treasury. Admin only.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), FaucetError> {
        read_admin(&env).require_auth();
        if amount <= 0 {
            return Err(FaucetError::InvalidAmount);
        }
        let token_client = token::Client::new(&env, &read_token(&env));
        let vault = env.current_contract_address();
        if token_client.balance(&vault) < amount {
            return Err(FaucetError::InsufficientBalance);
        }
        token_client.transfer(&vault, &to, &amount);
        Ok(())
    }

    /// Rotate the admin. Admin only.
    pub fn set_admin(env: Env, new_admin: Address) {
        read_admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        extend_instance(&env);
    }

    // ── Views ────────────────────────────────────────────────────────────

    pub fn balance(env: Env) -> i128 {
        token::Client::new(&env, &read_token(&env)).balance(&env.current_contract_address())
    }

    pub fn claim_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::ClaimAmount)
            .unwrap()
    }

    pub fn admin(env: Env) -> Address {
        read_admin(&env)
    }

    pub fn token(env: Env) -> Address {
        read_token(&env)
    }
}

#[cfg(test)]
mod test;

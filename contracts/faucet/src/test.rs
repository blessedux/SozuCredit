#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

fn setup(
    claim_amount: i128,
) -> (
    Env,
    SozuFaucetClient<'static>,
    TokenClient<'static>,
    Address, // admin
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer.clone());
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let faucet_id = env.register(
        SozuFaucet,
        (admin.clone(), sac.address(), claim_amount),
    );
    let faucet = SozuFaucetClient::new(&env, &faucet_id);

    // Fund the faucet vault with 100 USDC (7 decimals).
    token_admin.mint(&faucet_id, &1_000_000_000);

    (env, faucet, token, admin)
}

#[test]
fn claim_default_amount() {
    let (env, faucet, token, _admin) = setup(10_000_000); // 1 USDC
    let user = Address::generate(&env);

    let paid = faucet.claim(&user, &0);
    assert_eq!(paid, 10_000_000);
    assert_eq!(token.balance(&user), 10_000_000);
    assert_eq!(faucet.balance(), 990_000_000);
}

#[test]
fn claim_explicit_amount() {
    let (env, faucet, token, _admin) = setup(10_000_000);
    let user = Address::generate(&env);

    let paid = faucet.claim(&user, &25_000_000); // 2.5 USDC
    assert_eq!(paid, 25_000_000);
    assert_eq!(token.balance(&user), 25_000_000);
}

#[test]
fn set_claim_amount_changes_default() {
    let (env, faucet, token, _admin) = setup(10_000_000);
    faucet.set_claim_amount(&5_000_000); // 0.5 USDC
    assert_eq!(faucet.claim_amount(), 5_000_000);

    let user = Address::generate(&env);
    faucet.claim(&user, &0);
    assert_eq!(token.balance(&user), 5_000_000);
}

#[test]
fn claim_fails_when_empty() {
    let (env, faucet, _token, admin) = setup(10_000_000);
    faucet.withdraw(&admin, &1_000_000_000); // drain

    let user = Address::generate(&env);
    let res = faucet.try_claim(&user, &0);
    assert_eq!(res, Err(Ok(FaucetError::InsufficientBalance)));
}

#[test]
fn withdraw_returns_funds_to_admin() {
    let (_env, faucet, token, admin) = setup(10_000_000);
    faucet.withdraw(&admin, &400_000_000);
    assert_eq!(token.balance(&admin), 400_000_000);
    assert_eq!(faucet.balance(), 600_000_000);
}

#[test]
fn claim_requires_admin_auth() {
    let (env, faucet, _token, _admin) = setup(10_000_000);
    env.set_auths(&[]); // drop mocked auths

    let user = Address::generate(&env);
    let res = faucet.try_claim(&user, &0);
    assert!(res.is_err());
}

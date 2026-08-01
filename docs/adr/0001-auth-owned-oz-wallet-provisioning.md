# Auth-owned OZ-only Wallet Provisioning

New users get a single OpenZeppelin passkey **Smart Account** created at the Auth boundary (signup or returning login). Home remounts only read the address and **Token Balance**; they never deploy or register a wallet in the background. If provisioning fails, the user enters **Setup Incomplete** and retries via an explicit Finish setup CTA. Factory fallback and classic trustline activation are not part of the new-user path — empty $0 after setup is valid; funding is **Deposit** (optional minimalist testnet faucet link inside Deposit only).

We chose this over “create anywhere with safety nets” because silent Home/factory retries produced duplicate provision paths, scary indexer failures that looked like create bugs, and a custodial-feeling UX. Non-custodial here means the **Passkey** alone authorizes spends; the server **Fee Payer** may sponsor gas.

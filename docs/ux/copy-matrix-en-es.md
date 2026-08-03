# Sozu Wallet — EN/ES copy matrix (auth, setup, pay/receive, checkout)

Source: party-mode UX (Kaan) → Nicole stories [#23](https://github.com/Sozu-Capital/sozu-wallet/issues/23)–[#30](https://github.com/Sozu-Capital/sozu-wallet/issues/30).  
Parent epic: [#31](https://github.com/Sozu-Capital/sozu-wallet/issues/31).  
Portuguese: tracked in [#32](https://github.com/Sozu-Capital/sozu-wallet/issues/32) — **not** in this matrix.

**Principles**

- Lead with pay/receive digital dollars, not USDC / chain architecture.
- Self-custody is felt at trust moments, not as wallpaper on every screen.
- Privacy as concrete access: “No ID upload to start” — not “no-KYC” as a slogan.
- Failure states preserve confidence: passkey succeeded ≠ wallet setup unfinished.
- Merchant checkout should feel like a normal payment.

Engineering domain terms (`Passkey`, `Smart Account`, `Fee Payer`, `Setup Incomplete`, `Deposit`, `Token Balance`) stay in `CONTEXT.md` / code. User-facing strings below may diverge.

---

## Welcome

| Key | EN | ES |
|-----|----|----|
| headline | Pay and receive digital dollars with a passkey. | Paga y recibe dólares digitales con una passkey. |
| payReceive | Pay and receive money from your Sozu account. | Paga y recibe dinero desde tu cuenta Sozu. |
| privacy | No ID upload to start. | Sin subir documento de identidad para empezar. |
| custodyTrust | Only you can approve payments — Sozu can’t move your money. | Solo tú apruebas los pagos — Sozu no puede mover tu dinero. |
| start | Get started | Comenzar |

## Auth lock

| Key | EN | ES |
|-----|----|----|
| authEnter | Enter | Entrar |
| authPasskeyCaption | Passkey on this device | Passkey en este dispositivo |

## Tag / register

| Key | EN | ES |
|-----|----|----|
| authChooseName | Choose your Sozu tag. | Elige tu Sozu tag. |
| authRegisterOnInternet | People can pay you with this name. | Con este nombre pueden pagarte. |
| authLearnMoreBody | Your Sozu tag is how people find you. A passkey on this device protects access. Nothing here is financial advice. | Tu Sozu tag es cómo te encuentran. Un passkey en este dispositivo protege el acceso. Nada aquí es asesoría financiera. |
| authRegister | Continue | Continuar |
| authSignIn | Sign in | Iniciar sesión |

> **Passkey-only (ADR-0002):** Backup PIN login/setup UI is removed; PIN APIs return 410. Account recovery is a later initiative — do not revive PIN as interim recovery.

## Setup incomplete (trust moment)

| Key | EN | ES |
|-----|----|----|
| setupIncompleteTitle | One more step | Un paso más |
| setupIncompleteBody | Your passkey is ready. Your account still needs to finish setting up on this device. Nothing has been funded yet. | Tu passkey ya está listo. Tu cuenta aún debe terminar de configurarse en este dispositivo. Todavía no hay fondos. |
| setupIncompleteCta | Finish setup | Terminar configuración |
| setupIncompleteBusy | Setting up your account… | Configurando tu cuenta… |

## Cross-device QR (must be localized — no English islands)

| Key | EN | ES |
|-----|----|----|
| qrTitle | Complete setup on your phone | Completa la configuración en tu teléfono |
| qrBody | This device doesn’t have biometrics. Scan the QR with your phone to finish registration. | Este dispositivo no tiene biometría. Escanea el QR con tu teléfono para terminar el registro. |
| qrGenerating | Generating QR code… | Generando código QR… |
| qrScan | Scan with your phone | Escanea con tu teléfono |
| qrWaiting | Waiting for your phone… | Esperando tu teléfono… |
| qrCameraHint | Open your phone’s camera and scan this code | Abre la cámara de tu teléfono y escanea este código |
| qrTimeout | QR expired. Registration wasn’t completed in time. | El QR expiró. El registro no se completó a tiempo. |
| qrRetry | Try again | Intentar de nuevo |
| qrError | Couldn’t create the QR code. Try again. | No se pudo crear el código QR. Intenta de nuevo. |
| qrConnectionError | Connection error. Try again. | Error de conexión. Intenta de nuevo. |

## Receive / Add money (user-facing; domain may still say Deposit)

| Key | EN | ES |
|-----|----|----|
| cmdDeposit / depositTitle | Receive | Recibir |
| depositHero | Receive money | Recibir dinero |
| depositShareHint | Share your Sozu tag or QR. | Comparte tu Sozu tag o QR. |
| depositDetailsToggle | Payment details | Detalles del pago |
| depositUsdcOnly (details) | Advanced: send Circle USDC on testnet to this address | Avanzado: envía Circle USDC en testnet a esta dirección |
| depositSmartAccountHint (details) | Personal wallet address | Dirección de billetera personal |

Default path shows Sozu tag / QR. Chain / Circle / C-address live behind details.

## Pay

| Key | EN | ES |
|-----|----|----|
| cmdPay | Pay | Pagar |
| confirmWithPasskey | Confirm with passkey… | Confirmar con passkey… |
| sendPayment | Pay | Pagar |

Confirmation answers: who, how much, what they’re approving — not “sign transaction.”

## Checkout (merchant)

| Key | EN | ES |
|-----|----|----|
| checkoutPayWithSozu | Pay with Sozu | Pagar con Sozu |
| checkoutOneTap | One-tap payment | Pago en un toque |
| checkoutSignInToPay | Sign in to pay | Inicia sesión para pagar |
| checkoutConfirmPasskey | Confirm with your passkey | Confirma con tu passkey |
| checkoutProcessing | Processing payment… | Procesando el pago… |
| checkoutPaid | Paid | Pagado |
| checkoutToMerchant | to {merchant} | a {merchant} |
| checkoutLoading | Loading checkout… | Cargando el pago… |

Avoid USDC / Stellar / gas / “transaction” jargon on the default path. Cashback, if shown, uses plain money language (“reward”) not “USDC credited.”

---

## Locale behavior

| Situation | Language |
|-----------|----------|
| User saved preference (`sozu_app_language:v2`) | Saved `en` / `es` |
| Browser `es*` | `es` |
| Browser `en*` | `en` |
| Browser `pt*` | `en` until [#32](https://github.com/Sozu-Capital/sozu-wallet/issues/32) |
| Unknown / SSR | `en` |

Selector remains ES | EN until Portuguese ships.

/**
 * Faucet copy (Spanish-first, per docs/FAUCET_screens.md).
 * Kept separate from lib/wallet-texts.ts — the faucet is its own surface.
 */

export type FaucetLanguage = "es" | "en";

export type FaucetTexts = {
  availableTitle: string;
  availableBody: string;
  claimCta: string;
  howItWorks: string;
  tooltipTitle: string;
  tooltipBody: string;
  noWalletTitle: string;
  noWalletBody: string;
  createWalletCta: string;
  claimingTitle: string;
  claimingBody: string;
  successTitle: string;
  successAmount: (amount: number) => string;
  successReceived: string;
  successBody: string;
  viewWalletCta: string;
  emptyTitle: string;
  emptyBody: string;
  emptyPoetic: string;
  viewMapCta: string;
  globalCooldownTitle: string;
  globalCooldownBody: string;
  userCooldownTitle: string;
  userCooldownBody: string;
  userCooldownThanks: string;
  errorTitle: string;
  errorBody: string;
  retryCta: string;
  inactiveTitle: string;
  inactiveBody: string;
  loadingLabel: string;
  notFoundTitle: string;
  notFoundBody: string;
  mapHeader: string;
  mapSubtext: string;
  mapOpenFaucet: string;
  mapStateAvailable: string;
  mapStateCooldown: string;
  mapStateEmpty: string;
  countdownLabel: (time: string) => string;
  minutesShort: string;
  hoursShort: string;
  depositCta: string;
  depositTitle: string;
  depositBody: string;
  depositAmountPlaceholder: string;
  depositConfirm: string;
  depositPreparing: string;
  depositSigning: string;
  depositSubmitting: string;
  depositSuccessTitle: string;
  depositSuccessBody: (amount: number) => string;
  depositError: string;
  depositNeedAuth: string;
  depositClose: string;
};

const es: FaucetTexts = {
  availableTitle: "La fuente está activa.",
  availableBody:
    "Acabas de descubrir uno de los primeros Sozu Faucets.\n\nCada cierto tiempo liberamos una pequeña cantidad de USDC para demostrar cómo puede moverse el dinero en internet: instantáneo, programable y sin intermediarios.\n\nHoy hay fondos disponibles para ti.",
  claimCta: "Reclamar ahora",
  howItWorks: "¿Cómo funciona esto?",
  tooltipTitle: "¿Por qué estoy recibiendo dinero?",
  tooltipBody:
    "Sozu está construyendo una nueva infraestructura financiera sobre redes abiertas.\n\nEste faucet existe para que puedas experimentar la tecnología directamente.\n\nNo hay compras. No hay tarjetas. No hay letra chica.\n\nSimplemente reclamando fondos podrás probar cómo funciona una billetera autocustodiada y enviar valor digital a cualquier persona del mundo.\n\nLo único que te pedimos es feedback honesto.",
  noWalletTitle: "Necesitas una wallet para recibir fondos.",
  noWalletBody:
    "Tomará menos de un minuto.\n\nCrearemos una cuenta protegida por Passkeys para que puedas recibir, guardar y enviar dinero digital de forma segura.\n\nUna vez creada, volverás automáticamente al faucet.",
  createWalletCta: "Crear wallet",
  claimingTitle: "Activando la fuente…",
  claimingBody:
    "Estamos verificando disponibilidad y preparando tu transferencia.\n\nEsto normalmente tarda unos segundos.",
  successTitle: "Fondos recibidos.",
  successAmount: (amount) => `+${amount} USDC`,
  successReceived: "Recibido",
  successBody:
    "La transferencia fue confirmada exitosamente.\n\nBienvenido a la beta pública inicial de Sozu.",
  viewWalletCta: "Volver",
  emptyTitle: "La fuente ya fue reclamada.",
  emptyBody:
    "Alguien llegó antes.\n\nEl faucet libera fondos periódicamente y actualmente no hay saldo disponible.\n\nVuelve más tarde o explora otros faucets disponibles en el mapa.",
  emptyPoetic: "La fuente descansa. Otro viajero llegó primero.",
  viewMapCta: "Ver mapa",
  globalCooldownTitle: "La fuente se está recargando.",
  globalCooldownBody:
    "Este faucet solo puede liberar fondos una vez por ciclo.\n\nLa próxima activación ocurrirá en:",
  userCooldownTitle: "Ya reclamaste recientemente.",
  userCooldownBody:
    "Para que más personas puedan participar, cada wallet puede reclamar una vez por período.\n\nPodrás volver a intentarlo en:",
  userCooldownThanks: "Gracias por compartir la fuente.",
  errorTitle: "Algo salió mal.",
  errorBody:
    "No pudimos completar la transferencia.\n\nTus fondos no fueron descontados ni utilizados.\n\nIntenta nuevamente en unos momentos.",
  retryCta: "Reintentar",
  inactiveTitle: "Esta fuente está dormida.",
  inactiveBody: "Este faucet no está activo por ahora. Explora otros en el mapa.",
  loadingLabel: "Conectando con la fuente…",
  notFoundTitle: "Fuente no encontrada.",
  notFoundBody: "Este faucet no existe o fue retirado. Explora el mapa para encontrar otros.",
  mapHeader: "Fuentes activas",
  mapSubtext:
    "Explora la ciudad y descubre lugares donde el dinero digital fluye libremente.",
  mapOpenFaucet: "Abrir fuente",
  mapStateAvailable: "Disponible",
  mapStateCooldown: "Recargando",
  mapStateEmpty: "Agotada por hoy",
  countdownLabel: (time) => `${time}`,
  minutesShort: "min",
  hoursShort: "h",
  depositCta: "Depositar en la fuente",
  depositTitle: "Recarga la fuente.",
  depositBody:
    "Deposita USDC desde tu wallet para que más personas puedan reclamar de este faucet.",
  depositAmountPlaceholder: "Monto en USDC",
  depositConfirm: "Depositar",
  depositPreparing: "Preparando transferencia…",
  depositSigning: "Confirma con tu passkey…",
  depositSubmitting: "Enviando a la fuente…",
  depositSuccessTitle: "Fuente recargada.",
  depositSuccessBody: (amount) => `Depositaste ${amount} USDC en la fuente.`,
  depositError: "No pudimos completar el depósito. Intenta nuevamente.",
  depositNeedAuth: "Inicia sesión con tu wallet para depositar.",
  depositClose: "Cerrar",
};

const en: FaucetTexts = {
  availableTitle: "The fountain is active.",
  availableBody:
    "You just discovered one of the first Sozu Faucets.\n\nEvery so often we release a small amount of USDC to show how money can move on the internet: instant, programmable, with no intermediaries.\n\nThere are funds available for you today.",
  claimCta: "Claim now",
  howItWorks: "How does this work?",
  tooltipTitle: "Why am I receiving money?",
  tooltipBody:
    "Sozu is building new financial infrastructure on open networks.\n\nThis faucet exists so you can experience the technology directly.\n\nNo purchases. No cards. No fine print.\n\nBy claiming funds you can try a self-custodied wallet and send digital value to anyone in the world.\n\nAll we ask for is honest feedback.",
  noWalletTitle: "You need a wallet to receive funds.",
  noWalletBody:
    "It takes less than a minute.\n\nWe'll create an account protected by Passkeys so you can receive, hold, and send digital money securely.\n\nOnce created, you'll automatically return to the faucet.",
  createWalletCta: "Create wallet",
  claimingTitle: "Activating the fountain…",
  claimingBody:
    "We're verifying availability and preparing your transfer.\n\nThis usually takes a few seconds.",
  successTitle: "Funds received.",
  successAmount: (amount) => `+${amount} USDC`,
  successReceived: "Received",
  successBody:
    "The transfer was confirmed successfully.\n\nWelcome to Sozu's initial public beta.",
  viewWalletCta: "Back",
  emptyTitle: "The fountain has been claimed.",
  emptyBody:
    "Someone got here first.\n\nThe faucet releases funds periodically and there's no balance available right now.\n\nCome back later or explore other faucets on the map.",
  emptyPoetic: "The source is resting. Another traveler reached it first.",
  viewMapCta: "View map",
  globalCooldownTitle: "The fountain is recharging.",
  globalCooldownBody:
    "This faucet can only release funds once per cycle.\n\nThe next activation will occur in:",
  userCooldownTitle: "You claimed recently.",
  userCooldownBody:
    "So more people can participate, each wallet can claim once per period.\n\nYou can try again in:",
  userCooldownThanks: "Thanks for sharing the fountain.",
  errorTitle: "Something went wrong.",
  errorBody:
    "We couldn't complete the transfer.\n\nYour funds were not deducted or used.\n\nTry again in a few moments.",
  retryCta: "Retry",
  inactiveTitle: "This fountain is asleep.",
  inactiveBody: "This faucet isn't active right now. Explore others on the map.",
  loadingLabel: "Connecting to the source…",
  notFoundTitle: "Fountain not found.",
  notFoundBody: "This faucet doesn't exist or was removed. Explore the map to find others.",
  mapHeader: "Active fountains",
  mapSubtext:
    "Explore the city and discover places where digital money flows freely.",
  mapOpenFaucet: "Open fountain",
  mapStateAvailable: "Available",
  mapStateCooldown: "Recharging",
  mapStateEmpty: "Empty today",
  countdownLabel: (time) => `${time}`,
  minutesShort: "min",
  hoursShort: "h",
  depositCta: "Deposit into faucet",
  depositTitle: "Recharge the fountain.",
  depositBody:
    "Deposit USDC from your wallet so more people can claim from this faucet.",
  depositAmountPlaceholder: "Amount in USDC",
  depositConfirm: "Deposit",
  depositPreparing: "Preparing transfer…",
  depositSigning: "Confirm with your passkey…",
  depositSubmitting: "Sending to the fountain…",
  depositSuccessTitle: "Fountain recharged.",
  depositSuccessBody: (amount) => `You deposited ${amount} USDC into the fountain.`,
  depositError: "We couldn't complete the deposit. Try again.",
  depositNeedAuth: "Sign in with your wallet to deposit.",
  depositClose: "Close",
};

const texts: Record<FaucetLanguage, FaucetTexts> = { es, en };

export function getFaucetTexts(lang: FaucetLanguage): FaucetTexts {
  return texts[lang] ?? texts.es;
}

/** Same storage key as the wallet language switcher; Spanish by default. */
export function readFaucetLanguage(): FaucetLanguage {
  if (typeof window === "undefined") return "es";
  try {
    const stored = localStorage.getItem("sozu_app_language:v2");
    return stored === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

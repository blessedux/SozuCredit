/**
 * Wallet page translations
 * Type-safe text access for wallet components
 */

export type WalletTexts = {
  // Profile
  title: string;
  editProfile: string;
  username: string;
  profilePicture: string;
  walletAddress: string;
  walletAddressDesc: string;
  walletCopied: string;
  clickToCopy: string;
  addy: string;
  fundYourAddress: string;
  language: string;
  currency: string;
  currencyDesc: string;
  save: string;
  cancel: string;
  english: string;
  spanish: string;
  changePicture: string;
  xlm: string;
  usd: string;
  dollars: string;
  currencyDisplay: string;
  // Balance
  totalBalance: string;
  todayAPY: string;
  // Send Payment
  sendPayment: string;
  sendPaymentDesc: string;
  continue: string;
  manualTransaction: string;
  useSozuTag: string;
  resolving: string;
  sending: string;
  confirmWithPasskey: string;
  submitting: string;
  send: string;
  sendTapToSwitchCurrency: string;
  sendApproxUsdc: string;
  sendApproxFiat: string;
  sendInsufficientBalance: string;
  pizzaBalanceRow: string;
  // Success Modal
  transactionSuccessful: string;
  transactionSuccessfulDesc: string;
  done: string;
  receiptShareTitle: string;
  receiptShareHeading: string;
  receiptShareFooter: string;
  receiptAmountLabel: string;
  receiptFromLabel: string;
  receiptToLabel: string;
  receiptDateLabel: string;
  receiptNetworkLabel: string;
  receiptNetworkTestnet: string;
  receiptNetworkMainnet: string;
  receiptTxLabel: string;
  receiptMemoLabel: string;
  receiptCopyInvoice: string;
  receiptCopied: string;
  receiptCopyFailed: string;
  receiptSmsLabel: string;
  receiptMoreLabel: string;
  receiptDetailTitle: string;
  receiptDetailDesc: string;
  receiptShareImage: string;
  receiptSharingImage: string;
  receiptImageSaved: string;
  receiptShareImageFailed: string;
  // Transaction History
  loadingTransactions: string;
  noTransactions: string;
  emptyHistoryHint: string;
  emptyHistoryCta: string;
  recentActivity: string;
  onChainActivity: string;
  showLess: string;
  showAll: string;
  transactions: string;
  panelHome: string;
  panelHistory: string;
  authFailed: string;
  authCancelledHint: string;
  // Error Messages
  somethingWentWrong: string;
  unexpectedError: string;
  reloadPage: string;
  // Balance Audit
  balanceAudit: string;
  balanceAuditDesc: string;
  wallet: string;
  defiStrategy: string;
  total: string;
  shares: string;
  viewBlendStrategy: string;
  noBalanceData: string;
  // Profile
  checkAccountStatus: string;
  checking: string;
  network: string;
  xlmBalance: string;
  usdcTrustline: string;
  usdcIssuer: string;
  exists: string;
  notFound: string;
  lowBalance: string;
  forStellarLab: string;
  selectNetwork: string;
  useIssuer: string;
  ensureBalance: string;
  createWalletDesc: string;
  settings: string;
  // Notifications
  notifications: string;
  noNotifications: string;
  unreadNotifications: string;
  // Create Wallet
  createNewWallet: string;
  // Trust Points
  trustPoints: string;
  trustPointsTitle: string;
  currentBalance: string;
  whatAreTrustPoints: string;
  trustPointsDesc: string;
  howToGetMore: string;
  waitForDaily: string;
  inviteUsers: string;
  receivePoints: string;
  viewInviteCode: string;
  vouchForUser: string;
  // Invite Code
  yourInviteCode: string;
  inviteCodeDesc: string;
  copyCode: string;
  codeCopied: string;
  copyInviteCode: string;
  back: string;
  // Vouch
  vouchTitle: string;
  vouchDesc: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  pointsToSend: string;
  available: string;

  sendPoints: string;
  pointsSentSuccess: string;
  pointsSentError: string;
  notAuthenticated: string;
  // Profile button
  openProfile: string;
  closeProfile: string;
  logout: string;
  logoutConfirm: string;
  // Social share
  inviteMessage: string;
  codeCopiedShare: string;
  // EVM Address
  linkEvmAddress: string;
  evmAddressTitle: string;
  evmAddressDesc: string;
  evmAddressPlaceholder: string;
  linkAddress: string;
  unlinkAddress: string;
  evmAddressLinked: string;
  evmAddressNotLinked: string;
  maxflowScore: string;
  localHealth: string;
  totalNodes: string;
  acceptedUsers: string;
  loadingScore: string;
  errorLoadingScore: string;
  evmAddressCopied: string;
  // Treasury purchasing power
  treasuryPerformance: string;
  purchasingPowerImpact: string;
  inflationAvoided: string;
  fxProtection: string;
  projectedEarnings: string;
  treasuryModeEfficient: string;
  treasuryModeBalanced: string;
  treasuryModeFast: string;
  holdingPeriod: string;
  estimatedDisclaimer: string;
  referenceFiatNote: string;
  vsLocalFiatComparison: string;
  // App shell & commands
  commandTitle: string;
  cmdPay: string;
  cmdBatch: string;
  cmdOfframp: string;
  cmdDeposit: string;
  cmdPlan: string;
  cmdCredit: string;
  // Credit page
  creditPageTitle: string;
  creditPageSubtitle: string;
  creditYourCredits: string;
  creditNoCredits: string;
  creditApplyTitle: string;
  creditApplyDesc: string;
  creditProgramSoon: string;
  creditApplyButton: string;
  creditApplySuccess: string;
  creditAlreadyApplied: string;
  creditStatusPending: string;
  creditStatusApproved: string;
  creditStatusActive: string;
  creditStatusRepaid: string;
  creditStatusRejected: string;
  creditEligibilityTitle: string;
  creditEligibilityEligible: string;
  creditEligibilityProgress: string;
  creditBackHome: string;
  creditLegacyProgramName: string;
  creditProgramMujeres2000Name: string;
  creditProgramMujeres2000Desc: string;
  creditProgramEmprende500Name: string;
  creditProgramEmprende500Desc: string;
  creditProgramComunidad1kName: string;
  creditProgramComunidad1kDesc: string;
  creditProgramRapido250Name: string;
  creditProgramRapido250Desc: string;
  creditTermDays: string;
  comingSoon: string;
  comingSoonDesc: string;
  testnetBadge: string;
  activateWallet: string;
  activating: string;
  openCashflow: string;
  // Deposit modal
  depositTitle: string;
  depositClose: string;
  depositQrTypeLabel: string;
  depositQrTag: string;
  depositQrStellar: string;
  depositSozuTag: string;
  depositStellarAddress: string;
  depositCopied: string;
  depositNoWallet: string;
  depositUsdcOnly: string;
  depositLegacyGWarning: string;
  depositSmartAccountHint: string;
  depositResolvingWallet: string;
  depositTagCaption: string;
  depositAddressCaption: string;
  depositConnectWallet: string;
  depositBlendTitle: string;
  depositBlendHint: string;
  depositBlendFaucet: string;
  depositBlendPool: string;
  /** CTA that claims testnet Circle USDC via Sozu Faucet (Deposit). */
  depositFaucetCta: string;
  depositFaucetHint: string;
  depositFaucetBusy: string;
  depositFaucetSuccess: string;
  depositFaucetError: string;
  // Fiat deposit flow (bank transfer)
  depositFiatTabLabel: string;
  depositCryptoTabLabel: string;
  depositFiatTitle: string;
  depositFiatAmountLabel: string;
  depositFiatAmountPlaceholder: string;
  depositFiatMinError: string;
  depositFiatSubmit: string;
  depositFiatSubmitting: string;
  depositFiatInstructionsTitle: string;
  depositFiatBankLabel: string;
  depositFiatAccountLabel: string;
  depositFiatRutLabel: string;
  depositFiatEmailLabel: string;
  depositFiatReferenceLabel: string;
  depositFiatReferenceHint: string;
  depositFiatAmountConfirmLabel: string;
  depositFiatReceiveLabel: string;
  depositFiatCopied: string;
  depositFiatCopy: string;
  depositFiatDone: string;
  depositFiatStatusLabel: string;
  depositFiatStatusAwaiting: string;
  depositFiatStatusReceived: string;
  depositFiatStatusProcessing: string;
  depositFiatStatusCompleted: string;
  depositFiatStatusFailed: string;
  depositFiatError: string;
  depositFiatNoWallet: string;
  depositFiatProofLabel: string;
  depositFiatProofPlaceholder: string;
  depositFiatProofSubmit: string;
  depositFiatProofSent: string;
  depositFiatMethodBank: string;
  depositFiatMethodCard: string;
  depositFiatQuoteLabel: string;
  depositFiatQuoteLoading: string;
  depositFiatCardRedirect: string;
  depositFiatCardSubmit: string;
  depositFiatFxSource: string;
  // Brazil PIX on-ramp / off-ramp (Etherfuse)
  rampCountryLabel: string;
  rampCountryChile: string;
  rampCountryBrazil: string;
  rampOnboardTitle: string;
  rampOnboardNameLabel: string;
  rampOnboardEmailLabel: string;
  rampOnboardStart: string;
  rampOnboardVerifying: string;
  rampOnboardOpenKyc: string;
  rampOnboardKycHint: string;
  rampBankTitle: string;
  rampFirstName: string;
  rampLastName: string;
  rampCpf: string;
  rampPixKey: string;
  rampPixKeyType: string;
  rampSaveBank: string;
  rampAmountLabel: string;
  rampQuoteReceive: string;
  rampQuoteFee: string;
  rampQuoteExpires: string;
  rampCreateOrder: string;
  rampDepositTitle: string;
  rampDepositAmount: string;
  rampDepositBank: string;
  rampDepositHolder: string;
  rampStatusPending: string;
  rampStatusFunded: string;
  rampStatusSettling: string;
  rampStatusCompleted: string;
  rampStatusFailed: string;
  rampStatusRefunded: string;
  rampSimulate: string;
  rampErrorGeneric: string;
  rampOfframpTitle: string;
  rampOfframpAmountLabel: string;
  rampOfframpAmountPlaceholder: string;
  rampOfframpSign: string;
  rampOfframpSettling: string;
  rampOfframpClose: string;
  rampOfframpUserTxLabel: string;
  rampOfframpSettlementTxLabel: string;
  rampKycReturnTitle: string;
  rampKycReturnBody: string;
  rampNoWallet: string;
  rampCpfPlaceholder: string;
  rampAmountPlaceholder: string;
  rampInstructionsConfirm: string;
  rampPixKeyTypeEmail: string;
  rampPixKeyTypePhone: string;
  rampPixKeyTypeCpf: string;
  rampPixKeyTypeRandom: string;
  // Balance card
  hideBalance: string;
  showBalance: string;
  purchasingPowerSubline: string;
  apyBlendLabel: string;
  auditBreakdown: string;
  closeTreasury: string;
  backToBalance: string;
  // Treasury audit panel
  treasuryPanelTitle: string;
  treasuryPanelSubtitle: string;
  close: string;
  usdcBalanceSection: string;
  walletBalanceLabel: string;
  walletBlendBalanceLabel: string;
  walletSacBalanceLabel: string;
  walletSignerBalanceLabel: string;
  walletSacSendHint: string;
  balanceAuditZeroHint: string;
  defiStrategyLabel: string;
  totalLabel: string;
  defindexSharesLabel: string;
  projectionParams: string;
  treasuryModeLabel: string;
  periodDaysLabel: string;
  activePlan: string;
  suggestedWithdrawals: string;
  strategyAllocation: string;
  projectionHeading: string;
  blendYield: string;
  totalPurchasingPowerTitle: string;
  howCalculated: string;
  noProjection: string;
  viewBlendPool: string;
  poolApyLabel: string;
  effectiveApyCompare: string;
  verifyBlendPool: string;
  treasuryModeEfficientDesc: string;
  treasuryModeBalancedDesc: string;
  treasuryModeFastDesc: string;
  notBlendApyNote: string;
  localFiatLossNote: string;
  periodTotalLine: string;
  periodLayerBreakdown: string;
  // Chart
  chartPurchasingPower: string;
  chartToday: string;
  chartDayLabel: string;
  chartDailyDelta: string;
  chartNoProjection: string;
  chartPnlTitle: string;
  chartVsInitialBalance: string;
  chartFootnote: string;
  cashflowLink: string;
  settingsLanguageDesc: string;
  // Math breakdown
  mathBaseBalance: string;
  mathBaseBalanceDetail: string;
  mathAnnualCpi: string;
  mathAnnualCpiDetail: string;
  mathFxPeriod: string;
  mathFxPeriodDetail: string;
  mathProtocolApy: string;
  mathProtocolApyDetail: string;
  mathEffectiveApy: string;
  mathEffectiveApyDetail: string;
  mathDefiYield: string;
  mathDefiYieldDetail: string;
  mathInflationAvoidedDetail: string;
  mathFxProtectionDetail: string;
  mathPeriodTotal: string;
  mathPeriodTotalDetail: string;
  mathAnnualized: string;
  mathAnnualizedDetail: string;
  mathVsLocalFiat: string;
  mathVsLocalFiatDetail: string;
  mathPerYear: string;
  // Auth
  authEnter: string;
  authPasskeyCaption: string;
  authLoading: string;
  authPwaBannerIos: string;
  authPwaBannerAndroid: string;
  authPwaInstallIos: string;
  authPwaInstallAndroid: string;
  authClose: string;
  authChooseName: string;
  authRegisterOnInternet: string;
  authLearnMore: string;
  authLearnMoreBody: string;
  authTagPlaceholder: string;
  authSignIn: string;
  authRegister: string;
  authTagLengthError: string;
  authTagCharsError: string;
  authCouldNotCheck: string;
  authCouldNotSignIn: string;
  authPinLengthError: string;
  authPasskey: string;
  authBackupPin: string;
  authPinPlaceholder: string;
  authContinueWithPin: string;
  authNoBackupPin: string;
  authBack: string;
  authUsernameFree: string;
  authUsernameTakenPasskey: string;
  authUsernameTakenPasskeyPin: string;
  authDeviceChoiceTitle: string;
  authDeviceChoiceBody: string;
  authDeviceChoiceScan: string;
  authDeviceChoiceScanHint: string;
  authDeviceChoiceCreate: string;
  authDeviceChoiceCreateHint: string;
  setupIncompleteTitle: string;
  setupIncompleteBody: string;
  setupIncompleteCta: string;
  setupIncompleteBusy: string;
};

export type WalletLanguage = "en" | "es";

export type TreasuryModeKey = "efficient" | "balanced" | "fast";

export function formatWalletText(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}

export function getTreasuryModeLabel(mode: TreasuryModeKey, t: WalletTexts): string {
  const labels: Record<TreasuryModeKey, string> = {
    efficient: t.treasuryModeEfficient,
    balanced: t.treasuryModeBalanced,
    fast: t.treasuryModeFast,
  };
  return labels[mode];
}

export function getTreasuryModeDescription(mode: TreasuryModeKey, t: WalletTexts): string {
  const descriptions: Record<TreasuryModeKey, string> = {
    efficient: t.treasuryModeEfficientDesc,
    balanced: t.treasuryModeBalancedDesc,
    fast: t.treasuryModeFastDesc,
  };
  return descriptions[mode];
}

export const walletTexts = {
  es: {
    // Profile
    title: "Mi Perfil",
    editProfile: "Editar Perfil",
    username: "Nombre de Usuario",
    profilePicture: "Foto de Perfil",
    walletAddress: "Dirección de Billetera",
    walletAddressDesc: "Tu dirección privada de billetera",
    walletCopied: "Dirección copiada al portapapeles",
    clickToCopy: "Toca para copiar",
    addy: "Addy",
    fundYourAddress: "Fondea tu dirección para activar tu cuenta.",
    language: "Idioma",
    currency: "Moneda",
    currencyDesc: "Selecciona cómo quieres ver tu balance",
    save: "Guardar",
    cancel: "Cancelar",
    english: "Inglés",
    spanish: "Español",
    changePicture: "Cambiar Foto",
    xlm: "XLM",
    usd: "USD",
    dollars: "Dólares",
    currencyDisplay: "USD",
    // Balance
    totalBalance: "Saldo Total",
    todayAPY: "APY de Hoy",
    // Send Payment
    sendPayment: "Enviar Pago",
    sendPaymentDesc: "Envía Dólares a un destinatario",
    continue: "Continuar",
    manualTransaction: "Transacción manual",
    useSozuTag: "Usar Sozu en su lugar",
    resolving: "Resolviendo...",
    sending: "Enviando...",
    confirmWithPasskey: "Confirmar con passkey...",
    submitting: "Enviando transacción...",
    send: "Enviar",
    sendTapToSwitchCurrency: "Toca la moneda para cambiar",
    sendApproxUsdc: "≈ {amount} USDC",
    sendApproxFiat: "≈ {amount} {fiat}",
    sendInsufficientBalance: "Monto mayor al disponible",
    pizzaBalanceRow: "{count} PIZZA",
    // Success Modal
    transactionSuccessful: "Transacción Exitosa",
    transactionSuccessfulDesc: "Tu pago fue enviado exitosamente",
    done: "Hecho",
    receiptShareTitle: "📄 Comprobante Sozu",
    receiptShareHeading: "Compartir comprobante",
    receiptShareFooter: "Enviado con Sozu Wallet",
    receiptAmountLabel: "Monto",
    receiptFromLabel: "De",
    receiptToLabel: "Para",
    receiptDateLabel: "Fecha",
    receiptNetworkLabel: "Red",
    receiptNetworkTestnet: "Stellar Testnet",
    receiptNetworkMainnet: "Stellar Mainnet",
    receiptTxLabel: "Tx",
    receiptMemoLabel: "Memo",
    receiptCopyInvoice: "Copiar comprobante",
    receiptCopied: "Comprobante copiado",
    receiptCopyFailed: "No se pudo copiar",
    receiptSmsLabel: "Mensajes",
    receiptMoreLabel: "Más",
    receiptDetailTitle: "Detalle de transacción",
    receiptDetailDesc: "Comprobante de pago",
    receiptShareImage: "Compartir como imagen",
    receiptSharingImage: "Preparando imagen…",
    receiptImageSaved: "Comprobante guardado — adjúntalo en tu app",
    receiptShareImageFailed: "No se pudo compartir la imagen",
    // Transaction History
    loadingTransactions: "Cargando transacciones...",
    noTransactions: "Aún no hay transacciones",
    emptyHistoryHint: "Deposita USDC para ver tu actividad aquí.",
    emptyHistoryCta: "Depositar USDC",
    recentActivity: "Actividad reciente",
    onChainActivity: "Actividad on-chain",
    panelHome: "Inicio",
    panelHistory: "Historial",
    authFailed: "No se pudo iniciar sesión. Inténtalo de nuevo.",
    authCancelledHint: "Inicio de sesión cancelado. Puedes intentar otra vez.",
    showLess: "Mostrar menos",
    showAll: "Ver todas",
    transactions: "transacciones",
    // Error Messages
    somethingWentWrong: "Algo salió mal",
    unexpectedError:
      "Ocurrió un error inesperado en el componente de billetera.",
    reloadPage: "Recargar Página",
    // Balance Audit
    balanceAudit: "Auditoría de Balance",
    balanceAuditDesc: "Desglose detallado de tu balance",
    wallet: "Billetera:",
    defiStrategy: "Estrategia DeFi:",
    total: "Total:",
    shares: "Acciones:",
    viewBlendStrategy: "Ver Estrategia Blend",
    noBalanceData: "No hay datos de balance disponibles",
    // Profile
    checkAccountStatus: "Verificar Estado de Cuenta",
    checking: "Verificando...",
    network: "Red:",
    xlmBalance: "Balance XLM:",
    usdcTrustline: "Línea de Confianza USDC:",
    usdcIssuer: "Emisor USDC:",
    exists: "Existe",
    notFound: "No encontrado",
    lowBalance:
      "¡Balance bajo! Necesitas al menos 1.5 XLM para crear una línea de confianza.",
    forStellarLab: "Para Stellar Lab:",
    selectNetwork: "Selecciona la red",
    useIssuer: "Usa el emisor:",
    ensureBalance: "Asegúrate de que el balance ≥ 1.5 XLM",
    createWalletDesc:
      "Crea tu billetera no custodial con cuenta Stellar real y línea de confianza USDC",
    settings: "Configuración",
    // Notifications
    notifications: "Notificaciones",
    noNotifications: "Aún no hay notificaciones",
    unreadNotifications: "notificaciones no leídas",
    // Create Wallet
    createNewWallet: "Comenzar ahora",
    // Trust Points
    trustPoints: "Puntos de Confianza",
    trustPointsTitle: "Puntos de Confianza",
    currentBalance: "Tu saldo actual:",
    whatAreTrustPoints: "¿Qué son los Puntos de Confianza?",
    trustPointsDesc:
      "Los puntos de confianza son una medida de tu reputación en la plataforma. Puedes usarlos para apoyar a otros usuarios o aumentar tu elegibilidad para créditos.",
    howToGetMore: "¿Cómo obtener más puntos?",
    waitForDaily: "Espera para reclamar tu bono diario",
    inviteUsers: "Invita nuevos usuarios con tu código de invitación",
    receivePoints: "Recibe puntos de otros usuarios que te apoyen",
    viewInviteCode: "Ver Código de Invitación",
    vouchForUser: "Apoyar un Proyecto",
    // Invite Code
    yourInviteCode: "Tu Código de Invitación",
    inviteCodeDesc:
      "Comparte este código con nuevos usuarios. Cuando se registren usando tu código, recibirás 1 punto de confianza.",
    copyCode: "Copiar Código",
    codeCopied: "Código copiado al portapapeles",
    copyInviteCode: "Copiar Código de Invitación",
    back: "Volver",
    // Vouch
    vouchTitle: "Apoyar un Proyecto",
    vouchDesc:
      "Ingresa el nombre de usuario y envía puntos de confianza para apoyarlos.",
    usernameLabel: "Nombre de Usuario",
    usernamePlaceholder: "Nombre de usuario",
    pointsToSend: "Puntos a Enviar",
    available: "Disponible:",

    sendPoints: "Enviar Puntos",
    pointsSentSuccess: "Puntos de confianza enviados exitosamente",
    pointsSentError: "Error al enviar puntos",
    notAuthenticated: "Usuario no autenticado",
    // Profile button
    openProfile: "Abrir perfil",
    closeProfile: "Cerrar perfil",
    logout: "Cerrar Sesión",
    logoutConfirm: "¿Estás seguro de que quieres cerrar sesión?",
    // Social share
    inviteMessage:
      "¡Únete a Sozu Wallet! Usa mi código de invitación: {code} y recibamos ambos puntos de confianza extra.",
    codeCopiedShare: "Código copiado al portapapeles. ¡Listo para compartir!",
    // EVM Address
    linkEvmAddress: "Vincular Dirección EVM",
    evmAddressTitle: "Dirección EVM para MaxFlow",
    evmAddressDesc:
      "Vincula tu dirección Ethereum para obtener tu puntuación de ego de MaxFlow",
    evmAddressPlaceholder: "0x...",
    linkAddress: "Vincular Dirección",
    unlinkAddress: "Desvincular",
    evmAddressLinked: "Dirección vinculada",
    evmAddressNotLinked: "No hay dirección vinculada",
    maxflowScore: "Puntuación MaxFlow",
    localHealth: "Salud Local",
    totalNodes: "Nodos Totales",
    acceptedUsers: "Usuarios Aceptados",
    loadingScore: "Cargando puntuación...",
    errorLoadingScore: "Error al cargar puntuación",
    evmAddressCopied: "Dirección copiada",
    // Treasury purchasing power
    treasuryPerformance: "Rendimiento de Tesorería",
    purchasingPowerImpact: "Impacto en poder adquisitivo",
    inflationAvoided: "Inflación evitada",
    fxProtection: "Protección cambiaria",
    projectedEarnings: "Ganancias proyectadas",
    treasuryModeEfficient: "Eficiente",
    treasuryModeBalanced: "Balanceado",
    treasuryModeFast: "Rápido",
    holdingPeriod: "Período",
    estimatedDisclaimer: "Estimado · no garantizado · basado en tasas históricas",
    referenceFiatNote: "Referencia · no es saldo en",
    vsLocalFiatComparison: "Mantener en moneda local probablemente habría reducido tu poder adquisitivo",
    commandTitle: "Comandos",
    cmdPay: "Pagar",
    cmdBatch: "Lote",
    cmdOfframp: "Retiro",
    cmdDeposit: "Depositar",
    cmdPlan: "Plan",
    cmdCredit: "Crédito",
    creditPageTitle: "Microcréditos",
    creditPageSubtitle: "Créditos comunitarios respaldados por confianza en Sozu.",
    creditYourCredits: "Tus créditos",
    creditNoCredits: "Aún no tienes créditos activos ni solicitudes previas.",
    creditApplyTitle: "Solicitar microcrédito",
    creditApplyDesc: "Elige un programa. Por ahora solo Mujeres $2.000 está disponible para postular.",
    creditProgramSoon: "Próximamente",
    creditApplyButton: "Solicitar",
    creditApplySuccess: "Solicitud enviada. Te avisaremos cuando haya novedades.",
    creditAlreadyApplied: "Ya tienes una solicitud activa para este programa.",
    creditStatusPending: "En revisión",
    creditStatusApproved: "Aprobado",
    creditStatusActive: "Activo",
    creditStatusRepaid: "Pagado",
    creditStatusRejected: "Rechazado",
    creditEligibilityTitle: "Elegibilidad",
    creditEligibilityEligible: "Puedes solicitar crédito comunitario.",
    creditEligibilityProgress: "{count}/5 vouch confiables · {points} pts",
    creditBackHome: "Volver al inicio",
    creditLegacyProgramName: "Microcrédito comunitario",
    creditProgramMujeres2000Name: "Mujeres $2.000",
    creditProgramMujeres2000Desc: "Microcrédito para emprendedoras. Hasta $2.000.000 CLP · 180 días.",
    creditProgramEmprende500Name: "Emprende $500",
    creditProgramEmprende500Desc: "Capital semilla para ideas en etapa temprana.",
    creditProgramComunidad1kName: "Comunidad $1.000",
    creditProgramComunidad1kDesc: "Crédito respaldado por tu red de confianza.",
    creditProgramRapido250Name: "Rápido $250",
    creditProgramRapido250Desc: "Liquidez corta para gastos operacionales.",
    creditTermDays: "{days} días",
    comingSoon: "Próximamente",
    comingSoonDesc: "{label} aún no está disponible.",
    testnetBadge: "Testnet",
    activateWallet: "Activar billetera",
    activating: "Activando…",
    openCashflow: "Abrir cashflow",
    depositTitle: "Depositar",
    depositClose: "Cerrar depósito",
    depositQrTypeLabel: "Tipo de código QR",
    depositQrTag: "Sozu",
    depositQrStellar: "Stellar",
    depositSozuTag: "Sozu",
    depositStellarAddress: "Dirección Stellar",
    depositCopied: "Copiado",
    depositNoWallet: "Sin billetera conectada",
    depositUsdcOnly: "Envía USDC (Circle SAC en testnet) a esta dirección C",
    depositLegacyGWarning:
      "Esta es una cuenta clásica (G…). Para USDC Soroban en tu billetera passkey, cierra sesión y vuelve a entrar para completar la cuenta inteligente (C…).",
    depositSmartAccountHint: "Cuenta inteligente (C…) · USDC Soroban",
    depositResolvingWallet: "Configurando cuenta inteligente…",
    depositTagCaption: "@{tag} · escanea para pagar con Sozu",
    depositAddressCaption: "{addr} · cuenta inteligente Sozu",
    depositConnectWallet: "Conecta tu billetera",
    depositBlendTitle: "Testnet: BlendUSDC para enviar",
    depositBlendHint:
      "Los pagos usan BlendUSDC en tu cuenta C (no el USDC clásico de Circle en G). Copia tu dirección C abajo y recibe BlendUSDC ahí.",
    depositBlendFaucet: "Abrir testnet.blend.capital",
    depositBlendPool: "Pool USDC (Blend)",
    depositFaucetCta: "Obtener 20 USDC de prueba",
    depositFaucetHint: "Un clic — Circle USDC (testnet) vía Sozu Faucet.",
    depositFaucetBusy: "Fondeando…",
    depositFaucetSuccess: "Listo — 20 USDC en camino. Yendo al inicio…",
    depositFaucetError: "No se pudo fondear. Intenta de nuevo.",
    depositFiatTabLabel: "Pesos CLP",
    depositCryptoTabLabel: "Crypto",
    depositFiatTitle: "Depósito en pesos",
    depositFiatAmountLabel: "Monto en CLP",
    depositFiatAmountPlaceholder: "Ej. 50000",
    depositFiatMinError: "El mínimo es $1.000 CLP",
    depositFiatSubmit: "Continuar",
    depositFiatSubmitting: "Creando depósito…",
    depositFiatInstructionsTitle: "Instrucciones de transferencia",
    depositFiatBankLabel: "Banco",
    depositFiatAccountLabel: "Cuenta",
    depositFiatRutLabel: "RUT",
    depositFiatEmailLabel: "Email",
    depositFiatReferenceLabel: "Referencia",
    depositFiatReferenceHint: "Incluye este código en la descripción de tu transferencia",
    depositFiatAmountConfirmLabel: "Monto a transferir",
    depositFiatReceiveLabel: "Recibirás aprox.",
    depositFiatCopied: "Copiado",
    depositFiatCopy: "Copiar",
    depositFiatDone: "Listo",
    depositFiatStatusLabel: "Estado",
    depositFiatStatusAwaiting: "Esperando pago",
    depositFiatStatusReceived: "Pago recibido",
    depositFiatStatusProcessing: "Procesando depósito",
    depositFiatStatusCompleted: "Completado",
    depositFiatStatusFailed: "Fallido",
    depositFiatError: "No se pudo crear el depósito. Intenta de nuevo.",
    depositFiatNoWallet: "Necesitas una billetera Stellar antes de depositar.",
    depositFiatProofLabel: "Referencia del comprobante (opcional)",
    depositFiatProofPlaceholder: "Nro. de operación o comprobante",
    depositFiatProofSubmit: "Enviar comprobante",
    depositFiatProofSent: "Comprobante enviado",
    depositFiatMethodBank: "Transferencia",
    depositFiatMethodCard: "Tarjeta",
    depositFiatQuoteLabel: "Recibirás aprox.",
    depositFiatQuoteLoading: "Cotizando…",
    depositFiatCardRedirect: "Redirigiendo a SumUp…",
    depositFiatCardSubmit: "Pagar con tarjeta",
    depositFiatFxSource: "Tipo de cambio en vivo",
    rampCountryLabel: "País",
    rampCountryChile: "Chile · CLP",
    rampCountryBrazil: "Brasil · BRL",
    rampOnboardTitle: "Verificación para depósitos PIX",
    rampOnboardNameLabel: "Nombre completo",
    rampOnboardEmailLabel: "Email (recibirás un código)",
    rampOnboardStart: "Comenzar verificación",
    rampOnboardVerifying: "Verificando tu identidad…",
    rampOnboardOpenKyc: "Abrir verificación",
    rampOnboardKycHint: "Se abre en una pestaña nueva. Completa los pasos y vuelve aquí.",
    rampBankTitle: "Datos bancarios PIX",
    rampFirstName: "Nombre",
    rampLastName: "Apellido",
    rampCpf: "CPF",
    rampPixKey: "Clave PIX",
    rampPixKeyType: "Tipo de clave PIX",
    rampSaveBank: "Guardar",
    rampAmountLabel: "Monto en BRL",
    rampQuoteReceive: "Recibes",
    rampQuoteFee: "Comisión",
    rampQuoteExpires: "La cotización expira en",
    rampCreateOrder: "Continuar",
    rampDepositTitle: "Transfiere por PIX",
    rampDepositAmount: "Monto",
    rampDepositBank: "Banco",
    rampDepositHolder: "Titular",
    rampStatusPending: "Esperando tu transferencia",
    rampStatusFunded: "Pago recibido, enviando USDC…",
    rampStatusSettling: "Enviando USDC a tu wallet…",
    rampStatusCompleted: "¡USDC depositado!",
    rampStatusFailed: "La orden falló",
    rampStatusRefunded: "Orden reembolsada",
    rampSimulate: "Simular pago (testnet)",
    rampErrorGeneric: "Algo falló. Intenta de nuevo.",
    rampOfframpTitle: "Retirar a PIX (BRL)",
    rampOfframpAmountLabel: "Monto en USDC",
    rampOfframpAmountPlaceholder: "Ej. 25.00",
    rampOfframpSign: "Firmar y retirar",
    rampOfframpSettling: "Retiro en camino. Los BRL llegan a tu cuenta PIX más tarde — puedes cerrar esta ventana.",
    rampOfframpClose: "Cerrar retiro",
    rampOfframpUserTxLabel: "Tu transferencia",
    rampOfframpSettlementTxLabel: "Liquidación PIX",
    rampKycReturnTitle: "Verificación enviada",
    rampKycReturnBody: "Puedes cerrar esta pestaña y volver a la app.",
    rampNoWallet: "Necesitas una billetera Stellar antes de continuar.",
    rampCpfPlaceholder: "Ej. 000.000.000-00",
    rampAmountPlaceholder: "Ej. 150.00",
    rampInstructionsConfirm: "Ya transferí, continuar",
    rampPixKeyTypeEmail: "Email",
    rampPixKeyTypePhone: "Teléfono",
    rampPixKeyTypeCpf: "CPF",
    rampPixKeyTypeRandom: "Aleatoria",
    hideBalance: "Ocultar saldo",
    showBalance: "Mostrar saldo",
    purchasingPowerSubline: "+{pct}% poder adquisitivo · {days}d",
    apyBlendLabel: "APY Blend",
    auditBreakdown: "Desglose y proyección",
    closeTreasury: "Cerrar rendimiento de tesorería",
    backToBalance: "Volver al saldo",
    treasuryPanelTitle: "Rendimiento y Tesorería",
    treasuryPanelSubtitle: "Desglose USDC y proyección de poder adquisitivo.",
    close: "Cerrar",
    usdcBalanceSection: "Saldo USDC",
    walletBalanceLabel: "Billetera",
    walletBlendBalanceLabel: "BlendUSDC (envíos)",
    walletSacBalanceLabel: "USDC Circle (SAC en C)",
    walletSignerBalanceLabel: "USDC en cuenta G (firmante)",
    walletSacSendHint:
      "Tienes USDC SAC de Circle en tu C. Los envíos usan Blend primero; si no alcanza, usan SAC (compatible con cuentas SozuPay en testnet).",
    balanceAuditZeroHint:
      "Si Stellar Expert muestra saldo pero aquí ves $0, confirma que Depositar usa la misma dirección C y que Vercel tiene TESTNET_USDC_CONTRACT_ADDRESS (Blend), SOROBAN_RPC_URL y STELLAR_FUNDER_SECRET.",
    defiStrategyLabel: "Estrategia DeFi",
    totalLabel: "Total",
    defindexSharesLabel: "Shares DeFindex",
    projectionParams: "Parámetros de proyección",
    treasuryModeLabel: "Modo de tesorería",
    periodDaysLabel: "Período (días)",
    activePlan: "Plan activo",
    suggestedWithdrawals: "Retiros sugeridos: cada {days}d",
    strategyAllocation: "En estrategia: {pct}%",
    projectionHeading: "Proyección {days} días · {fiat}",
    blendYield: "Rendimiento Blend",
    totalPurchasingPowerTitle: "Poder adquisitivo total (no es APY Blend)",
    howCalculated: "Cómo se calcula",
    noProjection: "Sin proyección disponible",
    viewBlendPool: "Ver pool Blend (supply APY)",
    poolApyLabel: "APY pool",
    effectiveApyCompare:
      "APY efectivo en app (modo tesorería): {apy}% — comparar supply APY arriba con Blend",
    verifyBlendPool:
      "Abre el mismo pool {network} que respalda la estrategia DeFindex para verificar el supply APY.",
    treasuryModeEfficientDesc: "Maximiza el rendimiento. Retiros espaciados.",
    treasuryModeBalancedDesc: "Buen balance entre rendimiento y liquidez mensual.",
    treasuryModeFastDesc: "Liquidez semanal. Menor optimización de tesorería.",
    notBlendApyNote:
      "Extrapolación anual del total: {annualized}% — suma inflación y tipo de cambio, no rendimiento DeFi ({apy}% APY).",
    localFiatLossNote:
      "Mantener este saldo en {fiat} probablemente habría reducido tu poder adquisitivo ~{loss}% en {days} días (inflación ~{inflation}% + FX ~{fx}%, estimado).",
    periodTotalLine: "{sign}{pct}% en {days}d",
    periodLayerBreakdown: "(DeFi {defi}% + inflación {inflation}% + FX {fx}%)",
    chartPurchasingPower: "Poder adquisitivo",
    chartToday: "Hoy",
    chartDayLabel: "Día +{day}",
    chartDailyDelta: "Δ día:",
    chartNoProjection: "Sin proyección de poder adquisitivo",
    chartPnlTitle: "PNL poder adquisitivo",
    chartVsInitialBalance: "{sign}{pct}% vs saldo inicial",
    chartFootnote:
      "Curva diaria acumulada · toca un punto para ver el Δ del día y el desglose por capa.",
    cashflowLink: "Cashflow",
    settingsLanguageDesc: "Elige el idioma de la aplicación.",
    mathBaseBalance: "Saldo base",
    mathBaseBalanceDetail: "{balance} USDC · 1 USD = {rate} {fiat}",
    mathAnnualCpi: "CPI anual (mock)",
    mathAnnualCpiDetail: "Referencia {fiat} · prorrateado {days}d",
    mathFxPeriod: "FX período (mock)",
    mathFxPeriodDetail: "USD/{fiat} en {days}d · positivo = {fiat} se depreció",
    mathProtocolApy: "APY Blend (protocolo)",
    mathProtocolApyDetail: "Tasa anual del pool DeFi",
    mathEffectiveApy: "APY efectivo (modo)",
    mathEffectiveApyDetail: "Después del plan de tesorería activo",
    mathDefiYield: "Rendimiento DeFi",
    mathDefiYieldDetail: "USDC × {apy}% × ({days}/365)",
    mathInflationAvoidedDetail: "vs mantener {fiat} · prorrateado {days}d",
    mathFxProtectionDetail: "USD/{fiat} en {days}d",
    mathPeriodTotal: "Total período",
    mathPeriodTotalDetail: "Suma de capas en {days}d (no es APY)",
    mathAnnualized: "Extrapolación anual",
    mathAnnualizedDetail: "Total {days}d × (365/{days}) — no es APY Blend ({apy}%)",
    mathVsLocalFiat: "vs mantener {fiat}",
    mathVsLocalFiatDetail: "Pérdida estimada en moneda local (inflación + FX)",
    mathPerYear: "/ yr",
    // Auth
    authEnter: "Entrar",
    authPasskeyCaption: "Passkey en este dispositivo",
    authLoading: "Cargando…",
    authPwaBannerIos: "Instálala desde Safari → Compartir → Agregar a inicio",
    authPwaBannerAndroid: "Guárdala en tu pantalla de inicio para acceso instantáneo",
    authPwaInstallIos: "Cómo instalar",
    authPwaInstallAndroid: "Agregar a inicio",
    authClose: "Cerrar",
    authChooseName: "Elige tu nombre.",
    authRegisterOnInternet: "Regístrate en internet.",
    authLearnMore: "Saber más",
    authLearnMoreBody:
      "Tu nombre (Sozu tag) es tu identificador. Un passkey en este dispositivo protege el acceso; puedes agregar un PIN de respaldo en Configuración. Nada aquí es asesoría financiera.",
    authTagPlaceholder: "nombre",
    authSignIn: "Iniciar sesión",
    authRegister: "Registrarse",
    authTagLengthError: "3–30 caracteres",
    authTagCharsError: "Solo letras, números y guion bajo",
    authCouldNotCheck: "No se pudo verificar. Intenta de nuevo.",
    authCouldNotSignIn: "No se pudo iniciar sesión",
    authPinLengthError: "PIN: 6–12 dígitos",
    authPasskey: "Passkey",
    authBackupPin: "PIN de respaldo",
    authPinPlaceholder: "6–12 dígitos",
    authContinueWithPin: "Continuar con PIN",
    authNoBackupPin:
      "Aún no hay PIN de respaldo en esta cuenta. Usa tu passkey o configura un PIN en Ajustes después de iniciar sesión.",
    authBack: "Volver",
    authUsernameFree: "Este nombre está disponible.",
    authUsernameTakenPasskey: "Este nombre ya existe. Inicia sesión con tu passkey.",
    authUsernameTakenPasskeyPin: "Este nombre ya existe. Inicia sesión con passkey o PIN.",
    authDeviceChoiceTitle: "Este dispositivo no tiene biometría",
    authDeviceChoiceBody:
      "Sozu necesita Face ID, Touch ID o Windows Hello en el dispositivo donde creas o usas tu passkey.",
    authDeviceChoiceScan: "Escanear con otro dispositivo",
    authDeviceChoiceScanHint: "Ya tienes una cuenta. Usa el passkey de tu teléfono u otro dispositivo.",
    authDeviceChoiceCreate: "Crear una cuenta nueva",
    authDeviceChoiceCreateHint: "Elige tu nombre y completa el registro en un dispositivo con biometría.",
    setupIncompleteTitle: "Falta terminar tu billetera",
    setupIncompleteBody:
      "Tu passkey ya existe, pero aún no hay una cuenta inteligente (C…) en este dispositivo. Toca para crearla una vez.",
    setupIncompleteCta: "Terminar configuración",
    setupIncompleteBusy: "Creando billetera…",
  },
  en: {
    // Profile
    title: "My Profile",
    editProfile: "Edit Profile",
    username: "Username",
    profilePicture: "Profile Picture",
    walletAddress: "Wallet Address",
    walletAddressDesc: "Your private wallet address",
    walletCopied: "Address copied to clipboard",
    clickToCopy: "Tap to copy",
    addy: "Addy",
    fundYourAddress: "Fund your address to activate your account.",
    language: "Language",
    currency: "Currency",
    currencyDesc: "Select how you want to view your balance",
    save: "Save",
    cancel: "Cancel",
    english: "English",
    spanish: "Spanish",
    changePicture: "Change Picture",
    xlm: "XLM",
    usd: "USD",
    dollars: "Dollars",
    currencyDisplay: "USDC",
    // Balance
    totalBalance: "Total Balance",
    todayAPY: "Today's APY",
    // Send Payment
    sendPayment: "Send Payment",
    sendPaymentDesc: "Send USDC to a recipient",
    continue: "Continue",
    manualTransaction: "Manual transaction",
    useSozuTag: "Use Sozu instead",
    resolving: "Resolving...",
    sending: "Sending...",
    confirmWithPasskey: "Confirm with passkey...",
    submitting: "Submitting...",
    send: "Send",
    sendTapToSwitchCurrency: "Tap currency to switch",
    sendApproxUsdc: "≈ {amount} USDC",
    sendApproxFiat: "≈ {amount} {fiat}",
    sendInsufficientBalance: "Amount exceeds available balance",
    pizzaBalanceRow: "{count} PIZZA",
    // Success Modal
    transactionSuccessful: "Transaction Successful",
    transactionSuccessfulDesc: "Your payment was sent successfully",
    done: "Done",
    receiptShareTitle: "📄 Sozu receipt",
    receiptShareHeading: "Share receipt",
    receiptShareFooter: "Sent with Sozu Wallet",
    receiptAmountLabel: "Amount",
    receiptFromLabel: "From",
    receiptToLabel: "To",
    receiptDateLabel: "Date",
    receiptNetworkLabel: "Network",
    receiptNetworkTestnet: "Stellar Testnet",
    receiptNetworkMainnet: "Stellar Mainnet",
    receiptTxLabel: "Tx",
    receiptMemoLabel: "Memo",
    receiptCopyInvoice: "Copy receipt",
    receiptCopied: "Receipt copied",
    receiptCopyFailed: "Could not copy",
    receiptSmsLabel: "Messages",
    receiptMoreLabel: "More",
    receiptDetailTitle: "Transaction details",
    receiptDetailDesc: "Payment receipt",
    receiptShareImage: "Share as image",
    receiptSharingImage: "Preparing image…",
    receiptImageSaved: "Receipt saved — attach it in your app",
    receiptShareImageFailed: "Could not share image",
    // Transaction History
    loadingTransactions: "Loading transactions...",
    noTransactions: "No transactions yet",
    emptyHistoryHint: "Deposit USDC to see your activity here.",
    emptyHistoryCta: "Deposit USDC",
    recentActivity: "Recent activity",
    onChainActivity: "On-chain activity",
    panelHome: "Home",
    panelHistory: "History",
    authFailed: "Could not sign in. Please try again.",
    authCancelledHint: "Sign-in cancelled. You can try again.",
    showLess: "Show less",
    showAll: "View all",
    transactions: "transactions",
    // Error Messages
    somethingWentWrong: "Something went wrong",
    unexpectedError: "An unexpected error occurred in the wallet component.",
    reloadPage: "Reload Page",
    // Balance Audit
    balanceAudit: "Balance Audit",
    balanceAuditDesc: "Detailed breakdown of your balance",
    wallet: "Wallet:",
    defiStrategy: "DeFi Strategy:",
    total: "Total:",
    shares: "Shares:",
    viewBlendStrategy: "View Blend Strategy",
    noBalanceData: "No balance data available",
    // Profile
    checkAccountStatus: "Check Account Status",
    checking: "Checking...",
    network: "Network:",
    xlmBalance: "XLM Balance:",
    usdcTrustline: "USDC Trustline:",
    usdcIssuer: "USDC Issuer:",
    exists: "Exists",
    notFound: "Not found",
    lowBalance: "Low balance! You need at least 1.5 XLM to create a trustline.",
    forStellarLab: "For Stellar Lab:",
    selectNetwork: "Select network",
    useIssuer: "Use issuer:",
    ensureBalance: "Ensure balance ≥ 1.5 XLM",
    createWalletDesc:
      "Create your non-custodial wallet with real Stellar account and USDC trustline",
    settings: "Settings",
    // Notifications
    notifications: "Notifications",
    noNotifications: "No notifications yet",
    unreadNotifications: "unread notifications",
    // Create Wallet
    createNewWallet: "Start Now",
    // Trust Points
    trustPoints: "Trust Points",
    trustPointsTitle: "Trust Points",
    currentBalance: "Your current balance:",
    whatAreTrustPoints: "What are Trust Points?",
    trustPointsDesc:
      "Trust points are a measure of your reputation on the platform. You can use them to support other users or increase your eligibility for credits.",
    howToGetMore: "How to get more points?",
    waitForDaily: "Wait to claim your daily bonus",
    inviteUsers: "Invite new users with your invite code",
    receivePoints: "Receive points from other users who support you",
    viewInviteCode: "View Invite Code",
    vouchForUser: "Vouch for Project",
    // Invite Code
    yourInviteCode: "Your Invite Code",
    inviteCodeDesc:
      "Share this code with new users. When they register using your code, you'll receive 1 trust point.",
    copyCode: "Copy Code",
    codeCopied: "Code copied to clipboard",
    copyInviteCode: "Copy Invite Code",
    back: "Back",
    // Vouch
    vouchTitle: "Vouch for Project",
    vouchDesc: "Enter the username and send trust points to support them.",
    usernameLabel: "Username",
    usernamePlaceholder: "Username",
    pointsToSend: "Points to Send",
    available: "Available:",

    sendPoints: "Send Points",
    pointsSentSuccess: "Trust points sent successfully",
    pointsSentError: "Error sending points",
    notAuthenticated: "User not authenticated",
    // Profile button
    openProfile: "Open profile",
    closeProfile: "Close profile",
    logout: "Log Out",
    logoutConfirm: "Are you sure you want to log out?",
    // Social share
    inviteMessage:
      "Join Sozu Wallet! Use my invite code: {code} and let's both get extra trust points.",
    codeCopiedShare: "Code copied to clipboard. Ready to share!",
    // EVM Address
    linkEvmAddress: "Link EVM Address",
    evmAddressTitle: "EVM Address for MaxFlow",
    evmAddressDesc: "Link your Ethereum address to get your MaxFlow ego score",
    evmAddressPlaceholder: "0x...",
    linkAddress: "Link Address",
    unlinkAddress: "Unlink",
    evmAddressLinked: "Address linked",
    evmAddressNotLinked: "No address linked",
    maxflowScore: "MaxFlow Score",
    localHealth: "Local Health",
    totalNodes: "Total Nodes",
    acceptedUsers: "Accepted Users",
    loadingScore: "Loading score...",
    errorLoadingScore: "Error loading score",
    evmAddressCopied: "Address copied",
    // Treasury purchasing power
    treasuryPerformance: "Treasury Performance",
    purchasingPowerImpact: "Purchasing power impact",
    inflationAvoided: "Inflation avoided",
    fxProtection: "FX protection",
    projectedEarnings: "Projected earnings",
    treasuryModeEfficient: "Efficient",
    treasuryModeBalanced: "Balanced",
    treasuryModeFast: "Fast",
    holdingPeriod: "Period",
    estimatedDisclaimer: "Estimated · not guaranteed · based on historical rates",
    referenceFiatNote: "Reference · not your balance in",
    vsLocalFiatComparison: "Keeping funds in local currency likely would have reduced your purchasing power",
    commandTitle: "Command",
    cmdPay: "Pay",
    cmdBatch: "Batch",
    cmdOfframp: "Offramp",
    cmdDeposit: "Deposit",
    cmdPlan: "Plan",
    cmdCredit: "Credit",
    creditPageTitle: "Microcredit",
    creditPageSubtitle: "Community credit backed by trust on Sozu.",
    creditYourCredits: "Your credits",
    creditNoCredits: "No active credits or previous applications yet.",
    creditApplyTitle: "Apply for microcredit",
    creditApplyDesc: "Choose a program. Only Mujeres $2.000 is open for applications right now.",
    creditProgramSoon: "Coming soon",
    creditApplyButton: "Apply",
    creditApplySuccess: "Application submitted. We will notify you with updates.",
    creditAlreadyApplied: "You already have an active application for this program.",
    creditStatusPending: "Under review",
    creditStatusApproved: "Approved",
    creditStatusActive: "Active",
    creditStatusRepaid: "Repaid",
    creditStatusRejected: "Rejected",
    creditEligibilityTitle: "Eligibility",
    creditEligibilityEligible: "You can apply for community credit.",
    creditEligibilityProgress: "{count}/5 trustworthy vouches · {points} pts",
    creditBackHome: "Back to home",
    creditLegacyProgramName: "Community microcredit",
    creditProgramMujeres2000Name: "Mujeres $2.000",
    creditProgramMujeres2000Desc: "Microcredit for women entrepreneurs. Up to 2,000,000 CLP · 180 days.",
    creditProgramEmprende500Name: "Emprende $500",
    creditProgramEmprende500Desc: "Seed capital for early-stage ideas.",
    creditProgramComunidad1kName: "Comunidad $1.000",
    creditProgramComunidad1kDesc: "Credit backed by your trust network.",
    creditProgramRapido250Name: "Rápido $250",
    creditProgramRapido250Desc: "Short-term liquidity for operating expenses.",
    creditTermDays: "{days} days",
    comingSoon: "Coming soon",
    comingSoonDesc: "{label} is not available yet.",
    testnetBadge: "Testnet",
    activateWallet: "Activate wallet",
    activating: "Activating…",
    openCashflow: "Open cashflow",
    depositTitle: "Deposit",
    depositClose: "Close deposit",
    depositQrTypeLabel: "QR code type",
    depositQrTag: "Sozu",
    depositQrStellar: "Stellar",
    depositSozuTag: "Sozu",
    depositStellarAddress: "Stellar address",
    depositCopied: "Copied",
    depositNoWallet: "No wallet connected",
    depositUsdcOnly: "Send USDC (Circle SAC on testnet) to this C address",
    depositLegacyGWarning:
      "This is a classic G address. Soroban USDC belongs on your passkey smart account (C…). Sign out and sign in again to finish smart wallet setup.",
    depositSmartAccountHint: "Smart account (C…) · Soroban USDC",
    depositResolvingWallet: "Setting up smart account…",
    depositTagCaption: "@{tag} · scan to pay with Sozu",
    depositAddressCaption: "{addr} · Sozu smart account",
    depositConnectWallet: "Connect your wallet",
    depositBlendTitle: "Testnet: BlendUSDC for sends",
    depositBlendHint:
      "Payments use BlendUSDC on your C smart account (not classic Circle USDC on G). Copy your C address below and receive BlendUSDC there.",
    depositBlendFaucet: "Open testnet.blend.capital",
    depositBlendPool: "USDC pool (Blend)",
    depositFaucetCta: "Get 20 testnet USDC",
    depositFaucetHint: "One click — Circle USDC (testnet) via Sozu Faucet.",
    depositFaucetBusy: "Funding…",
    depositFaucetSuccess: "Done — 20 USDC on the way. Heading home…",
    depositFaucetError: "Could not fund. Try again.",
    depositFiatTabLabel: "CLP pesos",
    depositCryptoTabLabel: "Crypto",
    depositFiatTitle: "Peso deposit",
    depositFiatAmountLabel: "Amount in CLP",
    depositFiatAmountPlaceholder: "e.g. 50000",
    depositFiatMinError: "Minimum is $1,000 CLP",
    depositFiatSubmit: "Continue",
    depositFiatSubmitting: "Creating deposit…",
    depositFiatInstructionsTitle: "Transfer instructions",
    depositFiatBankLabel: "Bank",
    depositFiatAccountLabel: "Account",
    depositFiatRutLabel: "RUT",
    depositFiatEmailLabel: "Email",
    depositFiatReferenceLabel: "Reference",
    depositFiatReferenceHint: "Include this code in your bank transfer description",
    depositFiatAmountConfirmLabel: "Amount to transfer",
    depositFiatReceiveLabel: "You will receive approx.",
    depositFiatCopied: "Copied",
    depositFiatCopy: "Copy",
    depositFiatDone: "Done",
    depositFiatStatusLabel: "Status",
    depositFiatStatusAwaiting: "Awaiting payment",
    depositFiatStatusReceived: "Payment received",
    depositFiatStatusProcessing: "Processing deposit",
    depositFiatStatusCompleted: "Completed",
    depositFiatStatusFailed: "Failed",
    depositFiatError: "Could not create deposit. Please try again.",
    depositFiatNoWallet: "You need a Stellar wallet before you can deposit.",
    depositFiatProofLabel: "Proof reference (optional)",
    depositFiatProofPlaceholder: "Transaction or confirmation number",
    depositFiatProofSubmit: "Submit proof",
    depositFiatProofSent: "Proof sent",
    depositFiatMethodBank: "Bank transfer",
    depositFiatMethodCard: "Card",
    depositFiatQuoteLabel: "You will receive approx.",
    depositFiatQuoteLoading: "Fetching quote…",
    depositFiatCardRedirect: "Redirecting to SumUp…",
    depositFiatCardSubmit: "Pay with card",
    depositFiatFxSource: "Live exchange rate",
    rampCountryLabel: "Country",
    rampCountryChile: "Chile · CLP",
    rampCountryBrazil: "Brazil · BRL",
    rampOnboardTitle: "Verification for PIX deposits",
    rampOnboardNameLabel: "Full name",
    rampOnboardEmailLabel: "Email (you'll receive a code)",
    rampOnboardStart: "Start verification",
    rampOnboardVerifying: "Verifying your identity…",
    rampOnboardOpenKyc: "Open verification",
    rampOnboardKycHint: "Opens in a new tab. Complete the steps and come back here.",
    rampBankTitle: "PIX bank details",
    rampFirstName: "First name",
    rampLastName: "Last name",
    rampCpf: "CPF",
    rampPixKey: "PIX key",
    rampPixKeyType: "PIX key type",
    rampSaveBank: "Save",
    rampAmountLabel: "Amount in BRL",
    rampQuoteReceive: "You receive",
    rampQuoteFee: "Fee",
    rampQuoteExpires: "Quote expires in",
    rampCreateOrder: "Continue",
    rampDepositTitle: "Transfer via PIX",
    rampDepositAmount: "Amount",
    rampDepositBank: "Bank",
    rampDepositHolder: "Account holder",
    rampStatusPending: "Waiting for your transfer",
    rampStatusFunded: "Payment received, sending USDC…",
    rampStatusSettling: "Sending USDC to your wallet…",
    rampStatusCompleted: "USDC deposited!",
    rampStatusFailed: "Order failed",
    rampStatusRefunded: "Order refunded",
    rampSimulate: "Simulate payment (testnet)",
    rampErrorGeneric: "Something went wrong. Try again.",
    rampOfframpTitle: "Withdraw to PIX (BRL)",
    rampOfframpAmountLabel: "Amount in USDC",
    rampOfframpAmountPlaceholder: "e.g. 25.00",
    rampOfframpSign: "Sign & withdraw",
    rampOfframpSettling: "Withdrawal on its way. BRL arrives in your PIX account later — you can close this window.",
    rampOfframpClose: "Close withdrawal",
    rampOfframpUserTxLabel: "Your transfer",
    rampOfframpSettlementTxLabel: "PIX settlement",
    rampKycReturnTitle: "Verification submitted",
    rampKycReturnBody: "You can close this tab and return to the app.",
    rampNoWallet: "You need a Stellar wallet before you can continue.",
    rampCpfPlaceholder: "e.g. 000.000.000-00",
    rampAmountPlaceholder: "e.g. 150.00",
    rampInstructionsConfirm: "I've made the payment, continue",
    rampPixKeyTypeEmail: "Email",
    rampPixKeyTypePhone: "Phone",
    rampPixKeyTypeCpf: "CPF",
    rampPixKeyTypeRandom: "Random",
    hideBalance: "Hide balance",
    showBalance: "Show balance",
    purchasingPowerSubline: "+{pct}% purchasing power · {days}d",
    apyBlendLabel: "Blend APY",
    auditBreakdown: "Breakdown & projection",
    closeTreasury: "Close treasury performance",
    backToBalance: "Back to balance",
    treasuryPanelTitle: "Performance & Treasury",
    treasuryPanelSubtitle: "USDC breakdown and purchasing power projection.",
    close: "Close",
    usdcBalanceSection: "USDC balance",
    walletBalanceLabel: "Wallet",
    walletBlendBalanceLabel: "BlendUSDC (sends)",
    walletSacBalanceLabel: "Circle USDC (SAC on C)",
    walletSignerBalanceLabel: "USDC on G signer",
    walletSacSendHint:
      "You hold Circle USDC SAC on your C smart account. Sends prefer BlendUSDC; if that balance is too low, we send SAC USDC (same token SozuPay org treasuries use on testnet).",
    balanceAuditZeroHint:
      "If Stellar Expert shows a balance but this reads $0, confirm Depositar matches your funded C address and Vercel has TESTNET_USDC_CONTRACT_ADDRESS (Blend), SOROBAN_RPC_URL, and STELLAR_FUNDER_SECRET.",
    defiStrategyLabel: "DeFi strategy",
    totalLabel: "Total",
    defindexSharesLabel: "DeFindex shares",
    projectionParams: "Projection settings",
    treasuryModeLabel: "Treasury mode",
    periodDaysLabel: "Period (days)",
    activePlan: "Active plan",
    suggestedWithdrawals: "Suggested withdrawals: every {days}d",
    strategyAllocation: "In strategy: {pct}%",
    projectionHeading: "Projection {days} days · {fiat}",
    blendYield: "Blend yield",
    totalPurchasingPowerTitle: "Total purchasing power (not Blend APY)",
    howCalculated: "How it's calculated",
    noProjection: "No projection available",
    viewBlendPool: "View Blend pool (supply APY)",
    poolApyLabel: "Pool APY",
    effectiveApyCompare:
      "Effective in-app APY (treasury mode): {apy}% — compare pool supply APY above with Blend",
    verifyBlendPool:
      "Open the same {network} pool backing the DeFindex strategy to verify supply APY.",
    treasuryModeEfficientDesc: "Maximize yield. Spaced withdrawals.",
    treasuryModeBalancedDesc: "Good balance between yield and monthly liquidity.",
    treasuryModeFastDesc: "Weekly liquidity. Lower treasury optimization.",
    notBlendApyNote:
      "Annualized total extrapolation: {annualized}% — inflation and FX combined, not DeFi yield ({apy}% APY).",
    localFiatLossNote:
      "Keeping this balance in {fiat} likely would have reduced purchasing power ~{loss}% over {days} days (inflation ~{inflation}% + FX ~{fx}%, estimated).",
    periodTotalLine: "{sign}{pct}% in {days}d",
    periodLayerBreakdown: "(DeFi {defi}% + inflation {inflation}% + FX {fx}%)",
    chartPurchasingPower: "Purchasing power",
    chartToday: "Today",
    chartDayLabel: "Day +{day}",
    chartDailyDelta: "Daily Δ:",
    chartNoProjection: "No purchasing power projection",
    chartPnlTitle: "Purchasing power PNL",
    chartVsInitialBalance: "{sign}{pct}% vs initial balance",
    chartFootnote:
      "Daily cumulative curve · tap a point to see daily Δ and layer breakdown.",
    cashflowLink: "Cashflow",
    settingsLanguageDesc: "Choose the app display language.",
    mathBaseBalance: "Base balance",
    mathBaseBalanceDetail: "{balance} USDC · 1 USD = {rate} {fiat}",
    mathAnnualCpi: "Annual CPI (mock)",
    mathAnnualCpiDetail: "Reference {fiat} · prorated {days}d",
    mathFxPeriod: "Period FX (mock)",
    mathFxPeriodDetail: "USD/{fiat} in {days}d · positive = {fiat} depreciated",
    mathProtocolApy: "Blend APY (protocol)",
    mathProtocolApyDetail: "Annual DeFi pool rate",
    mathEffectiveApy: "Effective APY (mode)",
    mathEffectiveApyDetail: "After active treasury plan",
    mathDefiYield: "DeFi yield",
    mathDefiYieldDetail: "USDC × {apy}% × ({days}/365)",
    mathInflationAvoidedDetail: "vs holding {fiat} · prorated {days}d",
    mathFxProtectionDetail: "USD/{fiat} in {days}d",
    mathPeriodTotal: "Period total",
    mathPeriodTotalDetail: "Sum of layers in {days}d (not APY)",
    mathAnnualized: "Annualized extrapolation",
    mathAnnualizedDetail: "Total {days}d × (365/{days}) — not Blend APY ({apy}%)",
    mathVsLocalFiat: "vs holding {fiat}",
    mathVsLocalFiatDetail: "Estimated loss in local currency (inflation + FX)",
    mathPerYear: "/ yr",
    // Auth
    authEnter: "Enter",
    authPasskeyCaption: "Passkey on this device",
    authLoading: "Loading…",
    authPwaBannerIos: "Install from Safari → Share → Add to Home Screen",
    authPwaBannerAndroid: "Save to your home screen for instant access",
    authPwaInstallIos: "How to install",
    authPwaInstallAndroid: "Add to home screen",
    authClose: "Close",
    authChooseName: "Choose your name.",
    authRegisterOnInternet: "Register on the internet.",
    authLearnMore: "Learn more",
    authLearnMoreBody:
      "Your name (Sozu tag) is your handle. A passkey on this device protects access; you may add a backup PIN in Settings. Nothing here is financial advice.",
    authTagPlaceholder: "name",
    authSignIn: "Sign in",
    authRegister: "Register",
    authTagLengthError: "3–30 characters",
    authTagCharsError: "Letters, numbers, underscore only",
    authCouldNotCheck: "Could not check. Try again.",
    authCouldNotSignIn: "Could not sign in",
    authPinLengthError: "PIN: 6–12 digits",
    authPasskey: "Passkey",
    authBackupPin: "Backup PIN",
    authPinPlaceholder: "6–12 digits",
    authContinueWithPin: "Continue with PIN",
    authNoBackupPin:
      "No backup PIN on this account yet. Use your passkey, or set a PIN in Settings after you sign in.",
    authBack: "Back",
    authUsernameFree: "This name is free.",
    authUsernameTakenPasskey: "This name is taken. Sign in with your passkey.",
    authUsernameTakenPasskeyPin: "This name is taken. Sign in with your passkey or PIN.",
    authDeviceChoiceTitle: "This device has no biometrics",
    authDeviceChoiceBody:
      "Sozu needs Face ID, Touch ID, or Windows Hello on the device where you create or use your passkey.",
    authDeviceChoiceScan: "Scan with another device",
    authDeviceChoiceScanHint: "You already have an account. Use the passkey on your phone or another device.",
    authDeviceChoiceCreate: "Create a new account",
    authDeviceChoiceCreateHint: "Choose your name, then finish setup on a device with biometrics.",
    setupIncompleteTitle: "Finish setting up your wallet",
    setupIncompleteBody:
      "Your passkey is ready, but this device doesn’t have a smart account (C…) yet. Tap once to create it.",
    setupIncompleteCta: "Finish setup",
    setupIncompleteBusy: "Creating wallet…",
  },
} as const;

/**
 * Get wallet texts for a specific language
 * Defaults to Spanish
 */
export function getWalletTexts(lang: "en" | "es" = "es"): WalletTexts {
  return walletTexts[lang];
}

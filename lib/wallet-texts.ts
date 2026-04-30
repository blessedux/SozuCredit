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
  send: string;
  // Success Modal
  transactionSuccessful: string;
  transactionSuccessfulDesc: string;
  done: string;
  // Transaction History
  loadingTransactions: string;
  noTransactions: string;
  showLess: string;
  showAll: string;
  transactions: string;
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
};

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
    useSozuTag: "Usar etiqueta Sozu en su lugar",
    resolving: "Resolviendo...",
    sending: "Enviando...",
    send: "Enviar",
    // Success Modal
    transactionSuccessful: "Transacción Exitosa",
    transactionSuccessfulDesc: "Tu pago fue enviado exitosamente",
    done: "Hecho",
    // Transaction History
    loadingTransactions: "Cargando transacciones...",
    noTransactions: "Aún no hay transacciones",
    showLess: "Mostrar menos",
    showAll: "Mostrar todas",
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
      "¡Únete a Sozu Credit! Usa mi código de invitación: {code} y recibamos ambos puntos de confianza extra. 🚀",
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
    useSozuTag: "Use Sozu tag instead",
    resolving: "Resolving...",
    sending: "Sending...",
    send: "Send",
    // Success Modal
    transactionSuccessful: "Transaction Successful",
    transactionSuccessfulDesc: "Your payment was sent successfully",
    done: "Done",
    // Transaction History
    loadingTransactions: "Loading transactions...",
    noTransactions: "No transactions yet",
    showLess: "Show less",
    showAll: "Show all",
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
      "Join Sozu Credit! Use my invite code: {code} and let's both get extra trust points. 🚀",
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
  },
} as const;

/**
 * Get wallet texts for a specific language
 * Defaults to Spanish
 */
export function getWalletTexts(lang: "en" | "es" = "es"): WalletTexts {
  return walletTexts[lang];
}

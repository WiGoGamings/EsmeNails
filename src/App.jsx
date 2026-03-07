import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { API_BASE, apiRequest } from "./lib/api";

const defaultAuth = {
  name: "",
  email: "",
  password: ""
};

const defaultProfileForm = {
  name: "",
  birthDate: "",
  email: "",
  phone: "",
  description: "",
  profileImageUrl: "",
  emailVerified: false,
  phoneVerified: false,
  points: 0,
  ordersCount: 0,
  appointmentsCount: 0
};

const posSections = [
  "Home",
  "Menu",
  "Precios",
  "Agendar cita",
  "Contacto",
  "Asistente IA",
  "Mis puntos",
  "Historial",
  "Promociones",
  "Ajustes",
  "Privacidad y seguridad"
];

const realNailImages = {
  acrigel: "https://images.pexels.com/photos/3997391/pexels-photo-3997391.jpeg?auto=compress&cs=tinysrgb&w=1400",
  polygel: "https://images.pexels.com/photos/939836/pexels-photo-939836.jpeg?auto=compress&cs=tinysrgb&w=1400",
  gelx: "https://images.pexels.com/photos/704815/pexels-photo-704815.jpeg?auto=compress&cs=tinysrgb&w=1400",
  manicure: "https://images.pexels.com/photos/853427/pexels-photo-853427.jpeg?auto=compress&cs=tinysrgb&w=1400",
  encapsulado: "https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=1400",
  presson: "https://images.pexels.com/photos/7755651/pexels-photo-7755651.jpeg?auto=compress&cs=tinysrgb&w=1400",
  lashes: "https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?auto=compress&cs=tinysrgb&w=1400",
  artist: "https://images.pexels.com/photos/1072851/pexels-photo-1072851.jpeg?auto=compress&cs=tinysrgb&w=1400"
};

const localMenuImages = {
  acrigel: realNailImages.acrigel,
  polygel: realNailImages.polygel,
  gelx: realNailImages.gelx,
  manicure: realNailImages.manicure,
  encapsulado: realNailImages.encapsulado,
  presson: realNailImages.presson,
  lashes: realNailImages.lashes,
  artist: realNailImages.artist
};

const ADMIN_LOCAL_SETTINGS_KEY = "esme_admin_settings_local";
const MENU_CART_STORAGE_KEY = "esme_menu_cart";
const ASSISTANT_HISTORY_STORAGE_PREFIX = "esme_assistant_history";
const LOCAL_AUTH_USERS_KEY = "esme_local_auth_users";
const LOCAL_AUTH_PASSWORD_SALT = "esme-local-auth-v1";
const LOCAL_ADMIN_EMAIL = "admin.esme@esmenails.com";
const LOCAL_ADMIN_PASSWORD_HASH = "53ac1385fa6a18d0e617c52423c17abd61ab1f39b2093f0fb4e37a1bd14736f3";

const getAssistantHistoryStorageKey = (isAuthenticated, sessionUser) => {
  const identity = isAuthenticated ? (sessionUser?.email || "authenticated-user") : "guest";
  return `${ASSISTANT_HISTORY_STORAGE_PREFIX}:${identity.toLowerCase()}`;
};

const createLocalEntityId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeAuthEmail = (value) => String(value || "").trim().toLowerCase();

const createLocalPasswordHash = async (rawPassword) => {
  const normalized = `${LOCAL_AUTH_PASSWORD_SALT}:${String(rawPassword || "")}`;

  if (typeof window !== "undefined" && window.crypto?.subtle && typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
    return hex;
  }

  // Non-crypto fallback for environments without SubtleCrypto.
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash).toString(16)}`;
};

const isLocalAdminCredentials = async (email, password) => {
  if (normalizeAuthEmail(email) !== LOCAL_ADMIN_EMAIL) return false;
  const passwordHash = await createLocalPasswordHash(password);
  return passwordHash === LOCAL_ADMIN_PASSWORD_HASH;
};

const verifyLocalUserPassword = async (entry, rawPassword) => {
  const input = String(rawPassword || "");
  if (!input) return { matches: false, migrated: false, user: entry };

  const computedHash = await createLocalPasswordHash(input);
  if (typeof entry?.passwordHash === "string" && entry.passwordHash.trim()) {
    return {
      matches: entry.passwordHash === computedHash,
      migrated: false,
      user: entry
    };
  }

  const legacyPassword = String(entry?.password || "");
  if (legacyPassword && legacyPassword === input) {
    const migratedUser = { ...entry, passwordHash: computedHash };
    delete migratedUser.password;
    return {
      matches: true,
      migrated: true,
      user: migratedUser
    };
  }

  return { matches: false, migrated: false, user: entry };
};

const getLocalAuthUsers = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_AUTH_USERS_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const setLocalAuthUsers = (users) => {
  try {
    localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore storage write failures.
  }
};

const legacyMenuToRealImage = {
  "/menu/acrigel.svg": realNailImages.acrigel,
  "menu/acrigel.svg": realNailImages.acrigel,
  "/menu/polygel.svg": realNailImages.polygel,
  "menu/polygel.svg": realNailImages.polygel,
  "/menu/gelx.svg": realNailImages.gelx,
  "menu/gelx.svg": realNailImages.gelx,
  "/menu/manicure.svg": realNailImages.manicure,
  "menu/manicure.svg": realNailImages.manicure,
  "/menu/encapsulado.svg": realNailImages.encapsulado,
  "menu/encapsulado.svg": realNailImages.encapsulado,
  "/menu/presson.svg": realNailImages.presson,
  "menu/presson.svg": realNailImages.presson,
  "/menu/lashes.svg": realNailImages.lashes,
  "menu/lashes.svg": realNailImages.lashes
};

const normalizeRealImageUrl = (rawUrl) => {
  const normalized = String(rawUrl || "").trim();
  if (!normalized) return "";
  return legacyMenuToRealImage[normalized] || normalized;
};

const menuCategories = [
  {
    id: "acrigel",
    title: "Acrigel",
    subtitle: "Estructura firme y acabado premium",
    image: realNailImages.acrigel
  },
  {
    id: "polygel",
    title: "Polygel",
    subtitle: "Ligero, flexible y natural",
    image: realNailImages.polygel
  },
  {
    id: "gelx",
    title: "Gel X",
    subtitle: "Extensiones modernas y rápidas",
    image: realNailImages.gelx
  },
  {
    id: "manicure-spa",
    title: "Manicure Spa",
    subtitle: "Cuidado completo de manos y uñas",
    image: realNailImages.manicure
  },
  {
    id: "encapsulado",
    title: "Encapsulado",
    subtitle: "Diseño interno con brillo duradero",
    image: realNailImages.encapsulado
  },
  {
    id: "press-on",
    title: "Press On",
    subtitle: "Sets listos para aplicar",
    image: realNailImages.presson
  },
  {
    id: "pestañas",
    title: "Pestañas",
    subtitle: "Lifting, volumen y mirada definida",
    image: realNailImages.lashes
  }
];

const findCategoryById = (id) => menuCategories.find((item) => item.id === id) || null;

const daySlots = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00"];

const cardPalette = ["pink", "rose", "red", "coral", "orange", "sand", "salmon"];

const pointsGameOptions = [
  { id: "piedra", label: "Piedra" },
  { id: "papel", label: "Papel" },
  { id: "tijera", label: "Tijera" }
];
const POINTS_GAME_COOLDOWN_MS = 10000;

const normalizePointsValue = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 10) / 10;
};

const formatPointsValue = (value) => {
  const normalized = normalizePointsValue(value);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
};

const startHour = 8;
const visibleHours = daySlots.length;
const appointmentSlotStartHour = 8;
const appointmentSlotEndHour = 20;
const appointmentSlotStepMinutes = 30;

const toInputDate = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toInputDateTime = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const createAppointmentDraft = (dateValue) => ({
  serviceId: "",
  employeeId: "",
  date: toInputDate(dateValue),
  time: "10:00",
  notes: ""
});

const findSuggestedServiceId = (category, services) => {
  if (!category || !services?.length) return "";

  const terms = category.title.toLowerCase().split(/\s+/).filter(Boolean);
  const match = services.find((service) => {
    const searchable = `${service.name || ""} ${service.style || ""} ${service.model || ""}`.toLowerCase();
    return terms.some((term) => searchable.includes(term));
  });

  return match?.id || "";
};

const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;

const buildTimeSlots = (startHour, endHour, stepMinutes) => {
  const slots = [];
  const start = startHour * 60;
  const end = endHour * 60;

  for (let cursor = start; cursor < end; cursor += stepMinutes) {
    const hours = String(Math.floor(cursor / 60)).padStart(2, "0");
    const minutes = String(cursor % 60).padStart(2, "0");
    slots.push(`${hours}:${minutes}`);
  }

  return slots;
};

const toDayKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const navIconBySection = {
  Home: "home",
  Menu: "menu",
  Precios: "prices",
  "Agendar cita": "calendar",
  Contacto: "contact",
  "Asistente IA": "assistant",
  "Mis puntos": "points",
  Historial: "history",
  Promociones: "promo",
  Ajustes: "settings",
  "Privacidad y seguridad": "security",
  "Panel admin": "admin",
  "Mi perfil": "profile",
  "Mi cuenta": "account"
};

const quickRailLabelBySection = {
  Home: "Home",
  Menu: "Menu",
  Precios: "Precio",
  "Agendar cita": "Cita",
  Contacto: "Contacto",
  "Asistente IA": "Asistente",
  "Mis puntos": "Puntos",
  Historial: "Historial",
  Promociones: "Promo",
  Ajustes: "Ajustes",
  "Privacidad y seguridad": "Privacidad",
  "Panel admin": "Admin"
};

const appointmentStatusLabel = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada"
};

const appointmentStatusClass = {
  scheduled: "scheduled",
  confirmed: "confirmed",
  cancelled: "cancelled",
  completed: "completed"
};

const adminAppointmentFilters = [
  { key: "all", label: "Todas" },
  { key: "scheduled", label: "Agendadas" },
  { key: "confirmed", label: "Confirmadas" },
  { key: "cancelled", label: "Canceladas" }
];

const contactMessageStatuses = [
  { value: "new", label: "Nuevo" },
  { value: "in-progress", label: "En progreso" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" }
];

const defaultLoyaltyRewards = [
  { id: "reward-30", points: 30, title: "Nail art mini", description: "Decoracion basica sin costo en tu siguiente cita." },
  { id: "reward-60", points: 60, title: "10% de descuento", description: "Aplicable en un servicio de tu eleccion." },
  { id: "reward-100", points: 100, title: "Spa upgrade", description: "Upgrade a manicure spa premium." },
  { id: "reward-140", points: 140, title: "Gift set", description: "Kit sorpresa de cuidado de unas." }
];

const defaultPointsProgram = {
  pointsPerAmount: 10,
  pointsPerUnit: 1,
  rewards: defaultLoyaltyRewards
};

const lashesKeywords = ["pestan", "lash", "lifting", "volumen"];

const isLashesContent = (value) => {
  const normalized = String(value || "").toLowerCase();
  return lashesKeywords.some((keyword) => normalized.includes(keyword));
};

const isLashesItem = (item) => {
  if (!item || typeof item !== "object") return false;
  const text = [item.name, item.title, item.style, item.model, item.description].join(" ");
  return isLashesContent(text);
};

const defaultOwnerContact = {
  ownerName: "Esmeralda Guillen",
  website: "https://www.esmenails.com",
  email: "dueno@esmenails.com",
  phone: "+52 55 1234 5678",
  whatsapp: "+52 55 1234 5678",
  instagram: "https://instagram.com/esmenails.oficial",
  facebook: "https://facebook.com/esmenails.oficial",
  tiktok: "https://tiktok.com/@esmenails.oficial",
  address: "Calle Belleza 123, Ciudad de Mexico",
  homeImageMain: realNailImages.encapsulado,
  homeImageOne: realNailImages.gelx,
  homeImageTwo: realNailImages.acrigel,
  homeImageThree: realNailImages.polygel,
  homeImageFour: realNailImages.manicure
};

const normalizeAppPath = (rawPath) => {
  if (typeof rawPath !== "string" || !rawPath.trim()) return "/";
  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
};

const getCurrentAppPath = () => {
  const hashPath = window.location.hash.startsWith("#/") ? window.location.hash.slice(1) : "";
  if (hashPath) return normalizeAppPath(hashPath);

  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl === "./" ? "/" : (baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const pathname = window.location.pathname || "/";

  if (normalizedBase !== "/" && pathname.startsWith(normalizedBase)) {
    const trimmed = pathname.slice(normalizedBase.length - 1);
    return normalizeAppPath(trimmed || "/");
  }

  return normalizeAppPath(pathname || "/");
};

const resolveImageUrl = (rawUrl) => {
  if (typeof rawUrl !== "string") return "";

  let trimmed = rawUrl.trim();
  if (!trimmed) return "";

  if (/^www\./i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  if (/^http:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed.slice(7)}`;
  }

  const driveMatch = trimmed.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)\//i);
  if (driveMatch?.[1]) {
    trimmed = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("dropbox.com")) {
      parsed.searchParams.set("raw", "1");
      trimmed = parsed.toString();
    }
  } catch {
    // Keep original value when it's not a valid absolute URL.
  }

  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  if (trimmed.startsWith("/")) {
    return `${normalizedBase}${trimmed.slice(1)}`;
  }

  return `${normalizedBase}${trimmed}`;
};

function SmartImage({ src, fallbackSrc = localMenuImages.manicure, alt, ...rest }) {
  const toResolved = useCallback((value) => resolveImageUrl(value) || resolveImageUrl(fallbackSrc), [fallbackSrc]);
  const [currentSrc, setCurrentSrc] = useState(() => toResolved(src));

  useEffect(() => {
    setCurrentSrc(toResolved(src));
  }, [src, toResolved]);

  const fallbackResolved = resolveImageUrl(fallbackSrc);

  return (
    <img
      {...rest}
      src={currentSrc}
      alt={alt}
      onError={(event) => {
        if (currentSrc !== fallbackResolved) {
          setCurrentSrc(fallbackResolved);
          return;
        }
        event.currentTarget.onerror = null;
      }}
    />
  );
}

const mergeOwnerContactDefaults = (ownerContact) => ({
  ...defaultOwnerContact,
  ...(ownerContact || {})
});

const inferServiceImageUrl = (service) => {
  const text = `${service?.name || ""} ${service?.style || ""} ${service?.model || ""} ${service?.description || ""}`.toLowerCase();
  if (isLashesContent(text)) return realNailImages.lashes;
  if (text.includes("poly")) return realNailImages.polygel;
  if (text.includes("gel x") || text.includes("gelx")) return realNailImages.gelx;
  if (text.includes("encaps")) return realNailImages.encapsulado;
  if (text.includes("acri")) return realNailImages.acrigel;
  return realNailImages.manicure;
};

const inferProductImageUrl = (product) => {
  const text = `${product?.name || ""} ${product?.description || ""}`.toLowerCase();
  if (isLashesContent(text)) return realNailImages.lashes;
  if (text.includes("press")) return realNailImages.presson;
  return realNailImages.manicure;
};

const inferPromotionImageUrl = (promotion) => {
  const text = `${promotion?.title || ""} ${promotion?.description || ""}`.toLowerCase();
  if (isLashesContent(text)) return realNailImages.lashes;
  if (text.includes("gel x") || text.includes("gelx")) return realNailImages.gelx;
  return realNailImages.encapsulado;
};

const parseBudgetFromPrompt = (text) => {
  const hasBudgetIntent = /presupuesto|tengo|hasta|maximo|cuanto puedo gastar|\$|mxn/.test(text);
  if (!hasBudgetIntent) return 0;

  const matches = text.match(/\d+(?:[.,]\d{1,2})?/g);
  if (!matches || matches.length === 0) return 0;

  const parsed = Number(matches[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildLocalAssistantResponse = ({ message, services, products, promotions, ownerContact }) => {
  const text = String(message || "").toLowerCase();
  const budget = parseBudgetFromPrompt(text);

  if (budget > 0) {
    const candidate = (services || [])
      .map((service) => ({ ...service, priceValue: Number(service?.price || 0) }))
      .filter((service) => Number.isFinite(service.priceValue) && service.priceValue > 0 && service.priceValue <= budget)
      .sort((a, b) => b.priceValue - a.priceValue)[0];

    if (candidate) {
      return {
        text: [
          `Con un presupuesto de $${budget}, te recomiendo ${candidate.name} por $${candidate.priceValue}.`,
          `Duracion estimada: ${Number(candidate.timeMinutes) || 60} min.`,
          "Usa el boton de abajo para agendar esta recomendacion."
        ].join("\n"),
        suggestedServiceId: candidate.id || ""
      };
    }

    return {
      text: `Con presupuesto de $${budget} no encontre un servicio exacto en este momento. Si quieres, te muestro opciones cercanas o promociones activas.`,
      suggestedServiceId: ""
    };
  }

  if (text.includes("precio") || text.includes("cuanto") || text.includes("costo")) {
    const serviceLines = (services || [])
      .filter((item) => Number(item?.price) > 0)
      .slice(0, 4)
      .map((item) => `- ${item.name}: $${Number(item.price)}`);

    if (serviceLines.length === 0) {
      return { text: "Aun no tengo servicios con precio cargados. Puedes revisar la seccion Precios para confirmar el catalogo actual.", suggestedServiceId: "" };
    }

    return { text: `Estos son algunos precios actuales:\n${serviceLines.join("\\n")}\\n\\nSi me dices tu presupuesto, te recomiendo una opcion.`, suggestedServiceId: "" };
  }

  if (text.includes("promo") || text.includes("descuento") || text.includes("oferta")) {
    const promoLines = (promotions || [])
      .slice(0, 4)
      .map((promo) => {
        const value = Number(promo?.value || 0);
        if (!Number.isFinite(value) || value <= 0) return `- ${promo.title}`;
        return promo.discountType === "percentage"
          ? `- ${promo.title}: ${value}%`
          : `- ${promo.title}: $${value}`;
      });

    if (promoLines.length === 0) {
      return { text: "Por ahora no veo promociones activas. Revisa la seccion Promociones para confirmar si ya publicaron nuevas.", suggestedServiceId: "" };
    }

    return { text: `Promociones recomendadas:\n${promoLines.join("\\n")}`, suggestedServiceId: "" };
  }

  if (text.includes("contacto") || text.includes("whatsapp") || text.includes("telefono") || text.includes("direccion")) {
    const lines = [
      ownerContact?.whatsapp ? `WhatsApp: ${ownerContact.whatsapp}` : "",
      ownerContact?.phone ? `Telefono: ${ownerContact.phone}` : "",
      ownerContact?.address ? `Direccion: ${ownerContact.address}` : "",
      ownerContact?.instagram ? `Instagram: ${ownerContact.instagram}` : ""
    ].filter(Boolean);

    if (lines.length === 0) {
      return { text: "Puedes abrir la seccion Contacto para ver los enlaces disponibles.", suggestedServiceId: "" };
    }

    return { text: `Claro, aqui tienes los datos de contacto:\n${lines.join("\\n")}`, suggestedServiceId: "" };
  }

  if (text.includes("cita") || text.includes("agenda") || text.includes("reserv")) {
    return { text: "Para agendar: entra a Agendar cita, selecciona servicio, fecha y profesional, y confirma. Si quieres, te sugiero primero un servicio segun tu estilo.", suggestedServiceId: "" };
  }

  if (text.includes("producto")) {
    const productLines = (products || [])
      .filter((item) => Number(item?.price) > 0)
      .slice(0, 4)
      .map((item) => `- ${item.name}: $${Number(item.price)}`);

    if (productLines.length === 0) {
      return { text: "Todavia no tengo productos con precio cargado en este momento.", suggestedServiceId: "" };
    }

    return { text: `Estos productos estan disponibles:\n${productLines.join("\\n")}`, suggestedServiceId: "" };
  }

  return {
    text: "Soy tu asistente personal de EsmeNails. Te ayudo con precios, promociones, productos, contacto y agendar cita. Escribeme tu duda y te guio.",
    suggestedServiceId: ""
  };
};

const assistantWelcomeMessage = {
  id: "assistant-welcome",
  role: "assistant",
  text: "Hola. Soy tu asistente personal de EsmeNails. Puedo ayudarte con precios, promociones, productos y citas.",
  suggestedServiceId: ""
};

function NavIcon({ type }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };

  switch (type) {
    case "home":
      return <svg {...common}><path d="M2 7.2L8 2l6 5.2" /><path d="M3.5 6.5V14h9V6.5" /></svg>;
    case "menu":
      return <svg {...common}><path d="M2.5 4h11" /><path d="M2.5 8h11" /><path d="M2.5 12h11" /></svg>;
    case "prices":
      return <svg {...common}><path d="M3 2.5h7l3 3v8H3z" /><path d="M10 2.5v3h3" /><path d="M6 7h4" /><path d="M6 10h4" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M5 2.5v2" /><path d="M11 2.5v2" /><path d="M2.5 6.5h11" /></svg>;
    case "contact":
      return <svg {...common}><circle cx="8" cy="5.3" r="2.3" /><path d="M3.2 13c1.2-2.1 3-3.1 4.8-3.1s3.6 1 4.8 3.1" /></svg>;
    case "assistant":
      return <svg {...common}><rect x="2.4" y="3" width="11.2" height="8" rx="2" /><path d="M5.2 13l1.8-2h1.8L10.6 13" /><path d="M5.5 6.5h5" /><path d="M6.8 8.7h2.4" /></svg>;
    case "points":
      return <svg {...common}><path d="M8 2.3l1.6 3.2 3.5.5-2.5 2.4.6 3.4L8 10.1 4.8 11.8l.6-3.4L3 6l3.5-.5z" /></svg>;
    case "history":
      return <svg {...common}><path d="M2.8 8A5.2 5.2 0 1110 13" /><path d="M2.8 4.8v3.3h3.3" /><path d="M8 5.3v3l2 1.3" /></svg>;
    case "promo":
      return <svg {...common}><path d="M3 3.5h10v9H3z" /><path d="M3 6.5h10" /><circle cx="5.2" cy="5" r="0.7" /><circle cx="10.8" cy="8.8" r="0.7" /><path d="M6 9l4-4" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="8" cy="8" r="2" /><path d="M8 2.5v1.4" /><path d="M8 12.1v1.4" /><path d="M2.5 8h1.4" /><path d="M12.1 8h1.4" /><path d="M4.1 4.1l1 1" /><path d="M10.9 10.9l1 1" /><path d="M4.1 11.9l1-1" /><path d="M10.9 5.1l1-1" /></svg>;
    case "security":
      return <svg {...common}><path d="M8 2.3l4.6 1.8v3.6c0 3-1.8 4.9-4.6 6-2.8-1.1-4.6-3-4.6-6V4.1z" /><path d="M6.6 8l1 1 1.9-2" /></svg>;
    case "admin":
      return <svg {...common}><path d="M8 2.4l4.5 1.7v3.2c0 2.8-1.7 4.6-4.5 5.8-2.8-1.2-4.5-3-4.5-5.8V4.1z" /><path d="M8 5.5v4.8" /><path d="M5.9 8h4.2" /></svg>;
    case "profile":
    case "account":
      return <svg {...common}><circle cx="8" cy="5.3" r="2.3" /><path d="M3.2 13c1.2-2.1 3-3.1 4.8-3.1s3.6 1 4.8 3.1" /></svg>;
    case "web":
      return <svg {...common}><circle cx="8" cy="8" r="5.2" /><path d="M2.8 8h10.4" /><path d="M8 2.8c1.5 1.4 2.3 3.3 2.3 5.2S9.5 11.8 8 13.2" /><path d="M8 2.8C6.5 4.2 5.7 6.1 5.7 8s0.8 3.8 2.3 5.2" /></svg>;
    case "mail":
      return <svg {...common}><rect x="2.3" y="3.5" width="11.4" height="9" rx="1.3" /><path d="M2.9 4.2L8 8.1l5.1-3.9" /></svg>;
    case "phone":
      return <svg {...common}><path d="M5.1 2.8l1.7 2.4-1 1.3c0.8 1.7 2 2.9 3.7 3.7l1.3-1 2.4 1.7-0.8 2.2c-0.2 0.5-0.7 0.8-1.2 0.7-4.7-0.8-8.4-4.6-9.2-9.2-0.1-0.5 0.2-1 0.7-1.2z" /></svg>;
    case "whatsapp":
      return <svg {...common}><path d="M8 2.6a5.4 5.4 0 00-4.7 8l-0.5 2.8 2.9-0.5A5.4 5.4 0 108 2.6z" /><path d="M6.2 6.3c0.1 1 0.8 1.9 1.8 2.6 1 0.7 2 1 2.8 0.7" /></svg>;
    case "instagram":
      return <svg {...common}><rect x="3" y="3" width="10" height="10" rx="2.2" /><circle cx="8" cy="8" r="2.1" /><circle cx="11.3" cy="4.7" r="0.6" /></svg>;
    case "facebook":
      return <svg {...common}><path d="M9.3 13V8.7h1.5l0.3-1.8H9.3V5.8c0-0.6 0.2-1 1-1h0.9V3.2c-0.2 0-0.7-0.1-1.4-0.1-1.5 0-2.4 0.9-2.4 2.6v1.2H6v1.8h1.4V13z" /></svg>;
    case "tiktok":
      return <svg {...common}><path d="M9.6 3.1v6.2a2.5 2.5 0 11-1.8-2.4" /><path d="M9.6 4.2c0.7 0.8 1.5 1.2 2.6 1.3" /></svg>;
    case "map":
      return <svg {...common}><path d="M8 13.2s3.6-3.3 3.6-6.1A3.6 3.6 0 104.4 7c0 2.8 3.6 6.2 3.6 6.2z" /><circle cx="8" cy="7" r="1.2" /></svg>;
    default:
      return <svg {...common}><circle cx="8" cy="8" r="2.2" /></svg>;
  }
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(localStorage.getItem("esme_token") || localStorage.getItem("esme_admin_token"))
  );
  const [sessionUser, setSessionUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("esme_user") || "null");
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState("login");
  const [authForm, setAuthForm] = useState(defaultAuth);
  const [busy, setBusy] = useState(false);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem("esme_theme_mode") || "light");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Agendar cita");
  const [selectedMenuCategory, setSelectedMenuCategory] = useState(null);
  const [selectedMenuServiceId, setSelectedMenuServiceId] = useState("");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [menuCartItems, setMenuCartItems] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(MENU_CART_STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogPromotions, setCatalogPromotions] = useState([]);
  const [catalogEmployees, setCatalogEmployees] = useState([]);
  const [catalogPointsProgram, setCatalogPointsProgram] = useState(defaultPointsProgram);
  const [historyData, setHistoryData] = useState({ appointments: [], orders: [], summary: null });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pricesView, setPricesView] = useState("services");
  const [pricesFocus, setPricesFocus] = useState("all");
  const [serviceMinutesById, setServiceMinutesById] = useState({});
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const [appointmentDraft, setAppointmentDraft] = useState(() => createAppointmentDraft(new Date()));
  const [adminAuth, setAdminAuth] = useState({ email: "", password: "" });
  const [adminToken, setAdminToken] = useState(localStorage.getItem("esme_admin_token") || "");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [adminSettings, setAdminSettings] = useState(null);
  const [adminDetailView, setAdminDetailView] = useState("appointments");
  const [adminAppointmentFilter, setAdminAppointmentFilter] = useState("all");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [editingAppointmentId, setEditingAppointmentId] = useState("");
  const [adminAppointmentDraft, setAdminAppointmentDraft] = useState({
    employeeId: "",
    scheduledAt: "",
    notes: ""
  });
  const [quickRescheduleDraft, setQuickRescheduleDraft] = useState({
    appointmentId: "",
    scheduledAt: ""
  });
  const [adminServiceForm, setAdminServiceForm] = useState({
    name: "",
    description: "",
    style: "",
    model: "",
    timeMinutes: 60,
    price: 0,
    imageUrl: ""
  });
  const [adminProductForm, setAdminProductForm] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    imageUrl: ""
  });
  const [adminPromotionForm, setAdminPromotionForm] = useState({
    title: "",
    description: "",
    discountType: "percentage",
    value: 0,
    active: true,
    imageUrl: ""
  });
  const [adminEmployeeForm, setAdminEmployeeForm] = useState({
    name: "",
    role: "Nail Artist",
    active: true,
    imageUrl: ""
  });
  const [profileForm, setProfileForm] = useState(defaultProfileForm);
  const [profileBusy, setProfileBusy] = useState(false);
  const [pointsGameOpen, setPointsGameOpen] = useState(false);
  const [pointsGameRound, setPointsGameRound] = useState({ playerChoice: "", cpuChoice: "", result: "" });
  const [pointsGameWins, setPointsGameWins] = useState(0);
  const [pointsGameAnimating, setPointsGameAnimating] = useState(false);
  const [pointsGameCooldownUntil, setPointsGameCooldownUntil] = useState(0);
  const [pointsGameNow, setPointsGameNow] = useState(() => Date.now());
  const [contactForm, setContactForm] = useState({
    subject: "",
    message: "",
    preferredContact: "email"
  });
  const [contactBusy, setContactBusy] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantFloatingOpen, setAssistantFloatingOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState(() => ([assistantWelcomeMessage]));
  const [ownerContact, setOwnerContact] = useState(defaultOwnerContact);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [emailVerificationBusy, setEmailVerificationBusy] = useState(false);
  const [emailVerificationLocalMode, setEmailVerificationLocalMode] = useState(false);
  const [appPreferences, setAppPreferences] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("esme_app_preferences") || "null");
      if (!stored || typeof stored !== "object") {
        return {
          emailNotifications: true,
          smsNotifications: false,
          appointmentReminders: true,
          promoAlerts: true
        };
      }
      return {
        emailNotifications: Boolean(stored.emailNotifications),
        smsNotifications: Boolean(stored.smsNotifications),
        appointmentReminders: Boolean(stored.appointmentReminders),
        promoAlerts: Boolean(stored.promoAlerts)
      };
    } catch {
      return {
        emailNotifications: true,
        smsNotifications: false,
        appointmentReminders: true,
        promoAlerts: true
      };
    }
  });
  const [privacySettings, setPrivacySettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("esme_privacy_settings") || "null");
      if (!stored || typeof stored !== "object") {
        return {
          analytics: true,
          personalization: true,
          marketingEmails: false
        };
      }
      return {
        analytics: Boolean(stored.analytics),
        personalization: Boolean(stored.personalization),
        marketingEmails: Boolean(stored.marketingEmails)
      };
    } catch {
      return {
        analytics: true,
        personalization: true,
        marketingEmails: false
      };
    }
  });
  const profilePhotoInputRef = useRef(null);
  const assistantMessagesEndRef = useRef(null);
  const ownerCarouselFileInputsRef = useRef({});
  const ownerContactBootstrappedRef = useRef(false);
  const pointsGameResolveTimeoutRef = useRef(null);
  const [homePromoIndex, setHomePromoIndex] = useState(0);
  const [adminSavedMap, setAdminSavedMap] = useState({});
  const [feedback, setFeedback] = useState({ type: "info", text: "Bienvenida a EsmeNails. Inicia sesion o crea tu cuenta para continuar." });
  const appointmentTimeSlots = useMemo(
    () => buildTimeSlots(appointmentSlotStartHour, appointmentSlotEndHour, appointmentSlotStepMinutes),
    []
  );
  const assistantHistoryStorageKey = useMemo(
    () => getAssistantHistoryStorageKey(isAuthenticated, sessionUser),
    [isAuthenticated, sessionUser]
  );

  const buildEmptyAdminData = useCallback(() => ({
    overview: { clients: 0, appointments: 0, orders: 0, revenue: 0 },
    totals: {
      day: { newClients: 0, appointments: 0, orders: 0, revenue: 0, donations: 0 },
      week: { newClients: 0, appointments: 0, orders: 0, revenue: 0, donations: 0 },
      month: { newClients: 0, appointments: 0, orders: 0, revenue: 0, donations: 0 },
      year: { newClients: 0, appointments: 0, orders: 0, revenue: 0, donations: 0 }
    },
    users: [],
    appointments: [],
    completedAppointments: [],
    contactMessages: [],
    clientHistory: []
  }), []);

  const persistLocalAdminSettings = useCallback((settings) => {
    try {
      localStorage.setItem(ADMIN_LOCAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const getLocalAdminSettingsSnapshot = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ADMIN_LOCAL_SETTINGS_KEY) || "null");
      if (stored && typeof stored === "object") {
        return {
          services: Array.isArray(stored.services) ? stored.services : [],
          products: Array.isArray(stored.products) ? stored.products : [],
          promotions: Array.isArray(stored.promotions) ? stored.promotions : [],
          employees: Array.isArray(stored.employees) ? stored.employees : [],
          ownerContact: mergeOwnerContactDefaults(stored.ownerContact),
          pointsProgram: stored.pointsProgram || defaultPointsProgram
        };
      }
    } catch {
      // Fall back to runtime values.
    }

    return {
      services: [],
      products: [],
      promotions: [],
      employees: [],
      ownerContact: mergeOwnerContactDefaults(defaultOwnerContact),
      pointsProgram: defaultPointsProgram
    };
  }, []);

  const applyAdminSettingsToRuntime = useCallback((nextSettings) => {
    const services = Array.isArray(nextSettings?.services)
      ? nextSettings.services.map((service) => ({
          ...service,
          imageUrl: normalizeRealImageUrl(service?.imageUrl) || inferServiceImageUrl(service)
        }))
      : [];

    const products = Array.isArray(nextSettings?.products)
      ? nextSettings.products.map((product) => ({
          ...product,
          imageUrl: normalizeRealImageUrl(product?.imageUrl) || inferProductImageUrl(product)
        }))
      : [];

    const promotions = Array.isArray(nextSettings?.promotions)
      ? nextSettings.promotions.map((promotion) => ({
          ...promotion,
          imageUrl: normalizeRealImageUrl(promotion?.imageUrl) || inferPromotionImageUrl(promotion)
        }))
      : [];

    const employees = Array.isArray(nextSettings?.employees) ? nextSettings.employees : [];
    const owner = mergeOwnerContactDefaults(nextSettings?.ownerContact);
    const pointsProgram = nextSettings?.pointsProgram || defaultPointsProgram;

    const normalizedSettings = {
      services,
      products,
      promotions,
      employees,
      ownerContact: owner,
      pointsProgram
    };

    setAdminSettings(normalizedSettings);
    setCatalogServices(services);
    setCatalogProducts(products);
    setCatalogPromotions(promotions);
    setCatalogEmployees(employees);
    setCatalogPointsProgram(pointsProgram);
    setOwnerContact(owner);
    persistLocalAdminSettings(normalizedSettings);

    return normalizedSettings;
  }, [persistLocalAdminSettings]);

  const markAdminSaved = useCallback((key) => {
    setAdminSavedMap((prev) => ({ ...prev, [key]: true }));

    setTimeout(() => {
      setAdminSavedMap((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 1800);
  }, []);

  const redirectTo = (path) => {
    const targetPath = normalizeAppPath(path);
    const targetHash = `#${targetPath}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetPath;
    }
  };

  const openMenuCategory = (category) => {
    setActiveSection("Menu");
    setSelectedMenuServiceId("");
    setSelectedMenuCategory(category);
    redirectTo(`/nails-app/menu/${category.id}`);
    setFeedback({ type: "success", text: `Se abrio la vista: ${category.title}.` });
  };

  const openMenuServiceDetail = (service) => {
    if (!service?.id) return;
    setActiveSection("Menu");
    setSelectedMenuCategory(null);
    setSelectedMenuServiceId(service.id);
    redirectTo(`/nails-app/menu/${service.id}`);
  };

  const backToMenuGrid = () => {
    setSelectedMenuCategory(null);
    setSelectedMenuServiceId("");
    redirectTo("/nails-app");
  };

  const addServiceToMenuCart = (service) => {
    if (!service?.id) return;

    setMenuCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === service.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: Number(next[existingIndex].quantity || 0) + 1
        };
        return next;
      }

      return [
        ...prev,
        {
          id: service.id,
          name: service.name,
          price: Number(service.price) || 0,
          quantity: 1
        }
      ];
    });

    setFeedback({ type: "success", text: `${service.name} se agrego a tu lista.` });
  };

  const removeMenuCartItem = (serviceId) => {
    setMenuCartItems((prev) => prev.filter((item) => item.id !== serviceId));
  };

  const clearMenuCart = () => {
    setMenuCartItems([]);
  };

  const openAppointmentModal = (prefill = {}) => {
    const suggestedServiceId =
      prefill.serviceId && catalogServices.some((service) => service.id === prefill.serviceId)
        ? prefill.serviceId
        : "";

    const suggestedEmployeeId =
      prefill.employeeId && catalogEmployees.some((employee) => employee.id === prefill.employeeId)
        ? prefill.employeeId
        : "";

    const nextDraft = {
      ...createAppointmentDraft(selectedDate),
      ...prefill,
      serviceId: suggestedServiceId || catalogServices[0]?.id || "",
      employeeId: suggestedEmployeeId || catalogEmployees[0]?.id || ""
    };

    setAppointmentDraft(nextDraft);
    setAppointmentModalOpen(true);
  };

  const closeAppointmentModal = () => {
    setAppointmentModalOpen(false);
    setAppointmentBusy(false);
  };

  const handleAppointmentDraftChange = (event) => {
    setAppointmentDraft((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  };

  const logout = () => {
    localStorage.removeItem("esme_token");
    localStorage.removeItem("esme_user");
    setIsAuthenticated(false);
    setSessionUser(null);
    setMode("login");
    setAuthForm(defaultAuth);
    setProfileMenuOpen(false);
    setActiveSection("Agendar cita");
    setSelectedMenuCategory(null);
    setSelectedMenuServiceId("");
    setAdminToken("");
    setAdminData(null);
    setAdminSettings(null);
    localStorage.removeItem("esme_admin_token");
    redirectTo("/");
    setFeedback({ type: "info", text: "Se cerro la sesion correctamente." });
  };

  const handleAdminAuthChange = (event) => {
    setAdminAuth((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  };

  const loginAsAdminWithCredentials = async ({ email, password, fromMainLogin = false }) => {
    if (!API_BASE) {
      if (!await isLocalAdminCredentials(email, password)) {
        throw new Error("Credenciales admin locales invalidas.");
      }

      const localToken = `local-admin-${Date.now().toString(36)}`;
      localStorage.setItem("esme_admin_token", localToken);
      localStorage.removeItem("esme_token");
      localStorage.removeItem("esme_user");

      setAdminToken(localToken);
      setSessionUser({ name: "Administrador", email: LOCAL_ADMIN_EMAIL, role: "admin" });
      setIsAuthenticated(true);
      setActiveSection("Panel admin");
      redirectTo("/nails-app");

      if (fromMainLogin) {
        setFeedback({ type: "success", text: "Acceso admin local concedido. Bienvenido al panel." });
      } else {
        setFeedback({ type: "success", text: "Panel admin local activado." });
      }

      return {
        token: localToken,
        admin: { email: LOCAL_ADMIN_EMAIL, localMode: true }
      };
    }

    const response = await apiRequest("/admin/login", {
      method: "POST",
      body: { email, password }
    });

    localStorage.setItem("esme_admin_token", response.token);
    localStorage.removeItem("esme_token");
    localStorage.removeItem("esme_user");

    setAdminToken(response.token);
    setSessionUser({ name: "Administrador", email: response.admin.email });
    setIsAuthenticated(true);
    setActiveSection("Panel admin");
    redirectTo("/nails-app");

    if (fromMainLogin) {
      setFeedback({ type: "success", text: "Acceso de administracion concedido. Bienvenido al panel." });
    } else {
      setFeedback({ type: "success", text: "Panel de administracion activado." });
    }

    return response;
  };

  const submitAdminLogin = async (event) => {
    event.preventDefault();
    setAdminBusy(true);
    try {
      await loginAsAdminWithCredentials({ email: adminAuth.email, password: adminAuth.password });
      setAdminAuth({ email: "", password: "" });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No fue posible iniciar admin." });
    } finally {
      setAdminBusy(false);
    }
  };

  const refreshAdminPanels = useCallback(async (token = adminToken) => {
    if (!token) return;

    if (!API_BASE) {
      const localSettings = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime(localSettings);
      setAdminData(buildEmptyAdminData());
      return;
    }

    const [dashboardResponse, settingsResponse] = await Promise.all([
      apiRequest("/admin/dashboard", { token }),
      apiRequest("/admin/settings", { token })
    ]);
    setAdminData(dashboardResponse);
    applyAdminSettingsToRuntime(settingsResponse);
    if (settingsResponse?.ownerContact) {
      setOwnerContact(mergeOwnerContactDefaults(settingsResponse.ownerContact));
    }
  }, [adminToken, applyAdminSettingsToRuntime, buildEmptyAdminData, getLocalAdminSettingsSnapshot]);

  const loadOwnerContact = useCallback(async () => {
    if (!API_BASE) {
      const localSettings = getLocalAdminSettingsSnapshot();
      setOwnerContact(mergeOwnerContactDefaults(localSettings.ownerContact));
      return;
    }

    try {
      const response = await apiRequest("/contact/owner-info");
      if (response?.ownerContact) {
        setOwnerContact(mergeOwnerContactDefaults(response.ownerContact));
      }
    } catch {
      // Keep local fallback examples if endpoint is unavailable.
    }
  }, [getLocalAdminSettingsSnapshot]);

  const updateAdminSettingField = (collection, id, field, value) => {
    setAdminSettings((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        [collection]: prev[collection].map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      };
    });
  };

  const updateAdminPointsProgramField = (field, value) => {
    setAdminSettings((prev) => {
      if (!prev) return prev;
      const current = prev.pointsProgram || defaultPointsProgram;
      return {
        ...prev,
        pointsProgram: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const updateAdminPointsRewardField = (rewardId, field, value) => {
    setAdminSettings((prev) => {
      if (!prev) return prev;
      const current = prev.pointsProgram || defaultPointsProgram;
      return {
        ...prev,
        pointsProgram: {
          ...current,
          rewards: (current.rewards || []).map((reward) =>
            reward.id === rewardId ? { ...reward, [field]: value } : reward
          )
        }
      };
    });
  };

  const addAdminPointsReward = () => {
    setAdminSettings((prev) => {
      if (!prev) return prev;
      const current = prev.pointsProgram || defaultPointsProgram;
      const nextId = `reward-${Date.now().toString(36)}`;
      return {
        ...prev,
        pointsProgram: {
          ...current,
          rewards: [
            ...(current.rewards || []),
            {
              id: nextId,
              points: 20,
              title: "Nueva recompensa",
              description: ""
            }
          ]
        }
      };
    });
  };

  const removeAdminPointsReward = (rewardId) => {
    setAdminSettings((prev) => {
      if (!prev) return prev;
      const current = prev.pointsProgram || defaultPointsProgram;
      return {
        ...prev,
        pointsProgram: {
          ...current,
          rewards: (current.rewards || []).filter((reward) => reward.id !== rewardId)
        }
      };
    });
  };

  const savePointsProgram = async () => {
    if (!adminSettings?.pointsProgram) return;

    const normalizedRewards = (adminSettings.pointsProgram.rewards || [])
      .map((reward, index) => ({
        id: String(reward.id || `reward-${index + 1}`).trim(),
        points: Number(reward.points) || 0,
        title: String(reward.title || "").trim(),
        description: String(reward.description || "").trim()
      }))
      .filter((reward) => reward.id && reward.title && reward.points > 0)
      .sort((a, b) => a.points - b.points);

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        pointsProgram: {
          pointsPerAmount: Number(adminSettings.pointsProgram.pointsPerAmount) || 10,
          pointsPerUnit: Number(adminSettings.pointsProgram.pointsPerUnit) || 1,
          rewards: normalizedRewards
        }
      });
      markAdminSaved("points-program");
      setFeedback({ type: "success", text: "Programa de puntos actualizado al instante." });
      return;
    }

    try {
      await apiRequest("/admin/settings/points-program", {
        method: "PUT",
        token: adminToken,
        body: {
          pointsPerAmount: Number(adminSettings.pointsProgram.pointsPerAmount) || 10,
          pointsPerUnit: Number(adminSettings.pointsProgram.pointsPerUnit) || 1,
          rewards: normalizedRewards
        }
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved("points-program");
      setFeedback({ type: "success", text: "Programa de puntos actualizado." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo actualizar programa de puntos." });
    }
  };

  const saveService = async (service) => {
    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const updatedService = {
        ...service,
        timeMinutes: Number(service.timeMinutes),
        price: Number(service.price),
        imageUrl: service.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        services: (base.services || []).map((entry) => (entry.id === service.id ? updatedService : entry))
      });
      markAdminSaved(`service-${service.id}`);
      setFeedback({ type: "success", text: `Servicio ${service.name} actualizado al instante.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/services/${service.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          name: service.name,
          description: service.description || "",
          style: service.style,
          model: service.model,
          timeMinutes: Number(service.timeMinutes),
          price: Number(service.price),
          imageUrl: service.imageUrl || ""
        }
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved(`service-${service.id}`);
      setFeedback({ type: "success", text: `Servicio ${service.name} actualizado.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo guardar servicio." });
    }
  };

  const saveProduct = async (product) => {
    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const updatedProduct = {
        ...product,
        price: Number(product.price),
        stock: Number(product.stock),
        imageUrl: product.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        products: (base.products || []).map((entry) => (entry.id === product.id ? updatedProduct : entry))
      });
      markAdminSaved(`product-${product.id}`);
      setFeedback({ type: "success", text: `Producto ${product.name} actualizado al instante.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/products/${product.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          name: product.name,
          description: product.description || "",
          price: Number(product.price),
          stock: Number(product.stock),
          imageUrl: product.imageUrl || ""
        }
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved(`product-${product.id}`);
      setFeedback({ type: "success", text: `Producto ${product.name} actualizado.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo guardar producto." });
    }
  };

  const savePromotion = async (promotion) => {
    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const updatedPromotion = {
        ...promotion,
        value: Number(promotion.value),
        active: Boolean(promotion.active),
        imageUrl: promotion.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        promotions: (base.promotions || []).map((entry) => (entry.id === promotion.id ? updatedPromotion : entry))
      });
      markAdminSaved(`promotion-${promotion.id}`);
      setFeedback({ type: "success", text: `Promocion ${promotion.title} actualizada al instante.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/promotions/${promotion.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          title: promotion.title,
          description: promotion.description || "",
          discountType: promotion.discountType,
          value: Number(promotion.value),
          active: Boolean(promotion.active),
          imageUrl: promotion.imageUrl || ""
        }
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved(`promotion-${promotion.id}`);
      setFeedback({ type: "success", text: `Promocion ${promotion.title} actualizada.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo guardar promocion." });
    }
  };

  const deleteService = async (service) => {
    if (!window.confirm(`Eliminar servicio "${service.name}"?`)) return;

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        services: (base.services || []).filter((entry) => entry.id !== service.id)
      });
      setFeedback({ type: "success", text: `Servicio ${service.name} eliminado.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/services/${service.id}`, {
        method: "DELETE",
        token: adminToken
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      setFeedback({ type: "success", text: `Servicio ${service.name} eliminado.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo eliminar servicio." });
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Eliminar producto "${product.name}"?`)) return;

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        products: (base.products || []).filter((entry) => entry.id !== product.id)
      });
      setFeedback({ type: "success", text: `Producto ${product.name} eliminado.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/products/${product.id}`, {
        method: "DELETE",
        token: adminToken
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      setFeedback({ type: "success", text: `Producto ${product.name} eliminado.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo eliminar producto." });
    }
  };

  const deletePromotion = async (promotion) => {
    if (!window.confirm(`Eliminar promocion "${promotion.title}"?`)) return;

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        promotions: (base.promotions || []).filter((entry) => entry.id !== promotion.id)
      });
      setFeedback({ type: "success", text: `Promocion ${promotion.title} eliminada.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/promotions/${promotion.id}`, {
        method: "DELETE",
        token: adminToken
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      setFeedback({ type: "success", text: `Promocion ${promotion.title} eliminada.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo eliminar promocion." });
    }
  };

  const createService = async (event) => {
    event.preventDefault();

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const createdService = {
        id: createLocalEntityId("srv"),
        name: adminServiceForm.name,
        description: adminServiceForm.description || "",
        style: adminServiceForm.style,
        model: adminServiceForm.model,
        timeMinutes: Number(adminServiceForm.timeMinutes),
        price: Number(adminServiceForm.price),
        imageUrl: adminServiceForm.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        services: [...(base.services || []), createdService]
      });
      setAdminServiceForm({ name: "", description: "", style: "", model: "", timeMinutes: 60, price: 0, imageUrl: "" });
      markAdminSaved("service-create");
      setFeedback({ type: "success", text: "Servicio creado y publicado en su categoria." });
      return;
    }

    try {
      await apiRequest("/admin/settings/services", {
        method: "POST",
        token: adminToken,
        body: {
          ...adminServiceForm,
          timeMinutes: Number(adminServiceForm.timeMinutes),
          price: Number(adminServiceForm.price),
          imageUrl: adminServiceForm.imageUrl || ""
        }
      });
      setAdminServiceForm({ name: "", description: "", style: "", model: "", timeMinutes: 60, price: 0, imageUrl: "" });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved("service-create");
      setFeedback({ type: "success", text: "Servicio creado." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo crear servicio." });
    }
  };

  const createProduct = async (event) => {
    event.preventDefault();

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const createdProduct = {
        id: createLocalEntityId("prd"),
        name: adminProductForm.name,
        description: adminProductForm.description || "",
        price: Number(adminProductForm.price),
        stock: Number(adminProductForm.stock),
        imageUrl: adminProductForm.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        products: [...(base.products || []), createdProduct]
      });
      setAdminProductForm({ name: "", description: "", price: 0, stock: 0, imageUrl: "" });
      markAdminSaved("product-create");
      setFeedback({ type: "success", text: "Producto creado y visible al instante." });
      return;
    }

    try {
      await apiRequest("/admin/settings/products", {
        method: "POST",
        token: adminToken,
        body: {
          ...adminProductForm,
          price: Number(adminProductForm.price),
          stock: Number(adminProductForm.stock),
          imageUrl: adminProductForm.imageUrl || ""
        }
      });
      setAdminProductForm({ name: "", description: "", price: 0, stock: 0, imageUrl: "" });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved("product-create");
      setFeedback({ type: "success", text: "Producto creado." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo crear producto." });
    }
  };

  const createPromotion = async (event) => {
    event.preventDefault();

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const createdPromotion = {
        id: createLocalEntityId("promo"),
        title: adminPromotionForm.title,
        description: adminPromotionForm.description || "",
        discountType: adminPromotionForm.discountType,
        value: Number(adminPromotionForm.value),
        active: Boolean(adminPromotionForm.active),
        imageUrl: adminPromotionForm.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        promotions: [...(base.promotions || []), createdPromotion]
      });
      setAdminPromotionForm({ title: "", description: "", discountType: "percentage", value: 0, active: true, imageUrl: "" });
      markAdminSaved("promotion-create");
      setFeedback({ type: "success", text: "Promocion creada y publicada al instante." });
      return;
    }

    try {
      await apiRequest("/admin/settings/promotions", {
        method: "POST",
        token: adminToken,
        body: {
          ...adminPromotionForm,
          value: Number(adminPromotionForm.value),
          imageUrl: adminPromotionForm.imageUrl || ""
        }
      });
      setAdminPromotionForm({ title: "", description: "", discountType: "percentage", value: 0, active: true, imageUrl: "" });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved("promotion-create");
      setFeedback({ type: "success", text: "Promocion creada." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo crear promocion." });
    }
  };

  const saveEmployee = async (employee) => {
    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const updatedEmployee = {
        ...employee,
        active: Boolean(employee.active),
        imageUrl: employee.imageUrl || ""
      };
      applyAdminSettingsToRuntime({
        ...base,
        employees: (base.employees || []).map((entry) => (entry.id === employee.id ? updatedEmployee : entry))
      });
      markAdminSaved(`employee-${employee.id}`);
      setFeedback({ type: "success", text: `Empleada ${employee.name} actualizada al instante.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/employees/${employee.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          name: employee.name,
          role: employee.role,
          active: Boolean(employee.active),
          imageUrl: employee.imageUrl || ""
        }
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved(`employee-${employee.id}`);
      setFeedback({ type: "success", text: `Empleada ${employee.name} actualizada.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo guardar empleada." });
    }
  };

  const deleteEmployee = async (employee) => {
    if (!window.confirm(`Eliminar empleada "${employee.name}"?`)) return;

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        employees: (base.employees || []).filter((entry) => entry.id !== employee.id)
      });
      setFeedback({ type: "success", text: `Empleada ${employee.name} eliminada.` });
      return;
    }

    try {
      await apiRequest(`/admin/settings/employees/${employee.id}`, {
        method: "DELETE",
        token: adminToken
      });
      await refreshAdminPanels();
      await refreshAgendaData();
      setFeedback({ type: "success", text: `Empleada ${employee.name} eliminada.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo eliminar empleada." });
    }
  };

  const loadMyProfile = useCallback(async () => {
    const token = localStorage.getItem("esme_token");
    if (!token) return;

    if (!API_BASE) {
      setProfileForm((prev) => ({
        ...prev,
        name: sessionUser?.name || "",
        birthDate: sessionUser?.birthDate || "",
        email: sessionUser?.email || "",
        phone: sessionUser?.phone || "",
        description: sessionUser?.description || "",
        profileImageUrl: sessionUser?.profileImageUrl || "",
        emailVerified: false,
        phoneVerified: false,
        points: Number(sessionUser?.points) || 0,
        ordersCount: Number(sessionUser?.ordersCount) || 0,
        appointmentsCount: Number(sessionUser?.appointmentsCount) || 0
      }));
      setEmailCodeSent(false);
      setEmailVerificationCode("");
      setEmailVerificationLocalMode(false);
      return;
    }

    try {
      const response = await apiRequest("/users/me", { token });
      setProfileForm((prev) => ({
        ...prev,
        name: response.profile.name || "",
        birthDate: response.profile.birthDate || "",
        email: response.profile.email || "",
        phone: response.profile.phone || "",
        description: response.profile.description || "",
        profileImageUrl: response.profile.profileImageUrl || "",
        emailVerified: Boolean(response.profile.emailVerified),
        phoneVerified: Boolean(response.profile.phoneVerified),
        points: Number(response.profile.points) || 0,
        ordersCount: Number(response.profile.ordersCount) || 0,
        appointmentsCount: Number(response.profile.appointmentsCount) || 0
      }));
      setSessionUser((prev) => {
        const next = {
          ...(prev || {}),
          name: response.profile.name || prev?.name || "",
          email: response.profile.email || prev?.email || "",
          points: Number(response.profile.points) || 0
        };
        localStorage.setItem("esme_user", JSON.stringify(next));
        return next;
      });
      setEmailCodeSent(false);
      setEmailVerificationCode("");
      setEmailVerificationLocalMode(false);
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo cargar perfil." });
    }
  }, [sessionUser]);

  const handleProfileChange = (event) => {
    setProfileForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));

    if (event.target.name === "email") {
      setEmailCodeSent(false);
      setEmailVerificationCode("");
      setEmailVerificationLocalMode(false);
    }
  };

  const openProfilePhotoPicker = () => {
    profilePhotoInputRef.current?.click();
  };

  const handleProfilePhotoSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", text: "Selecciona un archivo de imagen valido." });
      return;
    }

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setFeedback({ type: "error", text: `La foto supera ${maxSizeMb}MB. Elige una imagen mas ligera.` });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileForm((prev) => ({
          ...prev,
          profileImageUrl: reader.result
        }));
        setFeedback({ type: "success", text: "Foto seleccionada. Guarda perfil para confirmar." });
      }
    };
    reader.onerror = () => {
      setFeedback({ type: "error", text: "No se pudo leer la foto seleccionada." });
    };
    reader.readAsDataURL(file);

    // Reset input value so selecting the same image again still triggers change.
    event.target.value = "";
  };

  const handleAdminImageFileSelected = (event, target) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", text: "Selecciona un archivo de imagen valido." });
      event.target.value = "";
      return;
    }

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setFeedback({ type: "error", text: `La imagen supera ${maxSizeMb}MB. Elige una imagen mas ligera.` });
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;

      if (target.form === "service") {
        setAdminServiceForm((prev) => ({ ...prev, imageUrl: reader.result }));
      } else if (target.form === "product") {
        setAdminProductForm((prev) => ({ ...prev, imageUrl: reader.result }));
      } else if (target.form === "promotion") {
        setAdminPromotionForm((prev) => ({ ...prev, imageUrl: reader.result }));
      } else if (target.form === "employee") {
        setAdminEmployeeForm((prev) => ({ ...prev, imageUrl: reader.result }));
      } else if (target.ownerField) {
        updateOwnerContactField(target.ownerField, reader.result);
      } else if (target.collection && target.id) {
        updateAdminSettingField(target.collection, target.id, "imageUrl", reader.result);
      }

      setFeedback({ type: "success", text: "Imagen cargada. Guarda para confirmar cambios." });
    };

    reader.onerror = () => {
      setFeedback({ type: "error", text: "No se pudo leer la imagen seleccionada." });
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("esme_token");
    if (!token) {
      setFeedback({ type: "error", text: "Inicia sesion como clienta para editar perfil." });
      return;
    }

    setProfileBusy(true);
    try {
      const response = await apiRequest("/users/me", {
        method: "PUT",
        token,
        body: {
          name: profileForm.name,
          birthDate: profileForm.birthDate,
          email: profileForm.email,
          phone: profileForm.phone,
          description: profileForm.description,
          profileImageUrl: profileForm.profileImageUrl
        }
      });

      const nextProfile = response.profile || {};
      setProfileForm((prev) => ({
        ...prev,
        name: nextProfile.name || "",
        birthDate: nextProfile.birthDate || "",
        email: nextProfile.email || "",
        phone: nextProfile.phone || "",
        description: nextProfile.description || "",
        profileImageUrl: nextProfile.profileImageUrl || "",
        emailVerified: Boolean(nextProfile.emailVerified),
        phoneVerified: Boolean(nextProfile.phoneVerified),
        points: Number(nextProfile.points) || prev.points || 0,
        ordersCount: Number(nextProfile.ordersCount) || prev.ordersCount || 0,
        appointmentsCount: Number(nextProfile.appointmentsCount) || prev.appointmentsCount || 0
      }));
      setEmailCodeSent(false);
      setEmailVerificationCode("");
      setEmailVerificationLocalMode(false);

      const nextSessionUser = {
        ...(sessionUser || {}),
        name: nextProfile.name || profileForm.name,
        email: nextProfile.email || profileForm.email,
        points: Number(nextProfile.points) || sessionUser?.points || 0
      };
      setSessionUser(nextSessionUser);
      localStorage.setItem("esme_user", JSON.stringify(nextSessionUser));
      setFeedback({ type: "success", text: response.message || "Perfil actualizado." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo actualizar perfil." });
    } finally {
      setProfileBusy(false);
    }
  };

  const verifyProfileField = async (kind) => {
    const token = localStorage.getItem("esme_token");
    if (!token) {
      setFeedback({ type: "error", text: "Inicia sesion como clienta para verificar." });
      return;
    }

    if (kind === "phone" && !profileForm.phone.trim()) {
      setFeedback({ type: "error", text: "Escribe un numero de telefono antes de verificar." });
      return;
    }

    if (kind === "email" && !profileForm.email.trim()) {
      setFeedback({ type: "error", text: "Escribe un correo antes de verificar." });
      return;
    }

    const endpoint = kind === "email" ? "/users/me/verify-email" : "/users/me/verify-phone";
    try {
      setEmailVerificationBusy(true);

      // Sync the latest profile form so verification uses the currently typed email/phone.
      const syncResponse = await apiRequest("/users/me", {
        method: "PUT",
        token,
        body: {
          name: profileForm.name,
          birthDate: profileForm.birthDate,
          email: profileForm.email,
          phone: profileForm.phone,
          description: profileForm.description,
          profileImageUrl: profileForm.profileImageUrl
        }
      });

      const syncedProfile = syncResponse.profile || {};
      setProfileForm((prev) => ({
        ...prev,
        name: syncedProfile.name || prev.name,
        birthDate: syncedProfile.birthDate || prev.birthDate,
        email: syncedProfile.email || prev.email,
        phone: syncedProfile.phone || prev.phone,
        description: syncedProfile.description || prev.description,
        profileImageUrl: syncedProfile.profileImageUrl || prev.profileImageUrl,
        emailVerified: Boolean(syncedProfile.emailVerified),
        phoneVerified: Boolean(syncedProfile.phoneVerified),
        points: Number(syncedProfile.points) || prev.points || 0,
        ordersCount: Number(syncedProfile.ordersCount) || prev.ordersCount || 0,
        appointmentsCount: Number(syncedProfile.appointmentsCount) || prev.appointmentsCount || 0
      }));

      const nextSessionUser = {
        ...(sessionUser || {}),
        name: syncedProfile.name || profileForm.name,
        email: syncedProfile.email || profileForm.email,
        points: Number(syncedProfile.points) || sessionUser?.points || 0
      };
      setSessionUser(nextSessionUser);
      localStorage.setItem("esme_user", JSON.stringify(nextSessionUser));

      const response = await apiRequest(endpoint, { method: "POST", token });
      if (kind === "email") {
        setEmailCodeSent(true);
        setEmailVerificationCode(response.devCode || "");
        setEmailVerificationLocalMode(Boolean(response.devCode));
        const devHint = response.devCode ? ` Codigo (dev): ${response.devCode}` : "";
        setFeedback({ type: "success", text: `${response.message || "Codigo enviado."}${devHint}` });
      } else {
        setProfileForm((prev) => ({
          ...prev,
          phoneVerified: true
        }));
        setFeedback({ type: "success", text: response.message || "Verificacion completada." });
      }
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo verificar." });
    } finally {
      setEmailVerificationBusy(false);
    }
  };

  const confirmEmailVerificationCode = async () => {
    const token = localStorage.getItem("esme_token");
    if (!token) {
      setFeedback({ type: "error", text: "Inicia sesion como clienta para verificar." });
      return;
    }

    if (!/^\d{6}$/.test(emailVerificationCode.trim())) {
      setFeedback({ type: "error", text: "Ingresa un codigo de 6 digitos." });
      return;
    }

    try {
      setEmailVerificationBusy(true);
      const response = await apiRequest("/users/me/verify-email/confirm", {
        method: "POST",
        token,
        body: { code: emailVerificationCode.trim() }
      });
      setProfileForm((prev) => ({ ...prev, emailVerified: true }));
      setEmailCodeSent(false);
      setEmailVerificationCode("");
      setEmailVerificationLocalMode(false);
      setFeedback({ type: "success", text: response.message || "Correo verificado" });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo confirmar codigo." });
    } finally {
      setEmailVerificationBusy(false);
    }
  };

  const createEmployee = async (event) => {
    event.preventDefault();

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      const createdEmployee = {
        id: createLocalEntityId("emp"),
        name: adminEmployeeForm.name,
        role: adminEmployeeForm.role,
        active: Boolean(adminEmployeeForm.active),
        imageUrl: adminEmployeeForm.imageUrl || ""
      };

      applyAdminSettingsToRuntime({
        ...base,
        employees: [...(base.employees || []), createdEmployee]
      });

      setAdminEmployeeForm({ name: "", role: "Nail Artist", active: true, imageUrl: "" });
      markAdminSaved("employee-create");
      setFeedback({ type: "success", text: "Empleada creada y visible al instante." });
      return;
    }

    try {
      await apiRequest("/admin/settings/employees", {
        method: "POST",
        token: adminToken,
        body: {
          ...adminEmployeeForm,
          active: Boolean(adminEmployeeForm.active),
          imageUrl: adminEmployeeForm.imageUrl || ""
        }
      });
      setAdminEmployeeForm({ name: "", role: "Nail Artist", active: true, imageUrl: "" });
      await refreshAdminPanels();
      await refreshAgendaData();
      markAdminSaved("employee-create");
      setFeedback({ type: "success", text: "Empleada creada." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo crear empleada." });
    }
  };

  const selectedClientProfile = useMemo(() => {
    if (!selectedClientId || !adminData?.clientHistory) return null;
    return adminData.clientHistory.find((entry) => entry.client.id === selectedClientId) || null;
  }, [selectedClientId, adminData]);

  const filteredAdminAppointments = useMemo(() => {
    const allAppointments = adminData?.appointments || [];
    if (adminAppointmentFilter === "all") {
      return allAppointments;
    }
    return allAppointments.filter((appointment) => appointment.status === adminAppointmentFilter);
  }, [adminData, adminAppointmentFilter]);

  const handleContactChange = (event) => {
    setContactForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  };

  const submitContactForm = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("esme_token");
    if (!token) {
      setFeedback({ type: "error", text: "Inicia sesion para enviar mensaje de contacto." });
      return;
    }

    setContactBusy(true);
    try {
      const response = await apiRequest("/contact/messages", {
        method: "POST",
        token,
        body: {
          subject: contactForm.subject,
          message: contactForm.message,
          preferredContact: contactForm.preferredContact
        }
      });
      setContactForm({ subject: "", message: "", preferredContact: "email" });
      setFeedback({ type: "success", text: response.message || "Mensaje enviado." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo enviar mensaje de contacto." });
    } finally {
      setContactBusy(false);
    }
  };

  const submitAssistantMessage = async (event) => {
    event.preventDefault();
    const message = assistantInput.trim();
    if (!message || assistantBusy) return;

    const nextUserMessage = {
      id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      text: message
    };

    const nextHistory = [...assistantMessages, nextUserMessage];
    setAssistantMessages(nextHistory);
    setAssistantInput("");
    setAssistantBusy(true);

    const fallbackResponse = buildLocalAssistantResponse({
      message,
      services: catalogServices,
      products: catalogProducts,
      promotions: catalogPromotions,
      ownerContact
    });

    try {
      if (!API_BASE) {
        throw new Error("API no disponible");
      }

      const response = await apiRequest("/ai", {
        method: "POST",
        body: {
          message,
          history: nextHistory.slice(-8).map((entry) => ({ role: entry.role, content: entry.text })),
          context: {
            services: catalogServices.slice(0, 20).map((item) => ({ id: item.id, name: item.name, price: Number(item.price) || 0 })),
            products: catalogProducts.slice(0, 20).map((item) => ({ name: item.name, price: Number(item.price) || 0 })),
            promotions: catalogPromotions.slice(0, 20).map((item) => ({
              title: item.title,
              value: Number(item.value) || 0,
              discountType: item.discountType
            })),
            ownerContact: {
              whatsapp: ownerContact.whatsapp,
              phone: ownerContact.phone,
              address: ownerContact.address,
              instagram: ownerContact.instagram
            }
          }
        }
      });

      const assistantReply = String(response?.reply || "").trim() || fallbackResponse.text;
      const apiSuggestedServiceId = String(response?.suggestedServiceId || "").trim();
      const suggestedServiceId = catalogServices.some((service) => service.id === apiSuggestedServiceId)
        ? apiSuggestedServiceId
        : fallbackResponse.suggestedServiceId;

      setAssistantMessages((prev) => ([
        ...prev,
        {
          id: `assistant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          role: "assistant",
          text: assistantReply,
          suggestedServiceId
        }
      ]));
    } catch {
      setAssistantMessages((prev) => ([
        ...prev,
        {
          id: `assistant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          role: "assistant",
          text: fallbackResponse.text,
          suggestedServiceId: fallbackResponse.suggestedServiceId
        }
      ]));
    } finally {
      setAssistantBusy(false);
    }
  };

  const openAssistantWithPrompt = (prompt) => {
    setAssistantFloatingOpen(true);
    if (typeof prompt === "string" && prompt.trim()) {
      setAssistantInput(prompt.trim());
    }
  };

  const updateAdminContactField = (messageId, field, value) => {
    setAdminData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        contactMessages: (prev.contactMessages || []).map((entry) =>
          entry.id === messageId ? { ...entry, [field]: value } : entry
        )
      };
    });
  };

  const saveAdminContactMessage = async (entry) => {
    try {
      await apiRequest(`/admin/contact-messages/${entry.id}`, {
        method: "PUT",
        token: adminToken,
        body: {
          status: entry.status,
          adminNote: entry.adminNote || ""
        }
      });
      await refreshAdminPanels();
      setFeedback({ type: "success", text: "Mensaje de contacto actualizado." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo actualizar contacto." });
    }
  };

  const updateOwnerContactField = (field, value) => {
    const normalizedValue = typeof value === "string" ? value : "";

    setAdminSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ownerContact: {
          ...(prev.ownerContact || {}),
          [field]: normalizedValue
        }
      };
    });

    // Keep visible preview aligned while editing carousel media.
    setOwnerContact((prev) => ({
      ...prev,
      [field]: normalizedValue
    }));
  };

  const clearOwnerContactField = (field) => {
    updateOwnerContactField(field, "");
  };

  const registerOwnerCarouselFileInput = (field, node) => {
    if (!ownerCarouselFileInputsRef.current) return;
    if (!node) {
      delete ownerCarouselFileInputsRef.current[field];
      return;
    }
    ownerCarouselFileInputsRef.current[field] = node;
  };

  const openOwnerCarouselFilePicker = (field) => {
    ownerCarouselFileInputsRef.current?.[field]?.click();
  };

  const hasOwnerCarouselImage = (value) => typeof value === "string" && value.trim().length > 0;

  const renderOwnerCarouselThumb = (value, fallbackSrc, alt) => {
    if (hasOwnerCarouselImage(value)) {
      return (
        <SmartImage
          src={value}
          alt={alt}
          className="admin-thumb"
          fallbackSrc={fallbackSrc}
        />
      );
    }

    return (
      <div className="admin-thumb admin-thumb-empty" role="img" aria-label={`${alt} sin imagen`}>
        Sin imagen
      </div>
    );
  };

  const pasteOwnerContactField = async (field) => {
    try {
      const canReadClipboard = typeof navigator !== "undefined"
        && navigator.clipboard
        && typeof navigator.clipboard.readText === "function";

      if (!canReadClipboard) {
        throw new Error("Tu navegador no permite leer portapapeles en esta pagina.");
      }

      const pasted = await navigator.clipboard.readText();
      const value = String(pasted || "").trim();
      updateOwnerContactField(field, value);
      setFeedback({ type: "success", text: "URL pegada en el carrusel." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error?.message || "No se pudo leer el portapapeles. Pega manualmente con Ctrl + V."
      });
    }
  };

  const applySuggestedServiceImage = (service) => {
    updateAdminSettingField("services", service.id, "imageUrl", inferServiceImageUrl(service));
  };

  const applySuggestedProductImage = (product) => {
    updateAdminSettingField("products", product.id, "imageUrl", inferProductImageUrl(product));
  };

  const applySuggestedPromotionImage = (promotion) => {
    updateAdminSettingField("promotions", promotion.id, "imageUrl", inferPromotionImageUrl(promotion));
  };

  const applySuggestedOwnerCarouselImages = () => {
    const nextOwnerContact = {
      ...(adminSettings?.ownerContact || defaultOwnerContact),
      homeImageMain: realNailImages.encapsulado,
      homeImageOne: realNailImages.gelx,
      homeImageTwo: realNailImages.acrigel,
      homeImageThree: realNailImages.polygel,
      homeImageFour: realNailImages.manicure
    };

    setAdminSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ownerContact: nextOwnerContact
      };
    });

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        ownerContact: nextOwnerContact
      });
    }
  };

  const saveOwnerContact = async () => {
    if (!adminSettings?.ownerContact) return;

    if (!API_BASE) {
      const base = getLocalAdminSettingsSnapshot();
      applyAdminSettingsToRuntime({
        ...base,
        ownerContact: mergeOwnerContactDefaults(adminSettings.ownerContact)
      });
      markAdminSaved("owner-contact");
      setFeedback({ type: "success", text: "Datos de contacto guardados y publicados al instante." });
      return;
    }

    try {
      const response = await apiRequest("/admin/settings/owner-contact", {
        method: "PUT",
        token: adminToken,
        body: {
          ownerName: adminSettings.ownerContact.ownerName,
          website: adminSettings.ownerContact.website,
          email: adminSettings.ownerContact.email,
          phone: adminSettings.ownerContact.phone,
          whatsapp: adminSettings.ownerContact.whatsapp,
          instagram: adminSettings.ownerContact.instagram,
          facebook: adminSettings.ownerContact.facebook,
          tiktok: adminSettings.ownerContact.tiktok,
          address: adminSettings.ownerContact.address,
          homeImageMain: adminSettings.ownerContact.homeImageMain || "",
          homeImageOne: adminSettings.ownerContact.homeImageOne || "",
          homeImageTwo: adminSettings.ownerContact.homeImageTwo || "",
          homeImageThree: adminSettings.ownerContact.homeImageThree || "",
          homeImageFour: adminSettings.ownerContact.homeImageFour || ""
        }
      });
      setOwnerContact(mergeOwnerContactDefaults(response.ownerContact || adminSettings.ownerContact));
      await refreshAdminPanels();
      markAdminSaved("owner-contact");
      setFeedback({ type: "success", text: "Datos de contacto del dueno actualizados." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo actualizar contacto del dueno." });
    }
  };

  const updateAdminAppointment = async (appointmentId, payload, successMessage) => {
    try {
      await apiRequest(`/admin/appointments/${appointmentId}`, {
        method: "PUT",
        token: adminToken,
        body: payload
      });
      await refreshAdminPanels();
      setFeedback({ type: "success", text: successMessage || "Cita actualizada." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo actualizar la cita." });
    }
  };

  const openClientProfile = (userId) => {
    setSelectedClientId(userId);
    setAdminDetailView("clients");
    setFeedback({ type: "info", text: "Perfil del cliente abierto." });
  };

  const startEditAppointment = (appointment) => {
    setEditingAppointmentId(appointment.id);
    setAdminAppointmentDraft({
      employeeId: appointment.employeeId || adminSettings?.employees?.[0]?.id || "",
      scheduledAt: toInputDateTime(appointment.scheduledAt),
      notes: appointment.notes || ""
    });
  };

  const closeEditAppointment = () => {
    setEditingAppointmentId("");
    setAdminAppointmentDraft({ employeeId: "", scheduledAt: "", notes: "" });
  };

  const submitEditAppointment = async (event) => {
    event.preventDefault();
    if (!editingAppointmentId) return;

    const scheduledAt = new Date(adminAppointmentDraft.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      setFeedback({ type: "error", text: "Fecha de cita invalida." });
      return;
    }

    await updateAdminAppointment(
      editingAppointmentId,
      {
        employeeId: adminAppointmentDraft.employeeId,
        scheduledAt: scheduledAt.toISOString(),
        notes: adminAppointmentDraft.notes.trim()
      },
      "Cita editada correctamente."
    );
    closeEditAppointment();
  };

  const confirmAppointment = async (appointmentId) => {
    await updateAdminAppointment(appointmentId, { status: "confirmed" }, "Cita confirmada.");
  };

  const completeAppointment = async (appointmentId) => {
    await updateAdminAppointment(appointmentId, { status: "completed" }, "Cita marcada como completada.");
  };

  const restoreCompletedAppointment = async (appointmentId) => {
    try {
      await apiRequest(`/admin/appointments/${appointmentId}/restore`, {
        method: "POST",
        token: adminToken
      });
      await refreshAdminPanels();
      setFeedback({ type: "success", text: "Cita restaurada a activas." });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo restaurar la cita." });
    }
  };

  const startQuickReschedule = (appointment) => {
    setQuickRescheduleDraft({
      appointmentId: appointment.id,
      scheduledAt: toInputDateTime(appointment.scheduledAt)
    });
  };

  const closeQuickReschedule = () => {
    setQuickRescheduleDraft({ appointmentId: "", scheduledAt: "" });
  };

  const submitQuickReschedule = async (event) => {
    event.preventDefault();
    if (!quickRescheduleDraft.appointmentId) return;

    const scheduledAt = new Date(quickRescheduleDraft.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      setFeedback({ type: "error", text: "Fecha de reagendado invalida." });
      return;
    }

    await updateAdminAppointment(
      quickRescheduleDraft.appointmentId,
      {
        scheduledAt: scheduledAt.toISOString(),
        status: "scheduled"
      },
      "Cita reagendada correctamente."
    );
    closeQuickReschedule();
  };

  const cancelEditedAppointment = async () => {
    if (!editingAppointmentId) return;
    try {
      await apiRequest(`/admin/appointments/${editingAppointmentId}`, {
        method: "DELETE",
        token: adminToken
      });
      await refreshAdminPanels();
      setFeedback({ type: "success", text: "Cita borrada correctamente." });
      closeEditAppointment();
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo borrar la cita." });
    }
  };

  const exportCsv = async (period) => {
    try {
      if (!API_BASE) {
        throw new Error("Exportacion no disponible: falta configurar VITE_API_URL en esta version web.");
      }

      const response = await fetch(`${API_BASE}/admin/reports/csv?period=${period}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "No se pudo exportar CSV");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `esmenails-${period}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFeedback({ type: "success", text: `CSV ${period} descargado.` });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "Error exportando CSV." });
    }
  };

  const logoutAdmin = () => {
    localStorage.removeItem("esme_admin_token");
    setAdminToken("");
    setAdminData(null);
    setAdminSettings(null);
    setFeedback({ type: "info", text: "Sesion de administracion cerrada." });
  };

  useEffect(() => {
    const checkApi = async () => {
      if (!API_BASE) {
        setFeedback((prev) => {
          if (prev?.type === "error" && String(prev?.text || "").includes("API no configurada")) {
            return {
              type: "info",
              text: "Modo local activo: puedes iniciar sesion sin backend en esta version web."
            };
          }
          return prev;
        });
        return;
      }

      try {
        await apiRequest("/health");
      } catch (error) {
        setFeedback({
          type: "error",
          text: error.message
        });
      }
    };

    checkApi();
  }, []);

  useEffect(() => {
    if (ownerContactBootstrappedRef.current) return;
    ownerContactBootstrappedRef.current = true;
    loadOwnerContact();
  }, [loadOwnerContact]);

  useEffect(() => {
    assistantMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [assistantMessages]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(assistantHistoryStorageKey) || "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        const normalized = stored
          .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant") && typeof entry.text === "string")
          .slice(-20)
          .map((entry, index) => ({
            id: entry.id || `assistant-history-${index}`,
            role: entry.role,
            text: entry.text,
            suggestedServiceId: typeof entry.suggestedServiceId === "string" ? entry.suggestedServiceId : ""
          }));

        if (normalized.length > 0) {
          setAssistantMessages(normalized);
          return;
        }
      }
    } catch {
      // Ignore parse errors and fall back to welcome message.
    }

    setAssistantMessages([assistantWelcomeMessage]);
  }, [assistantHistoryStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        assistantHistoryStorageKey,
        JSON.stringify((assistantMessages || []).slice(-20))
      );
    } catch {
      // Ignore storage failures.
    }
  }, [assistantHistoryStorageKey, assistantMessages]);

  useEffect(() => {
    try {
      localStorage.setItem(MENU_CART_STORAGE_KEY, JSON.stringify(menuCartItems));
    } catch {
      // Ignore storage write failures.
    }
  }, [menuCartItems]);

  useEffect(() => {
    const currentPath = getCurrentAppPath();

    if (currentPath.startsWith("/nails-app") && !isAuthenticated) {
      redirectTo("/");
    }
    if (currentPath !== "/nails-app" && isAuthenticated) {
      const match = currentPath.match(/^\/nails-app\/menu\/([a-z0-9-]+)$/i);

      if (match?.[1]) {
        const matchedService = catalogServices.find((service) => service.id === match[1]);
        if (matchedService) {
          setActiveSection("Menu");
          setSelectedMenuCategory(null);
          setSelectedMenuServiceId(matchedService.id);
          return;
        }

        const found = findCategoryById(match[1]);
        if (found) {
          setActiveSection("Menu");
          setSelectedMenuServiceId("");
          setSelectedMenuCategory(found);
          return;
        }
      }

      redirectTo("/nails-app");
    }
  }, [catalogServices, isAuthenticated]);

  const refreshAgendaData = useCallback(async () => {
    const token = localStorage.getItem("esme_token");

    setAgendaLoading(true);
    setHistoryLoading(true);
    try {
      if (!API_BASE) {
        const localSettings = getLocalAdminSettingsSnapshot();
        const normalizedSettings = applyAdminSettingsToRuntime(localSettings);
        const minutesMap = {};

        for (const service of normalizedSettings.services || []) {
          minutesMap[service.id] = Number(service.timeMinutes) || 60;
        }

        setAppointments([]);
        setHistoryData({ appointments: [], orders: [], summary: null });
        setServiceMinutesById(minutesMap);
        return;
      }

      const catalogPromise = apiRequest("/catalog");

      let appointmentsPromise = Promise.resolve({ appointments: [] });
      let historyPromise = Promise.resolve({ history: { appointments: [], orders: [], summary: null } });
      if (isAuthenticated && token) {
        appointmentsPromise = apiRequest("/appointments/my", { token });
        historyPromise = apiRequest("/users/me/history", { token });
      }

      const [catalogResponse, appointmentsResponse, historyResponse] = await Promise.all([
        catalogPromise,
        appointmentsPromise,
        historyPromise
      ]);

      const services = (catalogResponse.services || []).map((service) => ({
        ...service,
        imageUrl: normalizeRealImageUrl((service.imageUrl || "").trim()) || inferServiceImageUrl(service)
      }));
      const products = (catalogResponse.products || []).map((product) => ({
        ...product,
        imageUrl: normalizeRealImageUrl((product.imageUrl || "").trim()) || inferProductImageUrl(product)
      }));
      const promotions = (catalogResponse.promotions || []).map((promotion) => ({
        ...promotion,
        imageUrl: normalizeRealImageUrl((promotion.imageUrl || "").trim()) || inferPromotionImageUrl(promotion)
      }));
      const employees = catalogResponse.employees || [];
      const minutesMap = {};
      for (const service of services) {
        minutesMap[service.id] = Number(service.timeMinutes) || 60;
      }

      setAppointments(appointmentsResponse.appointments || []);
      setCatalogServices(services);
      setCatalogProducts(products);
      setCatalogPromotions(promotions);
      setCatalogEmployees(employees);
      setCatalogPointsProgram(catalogResponse.pointsProgram || defaultPointsProgram);
      setHistoryData(historyResponse.history || { appointments: [], orders: [], summary: null });
      setServiceMinutesById(minutesMap);
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo cargar la agenda." });
    } finally {
      setAgendaLoading(false);
      setHistoryLoading(false);
    }
  }, [applyAdminSettingsToRuntime, getLocalAdminSettingsSnapshot, isAuthenticated]);

  useEffect(() => {
    refreshAgendaData();
  }, [refreshAgendaData]);

  useEffect(() => {
    const loadAdminData = async () => {
      if (!adminToken || activeSection !== "Panel admin") {
        return;
      }

      setAdminBusy(true);
      try {
        await refreshAdminPanels(adminToken);
      } catch (error) {
        setFeedback({ type: "error", text: error.message || "Error cargando panel admin." });
      } finally {
        setAdminBusy(false);
      }
    };

    loadAdminData();
  }, [adminToken, activeSection, refreshAdminPanels]);

  const handleAuthChange = (event) => {
    setAuthForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  };

  const passwordRules = useMemo(
    () => ({
      minLength: authForm.password.length >= 6,
      hasUppercase: /[A-Z]/.test(authForm.password),
      hasSpecial: /[^A-Za-z0-9]/.test(authForm.password)
    }),
    [authForm.password]
  );

  const isPasswordStrong = passwordRules.minLength && passwordRules.hasUppercase && passwordRules.hasSpecial;

  const visiblePosSections = useMemo(() => {
    if (adminToken) {
      return [...posSections, "Panel admin"];
    }
    return posSections;
  }, [adminToken]);

  const quickRailSections = useMemo(() => visiblePosSections, [visiblePosSections]);

  const navigateToSection = (section) => {
    setActiveSection(section);
    if (section !== "Menu") {
      setSelectedMenuCategory(null);
      redirectTo("/nails-app");
    }
    setFeedback({ type: "success", text: `Seccion actual: ${section}.` });
  };

  const selectedDateLabel = useMemo(
    () => selectedDate.toLocaleDateString("es-ES", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    [selectedDate]
  );

  const visibleStaffColumns = useMemo(() => {
    if (catalogEmployees.length > 0) {
      return catalogEmployees.map((employee) => employee.name);
    }
    return ["Esmeralda Guillen"];
  }, [catalogEmployees]);

  const selectedServiceDuration = useMemo(() => {
    if (!appointmentDraft.serviceId) return 60;

    const selectedService = catalogServices.find((service) => service.id === appointmentDraft.serviceId);
    return Number(selectedService?.timeMinutes) || serviceMinutesById[appointmentDraft.serviceId] || 60;
  }, [appointmentDraft.serviceId, catalogServices, serviceMinutesById]);

  const occupiedAppointmentSlots = useMemo(() => {
    if (!appointmentDraft.date || appointmentTimeSlots.length === 0) {
      return new Set();
    }

    const selectedDay = toDayKey(new Date(`${appointmentDraft.date}T00:00:00`));
    const dayAppointments = appointments.filter((appointment) => {
      if (toDayKey(appointment.scheduledAt) !== selectedDay) return false;
      if (appointment.status === "cancelled") return false;
      if (!appointmentDraft.employeeId) return true;
      return (appointment.employeeId || "") === appointmentDraft.employeeId;
    });

    const blocked = new Set();
    for (const slot of appointmentTimeSlots) {
      const slotStart = new Date(`${appointmentDraft.date}T${slot}:00`);
      const slotEnd = new Date(slotStart.getTime() + selectedServiceDuration * 60_000);

      const inConflict = dayAppointments.some((appointment) => {
        const existingStart = new Date(appointment.scheduledAt);
        const existingDuration = serviceMinutesById[appointment.serviceId] || 60;
        const existingEnd = new Date(existingStart.getTime() + existingDuration * 60_000);
        return overlaps(slotStart, slotEnd, existingStart, existingEnd);
      });

      if (inConflict) blocked.add(slot);
    }

    return blocked;
  }, [appointmentDraft.date, appointmentDraft.employeeId, appointmentTimeSlots, appointments, selectedServiceDuration, serviceMinutesById]);

  const scheduleCards = useMemo(() => {
    const selectedKey = toDayKey(selectedDate);
    const staffCount = Math.max(1, visibleStaffColumns.length);

    return appointments
      .filter((appointment) => toDayKey(appointment.scheduledAt) === selectedKey)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .map((appointment, index) => {
        const date = new Date(appointment.scheduledAt);
        const hourPosition = date.getHours() + date.getMinutes() / 60 - startHour;
        const durationMinutes = serviceMinutesById[appointment.serviceId] || 60;
        const employeeName = appointment.employeeName || "Esmeralda Guillen";
        const employeeIndex = Math.max(0, visibleStaffColumns.indexOf(employeeName));

        return {
          id: appointment.id,
          title: appointment.employeeName || "Esmeralda Guillen",
          service: appointment.serviceName,
          column: employeeIndex >= 0 ? employeeIndex : index % staffCount,
          start: Math.max(0, hourPosition),
          span: Math.max(0.8, Math.min(2.2, durationMinutes / 60)),
          color: cardPalette[index % cardPalette.length]
        };
      })
      .filter((card) => card.start <= visibleHours - 0.1);
  }, [appointments, selectedDate, serviceMinutesById, visibleStaffColumns]);

  const upcomingAppointments = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((appointment) => {
        const timestamp = new Date(appointment.scheduledAt).getTime();
        return Number.isFinite(timestamp) && timestamp >= now && appointment.status !== "cancelled";
      })
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  }, [appointments]);

  const nextAppointment = upcomingAppointments[0] || null;

  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(profileForm.name?.trim()),
      Boolean(profileForm.email?.trim()),
      Boolean(profileForm.phone?.trim()),
      Boolean(profileForm.birthDate),
      Boolean(profileForm.description?.trim()),
      Boolean(profileForm.profileImageUrl)
    ];
    const complete = checks.filter(Boolean).length;
    return Math.round((complete / checks.length) * 100);
  }, [profileForm]);

  const pointsBalance = useMemo(() => {
    const fromProfile = Number(profileForm.points);
    if (Number.isFinite(fromProfile)) return Math.max(0, fromProfile);
    const fromSession = Number(sessionUser?.points);
    return Number.isFinite(fromSession) ? Math.max(0, fromSession) : 0;
  }, [profileForm.points, sessionUser?.points]);

  const pointsTier = useMemo(() => {
    if (pointsBalance >= 140) return "Diamante";
    if (pointsBalance >= 100) return "Gold";
    if (pointsBalance >= 60) return "Silver";
    return "Starter";
  }, [pointsBalance]);

  const pointsProgram = useMemo(() => {
    const source = catalogPointsProgram || defaultPointsProgram;
    const rewards = Array.isArray(source.rewards)
      ? [...source.rewards]
          .map((reward) => ({
            id: String(reward.id || "").trim(),
            points: Number(reward.points) || 0,
            title: String(reward.title || "").trim(),
            description: String(reward.description || "").trim()
          }))
          .filter((reward) => reward.id && reward.title && reward.points > 0)
          .sort((a, b) => a.points - b.points)
      : defaultLoyaltyRewards;

    return {
      pointsPerAmount: Number(source.pointsPerAmount) || 10,
      pointsPerUnit: Number(source.pointsPerUnit) || 1,
      rewards: rewards.length > 0 ? rewards : defaultLoyaltyRewards
    };
  }, [catalogPointsProgram]);

  const loyaltyRewards = pointsProgram.rewards;

  const nextReward = useMemo(
    () => loyaltyRewards.find((reward) => pointsBalance < reward.points) || null,
    [pointsBalance, loyaltyRewards]
  );

  const pointsProgressPercent = useMemo(() => {
    if (!nextReward) return 100;
    const previousThreshold =
      loyaltyRewards
        .filter((reward) => reward.points < nextReward.points)
        .slice(-1)[0]?.points || 0;
    const span = Math.max(1, nextReward.points - previousThreshold);
    return Math.max(0, Math.min(100, ((pointsBalance - previousThreshold) / span) * 100));
  }, [nextReward, pointsBalance, loyaltyRewards]);

  const completedVisits = useMemo(
    () => appointments.filter((appointment) => appointment.status === "completed").length,
    [appointments]
  );

  const pointsGameCooldownLeftMs = useMemo(
    () => Math.max(0, pointsGameCooldownUntil - pointsGameNow),
    [pointsGameCooldownUntil, pointsGameNow]
  );

  const pointsGameCooldownSeconds = useMemo(
    () => Math.ceil(pointsGameCooldownLeftMs / 1000),
    [pointsGameCooldownLeftMs]
  );

  useEffect(() => {
    if (pointsGameCooldownLeftMs <= 0) return undefined;
    const intervalId = window.setInterval(() => {
      setPointsGameNow(Date.now());
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [pointsGameCooldownLeftMs]);

  useEffect(() => () => {
    if (pointsGameResolveTimeoutRef.current) {
      window.clearTimeout(pointsGameResolveTimeoutRef.current);
    }
  }, []);

  const creditPointsFromGame = useCallback((deltaPoints) => {
    const increment = normalizePointsValue(deltaPoints);
    if (increment <= 0) return;

    setProfileForm((prev) => ({
      ...prev,
      points: normalizePointsValue((Number(prev.points) || 0) + increment)
    }));

    setSessionUser((prev) => {
      if (!prev) return prev;

      const nextPoints = normalizePointsValue((Number(prev.points) || 0) + increment);
      const nextUser = {
        ...prev,
        points: nextPoints
      };

      localStorage.setItem("esme_user", JSON.stringify(nextUser));

      if (!API_BASE) {
        const normalizedEmail = normalizeAuthEmail(nextUser.email);
        const users = getLocalAuthUsers();
        const nextUsers = users.map((entry) => {
          const byEmail = normalizeAuthEmail(entry?.email) === normalizedEmail;
          const byId = String(entry?.id || "") === String(nextUser.id || "");
          if (!byEmail && !byId) return entry;
          return {
            ...entry,
            points: nextPoints
          };
        });
        setLocalAuthUsers(nextUsers);
      }

      return nextUser;
    });
  }, []);

  const playPointsGameRound = useCallback((playerChoice) => {
    if (!playerChoice) return;

    if (pointsGameAnimating) {
      setFeedback({ type: "info", text: "Resolviendo la ronda actual, espera un momento." });
      return;
    }

    if (pointsGameCooldownLeftMs > 0) {
      setFeedback({ type: "info", text: `Espera ${pointsGameCooldownSeconds}s para jugar otra ronda.` });
      return;
    }

    setPointsGameAnimating(true);
    setPointsGameRound({ playerChoice, cpuChoice: "", result: "pending" });

    if (pointsGameResolveTimeoutRef.current) {
      window.clearTimeout(pointsGameResolveTimeoutRef.current);
    }

    pointsGameResolveTimeoutRef.current = window.setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * pointsGameOptions.length);
      const cpuChoice = pointsGameOptions[randomIndex]?.id || "piedra";

      let result = "draw";
      if (playerChoice !== cpuChoice) {
        const playerWins =
          (playerChoice === "piedra" && cpuChoice === "tijera")
          || (playerChoice === "papel" && cpuChoice === "piedra")
          || (playerChoice === "tijera" && cpuChoice === "papel");
        result = playerWins ? "win" : "lose";
      }

      setPointsGameRound({ playerChoice, cpuChoice, result });
      setPointsGameAnimating(false);
      setPointsGameNow(Date.now());
      setPointsGameCooldownUntil(Date.now() + POINTS_GAME_COOLDOWN_MS);

      if (result === "win") {
        setPointsGameWins((prev) => prev + 1);
        creditPointsFromGame(0.1);
        setFeedback({ type: "success", text: "Ganaste la ronda. +0.1 puntos agregados." });
        return;
      }

      if (result === "draw") {
        setFeedback({ type: "info", text: "Empate. Intenta otra ronda para sumar puntos." });
        return;
      }

      setFeedback({ type: "info", text: "Esta ronda se perdio. Vuelve a jugar para ganar puntos." });
    }, 900);
  }, [creditPointsFromGame, pointsGameAnimating, pointsGameCooldownLeftMs, pointsGameCooldownSeconds]);

  const historyAppointments = historyData?.appointments || [];
  const historyOrders = historyData?.orders || [];
  const historySummary = historyData?.summary || {
    appointments: historyAppointments.length,
    completedAppointments: historyAppointments.filter((entry) => entry.status === "completed").length,
    cancelledAppointments: historyAppointments.filter((entry) => entry.status === "cancelled").length,
    orders: historyOrders.length,
    totalSpent: historyOrders.reduce((acc, entry) => acc + Number(entry.total || 0), 0),
    totalPointsEarned: historyOrders.reduce((acc, entry) => acc + Number(entry.pointsEarned || 0), 0)
  };

  const filteredCatalogServices = useMemo(() => {
    if (pricesFocus === "all") return catalogServices;
    if (pricesFocus === "lashes") return catalogServices.filter((item) => isLashesItem(item));
    return catalogServices.filter((item) => !isLashesItem(item));
  }, [catalogServices, pricesFocus]);

  const filteredCatalogProducts = useMemo(() => {
    if (pricesFocus === "all") return catalogProducts;
    if (pricesFocus === "lashes") return catalogProducts.filter((item) => isLashesItem(item));
    return catalogProducts.filter((item) => !isLashesItem(item));
  }, [catalogProducts, pricesFocus]);

  const filteredCatalogPromotions = useMemo(() => {
    if (pricesFocus === "all") return catalogPromotions;
    if (pricesFocus === "lashes") return catalogPromotions.filter((item) => isLashesItem(item));
    return catalogPromotions.filter((item) => !isLashesItem(item));
  }, [catalogPromotions, pricesFocus]);

  const homeShowcaseItems = useMemo(() => {
    const ownerSlides = [
      ownerContact.homeImageMain,
      ownerContact.homeImageOne,
      ownerContact.homeImageTwo,
      ownerContact.homeImageThree,
      ownerContact.homeImageFour
    ]
      .filter((value) => typeof value === "string" && value.trim())
      .map((imageUrl, index) => ({
        id: `owner-home-${index}`,
        title: index === 0 ? "EsmeNails Destacado" : `Promo visual ${index}`,
        subtitle: "Imagen configurable desde Panel admin",
        imageUrl: normalizeRealImageUrl(imageUrl),
        kicker: "Home"
      }));

    const promoItems = (catalogPromotions || [])
      .filter((promotion) => promotion.imageUrl)
      .map((promotion) => ({
        id: `promo-${promotion.id}`,
        title: promotion.title,
        subtitle: promotion.description || "Promocion destacada",
        imageUrl: promotion.imageUrl,
        kicker: "Promocion"
      }));

    const serviceItems = (catalogServices || [])
      .filter((service) => service.imageUrl)
      .map((service) => ({
        id: `service-${service.id}`,
        title: service.name,
        subtitle: service.description || `${service.style} ${service.model}`,
        imageUrl: service.imageUrl,
        kicker: "Servicio"
      }));

    const categoryItems = menuCategories.map((category) => ({
      id: `category-${category.id}`,
      title: category.title,
      subtitle: category.subtitle,
      imageUrl: category.image,
      kicker: "Coleccion"
    }));

    const merged = [...ownerSlides, ...promoItems, ...serviceItems, ...categoryItems];
    const unique = [];
    const seen = new Set();

    for (const entry of merged) {
      const key = `${entry.title}-${entry.imageUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(entry);
    }

    if (unique.length === 0) {
      return [
        {
          id: "fallback-home-slide",
          title: "EsmeNails Studio",
          subtitle: "Disenos modernos y experiencias premium",
          imageUrl: realNailImages.gelx,
          kicker: "Destacado"
        }
      ];
    }

    return unique;
  }, [catalogPromotions, catalogServices, ownerContact]);

  const homeActiveSlide = homeShowcaseItems[homePromoIndex % Math.max(1, homeShowcaseItems.length)] || null;

  const homeFilmStripItems = useMemo(() => {
    if (homeShowcaseItems.length === 0) return [];
    return [...homeShowcaseItems, ...homeShowcaseItems];
  }, [homeShowcaseItems]);

  const contactIconLinks = useMemo(() => {
    const mapUrl = ownerContact.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ownerContact.address)}`
      : "";

    return [
      { key: "website", type: "web", href: ownerContact.website, label: "Website" },
      { key: "email", type: "mail", href: ownerContact.email ? `mailto:${ownerContact.email}` : "", label: "Correo" },
      { key: "phone", type: "phone", href: ownerContact.phone ? `tel:${ownerContact.phone}` : "", label: "Telefono" },
      { key: "whatsapp", type: "whatsapp", href: ownerContact.whatsapp ? `https://wa.me/${ownerContact.whatsapp.replace(/\D/g, "")}` : "", label: "WhatsApp" },
      { key: "instagram", type: "instagram", href: ownerContact.instagram, label: "Instagram" },
      { key: "facebook", type: "facebook", href: ownerContact.facebook, label: "Facebook" },
      { key: "tiktok", type: "tiktok", href: ownerContact.tiktok, label: "TikTok" },
      { key: "address", type: "map", href: mapUrl, label: "Ubicacion" }
    ].filter((entry) => Boolean(entry.href));
  }, [ownerContact]);

  const contactTickerLinks = useMemo(() => {
    const mapUrl = ownerContact.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ownerContact.address)}`
      : "";

    const links = [ownerContact.website, ownerContact.instagram, ownerContact.facebook, ownerContact.tiktok, mapUrl]
      .filter((value) => Boolean(value));

    if (links.length === 0) return [];
    return [...links, ...links];
  }, [ownerContact]);

  useEffect(() => {
    if (!adminToken && activeSection === "Panel admin") {
      setActiveSection("Agendar cita");
    }
  }, [adminToken, activeSection]);

  useEffect(() => {
    if (!isAuthenticated || adminToken) {
      setProfileForm(defaultProfileForm);
      return;
    }

    loadMyProfile();
  }, [isAuthenticated, adminToken, loadMyProfile]);

  useEffect(() => {
    const isDark = themeMode === "dark";
    document.body.classList.toggle("theme-dark", isDark);
    localStorage.setItem("esme_theme_mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem("esme_app_preferences", JSON.stringify(appPreferences));
  }, [appPreferences]);

  useEffect(() => {
    localStorage.setItem("esme_privacy_settings", JSON.stringify(privacySettings));
  }, [privacySettings]);

  useEffect(() => {
    setHomePromoIndex(0);
  }, [homeShowcaseItems.length]);

  useEffect(() => {
    if (activeSection !== "Home" || homeShowcaseItems.length < 2) {
      return;
    }

    const timerId = window.setInterval(() => {
      setHomePromoIndex((prev) => (prev + 1) % homeShowcaseItems.length);
    }, 3200);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeSection, homeShowcaseItems.length]);

  const submitAppointment = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("esme_token");
    if (!token) {
      setFeedback({ type: "error", text: "Debes iniciar sesion como clienta para agendar." });
      return;
    }

    if (!appointmentDraft.serviceId || !appointmentDraft.employeeId || !appointmentDraft.date || !appointmentDraft.time) {
      setFeedback({ type: "error", text: "Completa servicio, profesional, fecha y hora para continuar." });
      return;
    }

    const scheduledDate = new Date(`${appointmentDraft.date}T${appointmentDraft.time}:00`);
    if (Number.isNaN(scheduledDate.getTime())) {
      setFeedback({ type: "error", text: "La fecha u hora no es valida." });
      return;
    }

    if (occupiedAppointmentSlots.has(appointmentDraft.time)) {
      setFeedback({ type: "error", text: "Ese bloque ya esta ocupado. Selecciona otra hora." });
      return;
    }

    setAppointmentBusy(true);
    try {
      const response = await apiRequest("/appointments", {
        method: "POST",
        token,
        body: {
          serviceId: appointmentDraft.serviceId,
          employeeId: appointmentDraft.employeeId,
          scheduledAt: scheduledDate.toISOString(),
          notes: appointmentDraft.notes.trim() || undefined
        }
      });

      await refreshAgendaData();
      setSelectedDate(new Date(scheduledDate));
      closeAppointmentModal();
      setFeedback({
        type: "success",
        text: response.message || "Cita agendada correctamente."
      });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No se pudo agendar la cita." });
    } finally {
      setAppointmentBusy(false);
    }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setBusy(true);
    setFeedback({ type: "info", text: "Procesando solicitud..." });

    try {
      if (!API_BASE) {
        const normalizedEmail = normalizeAuthEmail(authForm.email);
        if (!normalizedEmail || !authForm.password.trim()) {
          throw new Error("Ingresa correo y contrasena para continuar.");
        }

        if (mode === "register") {
          if (!authForm.name.trim()) {
            throw new Error("Escribe tu nombre para registrarte.");
          }

          if (normalizedEmail === LOCAL_ADMIN_EMAIL) {
            throw new Error("Ese correo esta reservado para administracion.");
          }

          const passwordHash = await createLocalPasswordHash(authForm.password);

          const users = getLocalAuthUsers();
          if (users.some((entry) => normalizeAuthEmail(entry?.email) === normalizedEmail)) {
            throw new Error("Ese correo ya esta registrado en este dispositivo.");
          }

          const nextUser = {
            id: createLocalEntityId("local-user"),
            name: authForm.name.trim(),
            email: normalizedEmail,
            passwordHash,
            points: 0,
            createdAt: new Date().toISOString()
          };

          setLocalAuthUsers([...users, nextUser]);
          setAuthForm(defaultAuth);
          setMode("login");
          setFeedback({
            type: "success",
            text: "Registro local completado. Ahora inicia sesion."
          });
          return;
        }

        if (await isLocalAdminCredentials(authForm.email, authForm.password)) {
          await loginAsAdminWithCredentials({
            email: authForm.email,
            password: authForm.password,
            fromMainLogin: true
          });
          setAuthForm(defaultAuth);
          return;
        }

        const users = getLocalAuthUsers();
        let localUser = null;
        let migratedUsers = null;

        for (let index = 0; index < users.length; index += 1) {
          const entry = users[index];
          if (normalizeAuthEmail(entry?.email) !== normalizedEmail) {
            continue;
          }

          const verification = await verifyLocalUserPassword(entry, authForm.password);
          if (!verification.matches) {
            continue;
          }

          localUser = verification.user;
          if (verification.migrated) {
            migratedUsers = [...users];
            migratedUsers[index] = verification.user;
          }
          break;
        }

        if (!localUser) {
          throw new Error("Credenciales invalidas en modo local. Registrate primero en este dispositivo.");
        }

        if (migratedUsers) {
          setLocalAuthUsers(migratedUsers);
        }

        const sessionLocalUser = {
          id: localUser.id,
          name: localUser.name,
          email: localUser.email,
          points: Number(localUser.points) || 0
        };

        localStorage.setItem("esme_token", `local-${Date.now().toString(36)}`);
        localStorage.setItem("esme_user", JSON.stringify(sessionLocalUser));
        localStorage.removeItem("esme_admin_token");
        setAdminToken("");
        setSessionUser(sessionLocalUser);
        setIsAuthenticated(true);
        setActiveSection("Agendar cita");
        redirectTo("/nails-app");
        setAuthForm(defaultAuth);
        setFeedback({
          type: "success",
          text: `Bienvenida ${sessionLocalUser.name}. Iniciaste sesion en modo local (sin backend).`
        });
        return;
      }

      if (mode === "register") {
        const registerResponse = await apiRequest("/auth/register", {
          method: "POST",
          body: {
            name: authForm.name,
            email: authForm.email,
            password: authForm.password
          }
        });

        setFeedback({
          type: "success",
          text: registerResponse.message || "Registro exitoso. Ahora inicia sesion."
        });
        setAuthForm(defaultAuth);
        setMode("login");
        return;
      }

      try {
        await loginAsAdminWithCredentials({
          email: authForm.email,
          password: authForm.password,
          fromMainLogin: true
        });
        setAuthForm(defaultAuth);
        return;
      } catch {
        // If credentials are not admin, continue with normal client login.
      }

      const loginResponse = await apiRequest("/auth/login", {
        method: "POST",
        body: {
          email: authForm.email,
          password: authForm.password
        }
      });

      localStorage.setItem("esme_token", loginResponse.token);
      localStorage.setItem("esme_user", JSON.stringify(loginResponse.user));
      localStorage.removeItem("esme_admin_token");
      setAdminToken("");
      setSessionUser(loginResponse.user);
      setIsAuthenticated(true);
      setActiveSection("Agendar cita");
      redirectTo("/nails-app");
      setFeedback({
        type: "success",
        text: `Bienvenida ${loginResponse.user.name}. Inicio de sesion exitoso.`
      });
    } catch (error) {
      setFeedback({ type: "error", text: error.message || "No fue posible procesar la solicitud" });
    } finally {
      setBusy(false);
    }
  };

  return (
    isAuthenticated ? (
      <main className="pos-layout">
        <header className="pos-topbar">
          <div className="pos-topbar-left">
            <div>
              <p className="dashboard-kicker">EsmeNails</p>
              <strong>{activeSection}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className={`theme-switch ${themeMode === "dark" ? "dark" : ""}`}
              onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
              aria-label="Cambiar modo de color"
              title={themeMode === "dark" ? "Modo noche" : "Modo claro"}
            >
              <span className="theme-switch-track">
                <span className="theme-switch-thumb" />
              </span>
              <span className="theme-switch-label">{themeMode === "dark" ? "Noche" : "Claro"}</span>
            </button>

            <div className="profile-menu-wrap">
              <button
                className="topbar-btn"
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
              >
                {sessionUser?.name || "Mi cuenta"} v
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection("Mi perfil");
                      setProfileMenuOpen(false);
                      setFeedback({ type: "success", text: "Abriendo perfil de usuario." });
                    }}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <NavIcon type="profile" />
                    </span>
                    Mi perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection("Mi cuenta");
                      setProfileMenuOpen(false);
                      setFeedback({ type: "success", text: "Abriendo informacion de cuenta." });
                    }}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <NavIcon type="account" />
                    </span>
                    Mi cuenta
                  </button>
                  <button type="button" onClick={logout}>
                    <span className="nav-icon" aria-hidden="true">
                      <NavIcon type="security" />
                    </span>
                    Cerrar sesion
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="pos-shell">
          <aside className="quick-rail" aria-label="Acciones rapidas">
            {quickRailSections.map((item) => (
              <button
                key={item}
                type="button"
                className={activeSection === item ? "active" : ""}
                onClick={() => navigateToSection(item)}
                title={item}
              >
                <NavIcon type={navIconBySection[item]} />
                <span className="quick-rail-label">{quickRailLabelBySection[item] || item}</span>
              </button>
            ))}
          </aside>

          <section
            className="pos-content"
            onClick={() => {
              if (profileMenuOpen) setProfileMenuOpen(false);
            }}
          >
            <h1>{activeSection}</h1>
            <nav className="mobile-quick-nav" aria-label="Navegacion movil">
              {quickRailSections.map((item) => (
                <button
                  key={`mobile-${item}`}
                  type="button"
                  className={activeSection === item ? "active" : ""}
                  onClick={() => navigateToSection(item)}
                  title={item}
                >
                  <NavIcon type={navIconBySection[item]} />
                  <span>{quickRailLabelBySection[item] || item}</span>
                </button>
              ))}
            </nav>
            {activeSection === "Mi perfil" || activeSection === "Mi cuenta" ? (
              <section className="profile-panel">
                <article className="profile-hero">
                  <div className="profile-avatar-wrap">
                    {profileForm.profileImageUrl ? (
                      <SmartImage src={profileForm.profileImageUrl} alt="Foto de perfil" className="profile-avatar" fallbackSrc={localMenuImages.manicure} />
                    ) : (
                      <div className="profile-avatar placeholder">{(profileForm.name || sessionUser?.name || "E").slice(0, 1).toUpperCase()}</div>
                    )}
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="profile-photo-input"
                      onChange={handleProfilePhotoSelected}
                    />
                    <button
                      type="button"
                      className="secondary profile-photo-btn"
                      onClick={openProfilePhotoPicker}
                    >
                      {profileForm.profileImageUrl ? "Cambiar foto" : "Agregar foto"}
                    </button>
                  </div>
                  <div className="profile-hero-copy">
                    <h2>{profileForm.name || sessionUser?.name || "Tu perfil"}</h2>
                    <p>Panel dedicado de perfil personal de EsmeNails.</p>
                    <div className="profile-verify-row">
                      <span className={`verify-pill ${profileForm.emailVerified ? "ok" : "pending"}`}>
                        Correo: {profileForm.emailVerified ? "Verificado" : "Pendiente"}
                      </span>
                      <span className={`verify-pill ${profileForm.phoneVerified ? "ok" : "pending"}`}>
                        Telefono: {profileForm.phoneVerified ? "Verificado" : "Pendiente"}
                      </span>
                    </div>
                  </div>
                </article>

                <form className="profile-form" onSubmit={submitProfile}>
                  <label>
                    Nombre completo
                    <input
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      placeholder="Tu nombre"
                      required
                    />
                  </label>
                  <label>
                    Fecha de nacimiento
                    <input
                      name="birthDate"
                      type="date"
                      value={profileForm.birthDate}
                      onChange={handleProfileChange}
                    />
                  </label>
                  <label>
                    Correo electronico
                    <input
                      name="email"
                      type="email"
                      value={profileForm.email}
                      onChange={handleProfileChange}
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </label>
                  <div className="profile-inline-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => verifyProfileField("email")}
                      disabled={emailVerificationBusy}
                    >
                      {emailVerificationBusy ? "Enviando..." : "Enviar codigo de verificacion"}
                    </button>
                  </div>
                  {emailCodeSent && (
                    <div className="profile-code-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailVerificationCode}
                        onChange={(event) => setEmailVerificationCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="Ingresa el codigo de 6 digitos"
                      />
                      <button
                        type="button"
                        className="primary"
                        onClick={confirmEmailVerificationCode}
                        disabled={emailVerificationBusy}
                      >
                        {emailVerificationBusy ? "Validando..." : "Aceptar y continuar"}
                      </button>
                      {emailVerificationLocalMode && (
                        <p className="profile-code-hint">Modo local activo: el codigo ya fue cargado automaticamente.</p>
                      )}
                    </div>
                  )}
                  <label>
                    Numero de telefono
                    <input
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileChange}
                      placeholder="+52 000 000 0000"
                    />
                  </label>
                  <div className="profile-inline-actions">
                    <button type="button" className="secondary" onClick={() => verifyProfileField("phone")}>Verificar telefono</button>
                  </div>
                  <label>
                    Descripcion
                    <textarea
                      name="description"
                      value={profileForm.description}
                      onChange={handleProfileChange}
                      placeholder="Cuida tu estilo, preferencias, referencias favoritas..."
                      maxLength={500}
                    />
                  </label>

                  <button type="submit" className="primary" disabled={profileBusy}>
                    {profileBusy ? "Guardando perfil..." : "Guardar perfil"}
                  </button>
                </form>
              </section>
            ) : activeSection === "Agendar cita" ? (
              <section className="agenda-wrap">
                <article className="agenda-profile-summary">
                  <strong>Perfil para esta cita</strong>
                  <p>{profileForm.name || sessionUser?.name || "Sin nombre"}</p>
                  <p>{profileForm.email || sessionUser?.email || "Sin correo"}</p>
                  <p>{profileForm.phone || "Sin telefono"}</p>
                </article>
                <div className="agenda-headbar">
                  <div className="agenda-headbar-left">
                    <button
                      type="button"
                      className="ghost-chip"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      className="ghost-chip"
                      onClick={() => setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1))}
                    >
                      &lt;
                    </button>
                    <strong>{selectedDateLabel}</strong>
                    <button
                      type="button"
                      className="ghost-chip"
                      onClick={() => setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1))}
                    >
                      &gt;
                    </button>
                  </div>
                  <div className="agenda-headbar-right">
                    <span>Semana</span>
                    <span>2 Calendars</span>
                    <button
                      type="button"
                      className="primary-chip"
                      onClick={() => openAppointmentModal()}
                    >
                      Agendar cita
                    </button>
                  </div>
                </div>

                <div className="agenda-grid">
                  <div className="agenda-time-column">
                    <div className="agenda-time-top" />
                    {daySlots.map((slot) => (
                      <div key={slot} className="agenda-time-cell">{slot}</div>
                    ))}
                  </div>

                  <div className="agenda-columns-wrap">
                    <div
                      className="agenda-columns-head"
                      style={{ gridTemplateColumns: `repeat(${visibleStaffColumns.length}, minmax(0, 1fr))` }}
                    >
                      {visibleStaffColumns.map((name) => (
                        <div key={name} className="agenda-column-title">{name}</div>
                      ))}
                    </div>

                    <div
                      className="agenda-columns-body"
                      style={{ gridTemplateColumns: `repeat(${visibleStaffColumns.length}, minmax(0, 1fr))` }}
                    >
                      {visibleStaffColumns.map((name) => (
                        <div key={name} className="agenda-column-bg">
                          {daySlots.map((slot) => (
                            <div key={`${name}-${slot}`} className="agenda-row-line" />
                          ))}
                        </div>
                      ))}

                      {scheduleCards.map((card) => (
                        <article
                          key={card.id}
                          className={`schedule-card ${card.color}`}
                          style={{
                            width: `calc(${100 / Math.max(1, visibleStaffColumns.length)}% - 0.7rem)`,
                            left: `calc(${card.column * (100 / Math.max(1, visibleStaffColumns.length))}% + 0.35rem)`,
                            top: `calc(${card.start * 64}px + 0.2rem)`,
                            height: `calc(${card.span * 64}px - 0.35rem)`
                          }}
                        >
                          <strong>{card.title}</strong>
                          <small>{card.service}</small>
                        </article>
                      ))}

                      {!agendaLoading && scheduleCards.length === 0 && (
                        <div className="agenda-empty">
                          <strong>No hay citas para este dia</strong>
                          <p>Agenda una cita y aparecera aqui automaticamente.</p>
                          <button
                            type="button"
                            className="primary-chip"
                            onClick={() => openAppointmentModal()}
                          >
                            Agendar cita
                          </button>
                        </div>
                      )}

                      {agendaLoading && (
                        <div className="agenda-empty loading">
                          <strong>Cargando agenda...</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : activeSection === "Contacto" ? (
              <section className="contact-wrap">
                <article className="contact-hero">
                  <h2>Contacto EsmeNails</h2>
                  <p>Escribe tu mensaje y el equipo lo revisa desde el panel admin.</p>
                </article>

                <article className="contact-owner-card">
                  <h3>Conecta por iconos</h3>
                  <div className="contact-owner-icons" role="list" aria-label="Canales de contacto">
                    {contactIconLinks.map((entry) => (
                      <a
                        key={entry.key}
                        href={entry.href}
                        target="_blank"
                        rel="noreferrer"
                        className="contact-owner-icon-link"
                        title={entry.label}
                        aria-label={entry.label}
                      >
                        <NavIcon type={entry.type} />
                      </a>
                    ))}
                  </div>
                  {contactTickerLinks.length > 0 && (
                    <div className="contact-link-marquee" aria-hidden="true">
                      <div className="contact-link-marquee-track">
                        {contactTickerLinks.map((link, index) => (
                          <a key={`${link}-${index}`} href={link} target="_blank" rel="noreferrer">
                            {link.replace(/^https?:\/\//, "")}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="contact-owner-mini">
                    <span>{ownerContact.ownerName}</span>
                  </div>
                </article>

                <form className="contact-form" onSubmit={submitContactForm}>
                  <label>
                    Asunto
                    <input
                      name="subject"
                      value={contactForm.subject}
                      onChange={handleContactChange}
                      placeholder="Ejemplo: Duda sobre promocion"
                      maxLength={120}
                      required
                    />
                  </label>

                  <label>
                    Medio de contacto preferido
                    <select
                      name="preferredContact"
                      value={contactForm.preferredContact}
                      onChange={handleContactChange}
                    >
                      <option value="email">Correo electronico</option>
                      <option value="phone">Telefono</option>
                    </select>
                  </label>

                  <label>
                    Mensaje
                    <textarea
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactChange}
                      placeholder="Cuentanos que necesitas para ayudarte rapido"
                      minLength={10}
                      maxLength={2000}
                      required
                    />
                  </label>

                  <button type="submit" className="primary" disabled={contactBusy}>
                    {contactBusy ? "Enviando mensaje..." : "Enviar mensaje"}
                  </button>
                </form>
              </section>
            ) : activeSection === "Asistente IA" ? (
              <section className="assistant-wrap">
                <article className="assistant-hero">
                  <h2>Asistente personal con IA</h2>
                  <p>Preguntame por precios, promociones, productos, recomendaciones y como agendar cita.</p>
                  <div className="assistant-quick-actions">
                    <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Que promociones tienen hoy?")}>Promociones de hoy</button>
                    <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Recomiendame un servicio para evento")}>Recomendar servicio</button>
                    <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Como agendo mi cita?")}>Como agendar</button>
                  </div>
                </article>

                <article className="assistant-chat-card" aria-live="polite">
                  <div className="assistant-messages">
                    {assistantMessages.map((entry) => (
                      <div key={entry.id} className={`assistant-msg ${entry.role === "user" ? "user" : "bot"}`}>
                        <strong>{entry.role === "user" ? "Tu" : "Asistente"}</strong>
                        <p>{entry.text}</p>
                        {entry.role === "assistant" && entry.suggestedServiceId && (
                          <button
                            type="button"
                            className="secondary assistant-inline-action"
                            onClick={() => {
                              if (!isAuthenticated) {
                                setFeedback({ type: "info", text: "Inicia sesion para agendar esta recomendacion." });
                                setMode("login");
                                return;
                              }
                              openAppointmentModal({ serviceId: entry.suggestedServiceId });
                              setActiveSection("Agendar cita");
                            }}
                          >
                            Agendar esta recomendacion
                          </button>
                        )}
                      </div>
                    ))}
                    {assistantBusy && (
                      <div className="assistant-msg bot pending">
                        <strong>Asistente</strong>
                        <p>Escribiendo respuesta...</p>
                      </div>
                    )}
                    <div ref={assistantMessagesEndRef} />
                  </div>

                  <form className="assistant-form" onSubmit={submitAssistantMessage}>
                    <input
                      value={assistantInput}
                      onChange={(event) => setAssistantInput(event.target.value)}
                      placeholder="Ejemplo: cual servicio me conviene si quiero algo elegante y rapido?"
                      maxLength={1200}
                    />
                    <button type="submit" className="primary" disabled={assistantBusy || !assistantInput.trim()}>
                      {assistantBusy ? "Consultando..." : "Enviar"}
                    </button>
                  </form>
                </article>
              </section>
            ) : activeSection === "Mis puntos" ? (
              <section className="points-wrap">
                <article className="points-hero">
                  <div>
                    <p className="menu-detail-kicker">Programa de fidelidad</p>
                    <h2>Panel de puntos EsmeNails</h2>
                    <p>
                      Acumulas {pointsProgram.pointsPerUnit} punto{pointsProgram.pointsPerUnit === 1 ? "" : "s"} por cada ${pointsProgram.pointsPerAmount} en compras.
                      Canjea recompensas desde este panel.
                    </p>
                  </div>
                  <div className="points-balance">
                    <small>Saldo actual</small>
                    <strong>{formatPointsValue(pointsBalance)} pts</strong>
                    <span>Nivel: {pointsTier}</span>
                  </div>
                </article>

                <article className="points-progress-card">
                  <div className="points-progress-head">
                    <strong>
                      {nextReward
                        ? `Te faltan ${formatPointsValue(Math.max(0, nextReward.points - pointsBalance))} pts para: ${nextReward.title}`
                        : "Ya desbloqueaste todas las recompensas actuales"}
                    </strong>
                    <small>{nextReward ? `${formatPointsValue(pointsBalance)}/${formatPointsValue(nextReward.points)}` : "Nivel maximo"}</small>
                  </div>
                  <div className="points-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pointsProgressPercent)}>
                    <span style={{ width: `${pointsProgressPercent}%` }} />
                  </div>
                </article>

                <article className="points-game-card">
                  <div className="points-game-head">
                    <div>
                      <small>Mini juego</small>
                      <h3>Jugar para ganar puntos</h3>
                      <p>Cada victoria suma +0.1 puntos. Juega Piedra, Papel o Tijera.</p>
                    </div>
                    <button
                      type="button"
                      className={pointsGameOpen ? "secondary" : "primary"}
                      onClick={() => setPointsGameOpen((prev) => !prev)}
                    >
                      {pointsGameOpen ? "Cerrar juego" : "Jugar para ganar puntos"}
                    </button>
                  </div>

                  {pointsGameOpen && (
                    <>
                      <div className="points-game-options">
                        {pointsGameOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`secondary ${pointsGameRound.playerChoice === option.id ? "points-game-choice-active" : ""}`}
                            disabled={pointsGameCooldownLeftMs > 0 || pointsGameAnimating}
                            onClick={() => playPointsGameRound(option.id)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      <div className={`points-game-duel ${pointsGameAnimating ? "rolling" : ""} ${pointsGameRound.result ? `is-${pointsGameRound.result}` : ""}`}>
                        <div className="points-game-hand player">
                          <small>Tu jugada</small>
                          <strong>{pointsGameOptions.find((item) => item.id === pointsGameRound.playerChoice)?.label || "-"}</strong>
                        </div>
                        <div className="points-game-vs">{pointsGameAnimating ? "..." : "VS"}</div>
                        <div className="points-game-hand system">
                          <small>Sistema</small>
                          <strong>
                            {pointsGameAnimating
                              ? "Pensando..."
                              : pointsGameOptions.find((item) => item.id === pointsGameRound.cpuChoice)?.label || "-"}
                          </strong>
                        </div>
                      </div>

                      <div className="points-game-status">
                        <small>
                          Victorias acumuladas: <strong>{pointsGameWins}</strong>
                        </small>
                        <small>
                          {pointsGameAnimating
                            ? "Resolviendo ronda..."
                            : pointsGameCooldownLeftMs > 0
                            ? `Siguiente ronda disponible en ${pointsGameCooldownSeconds}s`
                            : "Ronda disponible ahora"}
                        </small>
                        {pointsGameRound.result && pointsGameRound.result !== "pending" && (
                          <p>
                            Tu jugada: <strong>{pointsGameOptions.find((item) => item.id === pointsGameRound.playerChoice)?.label || "-"}</strong>
                            {" | "}
                            Sistema: <strong>{pointsGameOptions.find((item) => item.id === pointsGameRound.cpuChoice)?.label || "-"}</strong>
                            {" | "}
                            Resultado: <strong>
                              {pointsGameRound.result === "win" ? "Ganaste" : pointsGameRound.result === "lose" ? "Perdiste" : "Empate"}
                            </strong>
                          </p>
                        )}
                        {pointsGameRound.result && pointsGameRound.result !== "pending" && (
                          <span className={`points-game-result-pill ${pointsGameRound.result}`}>
                            {pointsGameRound.result === "win"
                              ? "Victoria: +0.1 pts"
                              : pointsGameRound.result === "lose"
                                ? "Derrota: sin puntos"
                                : "Empate: vuelve a intentar"}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </article>

                <div className="points-kpi-grid">
                  <article>
                    <small>Citas registradas</small>
                    <strong>{profileForm.appointmentsCount || appointments.length}</strong>
                  </article>
                  <article>
                    <small>Ordenes registradas</small>
                    <strong>{profileForm.ordersCount || 0}</strong>
                  </article>
                  <article>
                    <small>Citas completadas</small>
                    <strong>{completedVisits}</strong>
                  </article>
                  <article>
                    <small>Siguiente meta</small>
                    <strong>{nextReward ? `${formatPointsValue(nextReward.points)} pts` : "Completada"}</strong>
                  </article>
                </div>

                <div className="points-rewards-grid">
                  {loyaltyRewards.map((reward) => {
                    const unlocked = pointsBalance >= reward.points;
                    return (
                      <article key={reward.id} className={`points-reward-card ${unlocked ? "unlocked" : "locked"}`}>
                        <header>
                          <strong>{reward.title}</strong>
                          <span>{formatPointsValue(reward.points)} pts</span>
                        </header>
                        <p>{reward.description}</p>
                        <button
                          type="button"
                          className={unlocked ? "primary" : "secondary"}
                          onClick={() => {
                            if (unlocked) {
                              setFeedback({ type: "success", text: `La recompensa ${reward.title} esta lista para canje. Contacta al equipo para activarla.` });
                              navigateToSection("Contacto");
                            } else {
                              setFeedback({ type: "info", text: `Todavia no alcanzas ${reward.points} puntos para ${reward.title}.` });
                            }
                          }}
                        >
                          {unlocked ? "Canjear ahora" : "Todavia no desbloqueada"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : activeSection === "Historial" ? (
              <section className="history-wrap-client">
                <article className="history-hero-client">
                  <div>
                    <p className="menu-detail-kicker">Tu actividad</p>
                    <h2>Historial</h2>
                    <p>Consulta tus citas, compras y progreso acumulado dentro de EsmeNails.</p>
                  </div>
                </article>

                <div className="history-kpi-grid-client">
                  <article>
                    <small>Citas totales</small>
                    <strong>{historySummary.appointments}</strong>
                  </article>
                  <article>
                    <small>Citas completadas</small>
                    <strong>{historySummary.completedAppointments}</strong>
                  </article>
                  <article>
                    <small>Compras</small>
                    <strong>{historySummary.orders}</strong>
                  </article>
                  <article>
                    <small>Total invertido</small>
                    <strong>${Number(historySummary.totalSpent || 0).toFixed(2)}</strong>
                  </article>
                  <article>
                    <small>Puntos ganados</small>
                    <strong>{historySummary.totalPointsEarned}</strong>
                  </article>
                </div>

                {historyLoading ? (
                  <article className="history-empty-client">
                    <strong>Cargando historial...</strong>
                  </article>
                ) : (
                  <div className="history-columns-client">
                    <article className="history-column-card">
                      <h3>Citas</h3>
                      {historyAppointments.length === 0 ? (
                        <p className="history-empty-copy">Todavia no tienes citas registradas.</p>
                      ) : (
                        <div className="history-list-client">
                          {historyAppointments.map((appointment) => (
                            <article key={`hist-apt-${appointment.id}-${appointment.scheduledAt}`} className="history-item-client">
                              <header>
                                <strong>{appointment.serviceName}</strong>
                                <span className={`status-pill ${appointmentStatusClass[appointment.status] || "scheduled"}`}>
                                  {appointmentStatusLabel[appointment.status] || appointment.status}
                                </span>
                              </header>
                              <p><strong>Profesional:</strong> {appointment.employeeName || "Sin asignar"}</p>
                              <p><strong>Fecha:</strong> {new Date(appointment.scheduledAt).toLocaleString()}</p>
                              {appointment.notes ? <p><strong>Notas:</strong> {appointment.notes}</p> : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </article>

                    <article className="history-column-card">
                      <h3>Compras y puntos</h3>
                      {historyOrders.length === 0 ? (
                        <p className="history-empty-copy">Todavia no tienes compras registradas.</p>
                      ) : (
                        <div className="history-list-client">
                          {historyOrders.map((order) => (
                            <article key={`hist-order-${order.id}`} className="history-item-client">
                              <header>
                                <strong>Orden #{order.id.slice(0, 8)}</strong>
                                <span>+{order.pointsEarned} pts</span>
                              </header>
                              <p><strong>Fecha:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                              <p><strong>Total:</strong> ${Number(order.total || 0).toFixed(2)}</p>
                              {order.discount > 0 ? <p><strong>Descuento:</strong> ${Number(order.discount || 0).toFixed(2)}</p> : null}
                              {order.items?.length ? (
                                <ul className="history-order-items">
                                  {order.items.map((item, index) => (
                                    <li key={`${order.id}-item-${index}`}>
                                      {item.quantity}x {item.name} - ${Number(item.lineTotal || 0).toFixed(2)}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </article>
                  </div>
                )}
              </section>
            ) : activeSection === "Panel admin" ? (
              <section className="admin-wrap">
                {!adminToken && (
                  <form className="admin-login" onSubmit={submitAdminLogin}>
                    <h2>Acceso Administrador</h2>
                    <p>Acceso exclusivo para una sola cuenta administradora.</p>
                    <label>
                      Correo de administracion
                      <input
                        name="email"
                        type="email"
                        value={adminAuth.email}
                        onChange={handleAdminAuthChange}
                        placeholder="admin@esmenails.com"
                        required
                      />
                    </label>
                    <label>
                      Contrasena de administracion
                      <input
                        name="password"
                        type="password"
                        value={adminAuth.password}
                        onChange={handleAdminAuthChange}
                        placeholder="Ingresa la contrasena de administracion"
                        required
                      />
                    </label>
                    <button type="submit" className="primary" disabled={adminBusy}>
                      {adminBusy ? "Entrando..." : "Entrar al panel admin"}
                    </button>
                  </form>
                )}

                {adminToken && (
                  <div className="admin-dashboard">
                    <div className="admin-head">
                      <h2>Panel Administrador</h2>
                      <button type="button" className="secondary" onClick={logoutAdmin}>Cerrar admin</button>
                    </div>

                    {!adminData && <p>Cargando datos del administrador...</p>}

                    {adminData && (
                      <>
                        <div className="admin-overview-grid">
                          <article>
                            <small>Clientes registrados</small>
                            <strong>{adminData.overview.clients}</strong>
                          </article>
                          <article>
                            <small>Citas totales</small>
                            <strong>{adminData.overview.appointments}</strong>
                          </article>
                          <article>
                            <small>Ventas totales</small>
                            <strong>{adminData.overview.orders}</strong>
                          </article>
                          <article>
                            <small>Ingresos totales</small>
                            <strong>${adminData.overview.revenue}</strong>
                          </article>
                        </div>

                        <div className="admin-period-grid">
                          {[
                            { key: "day", label: "Dia" },
                            { key: "week", label: "Semana" },
                            { key: "month", label: "Mes" },
                            { key: "year", label: "Ano" }
                          ].map((period) => (
                            <article key={period.key} className="period-card">
                              <h3>{period.label}</h3>
                              <p>Nuevos clientes: {adminData.totals[period.key].newClients}</p>
                              <p>Citas: {adminData.totals[period.key].appointments}</p>
                              <p>Ventas: {adminData.totals[period.key].orders}</p>
                              <p>Ingresos: ${adminData.totals[period.key].revenue}</p>
                              <p>Donaciones: ${adminData.totals[period.key].donations}</p>
                            </article>
                          ))}
                        </div>

                        <section className="admin-block">
                          <h3>Exportar reportes CSV</h3>
                          <div className="admin-actions-row">
                            <button type="button" className="secondary" onClick={() => exportCsv("day")}>CSV Dia</button>
                            <button type="button" className="secondary" onClick={() => exportCsv("week")}>CSV Semana</button>
                            <button type="button" className="secondary" onClick={() => exportCsv("month")}>CSV Mes</button>
                            <button type="button" className="secondary" onClick={() => exportCsv("year")}>CSV Ano</button>
                          </div>
                        </section>

                        <section className="admin-block">
                          <h3>Detalles</h3>
                          <div className="admin-detail-tabs">
                            <button
                              type="button"
                              className={adminDetailView === "clients" ? "active" : ""}
                              onClick={() => setAdminDetailView("clients")}
                            >
                              <span className="nav-icon" aria-hidden="true"><NavIcon type="contact" /></span>
                              Registros de clientes
                            </button>
                            <button
                              type="button"
                              className={adminDetailView === "appointments" ? "active" : ""}
                              onClick={() => setAdminDetailView("appointments")}
                            >
                              <span className="nav-icon" aria-hidden="true"><NavIcon type="calendar" /></span>
                              Citas agendadas
                            </button>
                            <button
                              type="button"
                              className={adminDetailView === "history" ? "active" : ""}
                              onClick={() => setAdminDetailView("history")}
                            >
                              <span className="nav-icon" aria-hidden="true"><NavIcon type="history" /></span>
                              Historial de clientes
                            </button>
                            <button
                              type="button"
                              className={adminDetailView === "contact" ? "active" : ""}
                              onClick={() => setAdminDetailView("contact")}
                            >
                              <span className="nav-icon" aria-hidden="true"><NavIcon type="contact" /></span>
                              Contacto
                            </button>
                            <button
                              type="button"
                              className={adminDetailView === "settings" ? "active" : ""}
                              onClick={() => setAdminDetailView("settings")}
                            >
                              <span className="nav-icon" aria-hidden="true"><NavIcon type="settings" /></span>
                              Menus de configuracion
                            </button>
                          </div>
                        </section>

                        {adminDetailView === "clients" && (
                        <section className="admin-block">
                          <h3>Registros de clientes</h3>
                          <div className="admin-table-wrap">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Nombre</th>
                                  <th>Email</th>
                                  <th>Telefono</th>
                                  <th>Nacimiento</th>
                                  <th>Puntos</th>
                                  <th>Registro</th>
                                  <th>Perfil</th>
                                </tr>
                              </thead>
                              <tbody>
                                {adminData.users.map((user) => (
                                  <tr key={user.id}>
                                    <td>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>{user.phone || "Sin telefono"}</td>
                                    <td>{user.birthDate || "Sin fecha"}</td>
                                    <td>{user.points}</td>
                                    <td>{new Date(user.createdAt).toLocaleString()}</td>
                                    <td>
                                      <button type="button" className="secondary" onClick={() => openClientProfile(user.id)}>
                                        Ver perfil
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {selectedClientProfile && (
                            <article className="history-card">
                              <header>
                                <strong>{selectedClientProfile.client.name}</strong>
                                <small>{selectedClientProfile.client.email}</small>
                              </header>
                              <p>Puntos: {selectedClientProfile.client.points}</p>
                              <p>Telefono: {selectedClientProfile.client.phone || "Sin telefono"}</p>
                              <p>Nacimiento: {selectedClientProfile.client.birthDate || "Sin fecha"}</p>
                              <p>Descripcion: {selectedClientProfile.client.description || "Sin descripcion"}</p>
                              <p>Citas: {selectedClientProfile.appointments.length}</p>
                              <p>Ventas: {selectedClientProfile.orders.length}</p>
                              <p>
                                Ultima cita: {selectedClientProfile.appointments[0] ? new Date(selectedClientProfile.appointments[0].scheduledAt).toLocaleString() : "Sin citas"}
                              </p>
                              <p>
                                Ultima venta: {selectedClientProfile.orders[0] ? `$${selectedClientProfile.orders[0].total} - ${new Date(selectedClientProfile.orders[0].createdAt).toLocaleString()}` : "Sin ventas"}
                              </p>
                            </article>
                          )}
                        </section>
                        )}

                        {adminDetailView === "appointments" && (
                        <section className="admin-block">
                          <h3>Citas agendadas</h3>
                          <div className="appointment-filter-bar" role="group" aria-label="Filtrar citas por estado">
                            {adminAppointmentFilters.map((filter) => (
                              <button
                                key={filter.key}
                                type="button"
                                className={`appointment-filter-chip ${adminAppointmentFilter === filter.key ? "active" : ""}`}
                                onClick={() => setAdminAppointmentFilter(filter.key)}
                              >
                                {filter.label}
                              </button>
                            ))}
                          </div>
                          <div className="admin-table-wrap">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Cliente</th>
                                  <th>Email</th>
                                  <th>Telefono</th>
                                  <th>Profesional</th>
                                  <th>Servicio</th>
                                  <th>Fecha</th>
                                  <th>Estado</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredAdminAppointments.map((appointment) => (
                                  <tr key={appointment.id}>
                                    <td>{appointment.clientName}</td>
                                    <td>{appointment.clientEmail}</td>
                                    <td>{appointment.clientPhone || "Sin telefono"}</td>
                                    <td>{appointment.employeeName || "Sin asignar"}</td>
                                    <td>{appointment.serviceName}</td>
                                    <td>{new Date(appointment.scheduledAt).toLocaleString()}</td>
                                    <td>
                                      <span className={`status-pill ${appointmentStatusClass[appointment.status] || "scheduled"}`}>
                                        {appointmentStatusLabel[appointment.status] || appointment.status}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="admin-actions-row compact">
                                        <button type="button" className="secondary" onClick={() => openClientProfile(appointment.userId)}>Perfil</button>
                                        <button type="button" className="secondary" onClick={() => startEditAppointment(appointment)}>Editar</button>
                                        <button type="button" className="secondary" onClick={() => startQuickReschedule(appointment)}>Reagendar</button>
                                        <button type="button" className="secondary" onClick={() => confirmAppointment(appointment.id)}>Confirmar</button>
                                        <button type="button" className="secondary" onClick={() => completeAppointment(appointment.id)}>Completada</button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {filteredAdminAppointments.length === 0 && (
                                  <tr>
                                    <td colSpan={8}>No hay citas para el filtro seleccionado.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {quickRescheduleDraft.appointmentId && (
                            <form className="admin-quick-reschedule" onSubmit={submitQuickReschedule}>
                              <strong>Reagendar rapido</strong>
                              <input
                                type="datetime-local"
                                value={quickRescheduleDraft.scheduledAt}
                                onChange={(event) => setQuickRescheduleDraft((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                                required
                              />
                              <button type="submit" className="primary">Guardar fecha</button>
                              <button type="button" className="secondary" onClick={closeQuickReschedule}>Cerrar</button>
                            </form>
                          )}

                          <article className="admin-recent-completed">
                            <h4>Registro reciente de citas completadas</h4>
                            {(adminData.recentCompletedAppointments || []).length === 0 ? (
                              <p>Todavia no hay citas completadas archivadas.</p>
                            ) : (
                              <div className="admin-table-wrap">
                                <table className="admin-table">
                                  <thead>
                                    <tr>
                                      <th>Cliente</th>
                                      <th>Profesional</th>
                                      <th>Servicio</th>
                                      <th>Fecha cita</th>
                                      <th>Completada</th>
                                      <th>Accion</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {adminData.recentCompletedAppointments.map((appointment) => (
                                      <tr key={`completed-${appointment.id}-${appointment.completedAt || appointment.createdAt}`}>
                                        <td>{appointment.clientName}</td>
                                        <td>{appointment.employeeName || "Sin asignar"}</td>
                                        <td>{appointment.serviceName}</td>
                                        <td>{new Date(appointment.scheduledAt).toLocaleString()}</td>
                                        <td>{new Date(appointment.completedAt || appointment.createdAt).toLocaleString()}</td>
                                        <td>
                                          <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => restoreCompletedAppointment(appointment.id)}
                                          >
                                            Restaurar
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </article>

                          {editingAppointmentId && (
                            <form className="admin-edit-appointment" onSubmit={submitEditAppointment}>
                              <h4>Editar cita</h4>
                              <div className="inline-form-grid three">
                                <select
                                  value={adminAppointmentDraft.employeeId}
                                  onChange={(event) => setAdminAppointmentDraft((prev) => ({ ...prev, employeeId: event.target.value }))}
                                  required
                                >
                                  {adminSettings?.employees?.filter((employee) => employee.active).map((employee) => (
                                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                                  ))}
                                </select>
                                <input
                                  type="datetime-local"
                                  value={adminAppointmentDraft.scheduledAt}
                                  onChange={(event) => setAdminAppointmentDraft((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                                  required
                                />
                                <input
                                  value={adminAppointmentDraft.notes}
                                  onChange={(event) => setAdminAppointmentDraft((prev) => ({ ...prev, notes: event.target.value }))}
                                  placeholder="Notas"
                                />
                                <button type="submit" className="primary">Guardar cambios</button>
                              </div>
                              <div className="admin-actions-row">
                                <button type="button" className="secondary" onClick={cancelEditedAppointment}>Borrar cita</button>
                                <button type="button" className="secondary" onClick={closeEditAppointment}>Cerrar editor</button>
                              </div>
                            </form>
                          )}
                        </section>
                        )}

                        {adminDetailView === "history" && (
                        <section className="admin-block">
                          <h3>Historial de clientes</h3>
                          <div className="admin-history-list">
                            {adminData.clientHistory.map((entry) => (
                              <article key={entry.client.id} className="history-card">
                                <header>
                                  <strong>{entry.client.name}</strong>
                                  <small>{entry.client.email}</small>
                                </header>
                                <p>Citas: {entry.appointments.length}</p>
                                <p>Ventas: {entry.orders.length}</p>
                                <p>
                                  Ultima cita: {entry.appointments[0] ? new Date(entry.appointments[0].scheduledAt).toLocaleString() : "Sin citas"}
                                </p>
                                <p>
                                  Ultima venta: {entry.orders[0] ? `$${entry.orders[0].total} - ${new Date(entry.orders[0].createdAt).toLocaleString()}` : "Sin ventas"}
                                </p>
                              </article>
                            ))}
                          </div>
                        </section>
                        )}

                        {adminDetailView === "contact" && (
                        <section className="admin-block">
                          <h3>Mensajes de contacto</h3>
                          <div className="admin-table-wrap">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Cliente</th>
                                  <th>Asunto</th>
                                  <th>Preferido</th>
                                  <th>Mensaje</th>
                                  <th>Estado</th>
                                  <th>Nota admin</th>
                                  <th>Accion</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(adminData.contactMessages || []).map((entry) => (
                                  <tr key={entry.id}>
                                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                                    <td>
                                      <strong>{entry.clientName}</strong>
                                      <div>{entry.clientEmail}</div>
                                      <div>{entry.clientPhone || "Sin telefono"}</div>
                                    </td>
                                    <td>{entry.subject}</td>
                                    <td>{entry.preferredContact === "phone" ? "Telefono" : "Correo"}</td>
                                    <td className="admin-contact-message-cell">{entry.message}</td>
                                    <td>
                                      <select
                                        value={entry.status || "new"}
                                        onChange={(event) => updateAdminContactField(entry.id, "status", event.target.value)}
                                      >
                                        {contactMessageStatuses.map((statusOption) => (
                                          <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td>
                                      <textarea
                                        className="admin-contact-note"
                                        value={entry.adminNote || ""}
                                        onChange={(event) => updateAdminContactField(entry.id, "adminNote", event.target.value)}
                                        placeholder="Nota interna"
                                        maxLength={500}
                                      />
                                    </td>
                                    <td>
                                      <button type="button" className="secondary" onClick={() => saveAdminContactMessage(entry)}>
                                        Guardar
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {(adminData.contactMessages || []).length === 0 && (
                                  <tr>
                                    <td colSpan={8}>No hay mensajes de contacto.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </section>
                        )}

                        {adminSettings && adminDetailView === "settings" && (
                          <section className="admin-block">
                            <h3>Menus de configuracion</h3>
                            <div className="admin-overview-grid">
                              <article>
                                <small>Servicios</small>
                                <strong>{adminSettings.services.length}</strong>
                              </article>
                              <article>
                                <small>Productos</small>
                                <strong>{adminSettings.products.length}</strong>
                              </article>
                              <article>
                                <small>Promociones</small>
                                <strong>{adminSettings.promotions.length}</strong>
                              </article>
                              <article>
                                <small>Empleadas</small>
                                <strong>{adminSettings.employees.length}</strong>
                              </article>
                              <article>
                                <small>Recompensas puntos</small>
                                <strong>{adminSettings.pointsProgram?.rewards?.length || 0}</strong>
                              </article>
                            </div>

                            <article className="admin-editor-card">
                              <h4>Editor rapido de imagenes</h4>
                              <p>Edita fotos de elementos ya creados sin buscar en todas las tablas.</p>

                              <h5 className="admin-subtitle">Carrusel Home</h5>
                              <div className="admin-image-editor-list">
                                <div className="admin-image-editor-item">
                                  {renderOwnerCarouselThumb(adminSettings.ownerContact?.homeImageMain, localMenuImages.encapsulado, "Carrusel principal")}
                                  <div className="admin-image-editor-fields">
                                    <strong>Imagen principal</strong>
                                    <input
                                      type="text"
                                      autoComplete="off"
                                      value={adminSettings.ownerContact?.homeImageMain ?? ""}
                                      onChange={(event) => updateOwnerContactField("homeImageMain", event.target.value)}
                                      placeholder="URL imagen principal"
                                    />
                                    <div className="admin-actions-row">
                                      <button type="button" className="secondary" onClick={() => openOwnerCarouselFilePicker("homeImageMain")}>Subir archivo</button>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        ref={(node) => registerOwnerCarouselFileInput("homeImageMain", node)}
                                        onChange={(event) => handleAdminImageFileSelected(event, { ownerField: "homeImageMain" })}
                                      />
                                      <button type="button" className="secondary" onClick={() => pasteOwnerContactField("homeImageMain")}>Pegar y reemplazar</button>
                                      <button type="button" className="secondary" onClick={() => clearOwnerContactField("homeImageMain")}>Limpiar</button>
                                    </div>
                                  </div>
                                </div>
                                <div className="admin-image-editor-item">
                                  {renderOwnerCarouselThumb(adminSettings.ownerContact?.homeImageOne, localMenuImages.gelx, "Carrusel 1")}
                                  <div className="admin-image-editor-fields">
                                    <strong>Imagen 1</strong>
                                    <input type="text" autoComplete="off" value={adminSettings.ownerContact?.homeImageOne ?? ""} onChange={(event) => updateOwnerContactField("homeImageOne", event.target.value)} placeholder="URL imagen 1" />
                                    <div className="admin-actions-row">
                                      <button type="button" className="secondary" onClick={() => openOwnerCarouselFilePicker("homeImageOne")}>Subir archivo</button>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        ref={(node) => registerOwnerCarouselFileInput("homeImageOne", node)}
                                        onChange={(event) => handleAdminImageFileSelected(event, { ownerField: "homeImageOne" })}
                                      />
                                      <button type="button" className="secondary" onClick={() => pasteOwnerContactField("homeImageOne")}>Pegar y reemplazar</button>
                                      <button type="button" className="secondary" onClick={() => clearOwnerContactField("homeImageOne")}>Limpiar</button>
                                    </div>
                                  </div>
                                </div>
                                <div className="admin-image-editor-item">
                                  {renderOwnerCarouselThumb(adminSettings.ownerContact?.homeImageTwo, localMenuImages.acrigel, "Carrusel 2")}
                                  <div className="admin-image-editor-fields">
                                    <strong>Imagen 2</strong>
                                    <input type="text" autoComplete="off" value={adminSettings.ownerContact?.homeImageTwo ?? ""} onChange={(event) => updateOwnerContactField("homeImageTwo", event.target.value)} placeholder="URL imagen 2" />
                                    <div className="admin-actions-row">
                                      <button type="button" className="secondary" onClick={() => openOwnerCarouselFilePicker("homeImageTwo")}>Subir archivo</button>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        ref={(node) => registerOwnerCarouselFileInput("homeImageTwo", node)}
                                        onChange={(event) => handleAdminImageFileSelected(event, { ownerField: "homeImageTwo" })}
                                      />
                                      <button type="button" className="secondary" onClick={() => pasteOwnerContactField("homeImageTwo")}>Pegar y reemplazar</button>
                                      <button type="button" className="secondary" onClick={() => clearOwnerContactField("homeImageTwo")}>Limpiar</button>
                                    </div>
                                  </div>
                                </div>
                                <div className="admin-image-editor-item">
                                  {renderOwnerCarouselThumb(adminSettings.ownerContact?.homeImageThree, localMenuImages.polygel, "Carrusel 3")}
                                  <div className="admin-image-editor-fields">
                                    <strong>Imagen 3</strong>
                                    <input type="text" autoComplete="off" value={adminSettings.ownerContact?.homeImageThree ?? ""} onChange={(event) => updateOwnerContactField("homeImageThree", event.target.value)} placeholder="URL imagen 3" />
                                    <div className="admin-actions-row">
                                      <button type="button" className="secondary" onClick={() => openOwnerCarouselFilePicker("homeImageThree")}>Subir archivo</button>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        ref={(node) => registerOwnerCarouselFileInput("homeImageThree", node)}
                                        onChange={(event) => handleAdminImageFileSelected(event, { ownerField: "homeImageThree" })}
                                      />
                                      <button type="button" className="secondary" onClick={() => pasteOwnerContactField("homeImageThree")}>Pegar y reemplazar</button>
                                      <button type="button" className="secondary" onClick={() => clearOwnerContactField("homeImageThree")}>Limpiar</button>
                                    </div>
                                  </div>
                                </div>
                                <div className="admin-image-editor-item">
                                  {renderOwnerCarouselThumb(adminSettings.ownerContact?.homeImageFour, localMenuImages.manicure, "Carrusel 4")}
                                  <div className="admin-image-editor-fields">
                                    <strong>Imagen 4</strong>
                                    <input type="text" autoComplete="off" value={adminSettings.ownerContact?.homeImageFour ?? ""} onChange={(event) => updateOwnerContactField("homeImageFour", event.target.value)} placeholder="URL imagen 4" />
                                    <div className="admin-actions-row">
                                      <button type="button" className="secondary" onClick={() => openOwnerCarouselFilePicker("homeImageFour")}>Subir archivo</button>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        ref={(node) => registerOwnerCarouselFileInput("homeImageFour", node)}
                                        onChange={(event) => handleAdminImageFileSelected(event, { ownerField: "homeImageFour" })}
                                      />
                                      <button type="button" className="secondary" onClick={() => pasteOwnerContactField("homeImageFour")}>Pegar y reemplazar</button>
                                      <button type="button" className="secondary" onClick={() => clearOwnerContactField("homeImageFour")}>Limpiar</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="admin-actions-row">
                                <button type="button" className="secondary" onClick={applySuggestedOwnerCarouselImages}>Usar pack real sugerido</button>
                                <button type="button" className="primary" onClick={saveOwnerContact}>Guardar carrusel</button>
                                {adminSavedMap["owner-contact"] && <span className="saved-pill">Guardado</span>}
                              </div>

                              <h5 className="admin-subtitle">Servicios creados</h5>
                              <div className="admin-image-editor-list">
                                {adminSettings.services.map((service) => (
                                  <div key={`quick-service-${service.id}`} className="admin-image-editor-item">
                                    <SmartImage src={service.imageUrl} alt={service.name} className="admin-thumb" fallbackSrc={localMenuImages.acrigel} />
                                    <div className="admin-image-editor-fields">
                                      <strong>{service.name}</strong>
                                      <input
                                        value={service.imageUrl || ""}
                                        onChange={(event) => updateAdminSettingField("services", service.id, "imageUrl", event.target.value)}
                                        placeholder="URL imagen servicio"
                                      />
                                      <div className="admin-actions-row">
                                        <button type="button" className="secondary" onClick={() => applySuggestedServiceImage(service)}>Foto real sugerida</button>
                                        <button type="button" className="primary" onClick={() => saveService(service)}>Editar</button>
                                        <button type="button" className="secondary danger-button" onClick={() => deleteService(service)}>Eliminar</button>
                                        {adminSavedMap[`service-${service.id}`] && <span className="saved-pill">Guardado</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <h5 className="admin-subtitle">Productos creados</h5>
                              <div className="admin-image-editor-list">
                                {adminSettings.products.map((product) => (
                                  <div key={`quick-product-${product.id}`} className="admin-image-editor-item">
                                    <SmartImage src={product.imageUrl} alt={product.name} className="admin-thumb" fallbackSrc={localMenuImages.presson} />
                                    <div className="admin-image-editor-fields">
                                      <strong>{product.name}</strong>
                                      <input
                                        value={product.imageUrl || ""}
                                        onChange={(event) => updateAdminSettingField("products", product.id, "imageUrl", event.target.value)}
                                        placeholder="URL imagen producto"
                                      />
                                      <div className="admin-actions-row">
                                        <button type="button" className="secondary" onClick={() => applySuggestedProductImage(product)}>Foto real sugerida</button>
                                        <button type="button" className="primary" onClick={() => saveProduct(product)}>Editar</button>
                                        <button type="button" className="secondary danger-button" onClick={() => deleteProduct(product)}>Eliminar</button>
                                        {adminSavedMap[`product-${product.id}`] && <span className="saved-pill">Guardado</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <h5 className="admin-subtitle">Promociones creadas</h5>
                              <div className="admin-image-editor-list">
                                {adminSettings.promotions.map((promo) => (
                                  <div key={`quick-promo-${promo.id}`} className="admin-image-editor-item">
                                    <SmartImage src={promo.imageUrl} alt={promo.title} className="admin-thumb" fallbackSrc={localMenuImages.encapsulado} />
                                    <div className="admin-image-editor-fields">
                                      <strong>{promo.title}</strong>
                                      <input
                                        value={promo.imageUrl || ""}
                                        onChange={(event) => updateAdminSettingField("promotions", promo.id, "imageUrl", event.target.value)}
                                        placeholder="URL imagen promocion"
                                      />
                                      <div className="admin-actions-row">
                                        <button type="button" className="secondary" onClick={() => applySuggestedPromotionImage(promo)}>Foto real sugerida</button>
                                        <button type="button" className="primary" onClick={() => savePromotion(promo)}>Editar</button>
                                        <button type="button" className="secondary danger-button" onClick={() => deletePromotion(promo)}>Eliminar</button>
                                        {adminSavedMap[`promotion-${promo.id}`] && <span className="saved-pill">Guardado</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </article>

                            <div className="admin-editor-grid">
                              <article className="admin-editor-card">
                                <h4>Crear servicio</h4>
                                <form onSubmit={createService} className="inline-form-grid">
                                  <input
                                    value={adminServiceForm.name}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="Nombre"
                                    required
                                  />
                                  <input
                                    value={adminServiceForm.description}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="Descripcion"
                                  />
                                  <input
                                    value={adminServiceForm.style}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, style: event.target.value }))}
                                    placeholder="Estilo"
                                    required
                                  />
                                  <input
                                    value={adminServiceForm.model}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, model: event.target.value }))}
                                    placeholder="Modelo"
                                    required
                                  />
                                  <input
                                    type="number"
                                    min="15"
                                    value={adminServiceForm.timeMinutes}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, timeMinutes: event.target.value }))}
                                    placeholder="Min"
                                    required
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={adminServiceForm.price}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, price: event.target.value }))}
                                    placeholder="Precio"
                                    required
                                  />
                                  <input
                                    value={adminServiceForm.imageUrl}
                                    onChange={(event) => setAdminServiceForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                                    placeholder="URL o base64 de imagen"
                                  />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="admin-image-input"
                                    onChange={(event) => handleAdminImageFileSelected(event, { form: "service" })}
                                  />
                                  <SmartImage src={adminServiceForm.imageUrl} alt="Preview servicio" className="admin-thumb" fallbackSrc={localMenuImages.acrigel} />
                                  <button type="submit" className="primary">Crear</button>
                                  {adminSavedMap["service-create"] && <span className="saved-pill">Guardado</span>}
                                </form>

                                <div className="admin-table-wrap">
                                  <table className="admin-table compact">
                                    <thead>
                                      <tr>
                                        <th>Nombre</th>
                                        <th>Estilo</th>
                                        <th>Modelo</th>
                                        <th>Min</th>
                                        <th>Precio</th>
                                        <th>Accion</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {adminSettings.services.map((service) => (
                                        <tr key={service.id}>
                                          <td>
                                            <input value={service.name} onChange={(event) => updateAdminSettingField("services", service.id, "name", event.target.value)} />
                                            <input value={service.description || ""} onChange={(event) => updateAdminSettingField("services", service.id, "description", event.target.value)} placeholder="Descripcion" />
                                            <input
                                              value={service.imageUrl || ""}
                                              onChange={(event) => updateAdminSettingField("services", service.id, "imageUrl", event.target.value)}
                                              placeholder="Imagen URL"
                                            />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="admin-image-input"
                                              onChange={(event) => handleAdminImageFileSelected(event, { collection: "services", id: service.id })}
                                            />
                                            <SmartImage src={service.imageUrl} alt={service.name} className="admin-thumb" fallbackSrc={localMenuImages.acrigel} />
                                          </td>
                                          <td>
                                            <input value={service.style} onChange={(event) => updateAdminSettingField("services", service.id, "style", event.target.value)} />
                                          </td>
                                          <td>
                                            <input value={service.model} onChange={(event) => updateAdminSettingField("services", service.id, "model", event.target.value)} />
                                          </td>
                                          <td>
                                            <input type="number" min="15" value={service.timeMinutes} onChange={(event) => updateAdminSettingField("services", service.id, "timeMinutes", event.target.value)} />
                                          </td>
                                          <td>
                                            <input type="number" min="0" step="0.01" value={service.price} onChange={(event) => updateAdminSettingField("services", service.id, "price", event.target.value)} />
                                          </td>
                                          <td>
                                            <div className="admin-actions-row compact">
                                              <button type="button" className="secondary" onClick={() => saveService(service)}>Editar</button>
                                              <button type="button" className="secondary danger-button" onClick={() => deleteService(service)}>Eliminar</button>
                                            </div>
                                            {adminSavedMap[`service-${service.id}`] && <span className="saved-pill">Guardado</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </article>

                              <article className="admin-editor-card">
                                <h4>Crear producto</h4>
                                <form onSubmit={createProduct} className="inline-form-grid three">
                                  <input
                                    value={adminProductForm.name}
                                    onChange={(event) => setAdminProductForm((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="Nombre"
                                    required
                                  />
                                  <input
                                    value={adminProductForm.description}
                                    onChange={(event) => setAdminProductForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="Descripcion"
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={adminProductForm.price}
                                    onChange={(event) => setAdminProductForm((prev) => ({ ...prev, price: event.target.value }))}
                                    placeholder="Precio"
                                    required
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    value={adminProductForm.stock}
                                    onChange={(event) => setAdminProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                                    placeholder="Stock"
                                    required
                                  />
                                  <input
                                    value={adminProductForm.imageUrl}
                                    onChange={(event) => setAdminProductForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                                    placeholder="URL o base64 de imagen"
                                  />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="admin-image-input"
                                    onChange={(event) => handleAdminImageFileSelected(event, { form: "product" })}
                                  />
                                  <SmartImage src={adminProductForm.imageUrl} alt="Preview producto" className="admin-thumb" fallbackSrc={localMenuImages.presson} />
                                  <button type="submit" className="primary">Crear</button>
                                  {adminSavedMap["product-create"] && <span className="saved-pill">Guardado</span>}
                                </form>

                                <div className="admin-table-wrap">
                                  <table className="admin-table compact">
                                    <thead>
                                      <tr>
                                        <th>Nombre</th>
                                        <th>Precio</th>
                                        <th>Stock</th>
                                        <th>Accion</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {adminSettings.products.map((product) => (
                                        <tr key={product.id}>
                                          <td>
                                            <input value={product.name} onChange={(event) => updateAdminSettingField("products", product.id, "name", event.target.value)} />
                                            <input value={product.description || ""} onChange={(event) => updateAdminSettingField("products", product.id, "description", event.target.value)} placeholder="Descripcion" />
                                            <input
                                              value={product.imageUrl || ""}
                                              onChange={(event) => updateAdminSettingField("products", product.id, "imageUrl", event.target.value)}
                                              placeholder="Imagen URL"
                                            />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="admin-image-input"
                                              onChange={(event) => handleAdminImageFileSelected(event, { collection: "products", id: product.id })}
                                            />
                                            <SmartImage src={product.imageUrl} alt={product.name} className="admin-thumb" fallbackSrc={localMenuImages.presson} />
                                          </td>
                                          <td>
                                            <input type="number" min="0" step="0.01" value={product.price} onChange={(event) => updateAdminSettingField("products", product.id, "price", event.target.value)} />
                                          </td>
                                          <td>
                                            <input type="number" min="0" value={product.stock} onChange={(event) => updateAdminSettingField("products", product.id, "stock", event.target.value)} />
                                          </td>
                                          <td>
                                            <div className="admin-actions-row compact">
                                              <button type="button" className="secondary" onClick={() => saveProduct(product)}>Editar</button>
                                              <button type="button" className="secondary danger-button" onClick={() => deleteProduct(product)}>Eliminar</button>
                                            </div>
                                            {adminSavedMap[`product-${product.id}`] && <span className="saved-pill">Guardado</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </article>

                              <article className="admin-editor-card">
                                <h4>Agregar empleada</h4>
                                <form onSubmit={createEmployee} className="inline-form-grid three">
                                  <input
                                    value={adminEmployeeForm.name}
                                    onChange={(event) => setAdminEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="Nombre"
                                    required
                                  />
                                  <input
                                    value={adminEmployeeForm.role}
                                    onChange={(event) => setAdminEmployeeForm((prev) => ({ ...prev, role: event.target.value }))}
                                    placeholder="Rol"
                                    required
                                  />
                                  <label className="toggle-inline">
                                    <input
                                      type="checkbox"
                                      checked={adminEmployeeForm.active}
                                      onChange={(event) => setAdminEmployeeForm((prev) => ({ ...prev, active: event.target.checked }))}
                                    />
                                    Activa
                                  </label>
                                  <input
                                    value={adminEmployeeForm.imageUrl}
                                    onChange={(event) => setAdminEmployeeForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                                    placeholder="URL o base64 de foto"
                                  />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="admin-image-input"
                                    onChange={(event) => handleAdminImageFileSelected(event, { form: "employee" })}
                                  />
                                  <SmartImage src={adminEmployeeForm.imageUrl} alt="Preview empleada" className="admin-thumb" fallbackSrc={localMenuImages.artist} />
                                  <button type="submit" className="primary">Crear</button>
                                  {adminSavedMap["employee-create"] && <span className="saved-pill">Guardado</span>}
                                </form>

                                <div className="admin-table-wrap">
                                  <table className="admin-table compact">
                                    <thead>
                                      <tr>
                                        <th>Nombre</th>
                                        <th>Rol</th>
                                        <th>Activa</th>
                                        <th>Accion</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {adminSettings.employees.map((employee) => (
                                        <tr key={employee.id}>
                                          <td>
                                            <input value={employee.name} onChange={(event) => updateAdminSettingField("employees", employee.id, "name", event.target.value)} />
                                            <input
                                              value={employee.imageUrl || ""}
                                              onChange={(event) => updateAdminSettingField("employees", employee.id, "imageUrl", event.target.value)}
                                              placeholder="Foto URL"
                                            />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="admin-image-input"
                                              onChange={(event) => handleAdminImageFileSelected(event, { collection: "employees", id: employee.id })}
                                            />
                                            <SmartImage src={employee.imageUrl} alt={employee.name} className="admin-thumb" fallbackSrc={localMenuImages.artist} />
                                          </td>
                                          <td>
                                            <input value={employee.role} onChange={(event) => updateAdminSettingField("employees", employee.id, "role", event.target.value)} />
                                          </td>
                                          <td>
                                            <input type="checkbox" checked={Boolean(employee.active)} onChange={(event) => updateAdminSettingField("employees", employee.id, "active", event.target.checked)} />
                                          </td>
                                          <td>
                                            <div className="admin-actions-row compact">
                                              <button type="button" className="secondary" onClick={() => saveEmployee(employee)}>Editar</button>
                                              <button type="button" className="secondary danger-button" onClick={() => deleteEmployee(employee)}>Eliminar</button>
                                            </div>
                                            {adminSavedMap[`employee-${employee.id}`] && <span className="saved-pill">Guardado</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </article>

                              <article className="admin-editor-card">
                                <h4>Contacto del dueno / redes sociales</h4>
                                <div className="inline-form-grid three">
                                  <input
                                    value={adminSettings.ownerContact?.ownerName || ""}
                                    onChange={(event) => updateOwnerContactField("ownerName", event.target.value)}
                                    placeholder="Nombre del dueno"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.website || ""}
                                    onChange={(event) => updateOwnerContactField("website", event.target.value)}
                                    placeholder="Website"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.email || ""}
                                    onChange={(event) => updateOwnerContactField("email", event.target.value)}
                                    placeholder="Correo"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.phone || ""}
                                    onChange={(event) => updateOwnerContactField("phone", event.target.value)}
                                    placeholder="Telefono"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.whatsapp || ""}
                                    onChange={(event) => updateOwnerContactField("whatsapp", event.target.value)}
                                    placeholder="WhatsApp"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.instagram || ""}
                                    onChange={(event) => updateOwnerContactField("instagram", event.target.value)}
                                    placeholder="Instagram URL"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.facebook || ""}
                                    onChange={(event) => updateOwnerContactField("facebook", event.target.value)}
                                    placeholder="Facebook URL"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.tiktok || ""}
                                    onChange={(event) => updateOwnerContactField("tiktok", event.target.value)}
                                    placeholder="TikTok URL"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.address || ""}
                                    onChange={(event) => updateOwnerContactField("address", event.target.value)}
                                    placeholder="Direccion"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.homeImageMain || ""}
                                    onChange={(event) => updateOwnerContactField("homeImageMain", event.target.value)}
                                    placeholder="Home imagen principal"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.homeImageOne || ""}
                                    onChange={(event) => updateOwnerContactField("homeImageOne", event.target.value)}
                                    placeholder="Home imagen 1"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.homeImageTwo || ""}
                                    onChange={(event) => updateOwnerContactField("homeImageTwo", event.target.value)}
                                    placeholder="Home imagen 2"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.homeImageThree || ""}
                                    onChange={(event) => updateOwnerContactField("homeImageThree", event.target.value)}
                                    placeholder="Home imagen 3"
                                  />
                                  <input
                                    value={adminSettings.ownerContact?.homeImageFour || ""}
                                    onChange={(event) => updateOwnerContactField("homeImageFour", event.target.value)}
                                    placeholder="Home imagen 4"
                                  />
                                </div>
                                <div className="admin-actions-row">
                                  <button type="button" className="primary" onClick={saveOwnerContact}>Guardar contacto del dueno</button>
                                  {adminSavedMap["owner-contact"] && <span className="saved-pill">Guardado</span>}
                                </div>
                              </article>

                              <article className="admin-editor-card">
                                <h4>Programa de puntos</h4>
                                <div className="inline-form-grid three">
                                  <label>
                                    Cada monto ($)
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={adminSettings.pointsProgram?.pointsPerAmount || 10}
                                      onChange={(event) => updateAdminPointsProgramField("pointsPerAmount", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    Puntos otorgados
                                    <input
                                      type="number"
                                      min="1"
                                      value={adminSettings.pointsProgram?.pointsPerUnit || 1}
                                      onChange={(event) => updateAdminPointsProgramField("pointsPerUnit", event.target.value)}
                                    />
                                  </label>
                                </div>

                                <p>
                                  Esta cantidad es editable desde admin y define la regla: por cada ${adminSettings.pointsProgram?.pointsPerAmount || 10}
                                  se otorgan {adminSettings.pointsProgram?.pointsPerUnit || 1} punto{Number(adminSettings.pointsProgram?.pointsPerUnit || 1) === 1 ? "" : "s"}.
                                </p>

                                <div className="admin-actions-row">
                                  <button type="button" className="secondary" onClick={addAdminPointsReward}>Agregar recompensa</button>
                                </div>

                                <div className="admin-table-wrap">
                                  <table className="admin-table compact">
                                    <thead>
                                      <tr>
                                        <th>ID</th>
                                        <th>Puntos</th>
                                        <th>Titulo</th>
                                        <th>Descripcion</th>
                                        <th>Accion</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(adminSettings.pointsProgram?.rewards || []).map((reward) => (
                                        <tr key={reward.id}>
                                          <td>
                                            <input
                                              value={reward.id}
                                              onChange={(event) => updateAdminPointsRewardField(reward.id, "id", event.target.value)}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              min="1"
                                              value={reward.points}
                                              onChange={(event) => updateAdminPointsRewardField(reward.id, "points", event.target.value)}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              value={reward.title}
                                              onChange={(event) => updateAdminPointsRewardField(reward.id, "title", event.target.value)}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              value={reward.description || ""}
                                              onChange={(event) => updateAdminPointsRewardField(reward.id, "description", event.target.value)}
                                            />
                                          </td>
                                          <td>
                                            <button type="button" className="secondary" onClick={() => removeAdminPointsReward(reward.id)}>Quitar</button>
                                          </td>
                                        </tr>
                                      ))}
                                      {(adminSettings.pointsProgram?.rewards || []).length === 0 && (
                                        <tr>
                                          <td colSpan={5}>No hay recompensas configuradas.</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                <div className="admin-actions-row">
                                  <button type="button" className="primary" onClick={savePointsProgram}>Guardar programa de puntos</button>
                                  {adminSavedMap["points-program"] && <span className="saved-pill">Guardado</span>}
                                </div>
                              </article>

                              <article className="admin-editor-card">
                                <h4>Crear promocion</h4>
                                <form onSubmit={createPromotion} className="inline-form-grid four">
                                  <input
                                    value={adminPromotionForm.title}
                                    onChange={(event) => setAdminPromotionForm((prev) => ({ ...prev, title: event.target.value }))}
                                    placeholder="Titulo"
                                    required
                                  />
                                  <input
                                    value={adminPromotionForm.description}
                                    onChange={(event) => setAdminPromotionForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="Descripcion"
                                  />
                                  <select
                                    value={adminPromotionForm.discountType}
                                    onChange={(event) => setAdminPromotionForm((prev) => ({ ...prev, discountType: event.target.value }))}
                                  >
                                    <option value="percentage">percentage</option>
                                    <option value="fixed">fixed</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={adminPromotionForm.value}
                                    onChange={(event) => setAdminPromotionForm((prev) => ({ ...prev, value: event.target.value }))}
                                    placeholder="Valor"
                                    required
                                  />
                                  <label className="toggle-inline">
                                    <input
                                      type="checkbox"
                                      checked={adminPromotionForm.active}
                                      onChange={(event) => setAdminPromotionForm((prev) => ({ ...prev, active: event.target.checked }))}
                                    />
                                    Activa
                                  </label>
                                  <input
                                    value={adminPromotionForm.imageUrl}
                                    onChange={(event) => setAdminPromotionForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                                    placeholder="URL o base64 de imagen"
                                  />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="admin-image-input"
                                    onChange={(event) => handleAdminImageFileSelected(event, { form: "promotion" })}
                                  />
                                  <SmartImage src={adminPromotionForm.imageUrl} alt="Preview promocion" className="admin-thumb" fallbackSrc={localMenuImages.encapsulado} />
                                  <button type="submit" className="primary">Crear</button>
                                  {adminSavedMap["promotion-create"] && <span className="saved-pill">Guardado</span>}
                                </form>

                                <div className="admin-table-wrap">
                                  <table className="admin-table compact">
                                    <thead>
                                      <tr>
                                        <th>Titulo</th>
                                        <th>Tipo</th>
                                        <th>Valor</th>
                                        <th>Activa</th>
                                        <th>Accion</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {adminSettings.promotions.map((promo) => (
                                        <tr key={promo.id}>
                                          <td>
                                            <input value={promo.title} onChange={(event) => updateAdminSettingField("promotions", promo.id, "title", event.target.value)} />
                                            <input value={promo.description || ""} onChange={(event) => updateAdminSettingField("promotions", promo.id, "description", event.target.value)} placeholder="Descripcion" />
                                            <input
                                              value={promo.imageUrl || ""}
                                              onChange={(event) => updateAdminSettingField("promotions", promo.id, "imageUrl", event.target.value)}
                                              placeholder="Imagen URL"
                                            />
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="admin-image-input"
                                              onChange={(event) => handleAdminImageFileSelected(event, { collection: "promotions", id: promo.id })}
                                            />
                                            <SmartImage src={promo.imageUrl} alt={promo.title} className="admin-thumb" fallbackSrc={localMenuImages.encapsulado} />
                                          </td>
                                          <td>
                                            <select value={promo.discountType} onChange={(event) => updateAdminSettingField("promotions", promo.id, "discountType", event.target.value)}>
                                              <option value="percentage">percentage</option>
                                              <option value="fixed">fixed</option>
                                            </select>
                                          </td>
                                          <td>
                                            <input type="number" min="0" step="0.01" value={promo.value} onChange={(event) => updateAdminSettingField("promotions", promo.id, "value", event.target.value)} />
                                          </td>
                                          <td>
                                            <input type="checkbox" checked={Boolean(promo.active)} onChange={(event) => updateAdminSettingField("promotions", promo.id, "active", event.target.checked)} />
                                          </td>
                                          <td>
                                            <div className="admin-actions-row compact">
                                              <button type="button" className="secondary" onClick={() => savePromotion(promo)}>Editar</button>
                                              <button type="button" className="secondary danger-button" onClick={() => deletePromotion(promo)}>Eliminar</button>
                                            </div>
                                            {adminSavedMap[`promotion-${promo.id}`] && <span className="saved-pill">Guardado</span>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </article>
                            </div>
                          </section>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            ) : activeSection === "Menu" ? (
              (() => {
                const selectedMenuService = catalogServices.find((service) => service.id === selectedMenuServiceId) || null;
                const normalizedMenuQuery = menuSearchQuery.trim().toLowerCase();
                const visibleMenuServices = normalizedMenuQuery
                  ? catalogServices.filter((service) => [service.name, service.style, service.model, service.description]
                    .join(" ")
                    .toLowerCase()
                    .includes(normalizedMenuQuery))
                  : catalogServices;
                const visibleMenuCategories = normalizedMenuQuery
                  ? menuCategories.filter((category) => [category.title, category.subtitle].join(" ").toLowerCase().includes(normalizedMenuQuery))
                  : menuCategories;
                const menuListCount = menuCartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                const menuListTotal = menuCartItems.reduce(
                  (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)),
                  0
                );

                const menuSearchBar = (
                  <article className="menu-search-hero">
                    <p className="menu-detail-kicker">Buscador rapido</p>
                    <h3>Busca servicios por nombre, estilo o descripcion</h3>
                    <div className="menu-search-row">
                      <span className="menu-search-icon" aria-hidden="true">Buscar:</span>
                      <input
                        value={menuSearchQuery}
                        onChange={(event) => setMenuSearchQuery(event.target.value)}
                        placeholder="Ejemplo: gel x, manicure spa, natural, elegante"
                        maxLength={120}
                      />
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setMenuSearchQuery("")}
                        disabled={!menuSearchQuery.trim()}
                      >
                        Limpiar
                      </button>
                    </div>
                    {menuSearchQuery.trim() && (
                      <small>
                        Resultados: {visibleMenuServices.length > 0 ? `${visibleMenuServices.length} servicio(s)` : `${visibleMenuCategories.length} categoria(s)`}
                      </small>
                    )}
                  </article>
                );

                if (selectedMenuService) {
                  const selectedServicePrice = Number(selectedMenuService.price);
                  const hasSelectedServicePrice = Number.isFinite(selectedServicePrice) && selectedServicePrice > 0;

                  return (
                    <section className="menu-screen-wrap">
                      {menuSearchBar}
                      <div className="menu-detail-with-list">
                        <div className="menu-detail">
                        <SmartImage
                          src={selectedMenuService.imageUrl}
                          alt={selectedMenuService.name}
                          className="menu-detail-image"
                          fallbackSrc={localMenuImages.manicure}
                        />
                        <div className="menu-detail-body">
                          <p className="menu-detail-kicker">Detalle del servicio</p>
                          <h2>{selectedMenuService.name}</h2>
                          <p>{`${selectedMenuService.style || "Estilo"} - ${selectedMenuService.model || "Modelo"}`}</p>
                          <p className="menu-detail-price">{hasSelectedServicePrice ? `Precio: $${selectedServicePrice}` : "Precio disponible en Precios"}</p>
                          <p>Duracion estimada: {Number(selectedMenuService.timeMinutes) || 60} min</p>
                          <p>{selectedMenuService.description || "Descripcion disponible en panel admin."}</p>
                          <div className="menu-detail-actions">
                            <button type="button" className="secondary" onClick={backToMenuGrid}>
                              Volver al menu
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => addServiceToMenuCart(selectedMenuService)}
                            >
                              Agregar a la lista
                            </button>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => {
                                openAppointmentModal({ serviceId: selectedMenuService.id });
                                setFeedback({ type: "info", text: `Agenda tu cita para ${selectedMenuService.name}.` });
                              }}
                            >
                              Agendar cita
                            </button>
                          </div>
                        </div>
                        </div>

                        <article className="menu-cart-panel">
                        <header>
                          <h3>Tu lista</h3>
                          <span>{menuListCount} item(s)</span>
                        </header>
                        <div className="menu-cart-list">
                          {menuCartItems.map((item) => (
                            <div key={item.id} className="menu-cart-item">
                              <div>
                                <strong>{item.name}</strong>
                                <p>Cantidad: {item.quantity}</p>
                                <p>${Number(item.price || 0)} c/u</p>
                              </div>
                              <button type="button" className="secondary danger-button" onClick={() => removeMenuCartItem(item.id)}>
                                Quitar
                              </button>
                            </div>
                          ))}
                          {menuCartItems.length === 0 && (
                            <p className="menu-cart-empty">Tu lista esta vacia. Agrega servicios desde Detalles.</p>
                          )}
                        </div>
                        <footer>
                          <strong>Total estimado: ${menuListTotal.toFixed(2)}</strong>
                          <button type="button" className="secondary" onClick={clearMenuCart} disabled={menuCartItems.length === 0}>
                            Vaciar lista
                          </button>
                        </footer>
                        </article>
                      </div>
                    </section>
                  );
                }

                if (selectedMenuCategory) {
                  const selectedServiceId = findSuggestedServiceId(selectedMenuCategory, catalogServices);
                  const selectedService = catalogServices.find((service) => service.id === selectedServiceId);
                  const selectedServicePrice = Number(selectedService?.price);
                  const hasSelectedServicePrice = Number.isFinite(selectedServicePrice) && selectedServicePrice > 0;

                  return (
                    <section className="menu-detail">
                      <SmartImage
                        src={selectedMenuCategory.image}
                        alt={selectedMenuCategory.title}
                        className="menu-detail-image"
                        fallbackSrc={localMenuImages.manicure}
                      />
                      <div className="menu-detail-body">
                        <p className="menu-detail-kicker">Categoria seleccionada</p>
                        <h2>{selectedMenuCategory.title}</h2>
                        <p>{selectedMenuCategory.subtitle}</p>
                        <p className="menu-detail-price">{hasSelectedServicePrice ? `Precio: $${selectedServicePrice}` : "Precio disponible en Precios"}</p>
                        <p>{selectedService?.description || "Descripcion disponible en panel admin."}</p>
                        <div className="menu-detail-actions">
                          <button type="button" className="secondary" onClick={backToMenuGrid}>
                            Volver al menu
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              if (selectedService) {
                                addServiceToMenuCart(selectedService);
                              }
                            }}
                            disabled={!selectedService}
                          >
                            Agregar a la lista
                          </button>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => {
                              openAppointmentModal({
                                serviceId: selectedServiceId
                              });
                              setFeedback({ type: "info", text: `Agenda tu cita para ${selectedMenuCategory.title}.` });
                            }}
                          >
                            Agendar cita
                          </button>
                        </div>
                      </div>
                    </section>
                  );
                }

                return (
                  <>
                    {menuSearchBar}
                    {catalogServices.length > 0 ? (
                      <>
                        <p>Servicios publicados desde Panel admin. Cada tarjeta incluye acceso a Detalles para agregar a tu lista o agendar cita.</p>
                        <div className="menu-grid">
                          {visibleMenuServices.map((service) => {
                            const servicePrice = Number(service.price);
                            const hasServicePrice = Number.isFinite(servicePrice) && servicePrice > 0;

                            return (
                              <article key={service.id} className="menu-card">
                                <SmartImage src={service.imageUrl} alt={service.name} fallbackSrc={localMenuImages.acrigel} />
                                <div className="menu-card-text">
                                  <strong>{service.name}</strong>
                                  <small>{`${service.style || "Estilo"} - ${service.model || "Modelo"}`}</small>
                                  <p className="menu-card-price">{hasServicePrice ? `$${servicePrice}` : "Precio no definido"}</p>
                                  <p className="menu-card-description">{service.description || "Descripcion editable desde panel admin."}</p>
                                </div>
                                <div className="menu-card-actions">
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => openMenuServiceDetail(service)}
                                  >
                                    Ver detalles
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                          {visibleMenuServices.length === 0 && (
                            <article className="menu-card">
                              <div className="menu-card-text">
                                <strong>Sin resultados</strong>
                                <p className="menu-card-description">No se encontraron servicios con ese texto. Prueba otra palabra.</p>
                              </div>
                            </article>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p>Selecciona un estilo de unas para abrir su pagina.</p>
                        <div className="menu-grid">
                          {visibleMenuCategories.map((category) => {
                            const suggestedServiceId = findSuggestedServiceId(category, catalogServices);
                            const matchedService = catalogServices.find((service) => service.id === suggestedServiceId);
                            const matchedPrice = Number(matchedService?.price);
                            const hasMatchedPrice = Number.isFinite(matchedPrice) && matchedPrice > 0;

                            return (
                              <article key={category.id} className="menu-card">
                                <SmartImage src={category.image} alt={category.title} fallbackSrc={localMenuImages.manicure} />
                                <div className="menu-card-text">
                                  <strong>{category.title}</strong>
                                  <small>{category.subtitle}</small>
                                  <p className="menu-card-price">{hasMatchedPrice ? `Desde $${matchedPrice}` : "Precio en seccion Precios"}</p>
                                  <p className="menu-card-description">
                                    {matchedService?.description || "Descripcion editable desde panel admin."}
                                  </p>
                                </div>
                                <div className="menu-card-actions">
                                  <button type="button" className="secondary" onClick={() => openMenuCategory(category)}>Ver detalles</button>
                                </div>
                              </article>
                            );
                          })}
                          {visibleMenuCategories.length === 0 && (
                            <article className="menu-card">
                              <div className="menu-card-text">
                                <strong>Sin resultados</strong>
                                <p className="menu-card-description">No se encontraron categorias con ese texto.</p>
                              </div>
                            </article>
                          )}
                        </div>
                      </>
                    )}
                  </>
                );
              })()
            ) : activeSection === "Precios" ? (
              <section className="prices-wrap">
                <article className="prices-hero">
                  <h2>Precios y catalogo</h2>
                  <p>Consulta servicios, productos y promociones vigentes de EsmeNails.</p>
                </article>

                <div className="prices-filters" role="tablist" aria-label="Filtrar precios">
                  <button
                    type="button"
                    className={pricesView === "services" ? "active" : ""}
                    onClick={() => setPricesView("services")}
                  >
                    Servicios
                  </button>
                  <button
                    type="button"
                    className={pricesView === "products" ? "active" : ""}
                    onClick={() => setPricesView("products")}
                  >
                    Productos
                  </button>
                  <button
                    type="button"
                    className={pricesView === "promotions" ? "active" : ""}
                    onClick={() => setPricesView("promotions")}
                  >
                    Promociones
                  </button>
                </div>

                <div className="prices-filters prices-segment" role="tablist" aria-label="Segmentar por categoria comercial">
                  <button
                    type="button"
                    className={pricesFocus === "all" ? "active" : ""}
                    onClick={() => setPricesFocus("all")}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    className={pricesFocus === "nails" ? "active" : ""}
                    onClick={() => setPricesFocus("nails")}
                  >
                    Unas
                  </button>
                  <button
                    type="button"
                    className={pricesFocus === "lashes" ? "active" : ""}
                    onClick={() => setPricesFocus("lashes")}
                  >
                    Pestanas
                  </button>
                </div>

                {pricesView === "services" && (
                  <div className="prices-grid">
                    {filteredCatalogServices.map((service) => (
                      <article key={service.id} className="price-card">
                        <SmartImage src={service.imageUrl} alt={service.name} className="price-card-image" fallbackSrc={localMenuImages.acrigel} />
                        <header>
                          <h3>{service.name}</h3>
                          <strong>${service.price}</strong>
                        </header>
                        <p>Estilo: {service.style}</p>
                        <p>Modelo: {service.model}</p>
                        <p>{service.description || "Sin descripcion"}</p>
                        <p>Duracion: {service.timeMinutes} min</p>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            openAppointmentModal({ serviceId: service.id });
                            setFeedback({ type: "info", text: `Agenda tu cita para ${service.name}.` });
                          }}
                        >
                          Agendar este servicio
                        </button>
                      </article>
                    ))}
                    {filteredCatalogServices.length === 0 && (
                      <article className="price-card empty">
                        <p>No hay servicios disponibles para este filtro.</p>
                      </article>
                    )}
                  </div>
                )}

                {pricesView === "products" && (
                  <div className="prices-grid">
                    {filteredCatalogProducts.map((product) => (
                      <article key={product.id} className="price-card">
                        <SmartImage src={product.imageUrl} alt={product.name} className="price-card-image" fallbackSrc={localMenuImages.presson} />
                        <header>
                          <h3>{product.name}</h3>
                          <strong>${product.price}</strong>
                        </header>
                        <p>Stock disponible: {product.stock}</p>
                        <p>{product.description || "Sin descripcion"}</p>
                      </article>
                    ))}
                    {filteredCatalogProducts.length === 0 && (
                      <article className="price-card empty">
                        <p>No hay productos disponibles para este filtro.</p>
                      </article>
                    )}
                  </div>
                )}

                {pricesView === "promotions" && (
                  <div className="prices-grid">
                    {filteredCatalogPromotions.map((promotion) => (
                      <article key={promotion.id} className="price-card">
                        <SmartImage src={promotion.imageUrl} alt={promotion.title} className="price-card-image" fallbackSrc={localMenuImages.encapsulado} />
                        <header>
                          <h3>{promotion.title}</h3>
                          <strong>
                            {promotion.discountType === "percentage" ? `${promotion.value}%` : `$${promotion.value}`}
                          </strong>
                        </header>
                        <p>{promotion.discountType === "percentage" ? "Descuento porcentual" : "Descuento fijo"}</p>
                        <p>{promotion.description || "Sin descripcion"}</p>
                      </article>
                    ))}
                    {filteredCatalogPromotions.length === 0 && (
                      <article className="price-card empty">
                        <p>No hay promociones activas para este filtro.</p>
                      </article>
                    )}
                  </div>
                )}
              </section>
            ) : activeSection === "Promociones" ? (
              <section className="promo-wrap">
                <article className="promo-hero">
                  <h2>Promociones activas</h2>
                  <p>Este listado se actualiza automaticamente desde Panel admin &gt; Menus de configuracion &gt; Promociones.</p>
                  <div className="promo-hero-actions">
                    <button type="button" className="primary" onClick={() => openAppointmentModal()}>
                      Agendar cita con promo
                    </button>
                    <button type="button" className="secondary" onClick={() => navigateToSection("Precios")}>
                      Ver precios completos
                    </button>
                  </div>
                </article>

                <div className="prices-filters prices-segment" role="tablist" aria-label="Filtrar promociones por categoria comercial">
                  <button
                    type="button"
                    className={pricesFocus === "all" ? "active" : ""}
                    onClick={() => setPricesFocus("all")}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    className={pricesFocus === "nails" ? "active" : ""}
                    onClick={() => setPricesFocus("nails")}
                  >
                    Unas
                  </button>
                  <button
                    type="button"
                    className={pricesFocus === "lashes" ? "active" : ""}
                    onClick={() => setPricesFocus("lashes")}
                  >
                    Pestanas
                  </button>
                </div>

                <div className="promo-grid">
                  {filteredCatalogPromotions.map((promotion) => (
                    <article key={promotion.id} className="promo-card">
                      <SmartImage src={promotion.imageUrl} alt={promotion.title} className="promo-card-image" fallbackSrc={localMenuImages.encapsulado} />
                      <div className="promo-card-body">
                        <header>
                          <h3>{promotion.title}</h3>
                          <strong>
                            {promotion.discountType === "percentage" ? `${promotion.value}%` : `$${promotion.value}`}
                          </strong>
                        </header>
                        <p>{promotion.description || "Promocion configurable desde admin."}</p>
                        <small>{promotion.discountType === "percentage" ? "Descuento porcentual" : "Descuento fijo"}</small>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setFeedback({ type: "info", text: `Promocion seleccionada: ${promotion.title}. Agenda para aplicarla.` });
                            openAppointmentModal();
                          }}
                        >
                          Quiero esta promo
                        </button>
                      </div>
                    </article>
                  ))}
                  {filteredCatalogPromotions.length === 0 && (
                    <article className="promo-card empty">
                      <p>No hay promociones activas para este filtro.</p>
                    </article>
                  )}
                </div>
              </section>
            ) : activeSection === "Ajustes" ? (
              <section className="settings-wrap-client">
                <article className="settings-hero-client">
                  <h2>Ajustes de cuenta</h2>
                  <p>Personaliza como quieres recibir avisos y como prefieres usar la app.</p>
                </article>

                <div className="settings-grid-client">
                  <article className="settings-card-client">
                    <h3>Notificaciones</h3>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={appPreferences.emailNotifications}
                        onChange={(event) => setAppPreferences((prev) => ({ ...prev, emailNotifications: event.target.checked }))}
                      />
                      Recibir notificaciones por correo
                    </label>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={appPreferences.smsNotifications}
                        onChange={(event) => setAppPreferences((prev) => ({ ...prev, smsNotifications: event.target.checked }))}
                      />
                      Recibir notificaciones por telefono
                    </label>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={appPreferences.appointmentReminders}
                        onChange={(event) => setAppPreferences((prev) => ({ ...prev, appointmentReminders: event.target.checked }))}
                      />
                      Recordatorios de cita
                    </label>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={appPreferences.promoAlerts}
                        onChange={(event) => setAppPreferences((prev) => ({ ...prev, promoAlerts: event.target.checked }))}
                      />
                      Alertas de promociones
                    </label>
                  </article>

                  <article className="settings-card-client">
                    <h3>Apariencia</h3>
                    <p>Modo actual: <strong>{themeMode === "dark" ? "Noche" : "Claro"}</strong></p>
                    <div className="settings-actions-row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
                      >
                        Cambiar modo
                      </button>
                    </div>
                  </article>

                  <article className="settings-card-client">
                    <h3>Cuenta y seguridad</h3>
                    <p>Administra informacion personal y datos sensibles desde los siguientes accesos.</p>
                    <div className="settings-actions-row">
                      <button type="button" className="secondary" onClick={() => navigateToSection("Mi perfil")}>Ir a mi perfil</button>
                      <button type="button" className="secondary" onClick={() => navigateToSection("Privacidad y seguridad")}>Privacidad y seguridad</button>
                      <button type="button" className="secondary" onClick={() => navigateToSection("Contacto")}>Soporte</button>
                    </div>
                  </article>
                </div>
              </section>
            ) : activeSection === "Privacidad y seguridad" ? (
              <section className="privacy-wrap-client">
                <article className="privacy-hero-client">
                  <h2>Privacidad y seguridad</h2>
                  <p>Gestiona el uso de datos, estado de verificacion y acciones de seguridad de tu cuenta.</p>
                </article>

                <div className="privacy-grid-client">
                  <article className="privacy-card-client">
                    <h3>Estado de seguridad</h3>
                    <div className="privacy-pill-row">
                      <span className={`verify-pill ${profileForm.emailVerified ? "ok" : "pending"}`}>
                        Correo: {profileForm.emailVerified ? "Verificado" : "Pendiente"}
                      </span>
                      <span className={`verify-pill ${profileForm.phoneVerified ? "ok" : "pending"}`}>
                        Telefono: {profileForm.phoneVerified ? "Verificado" : "Pendiente"}
                      </span>
                    </div>
                    <div className="settings-actions-row">
                      <button type="button" className="secondary" onClick={() => verifyProfileField("email")}>
                        Verificar correo
                      </button>
                      <button type="button" className="secondary" onClick={() => verifyProfileField("phone")}>
                        Verificar telefono
                      </button>
                      <button type="button" className="secondary" onClick={() => navigateToSection("Mi perfil")}>
                        Editar datos
                      </button>
                    </div>
                  </article>

                  <article className="privacy-card-client">
                    <h3>Preferencias de privacidad</h3>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={privacySettings.analytics}
                        onChange={(event) => setPrivacySettings((prev) => ({ ...prev, analytics: event.target.checked }))}
                      />
                      Permitir analitica de uso para mejorar la app
                    </label>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={privacySettings.personalization}
                        onChange={(event) => setPrivacySettings((prev) => ({ ...prev, personalization: event.target.checked }))}
                      />
                      Permitir recomendaciones personalizadas
                    </label>
                    <label className="settings-toggle-row">
                      <input
                        type="checkbox"
                        checked={privacySettings.marketingEmails}
                        onChange={(event) => setPrivacySettings((prev) => ({ ...prev, marketingEmails: event.target.checked }))}
                      />
                      Recibir comunicaciones comerciales
                    </label>
                  </article>

                  <article className="privacy-card-client">
                    <h3>Acciones de cuenta</h3>
                    <p>Si detectas actividad inusual, cierra sesion y contacta soporte de inmediato.</p>
                    <div className="settings-actions-row">
                      <button type="button" className="secondary" onClick={() => navigateToSection("Contacto")}>
                        Contactar soporte
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          logout();
                        }}
                      >
                        Cerrar sesion
                      </button>
                    </div>
                  </article>
                </div>
              </section>
            ) : activeSection === "Home" ? (
              <section className="home-wrap">
                <article className="home-cinema-card">
                  <div className="home-cinema-main">
                    <SmartImage
                      key={homeActiveSlide?.id || "home-fallback"}
                      src={homeActiveSlide?.imageUrl}
                      alt={homeActiveSlide?.title || "EsmeNails"}
                      className="home-cinema-image"
                      fallbackSrc={localMenuImages.gelx}
                    />
                    <div className="home-cinema-overlay">
                      <p className="menu-detail-kicker">{homeActiveSlide?.kicker || "Inicio"}</p>
                      <h2>{homeActiveSlide?.title || `Hola, ${profileForm.name || sessionUser?.name || "cliente"}`}</h2>
                      <p>{homeActiveSlide?.subtitle || "Tu panel rapido para revisar agenda, perfil y accesos principales."}</p>
                    </div>
                  </div>

                  <aside className="home-cinema-sidebar" aria-label="Promociones en movimiento">
                    <div
                      className="home-cinema-track"
                      style={{ transform: `translateX(-${homePromoIndex * 178}px)` }}
                    >
                      {homeFilmStripItems.map((item, index) => {
                        const baseIndex = index % Math.max(1, homeShowcaseItems.length);
                        const isActive = baseIndex === homePromoIndex % Math.max(1, homeShowcaseItems.length);
                        return (
                          <button
                            key={`${item.id}-${index}`}
                            type="button"
                            className={`home-film-item ${isActive ? "active" : ""}`}
                            onClick={() => setHomePromoIndex(baseIndex)}
                          >
                            <SmartImage src={item.imageUrl} alt={item.title} fallbackSrc={localMenuImages.gelx} />
                            <span>{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                </article>

                <article className="home-hero-card">
                  <div>
                    <p className="menu-detail-kicker">Inicio</p>
                    <h2>Hola, {profileForm.name || sessionUser?.name || "cliente"}</h2>
                    <p>Tu panel rapido para revisar agenda, perfil y accesos principales.</p>
                  </div>
                  <div className="home-hero-actions">
                    <button type="button" className="primary" onClick={() => navigateToSection("Agendar cita")}>Agendar ahora</button>
                    <button type="button" className="secondary" onClick={() => navigateToSection("Menu")}>Ver menu</button>
                    <button type="button" className="secondary" onClick={() => navigateToSection("Contacto")}>Contacto</button>
                  </div>
                </article>

                <div className="home-kpi-grid">
                  <article>
                    <small>Citas proximas</small>
                    <strong>{upcomingAppointments.length}</strong>
                  </article>
                  <article>
                    <small>Perfil completado</small>
                    <strong>{profileCompletion}%</strong>
                  </article>
                  <article>
                    <small>Correo</small>
                    <strong>{profileForm.emailVerified ? "Verificado" : "Pendiente"}</strong>
                  </article>
                  <article>
                    <small>Telefono</small>
                    <strong>{profileForm.phoneVerified ? "Verificado" : "Pendiente"}</strong>
                  </article>
                </div>

                <div className="home-panels">
                  <article className="home-panel-card">
                    <h3>Proxima cita</h3>
                    {nextAppointment ? (
                      <>
                        <p><strong>Servicio:</strong> {nextAppointment.serviceName}</p>
                        <p><strong>Profesional:</strong> {nextAppointment.employeeName || "Sin asignar"}</p>
                        <p><strong>Fecha:</strong> {new Date(nextAppointment.scheduledAt).toLocaleString()}</p>
                        <p><strong>Estado:</strong> {appointmentStatusLabel[nextAppointment.status] || nextAppointment.status}</p>
                      </>
                    ) : (
                      <p>No tienes citas proximas. Agenda una para reservar tu lugar.</p>
                    )}
                  </article>

                  <article className="home-panel-card">
                    <h3>Tu cuenta</h3>
                    <p><strong>Nombre:</strong> {profileForm.name || sessionUser?.name || "Sin nombre"}</p>
                    <p><strong>Email:</strong> {profileForm.email || sessionUser?.email || "Sin correo"}</p>
                    <p><strong>Telefono:</strong> {profileForm.phone || "Sin telefono"}</p>
                    <div className="home-panel-actions">
                      <button type="button" className="secondary" onClick={() => navigateToSection("Mi perfil")}>Completar perfil</button>
                      <button type="button" className="secondary" onClick={() => navigateToSection("Agendar cita")}>Ir a agenda</button>
                    </div>
                  </article>
                </div>
              </section>
            ) : (
              <>
                <p>Panel principal de EsmeNails. Desde aqui puedes administrar tus modulos.</p>

                <div className="content-cards">
                  <article>
                    <h3>Estado del sistema</h3>
                    <p>API conectada y sesion activa.</p>
                  </article>
                  <article>
                    <h3>Usuario activo</h3>
                    <p>{sessionUser?.name || "Cliente"}</p>
                    <small>{sessionUser?.email || "Sin email"}</small>
                  </article>
                  <article>
                    <h3>Atajo rapido</h3>
                    <p>Usa el menu lateral para navegar por cada modulo.</p>
                  </article>
                </div>
              </>
            )}

            {appointmentModalOpen && (
              <div className="modal-backdrop" role="presentation" onClick={closeAppointmentModal}>
                <section
                  className="appointment-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Agendar nueva cita"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="appointment-modal-head">
                    <h2>Nueva cita</h2>
                    <button type="button" className="ghost-chip" onClick={closeAppointmentModal}>Cerrar</button>
                  </header>

                  <form className="appointment-form" onSubmit={submitAppointment}>
                    <label>
                      Servicio
                      <select
                        name="serviceId"
                        value={appointmentDraft.serviceId}
                        onChange={handleAppointmentDraftChange}
                        required
                      >
                        {catalogServices.length === 0 && <option value="">No hay servicios disponibles</option>}
                        {catalogServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} - {service.timeMinutes} min - ${service.price}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Con quien deseas agendar
                      <select
                        name="employeeId"
                        value={appointmentDraft.employeeId}
                        onChange={handleAppointmentDraftChange}
                        required
                      >
                        {catalogEmployees.length === 0 && <option value="">No hay empleadas disponibles</option>}
                        {catalogEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} - {employee.role}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="appointment-inline-grid">
                      <label>
                        Fecha
                        <input
                          name="date"
                          type="date"
                          value={appointmentDraft.date}
                          onChange={handleAppointmentDraftChange}
                          required
                        />
                      </label>
                      <label>
                        Duracion estimada
                        <input
                          type="text"
                          value={`${selectedServiceDuration} min`}
                          readOnly
                        />
                      </label>
                    </div>

                    <div className="appointment-slot-picker" role="group" aria-label="Seleccion de hora por bloques">
                      {appointmentTimeSlots.map((slot) => {
                        const isBlocked = occupiedAppointmentSlots.has(slot);
                        const isActive = appointmentDraft.time === slot;

                        return (
                          <button
                            key={slot}
                            type="button"
                            className={`slot-chip ${isActive ? "active" : ""}`}
                            onClick={() => setAppointmentDraft((prev) => ({ ...prev, time: slot }))}
                            disabled={isBlocked}
                            aria-pressed={isActive}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>

                    <label>
                      Notas
                      <textarea
                        name="notes"
                        value={appointmentDraft.notes}
                        onChange={handleAppointmentDraftChange}
                        placeholder="Diseno deseado, color o referencia"
                        maxLength={300}
                      />
                    </label>

                    <div className="appointment-modal-actions">
                      <button type="button" className="secondary" onClick={closeAppointmentModal}>Cancelar</button>
                      <button
                        type="submit"
                        className="primary"
                        disabled={appointmentBusy || catalogServices.length === 0 || catalogEmployees.length === 0}
                      >
                        {appointmentBusy ? "Agendando..." : "Confirmar cita"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            <p className={`feedback ${feedback.type}`}>{feedback.text}</p>

            <button
              type="button"
              className={`assistant-cloud-btn ${assistantFloatingOpen ? "open" : ""}`}
              onClick={() => setAssistantFloatingOpen((prev) => !prev)}
              aria-label="Abrir asistente personal"
              title="Asistente personal"
            >
              <span className="assistant-cloud-icon" aria-hidden="true">Nube IA</span>
              <span className="assistant-cloud-label">Asistente</span>
            </button>

            {assistantFloatingOpen && (
              <aside className="assistant-floating-panel" aria-live="polite">
                <header>
                  <strong>Asistente personal</strong>
                  <button type="button" className="secondary" onClick={() => setAssistantFloatingOpen(false)}>Cerrar</button>
                </header>

                <div className="assistant-quick-actions">
                  <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Que promociones tienen hoy?")}>Promociones</button>
                  <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Recomiendame un servicio")}>Recomendar</button>
                  <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Como agendo mi cita?")}>Agendar</button>
                </div>

                <div className="assistant-messages floating">
                  {assistantMessages.map((entry) => (
                    <div key={`floating-${entry.id}`} className={`assistant-msg ${entry.role === "user" ? "user" : "bot"}`}>
                      <strong>{entry.role === "user" ? "Tu" : "Asistente"}</strong>
                      <p>{entry.text}</p>
                      {entry.role === "assistant" && entry.suggestedServiceId && (
                        <button
                          type="button"
                          className="secondary assistant-inline-action"
                          onClick={() => {
                            if (!isAuthenticated) {
                              setFeedback({ type: "info", text: "Inicia sesion para agendar esta recomendacion." });
                              setMode("login");
                              return;
                            }
                            openAppointmentModal({ serviceId: entry.suggestedServiceId });
                            setActiveSection("Agendar cita");
                          }}
                        >
                          Agendar esta recomendacion
                        </button>
                      )}
                    </div>
                  ))}
                  {assistantBusy && (
                    <div className="assistant-msg bot pending">
                      <strong>Asistente</strong>
                      <p>Escribiendo respuesta...</p>
                    </div>
                  )}
                  <div ref={assistantMessagesEndRef} />
                </div>

                <form className="assistant-form" onSubmit={submitAssistantMessage}>
                  <input
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    placeholder="Escribe tu pregunta..."
                    maxLength={1200}
                  />
                  <button type="submit" className="primary" disabled={assistantBusy || !assistantInput.trim()}>
                    {assistantBusy ? "Consultando..." : "Enviar"}
                  </button>
                </form>
              </aside>
            )}
          </section>
        </div>
      </main>
    ) : (
    <main className="auth-page">
      <header className="welcome-banner">
        <p>Hola hermosa,</p>
        <h1>Bienvenida a EsmeNails</h1>
        <small>Tu studio digital de nails</small>
      </header>

      <section className="auth-card">
        <div className="auth-toggle">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Registro
          </button>
        </div>

        <form onSubmit={submitAuth} className="form-grid" noValidate>
          {mode === "register" && (
            <label>
              Nombre
              <input
                name="name"
                value={authForm.name}
                onChange={handleAuthChange}
                placeholder="Tu nombre"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              name="email"
              type="email"
              value={authForm.email}
              onChange={handleAuthChange}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contrasena
            <input
              name="password"
              type="password"
              value={authForm.password}
              onChange={handleAuthChange}
              minLength={6}
              placeholder="Min 6, 1 mayuscula y 1 caracter especial"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
            />
          </label>

          {mode === "register" && (
            <ul className="rules">
              <li className={passwordRules.minLength ? "ok" : "pending"}>Minimo 6 caracteres</li>
              <li className={passwordRules.hasUppercase ? "ok" : "pending"}>Al menos una mayuscula</li>
              <li className={passwordRules.hasSpecial ? "ok" : "pending"}>Al menos un caracter especial</li>
            </ul>
          )}

          <button
            type="submit"
            disabled={busy || (mode === "register" && !isPasswordStrong)}
            className="primary full-width"
          >
            {busy ? "Procesando..." : mode === "register" ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        <p className={`feedback ${feedback.type}`}>{feedback.text}</p>
      </section>

      <button
        type="button"
        className={`assistant-cloud-btn ${assistantFloatingOpen ? "open" : ""}`}
        onClick={() => setAssistantFloatingOpen((prev) => !prev)}
        aria-label="Abrir asistente personal"
        title="Asistente personal"
      >
        <span className="assistant-cloud-icon" aria-hidden="true">Nube IA</span>
        <span className="assistant-cloud-label">Asistente</span>
      </button>

      {assistantFloatingOpen && (
        <aside className="assistant-floating-panel" aria-live="polite">
          <header>
            <strong>Asistente personal</strong>
            <button type="button" className="secondary" onClick={() => setAssistantFloatingOpen(false)}>Cerrar</button>
          </header>

          <div className="assistant-quick-actions">
            <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Que promociones tienen hoy?")}>Promociones</button>
            <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Recomiendame un servicio")}>Recomendar</button>
            <button type="button" className="secondary" onClick={() => openAssistantWithPrompt("Como agendo mi cita?")}>Agendar</button>
          </div>

          <div className="assistant-messages floating">
            {assistantMessages.map((entry) => (
              <div key={`floating-auth-${entry.id}`} className={`assistant-msg ${entry.role === "user" ? "user" : "bot"}`}>
                <strong>{entry.role === "user" ? "Tu" : "Asistente"}</strong>
                <p>{entry.text}</p>
                {entry.role === "assistant" && entry.suggestedServiceId && (
                  <button
                    type="button"
                    className="secondary assistant-inline-action"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setFeedback({ type: "info", text: "Inicia sesion para agendar esta recomendacion." });
                        setMode("login");
                        return;
                      }
                      openAppointmentModal({ serviceId: entry.suggestedServiceId });
                      setActiveSection("Agendar cita");
                    }}
                  >
                    Agendar esta recomendacion
                  </button>
                )}
              </div>
            ))}
            {assistantBusy && (
              <div className="assistant-msg bot pending">
                <strong>Asistente</strong>
                <p>Escribiendo respuesta...</p>
              </div>
            )}
            <div ref={assistantMessagesEndRef} />
          </div>

          <form className="assistant-form" onSubmit={submitAssistantMessage}>
            <input
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
              placeholder="Escribe tu pregunta..."
              maxLength={1200}
            />
            <button type="submit" className="primary" disabled={assistantBusy || !assistantInput.trim()}>
              {assistantBusy ? "Consultando..." : "Enviar"}
            </button>
          </form>
        </aside>
      )}
    </main>
    )
  );
}

export default App;

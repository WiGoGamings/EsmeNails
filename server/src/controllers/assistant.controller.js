import { env } from "../config/env.js";
import { assistantRequestSchema } from "../schemas/assistant.schema.js";

const parseValidationError = (error, fallback = "Datos invalidos") => {
  const flatten = error.flatten();
  const fieldErrors = Object.values(flatten.fieldErrors).flat();
  return {
    error: fieldErrors[0] || flatten.formErrors[0] || fallback,
    details: flatten
  };
};

const formatPriceList = (items = [], getLabel) => {
  const filtered = items
    .map((item) => ({ label: getLabel(item), price: Number(item?.price || item?.value || 0) }))
    .filter((item) => item.label && Number.isFinite(item.price) && item.price > 0)
    .slice(0, 4);

  if (filtered.length === 0) return "";
  return filtered.map((item) => `- ${item.label}: $${item.price}`).join("\\n");
};

const buildLocalReply = ({ message, context }) => {
  const text = String(message || "").toLowerCase();
  const services = context?.services || [];
  const products = context?.products || [];
  const promotions = context?.promotions || [];
  const owner = context?.ownerContact || {};

  if (text.includes("precio") || text.includes("cuanto") || text.includes("costo")) {
    const serviceBlock = formatPriceList(services, (item) => item?.name || "Servicio");
    const productBlock = formatPriceList(products, (item) => item?.name || "Producto");

    if (!serviceBlock && !productBlock) {
      return "Te puedo ayudar con precios, pero aun no tengo catalogo cargado. Ve a la seccion Precios para revisar los importes actuales.";
    }

    return [
      "Claro. Estos son algunos precios actuales:",
      serviceBlock ? "Servicios:\n" + serviceBlock : "",
      productBlock ? "Productos:\n" + productBlock : "",
      "Si quieres, te recomiendo una opcion segun tu presupuesto."
    ].filter(Boolean).join("\\n\\n");
  }

  if (text.includes("promo") || text.includes("descuento") || text.includes("oferta")) {
    const promoLines = promotions
      .slice(0, 4)
      .map((promo) => {
        const title = promo?.title || "Promocion";
        const value = Number(promo?.value || 0);
        if (!Number.isFinite(value) || value <= 0) return `- ${title}`;
        const suffix = promo?.discountType === "percentage" ? `${value}%` : `$${value}`;
        return `- ${title}: ${suffix}`;
      });

    if (promoLines.length === 0) {
      return "Ahorita no detecto promociones cargadas. Puedes revisar la seccion Promociones para confirmar si hay nuevas.";
    }

    return `Estas promociones podrian interesarte:\n${promoLines.join("\\n")}\\n\\nSi me dices tu servicio ideal, te sugiero cual conviene mas.`;
  }

  if (text.includes("contacto") || text.includes("whatsapp") || text.includes("telefono") || text.includes("direccion")) {
    const contactLines = [
      owner.whatsapp ? `WhatsApp: ${owner.whatsapp}` : "",
      owner.phone ? `Telefono: ${owner.phone}` : "",
      owner.address ? `Direccion: ${owner.address}` : "",
      owner.instagram ? `Instagram: ${owner.instagram}` : ""
    ].filter(Boolean);

    if (contactLines.length === 0) {
      return "Puedes abrir la seccion Contacto para ver los canales activos del negocio.";
    }

    return `Claro, aqui tienes los datos de contacto:\n${contactLines.join("\\n")}`;
  }

  if (text.includes("cita") || text.includes("agenda") || text.includes("reserv")) {
    return "Perfecto. Para agendar rapido entra a la seccion Agendar cita, elige servicio, fecha y profesional. Si quieres, te ayudo a elegir un servicio primero.";
  }

  return "Soy tu asistente de EsmeNails. Te puedo ayudar con precios, promociones, recomendaciones de servicios y datos de contacto. Dime que necesitas y te guio paso a paso.";
};

const buildSystemPrompt = (context) => {
  const serviceSample = (context?.services || [])
    .slice(0, 10)
    .map((service) => `${service?.name || "Servicio"} ($${Number(service?.price || 0)})`)
    .join(", ");

  const promoSample = (context?.promotions || [])
    .slice(0, 10)
    .map((promo) => `${promo?.title || "Promocion"}`)
    .join(", ");

  return [
    "Eres el asistente personal de EsmeNails.",
    "Responde en espanol, tono profesional y cercano.",
    "Da respuestas utiles, concretas y orientadas a conversion (agendar cita o comprar).",
    "Si no hay suficiente informacion, dilo claramente y sugiere siguiente paso dentro de la app.",
    serviceSample ? `Servicios de referencia: ${serviceSample}` : "",
    promoSample ? `Promociones de referencia: ${promoSample}` : ""
  ].filter(Boolean).join("\\n");
};

const askOpenAI = async ({ message, history, context }) => {
  if (!env.OPENAI_API_KEY) return null;

  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: buildSystemPrompt(context) }]
    },
    ...history.map((entry) => ({
      role: entry.role,
      content: [{ type: "input_text", text: entry.content }]
    })),
    {
      role: "user",
      content: [{ type: "input_text", text: message }]
    }
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input,
      temperature: 0.6,
      max_output_tokens: 350
    })
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.error?.message || "No se pudo consultar el proveedor de IA");
  }

  const payload = await response.json();
  const outputText = String(payload?.output_text || "").trim();
  if (outputText) return outputText;

  return null;
};

export const askAssistant = async (req, res) => {
  const parsed = assistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parseValidationError(parsed.error));
  }

  const { message, history, context } = parsed.data;

  try {
    const aiReply = await askOpenAI({ message, history, context });
    if (aiReply) {
      return res.status(200).json({ reply: aiReply, provider: "openai" });
    }
  } catch {
    // If provider call fails, fallback to local assistant instead of breaking UX.
  }

  const fallbackReply = buildLocalReply({ message, context });
  return res.status(200).json({ reply: fallbackReply, provider: "local" });
};

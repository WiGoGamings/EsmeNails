const explicitApiBase = typeof import.meta.env.VITE_API_URL === "string"
  ? import.meta.env.VITE_API_URL.trim()
  : "";

const isLocalFrontend = typeof window !== "undefined"
  && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const productionApiFallback = "https://esmenails-api.onrender.com/api";

export const API_BASE = explicitApiBase || (isLocalFrontend ? "http://localhost:4000/api" : productionApiFallback);

export async function apiRequest(path, { method = "GET", body, token } = {}) {
  if (!API_BASE) {
    throw new Error("API no configurada para esta version web. Define VITE_API_URL para conectar el backend.");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error("No hay conexion con la API. Ejecuta npm run dev y verifica que el puerto 4000 este activo.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Manejo automático de error 401
    if (response.status === 401) {
      localStorage.removeItem("esme_token");
      localStorage.removeItem("esme_admin_token");
      localStorage.removeItem("esme_user");
    }
    const message = data?.error || `Error ${response.status}: ${response.statusText}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

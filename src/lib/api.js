export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function apiRequest(path, { method = "GET", body, token } = {}) {
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
    const message = data?.error || "Request failed";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

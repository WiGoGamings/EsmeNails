export const errorHandler = (err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
};

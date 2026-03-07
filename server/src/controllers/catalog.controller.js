import { db } from "../db/storage.js";

export const getCatalog = (_req, res) => {
  return res.status(200).json({
    services: db.data.services,
    products: db.data.products,
    promotions: db.data.promotions.filter((promo) => promo.active),
    employees: (db.data.employees || []).filter((employee) => employee.active),
    pointsProgram: db.data.pointsProgram || null
  });
};

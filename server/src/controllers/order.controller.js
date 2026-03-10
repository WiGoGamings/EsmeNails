import { randomUUID } from "node:crypto";
import { db, persist } from "../db/storage.js";
import { createOrderSchema } from "../schemas/order.schema.js";

const asMoney = (value) => Number(value.toFixed(2));

export const createOrder = async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { items, promotionId, donationAmount, paymentMethod } = parsed.data;
  const normalizedItems = [];

  for (const item of items) {
    const source = item.kind === "service" ? db.data.services : db.data.products;
    const found = source.find((entry) => entry.id === item.id);

    if (!found) {
      return res.status(400).json({ error: `Item no encontrado: ${item.id}` });
    }

    normalizedItems.push({
      kind: item.kind,
      id: found.id,
      name: found.name,
      quantity: item.quantity,
      unitPrice: found.price,
      lineTotal: asMoney(found.price * item.quantity)
    });
  }

  const subtotal = asMoney(
    normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );

  let discount = 0;
  if (promotionId) {
    const promo = db.data.promotions.find((entry) => entry.id === promotionId && entry.active);
    if (!promo) {
      return res.status(400).json({ error: "Promocion invalida" });
    }

    if (promo.discountType === "percentage") {
      discount = asMoney((subtotal * promo.value) / 100);
    } else {
      discount = asMoney(promo.value);
    }

    discount = Math.min(discount, subtotal);
  }

  const total = asMoney(subtotal - discount + donationAmount);
  const pointsPerAmount = Number(db.data.pointsProgram?.pointsPerAmount) || 10;
  const pointsPerUnit = Number(db.data.pointsProgram?.pointsPerUnit) || 1;
  const pointsEarned = Math.floor(total / pointsPerAmount) * pointsPerUnit;

  const user = db.data.users.find((entry) => entry.id === req.user.sub);
  if (!user) {
    return res.status(401).json({ error: "Usuario no encontrado" });
  }

  user.points += pointsEarned;

  const order = {
    id: randomUUID(),
    userId: user.id,
    paymentMethod,
    items: normalizedItems,
    subtotal,
    discount,
    donationAmount,
    total,
    pointsEarned,
    createdAt: new Date().toISOString()
  };

  db.data.orders.push(order);

  if (donationAmount > 0) {
    db.data.donations.push({
      id: randomUUID(),
      userId: user.id,
      amount: donationAmount,
      orderId: order.id,
      createdAt: order.createdAt
    });
  }

  await persist();

  return res.status(201).json({
    message: "Venta registrada",
    order
  });
};

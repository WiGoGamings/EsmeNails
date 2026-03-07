    export const defaultData = {
  users: [],
  services: [
    {
      id: "srv-basic-mani",
      name: "Manicure Basica",
      description: "Limpieza, forma y esmaltado para un look natural y elegante.",
      style: "Natural",
      model: "Liso",
      timeMinutes: 45,
      price: 18,
      imageUrl: "/menu/manicure.svg"
    },
    {
      id: "srv-gel-x",
      name: "Gel X Premium",
      description: "Extension moderna con acabado brillante y duracion prolongada.",
      style: "Almendra",
      model: "French",
      timeMinutes: 90,
      price: 45,
      imageUrl: "/menu/gelx.svg"
    },
    {
      id: "srv-acrylic-art",
      name: "Acrilico con Arte",
      description: "Diseno artistico personalizado con estructura de acrilico resistente.",
      style: "Coffin",
      model: "3D",
      timeMinutes: 120,
      price: 62,
      imageUrl: "/menu/acrigel.svg"
    },
    {
      id: "srv-lash-lifting",
      name: "Lifting de Pestanas",
      description: "Curvatura, definicion y acabado natural para realzar la mirada.",
      style: "Lifting",
      model: "Natural",
      timeMinutes: 70,
      price: 38,
      imageUrl: "/menu/lashes.svg"
    }
  ],
  products: [
    {
      id: "prd-cuticle-oil",
      name: "Aceite de Cuticula",
      description: "Hidratacion diaria para cuticula suave y saludable.",
      price: 8,
      stock: 45,
      imageUrl: ""
    },
    {
      id: "prd-hand-cream",
      name: "Crema Hidratante",
      description: "Crema reparadora para manos con aroma suave.",
      price: 12,
      stock: 30,
      imageUrl: ""
    }
  ],
  promotions: [
    {
      id: "promo-french10",
      title: "10% en French",
      description: "Descuento especial en disenos french seleccionados.",
      discountType: "percentage",
      value: 10,
      active: true,
      imageUrl: ""
    },
    {
      id: "promo-welcome5",
      title: "$5 Bienvenida",
      description: "Promo de primera visita para nuevas clientas.",
      discountType: "fixed",
      value: 5,
      active: true,
      imageUrl: ""
    },
    {
      id: "promo-lashes-combo",
      title: "Combo Pestanas + Diseno",
      description: "Descuento especial al combinar lifting de pestanas con servicio de unas.",
      discountType: "percentage",
      value: 12,
      active: true,
      imageUrl: "/menu/lashes.svg"
    }
  ],
  employees: [
    {
      id: "emp-esmeralda-guillen",
      name: "Esmeralda Guillen",
      role: "Nail Artist",
      active: true,
      imageUrl: ""
    }
  ],
  ownerContact: {
    ownerName: "Esmeralda Guillen",
    website: "https://www.esmenails.com",
    email: "dueno@esmenails.com",
    phone: "+52 55 1234 5678",
    whatsapp: "+52 55 1234 5678",
    instagram: "https://instagram.com/esmenails.oficial",
    facebook: "https://facebook.com/esmenails.oficial",
    tiktok: "https://tiktok.com/@esmenails.oficial",
    address: "Calle Belleza 123, Ciudad de Mexico",
    homeImageMain: "/menu/encapsulado.svg",
    homeImageOne: "/menu/gelx.svg",
    homeImageTwo: "/menu/acrigel.svg",
    homeImageThree: "/menu/polygel.svg",
    homeImageFour: "/menu/manicure.svg"
  },
  pointsProgram: {
    pointsPerAmount: 10,
    pointsPerUnit: 1,
    rewards: [
      {
        id: "reward-30",
        points: 30,
        title: "Nail art mini",
        description: "Decoracion basica sin costo en tu siguiente cita."
      },
      {
        id: "reward-60",
        points: 60,
        title: "10% de descuento",
        description: "Aplicable en un servicio de tu eleccion."
      },
      {
        id: "reward-100",
        points: 100,
        title: "Spa upgrade",
        description: "Upgrade a manicure spa premium."
      },
      {
        id: "reward-140",
        points: 140,
        title: "Gift set",
        description: "Kit sorpresa de cuidado de unas."
      }
    ]
  },
  appointments: [],
  completedAppointments: [],
  contactMessages: [],
  orders: [],
  donations: []
};

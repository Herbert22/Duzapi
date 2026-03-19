-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceInCents" INTEGER NOT NULL,
    "cycle" TEXT NOT NULL,
    "description" TEXT,
    "features" TEXT[],
    "maxTenants" INTEGER NOT NULL DEFAULT 5,
    "maxMessagesPerMonth" INTEGER NOT NULL DEFAULT 10000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- Seed initial plans
INSERT INTO "Plan" ("id", "slug", "name", "priceInCents", "cycle", "description", "features", "maxTenants", "maxMessagesPerMonth", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'monthly', 'Plano Mensal', 12990, 'MONTHLY', 'Plano mensal com todos os recursos', ARRAY['5 instancias WhatsApp', '10.000 mensagens/mes', 'Chatbot IA avancado', 'Suporte prioritario'], 5, 10000, true, 1, NOW(), NOW()),
  (gen_random_uuid()::text, 'yearly', 'Plano Anual', 129900, 'YEARLY', 'Plano anual com economia de 2 meses', ARRAY['5 instancias WhatsApp', '10.000 mensagens/mes', 'Chatbot IA avancado', 'Suporte VIP', 'Economia de 2 meses'], 5, 10000, true, 2, NOW(), NOW());

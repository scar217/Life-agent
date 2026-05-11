-- CreateTable
CREATE TABLE "BriefingConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pushHour" INTEGER NOT NULL DEFAULT 8,
    "city" TEXT,
    "newsTopics" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BriefingConfig_pushHour_isEnabled_idx" ON "BriefingConfig"("pushHour", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingConfig_userId_key" ON "BriefingConfig"("userId");

-- AddForeignKey
ALTER TABLE "BriefingConfig" ADD CONSTRAINT "BriefingConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

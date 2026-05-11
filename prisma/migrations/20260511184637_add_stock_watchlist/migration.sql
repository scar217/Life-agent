-- CreateTable
CREATE TABLE "StockWatchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockWatchlist_userId_idx" ON "StockWatchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StockWatchlist_userId_symbol_key" ON "StockWatchlist"("userId", "symbol");

-- AddForeignKey
ALTER TABLE "StockWatchlist" ADD CONSTRAINT "StockWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

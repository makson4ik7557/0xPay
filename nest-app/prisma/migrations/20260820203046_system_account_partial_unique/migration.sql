CREATE UNIQUE INDEX "system_account_unique"
ON "Account" (currency, network)
WHERE type = 'SYSTEM';
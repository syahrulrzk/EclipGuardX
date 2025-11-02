-- CreateTable
CREATE TABLE "SystemMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cpuUsage" REAL NOT NULL,
    "cpuLoad1" REAL NOT NULL,
    "cpuLoad5" REAL NOT NULL,
    "cpuLoad15" REAL NOT NULL,
    "ramUsed" REAL NOT NULL,
    "ramFree" REAL NOT NULL,
    "ramUsagePercent" REAL NOT NULL,
    "ramTotal" REAL NOT NULL,
    "diskUsed" REAL NOT NULL,
    "diskFree" REAL NOT NULL,
    "diskUsagePercent" REAL NOT NULL,
    "diskTotal" REAL NOT NULL,
    "networkIn" REAL NOT NULL,
    "networkOut" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SystemMetric_timestamp_idx" ON "SystemMetric"("timestamp");

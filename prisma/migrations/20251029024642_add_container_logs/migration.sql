-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ports" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContainerMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerId" TEXT NOT NULL,
    "cpuUsage" REAL NOT NULL,
    "memUsage" REAL NOT NULL,
    "memLimit" REAL,
    "netIn" REAL NOT NULL,
    "netOut" REAL NOT NULL,
    "diskRead" REAL,
    "diskWrite" REAL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContainerMetric_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "containerId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Alert_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerId" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "summary" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    CONSTRAINT "Scan_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContainerLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "containerId" TEXT NOT NULL,
    "logLevel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    CONSTRAINT "ContainerLog_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Container_containerId_key" ON "Container"("containerId");

-- CreateIndex
CREATE INDEX "ContainerMetric_containerId_timestamp_idx" ON "ContainerMetric"("containerId", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_severity_timestamp_idx" ON "Alert"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_containerId_idx" ON "Alert"("containerId");

-- CreateIndex
CREATE INDEX "Scan_containerId_scanType_timestamp_idx" ON "Scan"("containerId", "scanType", "timestamp");

-- CreateIndex
CREATE INDEX "ContainerLog_containerId_timestamp_idx" ON "ContainerLog"("containerId", "timestamp");

-- CreateIndex
CREATE INDEX "ContainerLog_logLevel_timestamp_idx" ON "ContainerLog"("logLevel", "timestamp");

import "dotenv/config"
import { defineConfig } from "prisma/config"

// Schema lives in apps/server — single source of truth for the monorepo.
// Run `corepack yarn prisma generate` from apps/server to regenerate this app's client.
export default defineConfig({
  schema: "../server/prisma/schema.prisma",
  migrations: {
    path: "../server/prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
})

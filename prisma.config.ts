import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ path: process.env.ENV_FILE || '.env.development' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'cross-env ENV_FILE=.env.development tsx scripts/seedDatabase.ts'
  },
  datasource: {
    url: env('DATABASE_URL')
  }
});

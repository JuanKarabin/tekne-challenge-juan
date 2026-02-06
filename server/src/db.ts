/**
 * Configuración y pool de conexión PostgreSQL.
 * Centraliza la conexión para reutilización en repositorios y servicios.
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST ?? 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

export { pool };

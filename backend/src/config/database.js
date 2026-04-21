import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
// Configuración para la conexión a la base de datos según los campos o variables que definimos en el archivo .env
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;

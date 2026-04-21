// unidades_medida.js (nuevo archivo)
import { Router } from "express";
import pool from '../config/database.js';

const router = Router();

// Obtener todas las unidades de medida
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM unidades_medida WHERE is_deleted = 0');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener unidades de medida' });
  }
});

// Obtener unidad por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM unidades_medida WHERE id_unidad = ? AND is_deleted = 0', [id]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: 'Unidad de medida no encontrada' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener unidad de medida' });
  }
});

export default router;
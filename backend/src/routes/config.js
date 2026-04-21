import express from "express";
import pool from "../config/database.js";

const router = express.Router();
router.get('/impuesto', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT impuesto FROM categorias LIMIT 1');
        if (rows && rows[0]) return res.json({ impuesto: rows[0].impuesto });
        res.json({ impuesto: 0.19 });
    } catch (e) { res.status(500).send(e.message); }
});

export default router;
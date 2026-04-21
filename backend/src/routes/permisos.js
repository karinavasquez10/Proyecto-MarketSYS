// routes/permisos.js - Gestión de permisos por usuario y módulo
import express from "express";
import pool from "../config/database.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// ==========================================================================
// GET /api/permisos/modulos - Obtener lista de módulos disponibles
// ==========================================================================
router.get('/modulos', async (req, res) => {
    try {
        // Módulos predefinidos del sistema - sincronizados con la base de datos
        const modulos = [
            // Módulos de Admin (18 módulos - eliminados: cargue_masivo, cotizaciones, entradas, salidas)
            { id: 'gestion_categorias', nombre: 'Gestión de Categorías', categoria: 'admin', ruta: '/HomeAdmin/GestionCategorias' },
            { id: 'productos_recogidos', nombre: 'Productos Recogidos', categoria: 'admin', ruta: '/HomeAdmin/ProductosRecogidos' },
            { id: 'registro_compras', nombre: 'Compras', categoria: 'admin', ruta: '/HomeAdmin/RegistroCompras' },
            { id: 'lista_precios', nombre: 'Lista de Precios', categoria: 'admin', ruta: '/HomeAdmin/ListaPrecios' },
            { id: 'calibrar_productos', nombre: 'Productos por Calibrar', categoria: 'admin', ruta: '/HomeAdmin/CalibrarProductos' },
            { id: 'registro_productos', nombre: 'Registro de Productos', categoria: 'admin', ruta: '/HomeAdmin/RegistroProductos' },
            { id: 'consultar_ventas', nombre: 'Consultar Ventas', categoria: 'admin', ruta: '/HomeAdmin/ConsultarVentas' },
            { id: 'cierres_caja', nombre: 'Cierres de Caja', categoria: 'admin', ruta: '/HomeAdmin/CierresCaja' },
            { id: 'registro_ventas', nombre: 'Registro de Ventas', categoria: 'admin', ruta: '/HomeAdmin/RegistroVentas' },
            { id: 'consulta_inventario', nombre: 'Consulta Inventario', categoria: 'admin', ruta: '/HomeAdmin/ConsultaInventarioProductos' },
            { id: 'movimientos', nombre: 'Movimientos', categoria: 'admin', ruta: '/HomeAdmin/Movimientos' },
            { id: 'sede_principal', nombre: 'Sede Principal', categoria: 'admin', ruta: '/HomeAdmin/SedePrincipal' },
            { id: 'crear_usuario', nombre: 'Crear Usuario', categoria: 'admin', ruta: '/HomeAdmin/CrearUsuario' },
            { id: 'buscar_usuarios', nombre: 'Buscar Usuario', categoria: 'admin', ruta: '/HomeAdmin/BuscarUsuarios' },
            { id: 'gestion_clientes', nombre: 'Gestión de Clientes', categoria: 'admin', ruta: '/HomeAdmin/GestionClientes' },
            { id: 'indicadores', nombre: 'Indicadores', categoria: 'admin', ruta: '/HomeAdmin/Indicadores' },
            { id: 'gestion_proveedores', nombre: 'Gestión de Proveedores', categoria: 'admin', ruta: '/HomeAdmin/GestionProveedores' },
            { id: 'gestion_papelera', nombre: 'Gestión de Papelera', categoria: 'admin', ruta: '/HomeAdmin/GestionPapelera' },
            
            // Módulos de Cajero (6 módulos)
            { id: 'abrir_caja', nombre: 'Abrir Caja', categoria: 'cajero', ruta: 'AbrirCaja' },
            { id: 'cerrar_caja', nombre: 'Cerrar Caja', categoria: 'cajero', ruta: 'CerrarCaja' },
            { id: 'consulta_facturas', nombre: 'Consulta Facturas', categoria: 'cajero', ruta: 'ConsultaFacturas' },
            { id: 'consulta_productos', nombre: 'Consulta Productos', categoria: 'cajero', ruta: 'ConsultaProductos' },
            { id: 'catalogo', nombre: 'Catálogo', categoria: 'cajero', ruta: 'Catalogo' },
            { id: 'clientes_cajero', nombre: 'Clientes', categoria: 'cajero', ruta: 'Clientes' },
        ];

        res.json(modulos);
    } catch (error) {
        console.error('Error al obtener módulos:', error);
        res.status(500).json({ error: 'Error al obtener módulos' });
    }
});

// ==========================================================================
// GET /api/permisos/:id_usuario - Obtener permisos de un usuario
// ==========================================================================
router.get('/:id_usuario', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT modulo_id, tiene_acceso 
             FROM permisos_usuario 
             WHERE id_usuario = ?`,
            [req.params.id_usuario]
        );

        // Debug: ver qué tipo de datos vienen de la BD
        console.log(`[DEBUG] Permisos usuario ${req.params.id_usuario}:`, rows.length, 'registros');
        
        // Si el usuario no tiene permisos configurados, obtener su rol y retornar vacío
        // El frontend puede inicializar permisos predeterminados o el admin puede configurarlos
        if (rows.length === 0) {
            console.log(`[INFO] Usuario ${req.params.id_usuario} no tiene permisos configurados`);
            // Retornar objeto vacío para que el frontend pueda mostrar todos los módulos sin marcar
            return res.json({});
        }

        if (rows.length > 0) {
            console.log('[DEBUG] Primer registro:', rows[0], 'tiene_acceso type:', typeof rows[0].tiene_acceso);
        }

        // Convertir a objeto para facilitar el acceso
        // Usamos conversión explícita a booleano para manejar 0/1, true/false, "0"/"1"
        const permisos = {};
        rows.forEach(row => {
            permisos[row.modulo_id] = Boolean(Number(row.tiene_acceso));
        });

        console.log('[DEBUG] Permisos procesados:', permisos);
        res.json(permisos);
    } catch (error) {
        console.error('Error al obtener permisos:', error);
        res.status(500).json({ error: 'Error al obtener permisos' });
    }
});

// ==========================================================================
// POST /api/permisos/:id_usuario - Guardar/actualizar permisos de un usuario
// ==========================================================================
router.post('/:id_usuario', async (req, res) => {
    const { id_usuario } = req.params;
    const { permisos } = req.body; // Objeto: { modulo_id: boolean }

    console.log(`[DEBUG] POST /api/permisos/${id_usuario} - Inicio guardado de permisos`);
    console.log('[DEBUG] Body recibido:', req.body);
    console.log('[DEBUG] Permisos objeto:', permisos);
    console.log('[DEBUG] Tipo de permisos:', typeof permisos);
    console.log('[DEBUG] Cantidad de permisos:', permisos ? Object.keys(permisos).length : 0);

    try {
        // Eliminar permisos existentes
        const [deleteResult] = await pool.query('DELETE FROM permisos_usuario WHERE id_usuario = ?', [id_usuario]);
        console.log('[DEBUG] Permisos eliminados:', deleteResult.affectedRows);

        // Insertar nuevos permisos
        if (permisos && Object.keys(permisos).length > 0) {
            const values = Object.entries(permisos).map(([modulo_id, tiene_acceso]) => {
                console.log(`[DEBUG] Procesando permiso: ${modulo_id} = ${tiene_acceso} (${typeof tiene_acceso})`);
                return [
                    id_usuario,
                    modulo_id,
                    tiene_acceso ? 1 : 0
                ];
            });

            console.log('[DEBUG] Values a insertar:', values);

            const [insertResult] = await pool.query(
                `INSERT INTO permisos_usuario (id_usuario, modulo_id, tiene_acceso) 
                 VALUES ?`,
                [values]
            );

            console.log('[DEBUG] Permisos insertados:', insertResult.affectedRows);
        } else {
            console.log('[DEBUG] No hay permisos para insertar (objeto vacío o undefined)');
        }

        // Registrar auditoría de actualización de permisos
        await registrarAuditoria({
            id_usuario: req.user?.id || 1,
            accion: 'Actualización de permisos de usuario',
            tabla_nombre: 'permisos_usuario',
            registro_id: id_usuario,
            detalles: {
                id_usuario_afectado: id_usuario,
                permisos_eliminados: deleteResult.affectedRows,
                permisos_insertados: permisos ? Object.keys(permisos).length : 0,
                permisos: permisos
            },
            req
        });

        res.json({ message: 'Permisos actualizados exitosamente' });
    } catch (error) {
        console.error('[ERROR] Error al guardar permisos:', error);
        res.status(500).json({ error: 'Error al guardar permisos: ' + error.message });
    }
});

// ==========================================================================
// POST /api/permisos/:id_usuario/inicializar - Inicializar permisos según rol
// ==========================================================================
router.post('/:id_usuario/inicializar', async (req, res) => {
    const { id_usuario } = req.params;

    console.log(`[DEBUG] POST /api/permisos/${id_usuario}/inicializar - Inicio inicialización`);

    try {
        // Obtener el rol del usuario
        const [userRows] = await pool.query(
            'SELECT rol FROM usuarios WHERE id_usuario = ?',
            [id_usuario]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const rol = userRows[0].rol.toLowerCase();
        console.log(`[DEBUG] Rol del usuario ${id_usuario}: ${rol}`);

        // Módulos predeterminados según el rol
        const modulosPorDefecto = {
            admin: [
                'gestion_categorias', 'productos_recogidos', 'registro_compras',
                'lista_precios', 'calibrar_productos', 'registro_productos', 'consultar_ventas',
                'cierres_caja', 'registro_ventas', 'consulta_inventario', 'movimientos', 
                'sede_principal', 'crear_usuario', 'buscar_usuarios', 'gestion_clientes', 
                'indicadores', 'gestion_proveedores', 'gestion_papelera'
            ],
            cajero: [
                'abrir_caja', 'cerrar_caja', 'consulta_facturas', 'consulta_productos', 
                'catalogo', 'clientes_cajero'
            ],
            bodeguero: [
                'abrir_caja', 'cerrar_caja', 'consulta_facturas', 'consulta_productos', 
                'catalogo', 'clientes_cajero'
            ]
        };

        const modulos = modulosPorDefecto[rol] || modulosPorDefecto.cajero;
        console.log(`[DEBUG] Módulos a inicializar:`, modulos);

        // Eliminar permisos existentes
        await pool.query('DELETE FROM permisos_usuario WHERE id_usuario = ?', [id_usuario]);

        // Insertar nuevos permisos (todos habilitados por defecto)
        if (modulos.length > 0) {
            const values = modulos.map(modulo_id => [id_usuario, modulo_id, 1]);
            
            await pool.query(
                `INSERT INTO permisos_usuario (id_usuario, modulo_id, tiene_acceso) 
                 VALUES ?`,
                [values]
            );

            console.log(`[DEBUG] ${values.length} permisos inicializados para usuario ${id_usuario}`);
        }

        // Registrar auditoría de inicialización de permisos
        await registrarAuditoria({
            id_usuario: req.user?.id || 1,
            accion: 'Inicialización de permisos de usuario',
            tabla_nombre: 'permisos_usuario',
            registro_id: id_usuario,
            detalles: {
                id_usuario_afectado: id_usuario,
                rol: rol,
                permisos_creados: modulos.length,
                modulos: modulos
            },
            req
        });

        res.json({ 
            message: 'Permisos inicializados exitosamente',
            rol: rol,
            permisos_creados: modulos.length
        });
    } catch (error) {
        console.error('[ERROR] Error al inicializar permisos:', error);
        res.status(500).json({ error: 'Error al inicializar permisos: ' + error.message });
    }
});

// ==========================================================================
// GET /api/permisos/verificar/:id_usuario/:modulo_id - Verificar acceso a módulo
// ==========================================================================
router.get('/verificar/:id_usuario/:modulo_id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT tiene_acceso 
             FROM permisos_usuario 
             WHERE id_usuario = ? AND modulo_id = ?`,
            [req.params.id_usuario, req.params.modulo_id]
        );

        const tieneAcceso = rows.length > 0 ? rows[0].tiene_acceso === 1 : false;
        res.json({ tiene_acceso: tieneAcceso });
    } catch (error) {
        console.error('Error al verificar permiso:', error);
        res.status(500).json({ error: 'Error al verificar permiso' });
    }
});

export default router;

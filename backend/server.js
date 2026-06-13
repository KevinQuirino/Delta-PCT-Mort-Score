const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
app.use(express.json());

// Pool de conexiones estables a tu base de datos deltapct_db
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin12345',
    database: 'deltapct_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ==========================================
// ENDPOINTS (API REST RELACIONAL)
// ==========================================

app.get('/', (req, res) => {
    res.send(`
        <div style="background: #030a16; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif;">
            <h1 style="color: #39ff14; border: 2px solid #39ff14; padding: 20px; border-radius: 10px; background: rgba(57, 255, 20, 0.1);">
                🟢 Motor Backend Relacional Delta-PCT Activo
            </h1>
        </div>
    `);
});

// 1. GET: Obtener pacientes con TODOS sus datos de gasometría
app.get('/api/pacientes', async (req, res) => {
    try {
        // ACTUALIZACIÓN: Seleccionamos absolutamente todos los campos de ambas tablas
        const query = `
            SELECT 
                p.id, 
                p.folio, 
                DATE_FORMAT(p.fecha_registro, "%Y-%m-%d") as fecha, 
                p.edad, 
                p.genero, 
                p.comorbilidades_detalle,
                p.sepsis_origen as sepsis, 
                p.score_f1 as score, 
                p.estado_riesgo as estado,
                g.lactato,
                g.ph_arterial,
                g.pa_co2,
                g.hco3,
                g.pa_o2,
                g.pv_co2,
                g.fi_o2,
                g.delta_co2,
                g.pafi,
                g.procalcitonina
            FROM pacientes p 
            LEFT JOIN gasometrias g ON p.id = g.paciente_id 
            ORDER BY p.id DESC
        `;
        
        const [rows] = await pool.execute(query);
        return res.json(rows); 
    } catch (error) {
        console.error("Error en GET /api/pacientes:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Error al obtener pacientes', error: error.message });
        }
    }
});

// 2. POST: Guardar un nuevo registro (Doble inserción relacional)
app.post('/api/pacientes', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { folio, edad, genero, sepsis, score, lactato, estado, datosCompletos } = req.body;
        
        await connection.beginTransaction();

        // INSERCIÓN 1: Tabla de Pacientes
        const queryPaciente = `
            INSERT INTO pacientes (folio, edad, genero, comorbilidades_detalle, sepsis_origen, score_f1, estado_riesgo, datos_completos) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const comorbDetalle = datosCompletos.comorbilidadesSelect === 'si' ? (datosCompletos.comorbilidadesDetalle || 'Sí') : 'Ninguna';
        
        const [resultPaciente] = await connection.execute(queryPaciente, [
            folio, edad, genero, comorbDetalle, sepsis, score, estado, JSON.stringify(datosCompletos)
        ]);

        const nuevoPacienteId = resultPaciente.insertId;

        // Extraer y formatear laboratorios de Fase 2
        const ph = parseFloat(datosCompletos.phArterial) || null;
        const paco2 = parseFloat(datosCompletos.paCO2) || null;
        const hco3 = parseFloat(datosCompletos.hco3Arterial) || null;
        const pao2 = parseFloat(datosCompletos.paO2) || null;
        const pvco2 = parseFloat(datosCompletos.pvCO2) || null;
        const fio2 = parseFloat(datosCompletos.fio2) || null;
        
        let deltaCO2 = null;
        if (pvco2 !== null && paco2 !== null) deltaCO2 = pvco2 - paco2;

        let pafi = null;
        if (pao2 !== null && fio2 !== null) {
            let fio2Decimal = fio2 > 1 ? fio2 / 100 : fio2;
            pafi = Math.round(pao2 / fio2Decimal);
        }

        // INSERCIÓN 2: Tabla de Gasometrias
        const queryGasometria = `
            INSERT INTO gasometrias (paciente_id, lactato, ph_arterial, pa_co2, hco3, pa_o2, pv_co2, fi_o2, delta_co2, pafi, procalcitonina) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const procalcitonina = parseFloat(datosCompletos.procalcitonina) || null;
        await connection.execute(queryGasometria, [
            nuevoPacienteId, lactato, ph, paco2, hco3, pao2, pvco2, fio2, deltaCO2, pafi, procalcitonina
        ]);

        await connection.commit();
        return res.status(201).json({ message: 'Paciente y gasometría registrados exitosamente', pacienteId: nuevoPacienteId });

    } catch (error) {
        await connection.rollback();
        console.error("Error en POST /api/pacientes:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Error al registrar datos', error: error.message });
        }
    } finally {
        connection.release();
    }
});

// 3. PUT: Actualizar expediente
app.put('/api/pacientes/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        const { edad, genero, sepsis, lactato, estado, procalcitonina } = req.body;

        await connection.beginTransaction();

        const queryPac = `UPDATE pacientes SET edad = COALESCE(?, edad), genero = COALESCE(?, genero), sepsis_origen = COALESCE(?, sepsis_origen), estado_riesgo = COALESCE(?, estado_riesgo) WHERE id = ?`;
        await connection.execute(queryPac, [edad, genero, sepsis, estado, id]);

        const queryGas = `UPDATE gasometrias SET lactato = COALESCE(?, lactato), procalcitonina = COALESCE(?, procalcitonina) WHERE paciente_id = ?`;
        await connection.execute(queryGas, [lactato, procalcitonina !== undefined ? parseFloat(procalcitonina) : null, id]);

        await connection.commit();
        return res.json({ message: 'Expediente actualizado correctamente' });

    } catch (error) {
        await connection.rollback();
        console.error("Error en PUT /api/pacientes:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Error al actualizar expediente', error: error.message });
        }
    } finally {
        connection.release();
    }
});

// 4. DELETE: Eliminar paciente (Cascada activa)
app.delete('/api/pacientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM pacientes WHERE id = ?', [id]);
        return res.json({ message: 'Paciente eliminado correctamente' });
    } catch (error) {
        console.error("Error en DELETE /api/pacientes:", error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Error al eliminar paciente', error: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Relacional Delta-PCT corriendo en http://localhost:${PORT}`);
});
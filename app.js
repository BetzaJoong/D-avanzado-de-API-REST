const express = require('express');
const { Pool } = require('pg');
const pool = require('./data');

const app = express();
const port = 3000;

// Middleware para generar informes o reportes
app.use((req, res, next) => {
    console.log(`Consulta realizada a la ruta: ${req.path}`);
    next();
});

// Ruta GET /joyas
app.get('/joyas', async (req, res, next) => {
    try {
        const { limits = 6, page = 1, order_by } = req.query;
        const offset = (page - 1) * limits;

        let orderClause = 'id ASC'; // Orden predeterminado por id ascendente

        if (order_by) {
            const [field, direction] = order_by.split('_');
            orderClause = `${field} ${direction}`;
        }

        const query = {
            text: `
          SELECT * FROM (
            SELECT DISTINCT ON (nombre) * FROM inventario ORDER BY nombre, id ASC
          ) AS unique_joyas
          ORDER BY ${orderClause}
          LIMIT $1 OFFSET $2
        `,
            values: [parseInt(limits, 10), offset],
        };

        const result = await pool.query(query);

        const joyas = result.rows;

        // Cálculo del stock total
        const stockTotal = joyas.reduce((total, joya) => total + joya.stock, 0);

        // Estructura de resultado con HATEOAS
        const response = {
            TotalJoyas: joyas.length,
            stockTotal,
            results: joyas.map(joya => ({
                name: joya.nombre,
                href: `/joyas/joya/${joya.id}`,
            })),
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
});


// Ruta GET /joyas/filtros
app.get('/joyas/filtros', async (req, res, next) => {
    try {
        const { precio_min, precio_max, categoria, metal } = req.query;

        const filters = [];
        const values = [];

        if (precio_min) {
            filters.push('precio >= $1');
            values.push(parseInt(precio_min, 10));
        }

        if (precio_max) {
            filters.push('precio <= $2');
            values.push(parseInt(precio_max, 10));
        }

        if (categoria) {
            filters.push('categoria = $3');
            values.push(categoria);
        }

        if (metal) {
            filters.push('metal = $4');
            values.push(metal);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

        const query = {
            text: `
          SELECT DISTINCT ON (nombre) * FROM inventario ${whereClause}
        ORDER BY nombre, id
        `,
            values,
        };

        const result = await pool.query(query);

        const joyasFiltradas = result.rows;

        // Estructura de resultado para filtros
        const response = {
            TotalJoyasFiltradas: joyasFiltradas.length,
            joyasFiltradas,
        };

        res.json(response);
    } catch (err) {
        next(err);
    }
});

// Middleware para capturar errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Error interno del servidor');
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});

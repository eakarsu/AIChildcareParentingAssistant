const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

/**
 * Generic CRUD route factory.
 * @param {string} tableName - The database table name.
 * @param {string[]} columns - List of column names for insert/update.
 * @param {object} options - Additional options.
 * @param {string[]} options.required - Required columns for POST.
 * @param {string[]} options.searchFields - Columns to search against with ?search= param.
 * @param {boolean} options.userScoped - If true, scope by user_id instead of child_id.
 */
function createCrudRoutes(tableName, columns, options = {}) {
  const router = express.Router();
  const { required = [], searchFields = [], userScoped = false } = options;

  // GET / - List all items (supports ?page=&limit= pagination)
  router.get('/', auth, async (req, res) => {
    try {
      const { child_id, search, sort_by, order, page, limit } = req.query;

      // Pagination
      const usePagination = page !== undefined || limit !== undefined;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
      const offset = (pageNum - 1) * limitNum;

      let baseWhere = `FROM ${tableName} WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      if (userScoped) {
        baseWhere += ` AND user_id = $${paramIndex}`;
        params.push(req.user.id);
        paramIndex++;
      }

      if (child_id && !userScoped) {
        baseWhere += ` AND child_id = $${paramIndex}`;
        params.push(child_id);
        paramIndex++;
      }

      if (search && searchFields.length > 0) {
        const searchConditions = searchFields.map((field) => {
          params.push(`%${search}%`);
          return `${field} ILIKE $${paramIndex++}`;
        });
        baseWhere += ` AND (${searchConditions.join(' OR ')})`;
      }

      const sortColumn = sort_by && columns.includes(sort_by) ? sort_by : 'created_at';
      const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

      let query = `SELECT * ${baseWhere} ORDER BY ${sortColumn} ${sortOrder}`;

      // Apply pagination
      if (usePagination) {
        params.push(limitNum, offset);
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      }

      const result = await pool.query(query, params);

      // If pagination requested, also return total count
      if (usePagination) {
        const countResult = await pool.query(`SELECT COUNT(*) ${baseWhere}`, params.slice(0, params.length - 2));
        const total = parseInt(countResult.rows[0].count);
        return res.json({
          data: result.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        });
      }
      res.json(result.rows);
    } catch (err) {
      console.error(`GET /${tableName} error:`, err);
      res.status(500).json({ error: 'Failed to fetch records.' });
    }
  });

  // GET /:id - Get single item
  router.get('/:id', auth, async (req, res) => {
    try {
      const { id } = req.params;
      let query = `SELECT * FROM ${tableName} WHERE id = $1`;
      const params = [id];

      if (userScoped) {
        query += ' AND user_id = $2';
        params.push(req.user.id);
      }

      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Record not found.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`GET /${tableName}/:id error:`, err);
      res.status(500).json({ error: 'Failed to fetch record.' });
    }
  });

  // POST / - Create item
  router.post('/', auth, async (req, res) => {
    try {
      // Validate required fields
      const missing = required.filter((field) => !req.body[field] && req.body[field] !== 0);
      if (missing.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      const fields = [];
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      // If user-scoped, add user_id
      if (userScoped) {
        fields.push('user_id');
        values.push(req.user.id);
        placeholders.push(`$${paramIndex++}`);
      }

      for (const col of columns) {
        if (req.body[col] !== undefined) {
          fields.push(col);
          values.push(req.body[col]);
          placeholders.push(`$${paramIndex++}`);
        }
      }

      if (fields.length === 0 || (fields.length === 1 && userScoped)) {
        return res.status(400).json({ error: 'No valid fields provided.' });
      }

      const query = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const result = await pool.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(`POST /${tableName} error:`, err);
      res.status(500).json({ error: 'Failed to create record.' });
    }
  });

  // PUT /:id - Update item
  router.put('/:id', auth, async (req, res) => {
    try {
      const { id } = req.params;
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const col of columns) {
        if (req.body[col] !== undefined) {
          fields.push(`${col} = $${paramIndex++}`);
          values.push(req.body[col]);
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update.' });
      }

      values.push(id);
      let query = `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
      paramIndex++;

      if (userScoped) {
        query += ` AND user_id = $${paramIndex}`;
        values.push(req.user.id);
      }

      query += ' RETURNING *';

      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Record not found.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(`PUT /${tableName}/:id error:`, err);
      res.status(500).json({ error: 'Failed to update record.' });
    }
  });

  // DELETE /:id - Delete item
  router.delete('/:id', auth, async (req, res) => {
    try {
      const { id } = req.params;
      let query = `DELETE FROM ${tableName} WHERE id = $1`;
      const params = [id];

      if (userScoped) {
        query += ' AND user_id = $2';
        params.push(req.user.id);
      }

      query += ' RETURNING *';

      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Record not found.' });
      }
      res.json({ message: 'Record deleted successfully.', record: result.rows[0] });
    } catch (err) {
      console.error(`DELETE /${tableName}/:id error:`, err);
      res.status(500).json({ error: 'Failed to delete record.' });
    }
  });

  return router;
}

module.exports = createCrudRoutes;

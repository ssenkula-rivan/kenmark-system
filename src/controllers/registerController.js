const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../utils/logger');

const register = async (req, res) => {
  try {
    const { name, username, password, department, machine_id } = req.body;

    // Check if username already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (name, username, password_hash, role, department, machine_id) 
       VALUES (?, ?, ?, 'worker', ?, ?)`,
      [name, username, password_hash, department, machine_id || null]
    );

    logger.info('New user registered', {
      userId: result.insertId,
      username,
      department
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please login.',
      data: {
        id: result.insertId,
        name,
        username,
        department
      }
    });
  } catch (error) {
    logger.error('Registration error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

const getDepartments = async (req, res) => {
  try {
    // Return available departments
    const departments = [
      { value: 'large_format', label: 'Large Format Printing' },
      { value: 'digital_press', label: 'Digital Press' },
      { value: 'finishing', label: 'Finishing Department' },
      { value: 'design', label: 'Design Department' },
      { value: 'customer_service', label: 'Customer Service' }
    ];

    res.json({
      success: true,
      data: departments
    });
  } catch (error) {
    logger.error('Get departments error', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch departments'
    });
  }
};

const getMachines = async (req, res) => {
  try {
    const machines = await db.query(
      'SELECT id, name, type FROM machines WHERE status = ?',
      ['active']
    );

    res.json({
      success: true,
      data: machines
    });
  } catch (error) {
    logger.error('Get machines error', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch machines'
    });
  }
};

module.exports = {
  register,
  getDepartments,
  getMachines
};

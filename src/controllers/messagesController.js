const db = require('../config/database');
const logger = require('../utils/logger');
const path = require('path');

class MessagesController {
  async sendMessage(req, res) {
    try {
      const { receiver_id, message } = req.body;
      const sender_id = req.user.id;
      const file = req.file;

      if (!receiver_id) {
        return res.status(400).json({
          success: false,
          message: 'Receiver is required'
        });
      }

      if (!message && !file) {
        return res.status(400).json({
          success: false,
          message: 'Message or file is required'
        });
      }

      const result = await db.query(`
        INSERT INTO messages (sender_id, receiver_id, message, file_name, file_path, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        sender_id,
        receiver_id,
        message || null,
        file ? file.originalname : null,
        file ? file.path : null,
        file ? file.mimetype : null,
        file ? file.size : null
      ]);

      logger.info('Message sent', {
        messageId: result.insertId,
        senderId: sender_id,
        receiverId: receiver_id
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          id: result.insertId
        }
      });
    } catch (error) {
      logger.error('Send message error', {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  }

  async getMessages(req, res) {
    try {
      const userId = req.user.id;
      const { with_user_id } = req.query;

      let messages;
      if (with_user_id) {
        messages = await db.query(`
          SELECT m.*, 
                 sender.name as sender_name,
                 receiver.name as receiver_name
          FROM messages m
          INNER JOIN users sender ON m.sender_id = sender.id
          INNER JOIN users receiver ON m.receiver_id = receiver.id
          WHERE (m.sender_id = ? AND m.receiver_id = ?)
             OR (m.sender_id = ? AND m.receiver_id = ?)
          ORDER BY m.created_at ASC
        `, [userId, with_user_id, with_user_id, userId]);
      } else {
        messages = await db.query(`
          SELECT m.*, 
                 sender.name as sender_name,
                 receiver.name as receiver_name
          FROM messages m
          INNER JOIN users sender ON m.sender_id = sender.id
          INNER JOIN users receiver ON m.receiver_id = receiver.id
          WHERE m.sender_id = ? OR m.receiver_id = ?
          ORDER BY m.created_at DESC
          LIMIT 100
        `, [userId, userId]);
      }

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      logger.error('Get messages error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages'
      });
    }
  }

  async getUsers(req, res) {
    try {
      const currentUserId = req.user.id;
      
      // Get all users with last active timestamp
      const users = await db.query(`
        SELECT id, name, username, role, department, last_active,
               TIMESTAMPDIFF(SECOND, last_active, NOW()) as seconds_ago
        FROM users
        WHERE id != ?
        ORDER BY last_active DESC, name ASC
      `, [currentUserId]);

      res.json({
        success: true,
        data: users.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
          department: u.department,
          lastActive: u.last_active,
          secondsAgo: u.seconds_ago,
          isActive: u.seconds_ago !== null && u.seconds_ago < 300 // 5 minutes
        }))
      });
    } catch (error) {
      logger.error('Get users error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const { message_id } = req.params;
      const userId = req.user.id;

      await db.query(`
        UPDATE messages
        SET is_read = TRUE
        WHERE id = ? AND receiver_id = ?
      `, [message_id, userId]);

      res.json({
        success: true,
        message: 'Message marked as read'
      });
    } catch (error) {
      logger.error('Mark as read error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        message: 'Failed to mark message as read'
      });
    }
  }

  async downloadFile(req, res) {
    try {
      const { message_id } = req.params;
      const userId = req.user.id;

      const messages = await db.query(`
        SELECT file_path, file_name
        FROM messages
        WHERE id = ? AND (sender_id = ? OR receiver_id = ?)
      `, [message_id, userId, userId]);

      if (messages.length === 0 || !messages[0].file_path) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const filePath = path.resolve(messages[0].file_path);
      res.download(filePath, messages[0].file_name);
    } catch (error) {
      logger.error('Download file error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        message: 'Failed to download file'
      });
    }
  }
}

module.exports = new MessagesController();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mysql = require('mysql');

// MySQL connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'freelancer_nayem',
  password: 'Shamimhossanshamim',
  database: 'omega_chat_app'
};

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Serve static files
app.use(express.static('public'));

// Create users table if it doesn't exist
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to the database: ', err);
    return;
  }

  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      online BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;

  connection.query(query, (err) => {
    connection.release();

    if (err) {
      console.error('Error creating users table: ', err);
      return;
    }

    console.log('Users table created successfully');
  });
});

// Update user's online status in the database
function updateUserOnlineStatus(username, online) {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database: ', err);
      return;
    }

    const query = 'UPDATE users SET online = ? WHERE username = ?';
    connection.query(query, [online, username], (err, result) => {
      connection.release();

      if (err) {
        console.error('Error updating user online status: ', err);
        return;
      }

      console.log('User online status updated successfully:', username, online);
    });
  });
}

// Retrieve all online users from the database
function getOnlineUsers(callback) {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error connecting to the database: ', err);
      return callback(err, null);
    }

    const query = 'SELECT * FROM users WHERE online = TRUE';
    connection.query(query, (err, results) => {
      connection.release();

      if (err) {
        console.error('Error retrieving online users: ', err);
        return callback(err, null);
      }

      callback(null, results);
    });
  });
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle start call event
  socket.on('startCall', (username) => {
    // Update user's online status to true
    updateUserOnlineStatus(username, true);

    // Retrieve all online users from the database
    getOnlineUsers((err, users) => {
      if (err) {
        console.error('Error retrieving online users:', err);
        return;
      }

      // Send the list of online users to the client
      io.to(socket.id).emit('userList', users);
    });
  });

  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Update user's online status to false
    updateUserOnlineStatus(socket.username, false);
  });
});

// Start the server
const port = 3000;
http.listen(port, () => {
  console.log('Server listening on port', port);
});

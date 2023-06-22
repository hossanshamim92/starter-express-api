const WebSocket = require("ws");
const mysql = require("mysql");
const { v4: uuidv4 } = require("uuid");

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// MySQL database connection
const dbConnection = mysql.createConnection({
  host: "srv957.hstgr.io",
  user: "u292456886_omega",
  password: "Shamim123@",
  database: "u292456886_omega",
});

let waitingSocket = null;

// Connect to the database
dbConnection.connect((err) => {
  if (err) throw err;
  console.log("Connected to the MySQL database.");

  // Create the "connections" table if it doesn't exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS connections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      socket_id VARCHAR(255),
      connected BOOLEAN DEFAULT false
    )
  `;
  dbConnection.query(createTableQuery, (err) => {
    if (err) throw err;
    console.log("Connections table created or already exists.");
  });
});

wss.on("connection", (socket) => {
  const socketId = uuidv4();
  socket.socketId = socketId; // Attach the socket ID to the socket object

  socket.on("message", (message, isBinary) => {
    message = isBinary ? message : message.toString();

    if (message === "Start Chat") {
      // Insert the new socket into the database
      const insertQuery = `INSERT INTO connections (socket_id) VALUES (?)`;
      dbConnection.query(insertQuery, [socketId], (err, result) => {
        if (err) throw err;
        console.log(`New socket inserted with ID: ${result.insertId}`);

        checkForConnections(socket, socketId);
      });
    } else {
      // Send the received message to the connected socket
      if (
        socket.partnerSocket &&
        socket.partnerSocket.readyState === WebSocket.OPEN
      ) {
        socket.partnerSocket.send(message);
      }
    }
  });

  socket.on("close", () => {
    // Remove the socket from the database when closed
    const deleteQuery = `DELETE FROM connections WHERE socket_id = ?`;
    dbConnection.query(deleteQuery, [socketId], (err) => {
      if (err) throw err;
      console.log(`Socket with ID ${socketId} removed from connections.`);

      // Close the connection with the partner socket if connected
      if (socket.partnerSocket) {
        socket.partnerSocket.close();
        socket.partnerSocket = null;
      }
    });
  });
});

function checkForConnections(socket, socketId) {
  // Check if there is a waiting socket in the database
  const selectQuery = `SELECT * FROM connections WHERE connected = '0' AND socket_id != ? LIMIT 1`;
  dbConnection.query(selectQuery, [socketId], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      // Found a waiting socket, pair them together
      const waitingSocketId = results[0].socket_id;

      // Get the waiting socket from the WebSocket server
      const waitingSocket = Array.from(wss.clients).find(
        (client) => client.socketId === waitingSocketId
      );

      if (waitingSocket) {
        // Update the connection status in the database
        setConnectionStatus(waitingSocket, true);
        setConnectionStatus(socket, true);

        // Set the partner sockets for both sockets
        socket.partnerSocket = waitingSocket;
        waitingSocket.partnerSocket = socket;

        // Notify the sockets about the connection
        waitingSocket.send("Connected");
        socket.send("Connected");

        console.log(
          `Sockets ${waitingSocket.socketId} and ${socketId} connected.`
        );
      }
    } else {
      console.log(
        "No waiting socket found, add the current socket to the waiting list"
      );
      // No waiting socket found, set the current socket as the waiting socket
      waitingSocket = socket;
    }
  });
}

function setConnectionStatus(socket, status) {
  const updateQuery = `UPDATE connections SET connected = ? WHERE socket_id = ?`;
  dbConnection.query(updateQuery, [status, socket.socketId], (err) => {
    if (err) throw err;
  });
}

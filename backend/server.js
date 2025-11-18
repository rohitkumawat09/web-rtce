import { Server } from "socket.io";
import http from "http";

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send call
  socket.on("call-user", (data) => {
    io.to(data.to).emit("incoming-call", {
      from: socket.id,
      callType: data.callType // audio / video
    });
  });

  // Offer
  socket.on("offer", (data) => {
    io.to(data.to).emit("offer", data);
  });

  // Answer
  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", data);
  });

  // Ice Candidate
  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", data);
  });

  // End call
  socket.on("end-call", (data) => {
    io.to(data.to).emit("call-ended");
  });
});

server.listen(5000, () => console.log("Server running on 5000"));

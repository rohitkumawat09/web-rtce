import { Server } from "socket.io";
import http from "http";

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN }
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
    io.to(data.to).emit("offer", { ...data, from: socket.id });
  });

  // Answer
  socket.on("answer", (data) => {
    io.to(data.to).emit("answer", { ...data, from: socket.id });
  });

  // Ice Candidate
  socket.on("ice-candidate", (data) => {
    io.to(data.to).emit("ice-candidate", { ...data, from: socket.id });
  });

  // End call
  socket.on("end-call", (data) => {
    io.to(data.to).emit("call-ended", { from: socket.id });
  });
});

server.listen(PORT, () => console.log(`Server running on ${PORT}`));

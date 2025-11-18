import React, { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import ringtoneSrc from "./assets/iphone-13-30-00-62001.mp3";

const DEFAULT_SOCKET = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
const socket = io(DEFAULT_SOCKET);

export default function CallComponent() {
  const [incoming, setIncoming] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState("");
  const pcRef = useRef();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const ringtoneRef = useRef(new Audio(ringtoneSrc));
  const targetRef = useRef(null);
  const localStreamRef = useRef(null);

  // Styles
  const styles = {
    button: {
      padding: "10px 16px",
      margin: "8px",
      borderRadius: "8px",
      border: "0",
      cursor: "pointer",
      background: "#0ea5a4",
      color: "#fff",
      fontWeight: "600",
      fontSize: "14px",
    },
    rejectBtn: {
      padding: "10px 16px",
      margin: "8px",
      borderRadius: "8px",
      border: "0",
      cursor: "pointer",
      background: "#ff4d5a",
      color: "#fff",
      fontWeight: "600",
      fontSize: "14px",
    },
    incomingBox: {
      background: "#fff",
      width: "300px",
      margin: "20px auto",
      padding: "20px",
      borderRadius: "12px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      textAlign: "center",
    },
    videoWrapper: {
      display: "flex",
      justifyContent: "center",
      gap: "20px",
      marginTop: "20px",
    },
    video: {
      width: "220px",
      height: "160px",
      background: "black",
      borderRadius: "10px",
      objectFit: "cover",
    },
    endCallBtn: {
      marginTop: "20px",
      padding: "10px 20px",
      background: "#ff3b30",
      color: "#fff",
      border: "0",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "700",
    },
  };

  // init pc
  const createPeerConnection = () => {
    pcRef.current = new RTCPeerConnection();

    pcRef.current.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    pcRef.current.onicecandidate = (e) => {
      if (e.candidate) {
        const to = targetRef.current || incoming?.from;
        if (to) {
          socket.emit("ice-candidate", {
            to,
            candidate: e.candidate,
          });
        }
      }
    };
  };

  useEffect(() => {
    ringtoneRef.current.loop = true;

    const onIncoming = (data) => {
      targetRef.current = data.from;
      ringtoneRef.current.play();
      setIncoming(data);
      setCallType(data.callType);
    };

    const onOffer = async (data) => {
      if (!pcRef.current) createPeerConnection();
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const ans = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ans);
      socket.emit("answer", { to: data.from, answer: ans });
    };

    const onAnswer = async (data) => {
      if (pcRef.current && data?.answer) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const onIce = (data) => {
      try {
        if (pcRef.current && data?.candidate) {
          pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.warn("Failed to add ICE candidate", err);
      }
    };

    socket.on("incoming-call", onIncoming);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIce);
    socket.on("call-ended", () => endCall());

    return () => {
      socket.off("incoming-call", onIncoming);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIce);
      socket.off("call-ended");
    };
  }, [incoming]);

  // start call
  const startCall = async (userId, type) => {
    setCallType(type);
    targetRef.current = userId;
    createPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === "video",
      audio: true,
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

    socket.emit("call-user", { to: userId, callType: type });

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    socket.emit("offer", { to: userId, offer });
    setInCall(true);
  };

  // accept
  const acceptCall = async () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
    setInCall(true);

    if (!pcRef.current) createPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: callType === "video",
      audio: true,
    });

    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));
  };

  // reject
  const rejectCall = () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;
    if (incoming?.from) socket.emit("reject-call", { to: incoming.from });
    setIncoming(null);
    targetRef.current = null;
  };

  // end call
  const endCall = () => {
    ringtoneRef.current.pause();
    ringtoneRef.current.currentTime = 0;

    setInCall(false);
    setIncoming(null);

    try {
      const stream = localStreamRef.current;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      if (pcRef.current) pcRef.current.close();
    } catch (err) {
      console.warn("Error while ending call", err);
    }

    const to = targetRef.current || incoming?.from;
    if (to) socket.emit("end-call", { to });
    targetRef.current = null;
  };

  return (
    <>
      {/* Call Buttons */}
      <button style={styles.button} onClick={() => startCall("USER_B_ID", "audio")}>
        🎧 Audio Call
      </button>
      <button style={styles.button} onClick={() => startCall("USER_B_ID", "video")}>
        🎥 Video Call
      </button>

      {/* Incoming Call */}
      {incoming && !inCall && (
        <div style={styles.incomingBox}>
          <h3>📞 Incoming {callType} call...</h3>
          <button style={styles.button} onClick={acceptCall}>
            Accept
          </button>
          <button style={styles.rejectBtn} onClick={rejectCall}>
            Reject
          </button>
        </div>
      )}

      {/* In-Call UI */}
      {inCall && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          {callType === "video" && (
            <div style={styles.videoWrapper}>
              <video ref={localVideoRef} autoPlay muted style={styles.video} />
              <video ref={remoteVideoRef} autoPlay style={styles.video} />
            </div>
          )}

          <button style={styles.endCallBtn} onClick={endCall}>
            ⛔ End Call
          </button>
        </div>
      )}
    </>
  );
}

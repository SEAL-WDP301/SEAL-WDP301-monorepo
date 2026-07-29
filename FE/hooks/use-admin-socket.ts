import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/stores/auth.store";

interface UseAdminSocketOptions {
  eventId?: number | string;
  roundId?: number | string;
  teamId?: number | string;
  userId?: number | string | null;
}

export function useAdminSocket({ eventId, roundId, teamId, userId }: UseAdminSocketOptions = {}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // We get the base URL from env or fallback to localhost
    const rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
    const SOCKET_URL = rawUrl.replace(/\/api\/?$/, "");

    const socketInstance = io(`${SOCKET_URL}/admin-realtime`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });

    socketInstance.on("connect", () => {
      console.log("Admin socket connected:", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("Admin socket disconnected");
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Dynamically join rooms whenever socket is connected and room IDs resolve
  useEffect(() => {
    if (!socket || !isConnected) return;

    if (eventId) {
      socket.emit("joinEvent", { eventId: Number(eventId) });
    }
    if (roundId) {
      socket.emit("joinRound", { roundId: Number(roundId) });
    }
    if (teamId) {
      socket.emit("joinTeam", { teamId: Number(teamId) });
    }
    if (userId) {
      socket.emit("joinUser", { userId: Number(userId) });
    }
  }, [socket, isConnected, eventId, roundId, teamId, userId]);

  return { socket, isConnected };
}

"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/stores/auth.store";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "http://localhost:3000";

const socketInstances: Record<string, Socket> = {};

export const useSocket = (namespace: string = "") => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const url = namespace ? `${SOCKET_URL}${namespace.startsWith('/') ? namespace : `/${namespace}`}` : SOCKET_URL;

    if (!socketInstances[url]) {
      socketInstances[url] = io(url, {
        auth: (cb) => {
          cb({ token: useAuthStore.getState().accessToken });
        },
        transports: ["websocket"],
      });
    }

    socketRef.current = socketInstances[url];

    if (socketRef.current.connected) {
      setIsConnected(true);
    }
    
    socketRef.current.on("connect", () => setIsConnected(true));
    socketRef.current.on("disconnect", () => setIsConnected(false));

    const handleTokenRefresh = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.connect(); // Tự động lấy token mới nhờ hàm auth ở trên
      }
    };

    const handleAuthUnauthorized = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        delete socketInstances[url];
      }
    };

    window.addEventListener("token-refreshed", handleTokenRefresh);
    window.addEventListener("auth-unauthorized", handleAuthUnauthorized);

    return () => {
      window.removeEventListener("token-refreshed", handleTokenRefresh);
      window.removeEventListener("auth-unauthorized", handleAuthUnauthorized);
      
      // Do not disconnect the singleton socket on unmount, 
      // otherwise other components using it will lose connection.
      // We just clean up the local reference.
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [namespace]);

  return { socket: socketRef.current, isConnected };
};

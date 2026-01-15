import { useEffect, useRef, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

type WebSocketMessage = {
  type: string;
  [key: string]: unknown;
};

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error("Failed to parse WebSocket message", e);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error", error);
      };
    } catch (e) {
      console.error("Failed to connect to WebSocket", e);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case "MEMBER_ADDED":
      case "MEMBER_UPDATED":
      case "MEMBER_DELETED":
      case "STATUS_CHANGED":
        queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
        queryClient.invalidateQueries({ queryKey: ["/api/team-members/with-stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        break;
      case "SCREENSHOT_ADDED":
        queryClient.invalidateQueries({ queryKey: ["/api/screenshots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/screenshots/recent"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/timeline"] });
        break;
      case "ACTIVITY_LOGGED":
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/timeline"] });
        break;
      case "SETTINGS_UPDATED":
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        break;
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return wsRef.current;
}

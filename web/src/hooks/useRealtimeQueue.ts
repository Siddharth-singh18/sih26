import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBaseServerUrl } from '../lib/api';

export function useRealtimeQueue(doctorId?: string, facilityId?: string, onQueueUpdated?: () => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketServerUrl = getBaseServerUrl();

    // Connect to backend Socket.IO at root host with auto-reconnection
    const newSocket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: {
        token: localStorage.getItem('ayusync_token')
      }
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (doctorId) {
        newSocket.emit('join:doctor', doctorId);
      }
      if (facilityId) {
        newSocket.emit('join:facility', facilityId);
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for queue updates
    newSocket.on('queue.updated', () => {
      if (onQueueUpdated) {
        onQueueUpdated();
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [doctorId, facilityId]);

  return { isConnected, socket };
}


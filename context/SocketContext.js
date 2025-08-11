// frontend/context/SocketContext.js (Final Version)
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { jwtDecode } from 'jwt-decode';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [loggedInUser, setLoggedInUser] = useState(null);

    // Page load par user ka data (aur unread messages) fetch karein
    useEffect(() => {
        const token = localStorage.getItem('skill-token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                fetch(`https://skill-exchanger-backend-3.onrender.com/api/users/${decoded.id}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === 'success') {
                            setLoggedInUser(data.data.user);
                            // Database se mile unread counts ko state mein set karein
                            setUnreadCounts(data.data.user.unreadMessages || {});
                        }
                    });
            } catch (e) { console.error("Auth error in context", e); }
        }
    }, []);

    useEffect(() => {
        if (loggedInUser) {
            const newSocket = io('http://localhost:5000');
            setSocket(newSocket);
            newSocket.emit('addUser', loggedInUser._id);

            newSocket.on('new_message', (message) => {
                const currentChatPartnerId = window.location.pathname.split('/chat/')[1];
                if (message.senderId !== loggedInUser._id && message.senderId !== currentChatPartnerId) {
                    toast.success(`New message received!`, { icon: '📬' });
                    setUnreadCounts(prev => ({ ...prev, [message.senderId]: (prev[message.senderId] || 0) + 1 }));
                }
            });

            return () => newSocket.disconnect();
        }
    }, [loggedInUser]);

    const clearUnreadFrom = useCallback((senderId) => {
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[senderId];
            return newCounts;
        });
    }, []);
    
    useEffect(() => {
        const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
        if (totalUnread > 0) { document.title = `(${totalUnread}) Skill Exchanger`; } 
        else { document.title = "Skill Exchanger"; }
    }, [unreadCounts]);

    const value = useMemo(() => ({
        socket,
        unreadCounts,
        clearUnreadFrom,
    }), [socket, unreadCounts, clearUnreadFrom]);

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
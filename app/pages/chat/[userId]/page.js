'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { Send, ArrowLeft, Check, CheckCheck, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import { useSocket } from '@/context/SocketContext';

// --- Message Tick Component (No Change) ---
const MessageTick = ({ status }) => {
    if (status === 'seen') return <CheckCheck size={16} className="text-blue-400" />;
    if (status === 'delivered') return <CheckCheck size={16} className="text-gray-400" />;
    return <Check size={16} className="text-gray-400" />;
};

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatPartner, setChatPartner] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { socket, clearUnreadFrom } = useSocket();
  const router = useRouter();
  const params = useParams();
  const receiverId = params.userId;
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  // Data fetching aur user authentication
  useEffect(() => {
    const token = localStorage.getItem('skill-token');
    if (!token) {
      router.push('/pages/log_in');
      return;
    }
    try {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded);

      const fetchChatData = async () => {
        try {
          const userRes = await fetch(`https://skill-exchanger-backend-3.onrender.com/api/users/${receiverId}`);
          const userData = await userRes.json();
          if (userData.status === 'success') setChatPartner(userData.data.user);

          const msgRes = await fetch(`https://skill-exchanger-backend-3.onrender.com/api/chat/${receiverId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const msgData = await msgRes.json();
          if (msgData.status === 'success') setMessages(msgData.data.messages);
        } catch (error) {
          console.error("Data fetch error:", error);
        }
      };
      fetchChatData();
    } catch (error) {
      console.error("Token Error:", error);
      router.push('/pages/log_in');
    }
  }, [receiverId, router]);

  // Socket events ke liye
  useEffect(() => {
    if (!socket || !loggedInUser) return;

    clearUnreadFrom(receiverId);
    socket.emit('mark_messages_as_seen', { senderId: loggedInUser.id, receiverId });

    const handleNewMessage = (message) => {
      if (message.senderId === receiverId || message.senderId === loggedInUser.id) {
        setMessages((prev) => [...prev, message]);
        if (message.senderId === receiverId) {
          socket.emit('mark_messages_as_seen', { senderId: loggedInUser.id, receiverId });
        }
      }
    };
    const handleOnlineUsers = (onlineUsers) => {
      setIsPartnerOnline(onlineUsers.includes(receiverId));
    };
    const handleMessagesSeen = ({ conversationPartner }) => {
      if (conversationPartner === receiverId) {
        setMessages(prev => prev.map(msg => ({ ...msg, status: 'seen' })));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('get_online_users', handleOnlineUsers);
    socket.on('messages_seen', handleMessagesSeen);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('get_online_users', handleOnlineUsers);
      socket.off('messages_seen', handleMessagesSeen);
    };
  }, [socket, loggedInUser, receiverId, clearUnreadFrom]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !socket || !loggedInUser) return;
    const messageData = { senderId: loggedInUser.id, receiverId, content: newMessage };
    socket.emit('private_message', messageData);
    setNewMessage('');
    setShowEmojiPicker(false);
  };
  
  const onEmojiClick = (emojiObject) => {
    setNewMessage(prev => prev + emojiObject.emoji);
  };

  if (!chatPartner || !loggedInUser) {
    return <div className="flex justify-center items-center h-screen bg-gray-100 text-gray-500">Loading Chat...</div>;
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <motion.header
        className="bg-white p-4 border-b flex items-center shadow-sm sticky top-0 z-10"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.button onClick={() => router.back()} className="mr-3 p-2 rounded-full hover:bg-gray-100" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <ArrowLeft size={22} />
        </motion.button>
        
        {/* REMOVED: Avatar div yahan se hata diya gaya hai */}

        <div className="ml-0"> {/* Margin adjusted */}
            <h1 className="text-lg font-bold text-gray-800">{chatPartner.fullName}</h1>
            <p className={`text-xs font-semibold ${isPartnerOnline ? 'text-green-600' : 'text-gray-500'}`}>
                {isPartnerOnline ? 'Online' : 'Offline'}
            </p>
        </div>
      </motion.header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg._id}
              className={`flex items-end gap-2 ${msg.senderId === loggedInUser.id ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`max-w-md px-4 py-3 rounded-2xl shadow-sm ${msg.senderId === loggedInUser.id ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                  <span className={`text-xs opacity-75 ${msg.senderId === loggedInUser.id ? 'text-blue-100' : 'text-gray-500'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.senderId === loggedInUser.id && <MessageTick status={msg.status} />}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white p-3 border-t">
        <AnimatePresence>
            {showEmojiPicker && (
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 350 }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                >
                    <EmojiPicker onEmojiClick={onEmojiClick} height={350} width="100%" />
                </motion.div>
            )}
        </AnimatePresence>
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-500 hover:text-blue-600 rounded-full">
            <Smile size={22} />
          </button>
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 w-full px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <motion.button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-lg" disabled={!newMessage.trim()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Send size={20} />
          </motion.button>
        </form>
      </footer>
    </div>
  );
};

export default ChatPage;
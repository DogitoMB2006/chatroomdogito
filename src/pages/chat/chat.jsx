import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  orderBy,
  doc,
  getDoc
} from 'firebase/firestore';
import './chat.css';

const Chat = () => {
  const { friendUid } = useParams();
  const [user, loading] = useAuthState(auth);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [friendName, setFriendName] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user && friendUid) {
      const getFriendName = async () => {
        try {
          const friendDocRef = doc(db, 'users', friendUid);
          const friendDocSnap = await getDoc(friendDocRef);
          if (friendDocSnap.exists()) {
            setFriendName(friendDocSnap.data().username || 'Unknown');
          } else {
            setFriendName('Unknown');
          }
        } catch (error) {
          console.error('Error fetching friend name:', error);
          setFriendName('Unknown');
        }
      };

      getFriendName();

      const chatId = user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

      const chatQuery = query(
        collection(db, 'chats'),
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc')
      );
      const unsubscribe = onSnapshot(chatQuery, (querySnapshot) => {
        const messages = [];
        querySnapshot.forEach((doc) => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        setMessages(messages);
      });

      return () => unsubscribe();
    }
  }, [user, friendUid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (message.trim() === '') {
      return;
    }

    const chatId = user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

    try {
      await addDoc(collection(db, 'chats'), {
        chatId: chatId,
        users: [user.uid, friendUid],
        sender: user.uid,
        message: message.trim(),
        timestamp: new Date()
      });

      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again later.');
    }
  };

  const handleChangeMessage = (e) => {
    setMessage(e.target.value);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Chat with {friendName}</h2>
      </div>
      <div className="messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender === user.uid ? 'sent' : 'received'}`}>
            <p>{msg.message}</p>
            <span>{new Date(msg.timestamp?.toDate()).toLocaleString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="message-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={message}
          onChange={handleChangeMessage}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;

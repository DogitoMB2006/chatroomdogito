// chat.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { auth, db, storage } from '../../firebase'; // Adjust the path according to your file structure
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './chat.css';
import SettingsIcon from '@material-ui/icons/Settings';
import Modal from 'react-modal';

Modal.setAppElement('#root');

const Chat = () => {
  const { friendUid } = useParams();
  const [user, loading] = useAuthState(auth);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [friendName, setFriendName] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [newBackgroundImage, setNewBackgroundImage] = useState(null);
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

      const chatId =
        user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

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
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const getUserData = async () => {
        try {
          const userDocSnap = await getDoc(userRef);
          if (userDocSnap.exists()) {
            setBackgroundImage(userDocSnap.data().backgroundImage || null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };
      getUserData();
    }
  }, [user]);

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

    const chatId =
      user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

    try {
      await addDoc(collection(db, 'chats'), {
        chatId: chatId,
        users: [user.uid, friendUid],
        sender: user.uid,
        message: message.trim(),
        timestamp: new Date(),
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

  const openModal = () => {
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  const changeBackground = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    try {
      // Genera un nombre de archivo único usando el timestamp y el nombre original del archivo.
      const uniqueName = `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `chat-backgrounds/${uniqueName}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(uploadResult.ref);
      setNewBackgroundImage(imageUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    }
  };
  
  const saveChanges = async () => {
    if (!newBackgroundImage) return;
  
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { backgroundImage: newBackgroundImage });
      setBackgroundImage(newBackgroundImage);
      setNewBackgroundImage(null);
      closeModal();
      // No need to reload the whole window, React will update the component
    } catch (error) {
      console.error('Error updating background image:', error);
      alert('Failed to update background image. Please try again later.');
    }
  };
  

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="chat-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="chat-header">
        <h2>Chat with {friendName}</h2>
        <button className="settings-button" onClick={openModal}>
          <SettingsIcon />
        </button>
      </div>
      <div className="messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.sender === user.uid ? 'sent' : 'received'}`}
          >
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

      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Chat Settings"
        className="modal"
        overlayClassName="modal-overlay"
      >
        <h3>Chat Settings</h3>
        <input type="file" onChange={changeBackground} accept="image/*" />
        <button onClick={saveChanges}>Save Changes</button>
        <button className="close-button" onClick={closeModal}>Close</button>
      </Modal>
    </div>
  );
};

export default Chat;

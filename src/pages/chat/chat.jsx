import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../../firebase';
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
import Modal from 'react-modal';
import SettingsIcon from '@material-ui/icons/Settings';
import SendIcon from '@material-ui/icons/Send';
import GalleryIcon from '@material-ui/icons/PhotoLibrary';
import CancelIcon from '@material-ui/icons/Cancel';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

Modal.setAppElement('#root');

const Chat = () => {
  const { friendUid } = useParams();
  const navigate = useNavigate(); // Hook para navegación

  const [user, loading] = useAuthState(auth);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [friendName, setFriendName] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [newBackgroundImage, setNewBackgroundImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
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
    const chatId = user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;
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
    } catch (error) {
      console.error('Error updating background image:', error);
      alert('Failed to save changes. Please try again.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const uniqueName = `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `chat-images/${uniqueName}`);
      const uploadResult = await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(uploadResult.ref);

      const chatId =
        user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

      await addDoc(collection(db, 'chats'), {
        chatId: chatId,
        users: [user.uid, friendUid],
        sender: user.uid,
        imageUrl: imageUrl,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  return (
    <div className="chat-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="chat-header">
        <button className="icon-button" onClick={() => navigate('/home')}>
          <ArrowBackIcon />
        </button>
        <span>{friendName}</span>
        <button className="settings-button" onClick={openModal}><SettingsIcon /></button>
      </div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.sender === user.uid ? 'sent' : 'received'}`}
          >
            {msg.message && <p>{msg.message}</p>}
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="Chat Image"
                onClick={() => handleImageClick(msg.imageUrl)}
              />
            )}
            <span>{msg.sender === user.uid ? 'You' : friendName}</span>
            <span>{new Date(msg.timestamp?.toDate()).toLocaleString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="message-input">
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={handleChangeMessage}
        />
        <div className="icons">
          <button className="icon-button" onClick={openModal}>
            <GalleryIcon />
          </button>
          <button type="submit" className="icon-button">
            <SendIcon />
          </button>
        </div>
      </form>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Chat Settings"
        className="image-modal"
        overlayClassName="image-modal-overlay"
      >
        <div className="modal-content">
          <h2>Change Background Image</h2>
          <input type="file" onChange={changeBackground} />
          <button onClick={saveChanges} className="save-button">
            Save Changes
          </button>
          <button onClick={closeModal} className="close-button">
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Chat;

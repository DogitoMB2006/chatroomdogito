import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import SettingsIcon from '@material-ui/icons/Settings';
import Modal from 'react-modal';
import MicIcon from '@material-ui/icons/Mic';
import StopIcon from '@material-ui/icons/Stop';
import SendIcon from '@material-ui/icons/Send';
import GalleryIcon from '@material-ui/icons/PhotoLibrary';
import CancelIcon from '@material-ui/icons/Cancel'; // Nuevo icono para cancelar

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
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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
      alert('Failed to update background image. Please try again later.');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        audioChunksRef.current = [];
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendAudioMessage = async () => {
    if (!audioURL) return;

    try {
      const response = await fetch(audioURL);
      const audioBlob = await response.blob();
      const uniqueName = `${Date.now()}.wav`;
      const fileRef = ref(storage, `audio-messages/${uniqueName}`);
      await uploadBytes(fileRef, audioBlob);
      const audioUrl = await getDownloadURL(fileRef);

      const chatId =
        user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

      await addDoc(collection(db, 'chats'), {
        chatId: chatId,
        users: [user.uid, friendUid],
        sender: user.uid,
        audioUrl: audioUrl,
        timestamp: new Date(),
      });

      setAudioURL('');
    } catch (error) {
      console.error('Error sending audio message:', error);
      alert('Failed to send audio message. Please try again later.');
    }
  };

  const cancelAudioMessage = () => {
    setAudioURL('');
    audioChunksRef.current = [];
    setRecording(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const uniqueName = `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `chat-images/${uniqueName}`);
      await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(fileRef);

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
      alert('Failed to upload image. Please try again later.');
    }
  };

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
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
            {msg.message && <p>{msg.message}</p>}
            {msg.audioUrl && (
              <div className="voice-message">
                <audio controls src={msg.audioUrl}></audio>
              </div>
            )}
            {msg.imageUrl && (
              <div
                className="image-message"
                onClick={() => handleImageClick(msg.imageUrl)}
              >
                <img src={msg.imageUrl} alt="Sent by user" className="message-image" />
              </div>
            )}
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
        <label htmlFor="image-upload">
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <GalleryIcon className="gallery-icon" />
        </label>
        <button type="submit">Send</button>
      </form>
      <div className="audio-controls">
        {recording ? (
          <button onClick={stopRecording}>
            <StopIcon />
          </button>
        ) : (
          <button onClick={startRecording}>
            <MicIcon />
          </button>
        )}
        {audioURL && !recording && (
          <>
            <button onClick={sendAudioMessage}>
              <SendIcon />
            </button>
            <button onClick={cancelAudioMessage}>
              <CancelIcon />
            </button>
          </>
        )}
      </div>

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

      {selectedImage && (
        <div className="expanded-image-overlay" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Expanded" />
        </div>
      )}
    </div>
  );
};

export default Chat;


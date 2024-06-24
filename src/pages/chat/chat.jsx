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
import Modal from 'react-modal';
import SettingsIcon from '@material-ui/icons/Settings';
import MicIcon from '@material-ui/icons/Mic';
import StopIcon from '@material-ui/icons/Stop';
import SendIcon from '@material-ui/icons/Send';
import GalleryIcon from '@material-ui/icons/PhotoLibrary';
import CancelIcon from '@material-ui/icons/Cancel';

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

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Audio recording is not supported in this browser.');
      return;
    }
  
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
  
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
  
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const uniqueName = `${Date.now()}_audio.wav`;
        const fileRef = ref(storage, `audio-messages/${uniqueName}`);
        const uploadResult = await uploadBytes(fileRef, audioBlob);
        const audioUrl = await getDownloadURL(uploadResult.ref);
        setAudioURL(audioUrl);
      };
  
      mediaRecorderRef.current.start();
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

    const chatId =
      user.uid < friendUid ? `${user.uid}_${friendUid}` : `${friendUid}_${user.uid}`;

    try {
      await addDoc(collection(db, 'chats'), {
        chatId: chatId,
        users: [user.uid, friendUid],
        sender: user.uid,
        audioUrl: audioURL,
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
  };

  return (
    <div className="chat-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="chat-header">
        <h3>{friendName}</h3>
       
        <button className="settings-button" onClick={openModal}>
          <SettingsIcon />
        </button>
      </div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender === user.uid ? 'sent' : 'received'}`}>
            {msg.message && <p>{msg.message}</p>}
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="Sent Image"
                onClick={() => handleImageClick(msg.imageUrl)}
              />
            )}
            {msg.audioUrl && (
              <audio controls>
                <source src={msg.audioUrl} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="message-input">
        {audioURL ? (
          <div className="audio-preview">
            <audio controls>
              <source src={audioURL} type="audio/wav" />
              Your browser does not support the audio element.
            </audio>
            <button type="button" className="icon-button" onClick={cancelAudioMessage}>
              <CancelIcon />
            </button>
            <button type="button" className="icon-button" onClick={sendAudioMessage}>
              <SendIcon />
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={handleChangeMessage}
            />
            <div className="icons">
              <label htmlFor="image-upload" className="icon-button">
                <GalleryIcon />
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {recording ? (
                <button type="button" className="icon-button" onClick={stopRecording}>
                  <StopIcon />
                </button>
              ) : (
                <button type="button" className="icon-button" onClick={startRecording}>
                  <MicIcon />
                </button>
              )}
              <button type="submit" className="icon-button">
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </form>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Settings Modal"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Chat Settings</h2>
        <label htmlFor="background-upload" className="modal-button">
          Change Background
          <input
            id="background-upload"
            type="file"
            accept="image/*"
            onChange={changeBackground}
            style={{ display: 'none' }}
          />
        </label>
        <button className="modal-button" onClick={saveChanges}>
          Save Changes
        </button>
        <button className="modal-button" onClick={closeModal}>
          Close
        </button>
      </Modal>
      {selectedImage && (
        <div className="image-modal" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Selected" />
        </div>
      )}
    </div>
  );
};

export default Chat;

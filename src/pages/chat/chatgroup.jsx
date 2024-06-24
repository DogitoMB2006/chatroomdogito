import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { FaUserCircle, FaTrashAlt, FaCog } from 'react-icons/fa';
import { ArrowBack as ArrowBackIcon } from '@material-ui/icons'; 
import './chatgroup.css';
import Modal from 'react-modal';
import GroupSettingsModal from './GroupSettingsModal';

Modal.setAppElement('#root');

const ChatGroup = () => {
  const { groupId } = useParams();
  const [user] = useAuthState(auth);
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [usernames, setUsernames] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsernames = useCallback(async (members) => {
    const usernamesMap = {};
    for (const memberId of members) {
      const userDoc = await getDoc(doc(db, 'users', memberId));
      if (userDoc.exists()) {
        usernamesMap[memberId] = userDoc.data().username;
      }
    }
    setUsernames(usernamesMap);
  }, []);

  useEffect(() => {
    if (user) {
      const groupRef = doc(db, 'groups', groupId);

      const unsubscribeGroup = onSnapshot(groupRef, async (groupDoc) => {
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroup(groupData);
          setUserRole(groupData.memberRoles ? groupData.memberRoles[user.uid] : null);

          const members = groupData.members || [];
          await fetchUsernames(members);
        } else {
          console.log(`No group document found with groupId ${groupId}`);
        }
        setLoading(false);
      });

      const messagesQuery = query(
        collection(db, 'groups', groupId, 'messages'),
        where('groupId', '==', groupId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribeMessages = onSnapshot(messagesQuery, (querySnapshot) => {
        const msgs = [];
        querySnapshot.forEach((doc) => {
          msgs.push({ id: doc.id, ...doc.data() });
        });
        setMessages(msgs);
      });

      return () => {
        unsubscribeGroup();
        unsubscribeMessages();
      };
    }
  }, [user, groupId, fetchUsernames]);

  const handleSendMessage = async () => {
    if (newMessage.trim() !== '') {
      await addDoc(collection(db, 'groups', groupId, 'messages'), {
        groupId,
        text: newMessage,
        sender: user.uid,
        timestamp: new Date()
      });
      setNewMessage('');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    await deleteDoc(doc(db, 'groups', groupId, 'messages', messageId));
  };

  const openGroupSettings = () => {
    setModalIsOpen(true);
  };

  const closeGroupSettings = () => {
    setModalIsOpen(false);
  };

  const renderMessageActions = (message) => {
    const userRolePermissions = group?.roles?.[userRole]?.permissions;
    const canDelete = userRolePermissions?.canDeleteMessages || user.uid === group.createdBy;
    return canDelete ? (
      <FaTrashAlt onClick={() => handleDeleteMessage(message.id)} />
    ) : null;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleGoBack = () => {
    navigate('/home'); // Ajusta la ruta de regreso según sea necesario
  };

  if (!user) {
    navigate('/');
    return null;
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  const isGroupOwnerOrAdmin = user.uid === group?.createdBy || userRole === 'admin';

  return (
    <div className="chat-group-container" style={{ backgroundImage: `url(${group.photo})` }}>
      <div className="chat-group-header">
        <ArrowBackIcon onClick={handleGoBack} />
        <h2>{group?.name}</h2>
        {isGroupOwnerOrAdmin && (
          <FaCog onClick={openGroupSettings} />
        )}
      </div>
      <div className="chat-group-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender === user.uid ? 'sent' : 'received'}`}>
            <div className="message-header">
              <FaUserCircle />
              <span>{usernames[message.sender] || message.sender}</span>
              {renderMessageActions(message)}
            </div>
            <div className="message-body">
              <p>{message.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="chat-group-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message"
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeGroupSettings}
        contentLabel="Group Settings"
      >
        <GroupSettingsModal
          isOpen={modalIsOpen}
          onRequestClose={closeGroupSettings}
          groupId={groupId}
        />
      </Modal>
    </div>
  );
};

export default ChatGroup;

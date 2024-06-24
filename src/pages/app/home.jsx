import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { FaUserPlus, FaEnvelope, FaCheck, FaTimes, FaEdit, FaSignOutAlt, FaUsers } from 'react-icons/fa';
import Snackbar from '@mui/material/Snackbar';
import Grow from '@mui/material/Grow';
import './home.css';
import Modal from 'react-modal';
import CreateGroupModal from '../../pages/chat/CreateGroupModal';

const Home = () => {
  const [user, loading] = useAuthState(auth);
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendRequests, setFriendRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [lastLoaded, setLastLoaded] = useState(new Date());
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [activeTab, setActiveTab] = useState('chats'); // Estado para controlar la pestaña activa
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || user?.email);

  useEffect(() => {
    if (user) {
      const updateUserDisplayName = async () => {
        const userRef = doc(db, 'users', user.uid);
        const userSnapshot = await getDoc(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setDisplayName(userData.username || user.displayName || user.email);
        }
      };

      updateUserDisplayName();

      const reqQuery = query(collection(db, 'friendRequests'), where('to', '==', user.uid));
      const unsubscribeRequests = onSnapshot(reqQuery, (querySnapshot) => {
        const requests = [];
        querySnapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() });
        });
        setFriendRequests(requests);
      });

      const userRef = doc(db, 'users', user.uid);
      const unsubscribeUser = onSnapshot(userRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const friendList = await Promise.all(
            (userData.friends || []).slice(0, 10).map(async (friendUid) => { // Limit to 10 friends initially
              const friendDoc = await getDoc(doc(db, 'users', friendUid));
              return { uid: friendUid, username: friendDoc.data().username, profilePic: friendDoc.data().profilePic || 'https://st-anns.ca/wp-content/uploads/no-icon.png' };
            })
          );
          setFriends(friendList);
        }
      });

      const chatQuery = query(
        collection(db, 'chats'),
        where('users', 'array-contains', user.uid),
        limit(20) // Limit to 20 chats
      );

      const unsubscribeMessages = onSnapshot(chatQuery, (querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const messageData = change.doc.data();
            if (messageData.timestamp && messageData.timestamp.toDate() > lastLoaded) {
              if (messageData.sender !== user.uid) {
                const isRelevant = messageData.users.includes(user.uid);
                if (isRelevant) {
                  const senderDoc = doc(db, 'users', messageData.sender);
                  getDoc(senderDoc).then((docSnapshot) => {
                    if (docSnapshot.exists()) {
                      const senderData = docSnapshot.data();
                      const senderName = senderData.username || messageData.sender;
                      setNotifications((prevNotifications) => [
                        ...prevNotifications,
                        { 
                          id: change.doc.id, 
                          message: `${senderName} sent you a message: ${messageData.message || 'Check your DM\'s'}`, 
                          senderId: messageData.sender 
                        }
                      ]);
                    }
                  });
                }
              }
            }
          }
        });
      });

      const groupQuery = query(
        collection(db, 'groups'),
        where('members', 'array-contains', user.uid),
        limit(10) // Limit to 10 groups
      );

      const unsubscribeGroups = onSnapshot(groupQuery, (querySnapshot) => {
        const userGroups = [];
        querySnapshot.forEach((doc) => {
          userGroups.push({ id: doc.id, ...doc.data() });
        });
        setGroups(userGroups);
      });

      return () => {
        unsubscribeRequests();
        unsubscribeUser();
        unsubscribeMessages();
        unsubscribeGroups();
      };
    }
  }, [user, lastLoaded]);

  const handleAddFriend = async () => {
    console.log('Attempting to add friend with username:', friendUsername);
    if (friendUsername) {
      try {
        const q = query(collection(db, 'users'), where('username', '==', friendUsername), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const friendUid = querySnapshot.docs[0].id;
          await addDoc(collection(db, 'friendRequests'), {
            from: user.uid,
            fromUsername: user.displayName || user.email,
            to: friendUid,
            status: 'pending'
          });
          alert('Friend request sent!');
        } else {
          alert('User not found');
        }
      } catch (error) {
        console.error('Error adding friend:', error);
        alert('Failed to add friend. Please try again later.');
      }
    } else {
      alert('Please enter a username.');
    }
  };

  const handleAcceptRequest = async (request) => {
    try {
      const friendUid = request.from;
      const userDocRef = doc(db, 'users', user.uid);
      const friendDocRef = doc(db, 'users', friendUid);

      const userDocSnap = await getDoc(userDocRef);
      const friendDocSnap = await getDoc(friendDocRef);

      if (!userDocSnap.exists() || !friendDocSnap.exists()) {
        console.error('User or friend document does not exist.');
        return;
      }

      const userData = userDocSnap.data();
      const friendData = friendDocSnap.data();

      const updatedUserFriends = [...(userData.friends || []), friendUid];
      const updatedFriendFriends = [...(friendData.friends || []), user.uid];

      const batch = db.batch();
      batch.update(userDocRef, { friends: updatedUserFriends });
      batch.update(friendDocRef, { friends: updatedFriendFriends });
      batch.delete(doc(db, 'friendRequests', request.id));
      await batch.commit();

      alert('Friend request accepted');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Failed to accept friend request. Please try again later.');
    }
  };

  const handleRejectRequest = async (request) => {
    try {
      await deleteDoc(doc(db, 'friendRequests', request.id));
      setFriendRequests(friendRequests.filter((req) => req.id !== request.id));
      alert('Friend request rejected');
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      alert('Failed to reject friend request. Please try again later.');
    }
  };

  const handleSignOut = () => {
    auth.signOut().then(() => navigate('/'));
  };

  const handleNotificationClose = (id) => {
    setNotifications(notifications.filter((notification) => notification.id !== id));
  };

  const handleNotificationClick = (senderId) => {
    navigate(`/chat/${senderId}`);
  };

  const handleFriendClick = (friendUid) => {
    navigate(`/chat/${friendUid}`);
  };

  const openCreateGroupModal = () => {
    setShowCreateGroupModal(true);
  };

  const closeCreateGroupModal = () => {
    setShowCreateGroupModal(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h2>Welcome, {displayName}</h2>
        <div className="icons">
          <FaUserPlus onClick={() => setShowAddFriend(!showAddFriend)} />
          <FaEnvelope onClick={() => setShowRequests(!showRequests)} />
          <FaEdit onClick={() => navigate('/profile/edit')} />
          <FaUsers onClick={openCreateGroupModal} />
          <FaSignOutAlt onClick={handleSignOut} />
        </div>
      </div>

      {showAddFriend && (
        <div className="add-friend">
          <input
            type="text"
            placeholder="Enter username"
            value={friendUsername}
            onChange={(e) => setFriendUsername(e.target.value)}
          />
          <button onClick={handleAddFriend}>Add Friend</button>
        </div>
      )}

      {showRequests && (
        <div className="friend-requests">
          <h3>Friend Requests</h3>
          {friendRequests.length === 0 ? (
            <p>No friend requests.</p>
          ) : (
            friendRequests.map((request) => (
              <div key={request.id} className="friend-request">
                <p>{request.fromUsername} wants to be your friend.</p>
                <div className="friend-request-actions">
                  <FaCheck onClick={() => handleAcceptRequest(request)} />
                  <FaTimes onClick={() => handleRejectRequest(request)} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="tabs">
        <button className={activeTab === 'chats' ? 'active' : ''} onClick={() => setActiveTab('chats')}>Chats</button>
        <button className={activeTab === 'groups' ? 'active' : ''} onClick={() => setActiveTab('groups')}>Groups</button>
      </div>

      <div className="tab-content">
        {activeTab === 'chats' && (
          <div className="friend-list">
            {friends.length === 0 ? (
              <p>You have no friends added.</p>
            ) : (
              friends.map((friend) => (
                <div key={friend.uid} className="friend" onClick={() => handleFriendClick(friend.uid)}>
                  <img src={friend.profilePic} alt={`${friend.username}'s profile`} />
                  <p>{friend.username}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="group-list">
            {groups.length === 0 ? (
              <p>You are not in any groups.</p>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="group" onClick={() => navigate(`/group/${group.id}`)}>
                  <img src={group.profilePic || 'https://via.placeholder.com/50'} alt={`${group.name} group`} />
                  <p>{group.name}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          onClose={() => handleNotificationClose(notification.id)}
          TransitionComponent={Grow}
          autoHideDuration={4000}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <div
            className="notification-content"
            onClick={() => handleNotificationClick(notification.senderId)}
            style={{ cursor: 'pointer' }}
          >
            {notification.message}
          </div>
        </Snackbar>
      ))}

      <Modal
        isOpen={showCreateGroupModal}
        onRequestClose={closeCreateGroupModal}
        contentLabel="Create Group"
        className="modal"
        overlayClassName="modal-overlay"
      >
        <CreateGroupModal
          friends={friends}
          onClose={closeCreateGroupModal}
        />
      </Modal>
    </div>
  );
};

export default Home;


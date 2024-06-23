import React, { useState, useEffect } from 'react';
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
  deleteDoc
} from 'firebase/firestore';
import { FaUserPlus, FaEnvelope, FaCheck, FaTimes, FaEdit, FaSignOutAlt } from 'react-icons/fa';
import Snackbar from '@mui/material/Snackbar';
import Grow from '@mui/material/Grow';
import './home.css';

const Home = () => {
  const [user, loading] = useAuthState(auth);
  const [friends, setFriends] = useState([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendRequests, setFriendRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [lastLoaded, setLastLoaded] = useState(new Date());
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || user?.email); // Estado local para el nombre de usuario

  useEffect(() => {
    if (user) {
      // Función para actualizar el nombre de usuario en la página de inicio
      const updateUserDisplayName = async () => {
        const userRef = doc(db, 'users', user.uid);
        const userSnapshot = await getDoc(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.data();
          setDisplayName(userData.username || user.displayName || user.email);
        }
      };

      updateUserDisplayName(); // Llamar a la función al cargar el componente inicialmente

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
            (userData.friends || []).map(async (friendUid) => {
              const friendDoc = await getDoc(doc(db, 'users', friendUid));
              return { uid: friendUid, username: friendDoc.data().username, profilePic: friendDoc.data().profilePic || 'https://st-anns.ca/wp-content/uploads/no-icon.png' };
            })
          );
          setFriends(friendList);
        }
      });

      const chatQuery = query(
        collection(db, 'chats'),
        where('users', 'array-contains', user.uid)
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

      return () => {
        unsubscribeRequests();
        unsubscribeUser();
        unsubscribeMessages();
      };
    }
  }, [user, lastLoaded]);

  const handleAddFriend = async () => {
    console.log('Attempting to add friend with username:', friendUsername);
    if (friendUsername) {
      try {
        const q = query(collection(db, 'users'), where('username', '==', friendUsername));
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

      await Promise.all([
        updateDoc(userDocRef, { friends: updatedUserFriends }),
        updateDoc(friendDocRef, { friends: updatedFriendFriends })
      ]);

      await deleteDoc(doc(db, 'friendRequests', request.id));

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
        <h2>Welcome, {displayName}</h2> {/* Mostrar displayName actualizado dinámicamente */}
        <div className="icons">
          <FaUserPlus onClick={() => setShowAddFriend(!showAddFriend)} />
          <FaEnvelope onClick={() => setShowRequests(!showRequests)} />
          <FaEdit onClick={() => navigate('/profile/edit')} />
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
                  <FaTimes onClick={() =>                   handleRejectRequest(request)} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="friend-list">
        <h3>Friends</h3>
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
    </div>
  );
};

export default Home;


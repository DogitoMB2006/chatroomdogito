import React, { useState } from 'react';
import { auth, db } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { addDoc, collection, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './createGroupModal.css';

const CreateGroupModal = ({ friends, onClose }) => {
  const [user] = useAuthState(auth);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);

  const handleFriendSelect = (uid) => {
    setSelectedFriends((prevSelected) =>
      prevSelected.includes(uid)
        ? prevSelected.filter((id) => id !== uid)
        : [...prevSelected, uid]
    );
  };

  const handleCreateGroup = async () => {
    if (groupName && selectedFriends.length > 0) {
      try {
        const groupDoc = await addDoc(collection(db, 'groups'), {
          name: groupName,
          members: [user.uid, ...selectedFriends],
          createdBy: user.uid,
        });

        await Promise.all(
          [user.uid, ...selectedFriends].map(async (uid) => {
            const userDoc = doc(db, 'users', uid);
            await updateDoc(userDoc, {
              groups: arrayUnion(groupDoc.id),
            });
          })
        );

        toast.success('Group created successfully!');
        onClose();
      } catch (error) {
        console.error('Error creating group:', error);
        toast.error('Failed to create group. Please try again later.');
      }
    } else {
      toast.warn('Please enter a group name and select at least one friend.');
    }
  };

  const handleAddRole = async (userId, role) => {
    try {
      const userDoc = doc(db, 'users', userId);
      await updateDoc(userDoc, {
        roles: arrayUnion(role),
      });
      toast.success('Role added successfully!');
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Failed to add role. Please try again later.');
    }
  };

  const handleRemoveRole = async (userId, role) => {
    try {
      const userDoc = doc(db, 'users', userId);
      await updateDoc(userDoc, {
        roles: arrayRemove(role),
      });
      toast.success('Role removed successfully!');
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Failed to remove role. Please try again later.');
    }
  };

  const handleRemoveUserFromGroup = async (groupId, userId) => {
    try {
      const groupDoc = doc(db, 'groups', groupId);
      await updateDoc(groupDoc, {
        members: arrayRemove(userId),
      });

      const userDoc = doc(db, 'users', userId);
      await updateDoc(userDoc, {
        groups: arrayRemove(groupId),
      });

      toast.success('User removed from group successfully!');
    } catch (error) {
      console.error('Error removing user from group:', error);
      toast.error('Failed to remove user from group. Please try again later.');
    }
  };

  return (
    <div className="create-group-modal">
      <h2>Create Group</h2>
      <input
        type="text"
        placeholder="Group Name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      <div className="friend-selection">
        <h3>Select Friends</h3>
        {friends.map((friend) => (
          <div
            key={friend.uid}
            className={`friend ${selectedFriends.includes(friend.uid) ? 'selected' : ''}`}
            onClick={() => handleFriendSelect(friend.uid)}
          >
            <img src={friend.profilePic} alt={`${friend.username}'s profile`} />
            <p>{friend.username}</p>
          </div>
        ))}
      </div>
      <button onClick={handleCreateGroup}>Create Group</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default CreateGroupModal;

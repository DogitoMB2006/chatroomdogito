import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import './GroupSettingsModal.css';

Modal.setAppElement('#root');

const GroupSettingsModal = ({ isOpen, onRequestClose, groupId, onRoleUpdate }) => {
  const [user] = useAuthState(auth);
  const [groupData, setGroupData] = useState(null);
  const [roles, setRoles] = useState({});
  const [newRoleName, setNewRoleName] = useState('');
  const [permissions, setPermissions] = useState({
    canDeleteMessages: false,
    canChangePhoto: false,
  });
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [usernames, setUsernames] = useState({});
  const [view, setView] = useState('settings');
  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGroupData = async () => {
      const groupDocRef = doc(db, 'groups', groupId);
      const groupDocSnap = await getDoc(groupDocRef);
      if (groupDocSnap.exists()) {
        const data = groupDocSnap.data();
        setGroupData(data);
        setRoles(data.roles || {});
        const usernames = {};
        for (const memberId of data.members) {
          const userDocRef = doc(db, 'users', memberId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            usernames[memberId] = userDocSnap.data().username;
          }
        }
        setUsernames(usernames);
      }
    };
    
    const fetchFriends = async () => {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const friendList = await Promise.all(
          (userData.friends || []).map(async (friendUid) => {
            const friendDoc = await getDoc(doc(db, 'users', friendUid));
            return { uid: friendUid, username: friendDoc.data().username };
          })
        );
        setFriends(friendList);
      }
    };

    if (isOpen) {
      fetchGroupData();
      fetchFriends();
    }
  }, [isOpen, groupId, user]);

  const handleCreateRole = async () => {
    const newRoles = {
      ...roles,
      [newRoleName]: { permissions },
    };
    setRoles(newRoles);
    await updateDoc(doc(db, 'groups', groupId), { roles: newRoles });

  
    if (typeof onRoleUpdate === 'function') {
      onRoleUpdate(); 
    }
  };

  const handleAssignRole = async () => {
    const newMemberRoles = {
      ...groupData.memberRoles,
      [selectedUser]: selectedRole,
    };
    await updateDoc(doc(db, 'groups', groupId), { memberRoles: newMemberRoles });

    
    if (typeof onRoleUpdate === 'function') {
      onRoleUpdate();
    }
  };

  const handleRemoveRole = async (userId) => {
    const updatedMemberRoles = { ...groupData.memberRoles };
    delete updatedMemberRoles[userId];
    await updateDoc(doc(db, 'groups', groupId), { memberRoles: updatedMemberRoles });

    
    if (typeof onRoleUpdate === 'function') {
      onRoleUpdate(); 
    }
  };

  const handleDeleteRole = async (roleName) => {
    const updatedRoles = { ...roles };
    delete updatedRoles[roleName];
    const updatedMemberRoles = { ...groupData.memberRoles };
    for (const userId in updatedMemberRoles) {
      if (updatedMemberRoles[userId] === roleName) {
        delete updatedMemberRoles[userId];
      }
    }
    await updateDoc(doc(db, 'groups', groupId), {
      roles: updatedRoles,
      memberRoles: updatedMemberRoles,
    });
    setRoles(updatedRoles);
    setGroupData((prev) => ({
      ...prev,
      memberRoles: updatedMemberRoles,
    }));

   
    if (typeof onRoleUpdate === 'function') {
      onRoleUpdate();
    }
  };

  const handleAddMember = async (friendId) => {
    const updatedMembers = [...groupData.members, friendId];
    await updateDoc(doc(db, 'groups', groupId), { members: updatedMembers });
    setGroupData((prev) => ({
      ...prev,
      members: updatedMembers,
    }));
    const userDocRef = doc(db, 'users', friendId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const newUsernames = { ...usernames, [friendId]: userDocSnap.data().username };
      setUsernames(newUsernames);
    }

   
    if (typeof onRoleUpdate === 'function') {
      onRoleUpdate(); 
    }
  };

  const handleRemoveMember = async (userId) => {
    const updatedMembers = groupData.members.filter(member => member !== userId);
    await updateDoc(doc(db, 'groups', groupId), { members: updatedMembers });
    setGroupData((prev) => ({
      ...prev,
      members: updatedMembers,
    }));
    const newUsernames = { ...usernames };
    delete newUsernames[userId];
    setUsernames(newUsernames);
    if (userId === user.uid) navigate('/home');

   
    if (typeof onRoleUpdate === 'function') {
      onRoleUpdate(); 
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} className="modal" overlayClassName="overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Group Settings</h2>
          <button className="close-button" onClick={onRequestClose}>X</button>
        </div>
        <div className="modal-body">
          <div className="sidebar">
            <button onClick={() => setView('settings')}>Group Settings</button>
            <button onClick={() => setView('members')}>Group Members</button>
          </div>
          {view === 'settings' && (
            <div className="settings">
              <div>
                <h3>Create Role</h3>
                <input
                  type="text"
                  placeholder="Role Name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <div className="checkboxes">
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canDeleteMessages}
                      onChange={(e) => setPermissions({ ...permissions, canDeleteMessages: e.target.checked })}
                    />
                    Can Delete Messages
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canChangePhoto}
                      onChange={(e) => setPermissions({ ...permissions, canChangePhoto: e.target.checked })}
                    />
                    Can Change Photo
                  </label>
                </div>
                <button className="action-button" onClick={handleCreateRole}>Create Role</button>
              </div>
              <div>
                <h3>Assign Role</h3>
                <select className="select-user" onChange={(e) => setSelectedUser(e.target.value)}>
                  <option value="">Select User</option>
                  {Object.keys(usernames).map((userId) => (
                    <option key={userId} value={userId}>{usernames[userId]}</option>
                  ))}
                </select>
                <select className="select-role" onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="">Select Role</option>
                  {Object.keys(roles).map((roleName) => (
                    <option key={roleName} value={roleName}>{roleName}</option>
                  ))}
                </select>
                <button className="action-button" onClick={handleAssignRole}>Assign Role</button>
              </div>
              <div>
                <h3>Remove User Role</h3>
                <select className="select-user" onChange={(e) => setSelectedUser(e.target.value)}>
                  <option value="">Select User</option>
                  {Object.keys(groupData?.memberRoles || {}).map((userId) => (
                    <option key={userId} value={userId}>{usernames[userId]}</option>
))}
                </select>
                <button className="action-button" onClick={() => handleRemoveRole(selectedUser)}>Remove Role</button>
              </div>
              <div>
                <h3>Delete Role</h3>
                <select className="select-role" onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="">Select Role</option>
                  {Object.keys(roles).map((roleName) => (
                    <option key={roleName} value={roleName}>{roleName}</option>
                  ))}
                </select>
                <button className="action-button" onClick={() => handleDeleteRole(selectedRole)}>Delete Role</button>
              </div>
            </div>
          )}
          {view === 'members' && (
            <div className="members">
              <h3>Group Members</h3>
              <ul>
                {groupData?.members.map((memberId) => (
                  <li key={memberId}>
                    {usernames[memberId]} 
                    <button className="action-button" onClick={() => handleRemoveMember(memberId)}>Remove</button>
                  </li>
                ))}
              </ul>
              <h3>Add Members</h3>
              <select className="select-friend" onChange={(e) => setSelectedUser(e.target.value)}>
                <option value="">Select Friend</option>
                {friends.map((friend) => (
                  <option key={friend.uid} value={friend.uid}>{friend.username}</option>
                ))}
              </select>
              <button className="action-button" onClick={() => handleAddMember(selectedUser)}>Add Member</button>
            </div>
          )}
        </div>
        <button className="action-button" onClick={onRequestClose}>Close</button>
      </div>
    </Modal>
  );
};

export default GroupSettingsModal;

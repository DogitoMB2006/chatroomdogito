// src/components/EditProfile.jsx

import React, { useState } from 'react';
import { auth, db, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const EditProfile = () => {
  const [user] = useAuthState(auth);
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
  };

  const handleProfilePicChange = (e) => {
    if (e.target.files[0]) {
      setProfilePic(e.target.files[0]);
    }
  };

  const handleSaveChanges = async () => {
    if (user) {
      setLoading(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const updates = { username: username || user.displayName };

        if (profilePic) {
          const profilePicRef = ref(storage, `profilePics/${user.uid}`);
          await uploadBytes(profilePicRef, profilePic);
          const profilePicURL = await getDownloadURL(profilePicRef);
          updates.profilePic = profilePicURL;
        }

        await updateDoc(userDocRef, updates);
        alert('Profile updated successfully!');
        window.location.reload();
      } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="edit-profile-container">
      <h2>Edit Profile</h2>
      <input
        type="text"
        placeholder="Enter new username"
        value={username}
        onChange={handleUsernameChange}
      />
      <input type="file" accept="image/*" onChange={handleProfilePicChange} />
      <button onClick={handleSaveChanges} disabled={loading}>
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
};

export default EditProfile;

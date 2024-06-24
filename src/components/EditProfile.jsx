import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { TextField, Button, CircularProgress, Snackbar, Alert } from '@mui/material';

const EditProfile = () => {
  const [user] = useAuthState(auth);
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const navigate = useNavigate();

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
        // Verificar si el nombre de usuario ya está tomado
        const usernamesQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernamesSnapshot = await getDocs(usernamesQuery);
        if (!usernamesSnapshot.empty) {
          setNotification({ open: true, message: 'That name is already taken', severity: 'error' });
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const updates = { username: username || user.displayName };

        if (profilePic) {
          const profilePicRef = ref(storage, `profilePics/${user.uid}`);
          await uploadBytes(profilePicRef, profilePic);
          const profilePicURL = await getDownloadURL(profilePicRef);
          updates.profilePic = profilePicURL;
        }

        await updateDoc(userDocRef, updates);
        setNotification({ open: true, message: 'Profile updated successfully!', severity: 'success' });
        navigate('/home');
      } catch (error) {
        console.error('Error updating profile:', error);
        setNotification({ open: true, message: 'Failed to update profile. Please try again later.', severity: 'error' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <div className="edit-profile-container">
      <h2>Edit Profile</h2>
      <TextField
        label="Enter new username"
        value={username}
        onChange={handleUsernameChange}
        fullWidth
        margin="normal"
      />
      <input type="file" accept="image/*" onChange={handleProfilePicChange} />
      <Button
        variant="contained"
        color="primary"
        onClick={handleSaveChanges}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} /> : 'Save Changes'}
      </Button>
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default EditProfile;

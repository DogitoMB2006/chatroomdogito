import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { setDoc, doc, getDocs, query, collection, where } from 'firebase/firestore';
import { TextField, Button, Snackbar, Alert } from '@mui/material';
import './register.css';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const navigate = useNavigate();

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      // Verificar si el nombre de usuario ya está tomado
      const usernamesQuery = query(collection(db, 'users'), where('username', '==', name));
      const usernamesSnapshot = await getDocs(usernamesQuery);
      if (!usernamesSnapshot.empty) {
        setNotification({ open: true, message: 'That name is already taken', severity: 'error' });
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(auth.currentUser, { displayName: name });
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        username: name,
        email: userCredential.user.email,
        friends: [],
        friendRequests: []
      });
      navigate('/home');
    } catch (error) {
      setNotification({ open: true, message: error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Register</h2>
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              className="custom-textfield"
            />
          </div>
          <div className="form-group">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              className="custom-textfield"
            />
          </div>
          <div className="form-group">
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              className="custom-textfield"
            />
          </div>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            fullWidth
            className="login-button"
          >
            {loading ? 'Registering...' : 'Register'}
          </Button>
        </form>
        <div className="signup-link">
          <p>Already have an account? <a href="/">Login here</a></p>
        </div>
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
    </div>
  );
};

export default Register;

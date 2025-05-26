import Navbar from './components/Navbar.jsx';
import {Routes, Route, Navigate} from "react-router-dom";
import { HomePage } from './pages/HomePage.jsx';
import { SingUpPage } from './pages/SingUpPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { useAuthStore } from './store/useAuthStore.js';
import { useEffect } from 'react';
import { Loader } from "lucide-react";
import { Toaster } from 'react-hot-toast';

const App = () => {
  const {authUser, checkAuth, isCheckingAuth} = useAuthStore();

  useEffect(() => {
    checkAuth();
  },[checkAuth]);

  if(isCheckingAuth && !authUser) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage/> : <Navigate to="/login" />}/>
        <Route path="/signup" element={!authUser ? <SingUpPage/> : <Navigate to="/" />}/>
        <Route path="/login" element={!authUser ? <LoginPage/> : <Navigate to="/" />}/>
        <Route path="/profile" element={authUser ? <ProfilePage/> : <Navigate to="/login" />}/>
      </Routes>

      <Toaster></Toaster>
    </div>
  )
}
export default App;
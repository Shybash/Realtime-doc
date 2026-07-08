import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true initially
  const [firebaseReady, setFirebaseReady] = useState(false);

  const api = axios.create({
    baseURL: import.meta.env.VITE_AUTH_URL
      ? `${import.meta.env.VITE_AUTH_URL}/api`
      : "http://localhost:8080/api",
    withCredentials: true,
  });
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseReady(true);
      if (firebaseUser) {
        try {
          const res = await api.get("/auth/protected");
          setUser(res.data);
        } catch (err) {
          console.error("Protected route failed", err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const emailLogin = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const idToken = await userCredential.user.getIdToken();

    await api.post("/auth/login", { idToken });

    const res = await api.get("/auth/protected");
    setUser(res.data);
  };

  const register = async (name, email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const idToken = await userCredential.user.getIdToken();

      await api.post("/auth/login", { idToken });

      const res = await api.get("/auth/protected");
      setUser(res.data);
    } catch (err) {
      // Optionally, show a specific error message here
      throw err; // Ensure error is thrown so Register.jsx can handle it
    }
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, emailLogin, register, logout, loading }}
    >
      {!loading ? children : <div>Loading...</div>}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

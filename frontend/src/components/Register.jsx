import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from 'react-hot-toast';
import { getFriendlyErrorMessage } from "../utils/firebaseErrors";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return (
      password.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return toast.error("All fields required");
    if (!validatePassword(password)) {
      return toast.error(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      );
    }
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success("Account created successfully!");
      navigate("/documents");
    } catch (err) {
      const friendlyMsg = getFriendlyErrorMessage(err);
      toast.error(friendlyMsg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Decorative Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/30 dark:bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/30 dark:bg-blue-900/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-4 z-10"
      >
        <div className="glass-card dark:bg-slate-900/85 dark:border-slate-800/80 p-8 md:p-10 transition-colors">
          <div className="text-center mb-8">
             <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-600/30 mx-auto mb-4">
              C
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Create an account</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Join CollabDocs and start collaborating</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                required
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Must be at least 8 characters with upper/lowercase, number, and special character.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98] flex justify-center items-center mt-6"
            >
              {loading ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Create Account"
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <span
              className="text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors"
              onClick={() => navigate('/login')}
            >
              Sign in
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;

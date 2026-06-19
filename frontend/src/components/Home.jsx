import React from "react";
import { useAuth } from "./AuthContext"; 
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Users, Zap, Shield } from "lucide-react";

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 dark:bg-blue-900/10 blur-[120px] mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 dark:bg-indigo-900/10 blur-[120px] mix-blend-multiply pointer-events-none" />
      
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex justify-between items-center max-w-7xl mx-auto z-20 relative">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
            C
          </div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">CollabDocs</span>
        </div>
        <div>
          {user ? (
             <Link
              to="/documents"
              className="inline-block px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md"
            >
              Dashboard
            </Link>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-block px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-md shadow-slate-900/20"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </nav>
 
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 z-10 relative mt-[-4rem]">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-450 text-sm font-medium mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
            Real-time Collaboration Engine v2.0
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
            Write better, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">together.</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create, edit, and share beautiful documents in real-time. Experience seamless collaboration with your team in a powerful, distraction-free environment.
          </motion.p>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Link
              to={user ? "/documents" : "/register"}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center group"
            >
              {user ? "Open Workspace" : "Start for free"}
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            {!user && (
               <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-305 font-semibold rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-md transition-all active:scale-95 text-center inline-block"
              >
                View demo
              </Link>
            )}
          </motion.div>
        </motion.div>
 
        {/* Feature Grid */}
        <motion.div 
           initial={{ opacity: 0, y: 40 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.8, duration: 0.8 }}
           className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-24"
        >
          <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-lg p-6 rounded-2xl border border-white/40 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Lightning Fast</h3>
            <p className="text-slate-600 dark:text-slate-400">Changes sync instantly across all devices. Never worry about losing your work or resolving conflicts.</p>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-lg p-6 rounded-2xl border border-white/40 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Multiplayer</h3>
            <p className="text-slate-600 dark:text-slate-400">See exactly who is editing what. Live cursors and presence indicators make remote work feel local.</p>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-lg p-6 rounded-2xl border border-white/40 dark:border-slate-800/60 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Secure</h3>
            <p className="text-slate-600 dark:text-slate-400">Your data is yours. Granular permissions, role-based access control, and enterprise-grade security.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Home;

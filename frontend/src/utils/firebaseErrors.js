/**
 * Maps Firebase Auth SDK error codes to user-friendly messages.
 * This prevents raw developer-facing error strings (like "Firebase: Error (auth/invalid-credential)")
 * from being shown directly to users.
 */
export const getFriendlyErrorMessage = (err) => {
  if (!err) return "An unexpected error occurred.";
  
  // Extract code from Firebase error object
  const code = err.code || (err.message && err.message.includes("auth/") ? 
    err.message.match(/auth\/[a-zA-Z0-9-]+/)?.[0] : null);

  switch (code) {
    case "auth/invalid-credential":
      return "Incorrect email or password. If you don't have an account yet, please click 'Create one now' to sign up.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/user-not-found":
      return "No account found with this email. Please register first.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in instead.";
    case "auth/weak-password":
      return "Password is too weak. Please use a password with at least 8 characters.";
    case "auth/operation-not-allowed":
      return "Sign-in method is disabled. Please enable Email/Password login in the Firebase Console under Authentication > Sign-in method.";
    case "auth/too-many-requests":
      return "Access to this account has been temporarily disabled due to many failed login attempts. You can restore it immediately by resetting your password, or try again later.";
    default:
      // Strip "Firebase:" prefix if it exists to make default error cleaner
      return err.message ? err.message.replace(/^Firebase:\s*(Error\s*)?\(?\/?\s*/, "").replace(/\)?\.?$/, "") : "Authentication failed.";
  }
};

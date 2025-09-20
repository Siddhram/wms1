"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { emailService } from '@/lib/email-service';
import { loginAttemptService } from '@/lib/login-attempts';
import { validatePassword } from '@/lib/password-validator';

type UserRole = "maker" | "checker" | "admin" | null;

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (username: string, email: string, password: string, role: UserRole) => Promise<void>;
  login: (username: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const register = async (username: string, email: string, password: string, role: UserRole) => {
    try {
      // Validate password using the new validation system
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        const failedRules = Object.entries(passwordValidation.rules)
          .filter(([_, rule]) => !rule.passed && rule.required)
          .map(([_, rule]) => rule.label);
        
        throw new Error(`Password validation failed: ${failedRules.join(', ')}`);
      }

      // Check if username is already taken
      const usernameQuery = query(
        collection(db, 'users'),
        where('username', '==', username)
      );
      const usernameSnapshot = await getDocs(usernameQuery);
      
      if (!usernameSnapshot.empty) {
        throw new Error("Username is already taken");
      }

      // Check if email is already registered
      const emailQuery = query(
        collection(db, 'users'),
        where('email', '==', email)
      );
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        throw new Error("Email ID already used, please try to register with new email ID");
      }

      // Create new user document
      const userRef = doc(collection(db, 'users'));
      const newUser: User = {
        id: userRef.id,
        username,
        email,
        role,
        createdAt: new Date().toISOString(),
        isVerified: false
      };

      await setDoc(userRef, newUser);
      
      // Send admin notification for verification
      try {
        const { adminNotificationService } = await import('@/lib/admin-notification-service');
        await adminNotificationService.sendAdminNotification({
          userId: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role || 'maker',
          registrationTime: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          })
        });
        console.log('Admin notification sent for user verification');
      } catch (adminEmailError) {
        console.error('Failed to send admin notification:', adminEmailError);
        // Don't throw error, registration should still succeed
      }
      
      // Don't automatically login unverified users
      // Registration success popup will handle the flow
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  const login = async (username: string, email: string, password: string): Promise<User> => {
    try {
      // Get user's IP address for attempt tracking
      let ipAddress: string | undefined;
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (ipError) {
        console.warn('Could not get IP address:', ipError);
      }

      // Check if user is currently blocked
      const blockCheck = loginAttemptService.checkIfBlocked(username, ipAddress);
      if (blockCheck.isBlocked) {
        throw new Error(blockCheck.message);
      }

      // For demo purposes, allow login with any username if it exists
      // In production, you'd want to implement proper password hashing and verification
      const userQuery = query(
        collection(db, 'users'),
        where('username', '==', username)
      );
      const userSnapshot = await getDocs(userQuery);
      
      let userData: User;
      
      if (userSnapshot.empty) {
        // Create a demo user if username doesn't exist
        const userRef = doc(collection(db, 'users'));
        // Determine if this should be an admin user based on username or email
        const isAdminUser = username.toLowerCase().includes('admin') || 
                           email.toLowerCase().includes('admin');
        
        userData = {
          id: userRef.id,
          username,
          email: email || `${username}@demo.com`,
          role: isAdminUser ? "admin" : "maker",
          createdAt: new Date().toISOString(),
          isVerified: true  // Demo users are auto-verified for testing
        };
        await setDoc(userRef, userData);
      } else {
        userData = userSnapshot.docs[0].data() as User;
      }
      
      // Check if user is verified by admin (skip verification for admin users)
      if (!userData.isVerified && userData.role !== 'admin') {
        throw new Error("Your account is pending admin verification. You will be notified via email once approved. Please contact admin if you have been waiting for more than 24 hours.");
      }
      
      // Record successful login attempt
      loginAttemptService.recordSuccessfulAttempt(username, ipAddress);
      
      // Store user in local storage
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      // Send login notification email
      try {
        await emailService.sendLoginNotification({
          username: userData.username,
          email: userData.email,
          role: userData.role || 'maker',
          loginTime: new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          }),
          ipAddress
        });
        console.log('Login notification email sent successfully');
      } catch (emailError) {
        console.error('Failed to send login notification email:', emailError);
        // Don't throw error, just log it - login should still succeed
      }
      
      router.push("/dashboard");
      return userData;
    } catch (error) {
      console.error("Login error:", error);
      
      // Record failed login attempt
      try {
        let ipAddress: string | undefined;
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          ipAddress = ipData.ip;
        } catch (ipError) {
          console.warn('Could not get IP address:', ipError);
        }
        
        const attemptResult = loginAttemptService.recordFailedAttempt(username, ipAddress);
        
        // If user is blocked, throw the block message
        if (attemptResult.isBlocked) {
          throw new Error(attemptResult.message);
        }
        
        // If not blocked, throw the remaining attempts message
        throw new Error(attemptResult.message);
      } catch (attemptError) {
        // Re-throw the attempt error (which includes block status)
        throw attemptError;
      }
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('user');
      setUser(null);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
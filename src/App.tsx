import React, { useState, useEffect } from 'react';
import { supabase, checkSupabaseConnection } from './lib/supabase';
import { User, Bug, BugStatus, AppConfig } from './types';
import { parseBugMetadata, stringifyBugMetadata } from './utils/metadata';
import AuthModal from './components/AuthModal';
import BugForm from './components/BugForm';
import BugCard from './components/BugCard';
import DbGuideModal from './components/DbGuideModal';
import { 
  Bug as BugIcon, 
  Database, 
  Settings, 
  LogOut, 
  Chrome, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Search, 
  SlidersHorizontal,
  ChevronDown,
  Github,
  Cloud,
  User as UserIcon,
  Plus,
  X
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [filter, setFilter] = useState<BugStatus | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  
  // Profile edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [profileUpdateError, setProfileUpdateError] = useState<string | null>(null);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState('');
  
  // Database status and configuration states
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [tablesExist, setTablesExist] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbGuideOpen, setDbGuideOpen] = useState(false);
  const [isCloudinaryConnected, setIsCloudinaryConnected] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<{name: string, google_email: string, avatar_url: string} | null>(null);
  
  // App Config Settings Panel
  const [showConfig, setShowConfig] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>({
    supabaseUrl: 'https://ekhtfzpkyjrvewrhcbor.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraHRmenBreWpydmV3cmhjYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjM0ODUsImV4cCI6MjA5OTY5OTQ4NX0.qLeyzHMgnw1PkOek-XQgyTfWj_RHmVszV-nqY-A1FLQ',
    cloudinaryCloudName: 'dlnyyzwvx',
    cloudinaryApiKey: '633679995456178',
    cloudinaryApiSecret: 'BMHCHGPN1zDW9oQrUc0V9hvzVw4'
  });

  // Load server-side defaults on initialization
  useEffect(() => {
    async function fetchServerConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const serverConfig = await res.json();
          setAppConfig((prev) => ({
            ...prev,
            supabaseUrl: serverConfig.supabaseUrl || prev.supabaseUrl,
            supabaseAnonKey: serverConfig.supabaseAnonKey || prev.supabaseAnonKey,
            cloudinaryCloudName: serverConfig.cloudinaryCloudName || prev.cloudinaryCloudName,
            cloudinaryApiKey: serverConfig.cloudinaryApiKey || prev.cloudinaryApiKey,
          }));
          setIsCloudinaryConnected(!!serverConfig.cloudinaryConnected);
          
          // Also immediately sync Supabase verification status to client-side state
          if (serverConfig.supabaseConnected !== undefined) {
            setIsSupabaseConnected(!!serverConfig.supabaseConnected);
            setTablesExist(!!serverConfig.tablesExist);
            if (!serverConfig.supabaseConnected || !serverConfig.tablesExist) {
              setDbError(serverConfig.dbError || 'Cần cấu hình các bảng trong Supabase SQL Editor.');
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load server configurations, using standard hardcoded defaults", err);
      }
    }
    fetchServerConfig();
  }, []);

  // Check Supabase connection and tables status
  const verifyDatabase = async () => {
    setCheckingDb(true);
    setDbError(null);
    try {
      // First try fetching config from our backend (which contains server-side verification)
      const resConfig = await fetch('/api/config');
      if (resConfig.ok) {
        const configData = await resConfig.json();
        setIsSupabaseConnected(configData.supabaseConnected);
        setTablesExist(configData.tablesExist);
        if (!configData.supabaseConnected || !configData.tablesExist) {
          setDbError(configData.dbError || 'Cần cấu hình các bảng trong Supabase SQL Editor.');
        }
        return;
      }
      
      // Fallback to client-side direct request if backend API is not responding
      const res = await checkSupabaseConnection();
      setIsSupabaseConnected(res.connected);
      setTablesExist(res.tablesExist);
      if (!res.connected || !res.tablesExist) {
        setDbError(res.error || 'Cần cấu hình các bảng trong Supabase SQL Editor.');
      }
    } catch (err: any) {
      setIsSupabaseConnected(false);
      setTablesExist(false);
      setDbError(err.message || 'Lỗi kiểm tra kết nối.');
    } finally {
      setCheckingDb(false);
    }
  };

  useEffect(() => {
    verifyDatabase();
  }, [appConfig.supabaseUrl]);

  // Automatically sync currentUser changes to localStorage
  useEffect(() => {
    if (currentUser) {
      let currentToken = '';
      try {
        const savedSession = localStorage.getItem('bugstream_user_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          currentToken = parsed.token || '';
        }
      } catch (e) {}

      // If no token exists yet (e.g. fresh Google OAuth redirect login), we'll keep what we have or generate a new one
      if (!currentToken && currentUser.session_token) {
        currentToken = currentUser.session_token;
      } else if (!currentToken) {
        currentToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }

      localStorage.setItem('bugstream_user_session', JSON.stringify({
        user: currentUser,
        timestamp: Date.now(),
        token: currentToken
      }));
    }
  }, [currentUser]);

  // Check and restore user session from localStorage on mount (valid for 1 hour)
  // Also check database to verify that this session's current token is still the active one (Single Session)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedSession = localStorage.getItem('bugstream_user_session');
        if (savedSession) {
          const { user, timestamp, token } = JSON.parse(savedSession);
          if (Date.now() - timestamp < 3600000) { // 1 hour in ms
            // Verify session token against Database
            if (isSupabaseConnected && tablesExist && user?.id) {
              const { data: dbUser, error } = await supabase
                .from('users')
                .select('session_token')
                .eq('id', user.id)
                .maybeSingle();

              if (!error && dbUser) {
                // If DB session_token exists and doesn't match this tab's token, force log out
                if (dbUser.session_token && dbUser.session_token !== token) {
                  alert("Tài khoản của bạn đã được đăng nhập ở nơi khác. Bạn sẽ bị đăng xuất.");
                  handleLogout();
                  return;
                }
              }
            }
            setCurrentUser(user);
          } else {
            localStorage.removeItem('bugstream_user_session');
          }
        }
      } catch (e) {
        console.warn("Failed to parse saved session", e);
      }
    };
    restoreSession();
  }, [isSupabaseConnected, tablesExist]);

  // Periodic active session validator (Single Sign On monitor every 15 seconds)
  useEffect(() => {
    if (!currentUser || !isSupabaseConnected || !tablesExist) return;

    const interval = setInterval(async () => {
      try {
        const savedSession = localStorage.getItem('bugstream_user_session');
        if (savedSession) {
          const { token } = JSON.parse(savedSession);
          const { data: dbUser, error } = await supabase
            .from('users')
            .select('session_token')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (!error && dbUser && dbUser.session_token && dbUser.session_token !== token) {
            alert("Tài khoản của bạn đã được đăng nhập ở một thiết bị hoặc trình duyệt khác.");
            handleLogout();
          }
        }
      } catch (e) {
        console.error("Session sync check failed", e);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [currentUser, isSupabaseConnected, tablesExist]);

  // Session time left calculator
  useEffect(() => {
    if (!currentUser || !showProfile) return;

    const updateTimeLeft = () => {
      const savedSession = localStorage.getItem('bugstream_user_session');
      if (savedSession) {
        try {
          const { timestamp } = JSON.parse(savedSession);
          const expTime = timestamp + 1 * 60 * 60 * 1000;
          const diff = expTime - Date.now();
          if (diff <= 0) {
            setSessionTimeLeft('Hết hạn');
            handleLogout();
          } else {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setSessionTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
          }
        } catch (e) {
          setSessionTimeLeft('N/A');
        }
      } else {
        setSessionTimeLeft('N/A');
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [currentUser, showProfile]);

  // Fetch Bugs from Supabase
  const fetchBugs = async () => {
    try {
      // Fetch bugs and join with users to get the name
      const { data: bugsData, error } = await supabase
        .from('bugs')
        .select(`
          id,
          description,
          status,
          timestamp,
          image,
          user_id,
          users (
            name
          )
        `)
        .order('timestamp', { ascending: false });


      if (error) throw error;

      if (bugsData) {
        const mappedBugs: Bug[] = bugsData.map((item: any) => {
          const { cleanDescription, metadata } = parseBugMetadata(item.description);
          return {
            id: item.id,
            description: item.description, // keep raw description to avoid data loss
            status: item.status as BugStatus,
            timestamp: item.timestamp,
            image: item.image || [],
            user_id: item.user_id,
            user_name: item.users?.name || 'Vô danh',
            resolved_hours: metadata.resolved_hours,
            recheck_reason: metadata.recheck_reason,
            priority: metadata.priority,
            history: metadata.history
          };
        });

        // Check for auto-closing resolved bugs after 2 days
        const now = new Date();
        const autoClosedBugs = mappedBugs.map(async (bug) => {
          if (bug.status === 'Resolved') {
            // Find the latest transition to Resolved in history
            const resolvedLog = bug.history
              ?.filter(log => log.to_status === 'Resolved')
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            
            const resolvedTime = resolvedLog ? new Date(resolvedLog.timestamp) : new Date(bug.timestamp);
            const diffTime = Math.abs(now.getTime() - resolvedTime.getTime());
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            if (diffDays >= 2) {
              // Construct new history log
              const updatedHistory = [...(bug.history || [])];
              const newLog = {
                timestamp: now.toISOString(),
                from_status: 'Resolved',
                to_status: 'Closed',
                user_name: 'Hệ thống',
                recheck_reason: 'Tự động đóng case sau 2 ngày hoàn tất'
              };
              updatedHistory.push(newLog);

              const { cleanDescription, metadata } = parseBugMetadata(bug.description);
              const mergedMetadata = {
                ...metadata,
                history: updatedHistory
              };
              const updatedDescription = stringifyBugMetadata(cleanDescription, mergedMetadata);

              try {
                await supabase
                  .from('bugs')
                  .update({
                    status: 'Closed',
                    description: updatedDescription
                  })
                  .eq('id', bug.id);
                
                // Update the local representation
                bug.status = 'Closed';
                bug.description = updatedDescription;
                bug.history = updatedHistory;
              } catch (e) {
                console.error("Auto-close failed for bug ID:", bug.id, e);
              }
            }
          }
        });

        // Wait for any DB auto-closes to resolve
        await Promise.all(autoClosedBugs);

        setBugs(mappedBugs);
      }
    } catch (err) {
      console.error("Failed to fetch bugs from Supabase:", err);
      // Suppress setting empty bugs to allow retries during async settings initialization
    }
  };

  useEffect(() => {
    fetchBugs();
  }, [isSupabaseConnected, tablesExist]);

  // Lock body scroll when modals/popups are active to restrict scrolling to the popup only
  useEffect(() => {
    const isModalOpen = showBugModal || dbGuideOpen || showConfig || (pendingGoogleProfile !== null) || (!currentUser && !pendingGoogleProfile);
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showBugModal, dbGuideOpen, showConfig, pendingGoogleProfile, currentUser]);

  // Check Supabase Auth redirect session on mount (for Google OAuth login/linking)
  useEffect(() => {
    const checkOAuthSession = async () => {
      // If client state hasn't resolved config details yet, fetch from config API first
      let activeDb = isSupabaseConnected && tablesExist;
      if (!activeDb) {
        try {
          const resConfig = await fetch('/api/config');
          if (resConfig.ok) {
            const configData = await resConfig.json();
            activeDb = !!configData.supabaseConnected && !!configData.tablesExist;
          }
        } catch (e) {
          console.warn("Failed to check status pre-session", e);
        }
      }

      if (!activeDb) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const googleEmail = session.user.email;
          const fullName = session.user.user_metadata.full_name || 'Google User';
          const avatarUrl = session.user.user_metadata.avatar_url;

          if (!googleEmail) return;

          // Sign out from Supabase Auth first so we don't carry a restricted RLS token context during update
          await supabase.auth.signOut();

          // Check if we are in linking mode (have a logged in user in memory state)
          if (currentUser) {
            const localUser = currentUser;
            if (localUser && (!localUser.google_email || localUser.google_email !== googleEmail)) {
              // Determine role based on email if linking
              const emailLower = googleEmail.toLowerCase().trim();
              let determinedRole = localUser.role || 'reporter';
              if (emailLower === 'thanhhoangcloud@gmail.com') {
                determinedRole = 'fixer';
              } else if (emailLower === 'cuongdt@thanhhoang.vn') {
                determinedRole = 'approver';
              }

              // Update custom users table
              const { error } = await supabase
                .from('users')
                .update({ 
                  google_email: googleEmail,
                  role: determinedRole
                })
                .eq('id', localUser.id);
              
              if (!error) {
                const updated = { ...localUser, google_email: googleEmail, role: determinedRole };
                setCurrentUser(updated);
                alert(`Đã liên kết tài khoản Google: ${googleEmail} (Vai trò: ${determinedRole})`);
              } else {
                console.error("Failed to link Google in database:", error);
                alert("Lỗi lưu liên kết Google vào DB: " + error.message);
              }
            } else if (localUser && localUser.google_email === googleEmail) {
              // Check and update role if it does not match
              const emailLower = googleEmail.toLowerCase().trim();
              let determinedRole = localUser.role || 'reporter';
              if (emailLower === 'thanhhoangcloud@gmail.com') {
                determinedRole = 'fixer';
              } else if (emailLower === 'cuongdt@thanhhoang.vn') {
                determinedRole = 'approver';
              }

              if (localUser.role !== determinedRole) {
                await supabase.from('users').update({ role: determinedRole }).eq('id', localUser.id);
                const updated = { ...localUser, role: determinedRole };
                setCurrentUser(updated);
              } else {
                setCurrentUser(localUser);
              }
            }
          } else {
            // Direct login/signup via Google OAuth
            // Check if user exists in custom users table with this google_email
            const { data: existingUser } = await supabase
              .from('users')
              .select('*')
              .eq('google_email', googleEmail)
              .maybeSingle();

            if (existingUser) {
              // Ensure correct role is set on login
              const emailLower = googleEmail.toLowerCase().trim();
              let determinedRole = existingUser.role || 'reporter';
              if (emailLower === 'thanhhoangcloud@gmail.com') {
                determinedRole = 'fixer';
              } else if (emailLower === 'cuongdt@thanhhoang.vn') {
                determinedRole = 'approver';
              }

              const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
              const updatePayload: any = { session_token: token };
              if (existingUser.role !== determinedRole) {
                updatePayload.role = determinedRole;
                existingUser.role = determinedRole;
              }

              await supabase.from('users').update(updatePayload).eq('id', existingUser.id);
              
              // Set local storage directly first since useEffect might not pick it up fast enough
              localStorage.setItem('bugstream_user_session', JSON.stringify({
                user: { ...existingUser, session_token: token },
                timestamp: Date.now(),
                token: token
              }));

              setCurrentUser({ ...existingUser, session_token: token });
            } else {
              // Sign out from oauth session first so we don't save a half-baked oauth login state
              await supabase.auth.signOut();
              
              // Set state for onboarding Google user profile setup
              setPendingGoogleProfile({
                name: fullName,
                google_email: googleEmail,
                avatar_url: avatarUrl || ''
              });
              alert(`Tài khoản Google ${googleEmail} chưa tồn tại trên hệ thống. Vui lòng hoàn tất việc thiết lập ID, Tên hiển thị và Mật khẩu.`);
            }
          }
        }
      } catch (err) {
        console.error("Google OAuth check failed:", err);
      }
    };

    checkOAuthSession();
  }, [isSupabaseConnected, tablesExist]);

  const handleLoginSuccess = async (user: User) => {
    const userWithRole = { ...user, role: user.role || 'reporter' };
    let token = user.session_token;
    if (!token) {
      token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      // Update database session token
      await supabase.from('users').update({ session_token: token }).eq('id', user.id);
    }
    setCurrentUser({ ...userWithRole, session_token: token });
    localStorage.setItem('bugstream_user_session', JSON.stringify({
      user: { ...userWithRole, session_token: token },
      timestamp: Date.now(),
      token: token
    }));
    fetchBugs();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('bugstream_user_session');
    setIsEditingProfile(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setProfileUpdateError(null);
    setProfileUpdateSuccess(false);

    try {
      const updateData: any = {};
      if (editName.trim()) {
        updateData.name = editName.trim();
      }
      if (editPassword) {
        if (editPassword.length < 6) {
          throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
        }
        updateData.password = editPassword;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('Vui lòng điền thông tin thay đổi.');
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const updatedUser = { ...currentUser, ...data };
        setCurrentUser(updatedUser);
        setProfileUpdateSuccess(true);
        setEditPassword('');
        setTimeout(() => {
          setIsEditingProfile(false);
          setProfileUpdateSuccess(false);
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setProfileUpdateError(err.message || 'Lỗi cập nhật hồ sơ.');
    }
  };

  // Connect Google account for already logged in user
  const handleConnectGoogle = async () => {
    if (!currentUser) return;
    
    if (!isSupabaseConnected || !tablesExist) {
      alert("Không thể kết nối tài khoản Google do chưa cấu hình cơ sở dữ liệu Supabase.");
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google OAuth redirect failed", err);
      alert("Lỗi chuyển hướng xác thực Google: " + (err.message || err));
    }
  };

  // Submit Bug Report
  const handleBugSubmitted = async (bugData: { description: string; image: string[] }) => {
    if (!currentUser) return;

    if (!isSupabaseConnected || !tablesExist) {
      throw new Error("Không thể gửi báo cáo do chưa cấu hình cơ sở dữ liệu Supabase.");
    }

    const newBugId = Math.random().toString(36).substring(2, 11);
    const newBug: Bug = {
      id: newBugId,
      description: bugData.description,
      status: 'Pending',
      timestamp: new Date().toISOString(),
      image: bugData.image,
      user_id: currentUser.id,
      user_name: currentUser.name
    };

    try {
      const { error } = await supabase.from('bugs').insert({
        id: newBug.id,
        description: newBug.description,
        status: newBug.status,
        timestamp: newBug.timestamp,
        image: newBug.image,
        user_id: newBug.user_id
      });
      if (error) throw error;
      setBugs((prev) => [newBug, ...prev]);
    } catch (err: any) {
      console.error("Database write error", err);
      throw new Error("Không thể lưu báo cáo lỗi: " + (err.message || err));
    }
  };

  // Update Bug Status and Metadata (Interactive feature)
  const handleBugUpdate = async (
    bugId: string,
    newStatus: BugStatus,
    newMetadata?: { resolved_hours?: number; recheck_reason?: string; priority?: 'Low' | 'Medium' | 'High' }
  ) => {
    if (!isSupabaseConnected || !tablesExist) {
      alert("Không thể thay đổi thông tin do chưa cấu hình cơ sở dữ liệu Supabase.");
      return;
    }

    const bugToUpdate = bugs.find((b) => b.id === bugId);
    if (!bugToUpdate) return;

    // Parse existing metadata from the full description
    const { cleanDescription, metadata: oldMetadata } = parseBugMetadata(bugToUpdate.description);
    
    // Construct new history log if status changes
    let updatedHistory = [...(oldMetadata.history || [])];
    if (bugToUpdate.status !== newStatus) {
      const newLog = {
        timestamp: new Date().toISOString(),
        from_status: bugToUpdate.status,
        to_status: newStatus,
        user_name: currentUser?.name || currentUser?.id || 'Ẩn danh',
        resolved_hours: newMetadata?.resolved_hours,
        recheck_reason: newMetadata?.recheck_reason
      };
      updatedHistory.push(newLog);
    }

    // Accumulate total resolved hours from all history logs
    const totalResolvedHours = updatedHistory.reduce((acc, log) => {
      return acc + (log.resolved_hours || 0);
    }, 0);

    // Merge old metadata with new metadata, including updated history and accumulated hours
    const mergedMetadata = {
      ...oldMetadata,
      ...newMetadata,
      history: updatedHistory,
      resolved_hours: totalResolvedHours > 0 ? totalResolvedHours : undefined
    };
    
    // Stringify back into the description
    const updatedDescription = stringifyBugMetadata(cleanDescription, mergedMetadata);

    try {
      const { error } = await supabase
        .from('bugs')
        .update({ 
          status: newStatus,
          description: updatedDescription
        })
        .eq('id', bugId);
      if (error) throw error;

      // Update UI only after successful DB update
      setBugs((prev) =>
        prev.map((b) =>
          b.id === bugId
            ? {
                ...b,
                status: newStatus,
                description: updatedDescription,
                resolved_hours: mergedMetadata.resolved_hours,
                recheck_reason: newMetadata?.recheck_reason || b.recheck_reason, // Show latest recheck reason directly
                priority: mergedMetadata.priority,
                history: updatedHistory
              }
            : b
        )
      );
    } catch (err: any) {
      console.error("Database update failed", err);
      alert("Lỗi cập nhật sự cố: " + (err.message || err));
    }
  };

  // Filtered Bugs List
  const filteredBugs = bugs.filter((bug) => {
    const matchesFilter = filter === 'All' || bug.status === filter;
    const matchesSearch = 
      bug.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bug.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      bug.id.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E4E4E7] flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <header className="sticky top-0 bg-[#0D0D0F]/90 backdrop-blur-md border-b border-[#222224] z-30 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Logo Title (Georgia italic styling matching theme HTML) */}
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-sm font-medium tracking-tight text-white flex items-center gap-1 shadow-xs" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              FixBug - TH <span className="text-[9px] font-mono text-zinc-500 not-italic uppercase tracking-widest ml-1">v1.2.2</span>
            </h1>
          </div>

          {/* Search Input (Middle) */}
          <div className="relative flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Tìm kiếm sự cố..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white placeholder-zinc-500"
            />
          </div>

          {/* Actions & Profile (Right) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            

            {/* Sync Button */}
            <button
              onClick={fetchBugs}
              title="Đồng bộ dữ liệu"
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-[#161618] hover:bg-[#1C1C1E] text-zinc-300 border border-[#222224] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>



            {/* Add Bug Report Trigger Button */}
            {currentUser && (() => {
              const isReady = isSupabaseConnected && tablesExist && isCloudinaryConnected;
              return (
                <button
                  onClick={() => setShowBugModal(true)}
                  disabled={!isReady}
                  title={isReady ? "Báo cáo sự cố mới" : "Vui lòng cấu hình kết nối Database & Cloudinary"}
                  className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold tracking-tight transition-all shadow-md ${
                    isReady 
                      ? "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white border border-blue-700/50 cursor-pointer shadow-blue-900/20"
                      : "opacity-40 cursor-not-allowed bg-zinc-800 text-zinc-400 border border-[#222224] shadow-none pointer-events-none"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Thêm</span>
                </button>
              );
            })()}

            {/* Toggle Profile Button with Pop-up Menu */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  title={showProfile ? 'Ẩn hồ sơ cá nhân' : 'Hiện hồ sơ cá nhân'}
                  className={`flex items-center justify-center w-7 h-7 rounded-full border overflow-hidden transition-all cursor-pointer ${
                    showProfile 
                      ? 'border-blue-500 ring-2 ring-blue-500/20' 
                      : 'border-[#222224] hover:border-zinc-500'
                  }`}
                >
                  <img
                    src={currentUser.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser.name}`}
                    alt="Hồ sơ"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>

                {showProfile && (
                  <div className="absolute right-0 top-9 mt-1 z-40 bg-[#111113] border border-[#222224] rounded-xl p-4 shadow-xl space-y-4 w-72 md:w-80 max-h-[80vh] overflow-y-auto animate-slide-down">
                    
                    {isEditingProfile ? (
                      /* Profile Edit Form */
                      <form onSubmit={handleUpdateProfile} className="space-y-3">
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#222224]">
                          <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Chỉnh sửa hồ sơ</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingProfile(false);
                              setProfileUpdateError(null);
                            }}
                            className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>

                        {profileUpdateError && (
                          <div className="p-2 bg-red-950/30 border border-red-900/50 rounded-lg text-[11px] text-red-400">
                            {profileUpdateError}
                          </div>
                        )}

                        {profileUpdateSuccess && (
                          <div className="p-2 bg-green-950/30 border border-green-900/50 rounded-lg text-[11px] text-green-400">
                            Đã cập nhật thông tin thành công!
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">TÊN HIỂN THỊ</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            placeholder="Nhập tên hiển thị mới"
                            className="w-full px-2.5 py-1.5 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">MẬT KHẨU MỚI (BỎ TRỐNG NẾU KHÔNG ĐỔI)</label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="Nhập mật khẩu tối thiểu 6 ký tự"
                            className="w-full px-2.5 py-1.5 bg-[#161618] border border-[#222224] rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-md shadow-blue-900/20"
                        >
                          Lưu thay đổi
                        </button>
                      </form>
                    ) : (
                      /* Standard User Card Mode */
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <img
                              src={currentUser.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser.name}`}
                              alt={currentUser.name}
                              className="w-9 h-9 rounded-lg bg-[#161618] object-cover border border-[#222224]"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-semibold text-xs text-white truncate max-w-[130px]">
                                  {currentUser.name}
                                </h3>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md border font-mono uppercase ${
                                  currentUser.role === 'approver' 
                                    ? 'text-purple-400 bg-purple-950/20 border-purple-900/50' 
                                    : currentUser.role === 'fixer'
                                      ? 'text-amber-400 bg-amber-950/20 border-amber-900/50'
                                      : 'text-zinc-400 bg-zinc-900 border-zinc-800'
                                }`}>
                                  {currentUser.role || 'reporter'}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-mono">@{currentUser.id}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditName(currentUser.name);
                                setEditPassword('');
                                setProfileUpdateError(null);
                                setIsEditingProfile(true);
                              }}
                              className="p-1 bg-[#161618] hover:bg-blue-950/40 text-zinc-400 hover:text-blue-400 border border-[#222224] rounded-md transition-all cursor-pointer"
                              title="Sửa hồ sơ"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleLogout}
                              className="p-1 bg-[#161618] hover:bg-red-950/40 text-zinc-400 hover:text-red-400 border border-[#222224] rounded-md transition-all cursor-pointer"
                              title="Đăng xuất"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Google Account Linking */}
                        <div className="border-t border-[#222224] pt-2.5 space-y-1.5">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">LIÊN KẾT TÀI KHOẢN GOOGLE</span>
                          {currentUser.google_email ? (
                            <div className="bg-[#161618] border border-[#222224] rounded-lg p-2 flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                                <Chrome className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span className="font-semibold text-zinc-200 truncate">{currentUser.google_email}</span>
                              </div>
                              <span className="text-[8px] font-bold text-green-400 bg-green-950/30 px-1.5 py-0.5 rounded-md border border-green-900/50 uppercase shrink-0 ml-1">Đã kết nối</span>
                            </div>
                          ) : (
                            <button
                              onClick={handleConnectGoogle}
                              className="w-full flex items-center justify-center gap-1.5 border border-[#222224] bg-[#161618] hover:bg-[#1C1C1E] rounded-lg py-1.5 text-[11px] text-zinc-300 font-semibold cursor-pointer transition-all hover:border-[#2C2C2E]"
                            >
                              <Chrome className="w-3.5 h-3.5 text-red-400 shrink-0" />
                              <span>Kết nối tài khoản Google</span>
                            </button>
                          )}
                        </div>

                        {/* Chi tiết phiên đăng nhập */}
                        <div className="border-t border-[#222224] pt-2.5 space-y-1.5">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block font-mono">THÔNG TIN PHIÊN ĐĂNG NHẬP</span>
                          <div className="bg-[#161618] border border-[#222224] rounded-lg p-2 space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between text-zinc-300">
                              <span className="text-zinc-500">Hạn phiên:</span>
                              <span className="font-mono font-semibold text-zinc-200">{sessionTimeLeft || 'Đang tính...'}</span>
                            </div>
                            <div className="flex items-center justify-between text-zinc-300">
                              <span className="text-zinc-500">Thiết bị đăng nhập:</span>
                              <span className="font-semibold text-green-400">1 nơi duy nhất</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Supabase Status Icon */}
            <button
              onClick={() => {
                if (!isSupabaseConnected || !tablesExist) {
                  setDbGuideOpen(true);
                }
              }}
              title={
                checkingDb 
                  ? 'Đang kiểm tra kết nối Supabase...' 
                  : isSupabaseConnected && tablesExist 
                    ? 'Supabase: Đã kết nối' 
                    : 'Supabase: Cần thiết lập bảng'
              }
              className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border transition-all ${
                checkingDb 
                  ? 'bg-[#161618] text-zinc-500 border-[#222224] animate-pulse' 
                  : isSupabaseConnected && tablesExist 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50 hover:bg-emerald-950/20' 
                    : 'bg-amber-950/40 text-amber-400 border-amber-900/50 hover:bg-amber-900/20 animate-pulse'
              } cursor-pointer`}
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* Cloudinary Status Icon */}
            <div
              title={
                isCloudinaryConnected 
                  ? 'Cloudinary: Đã kết nối' 
                  : 'Cloudinary: Chưa kết nối'
              }
              className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border transition-all ${
                isCloudinaryConnected 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                  : 'bg-amber-950/40 text-amber-400 border-amber-900/50'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 shrink-0" />
            </div>
          </div>
        </div>
      </header>
 
      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 space-y-4">
 
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <button
            onClick={() => setFilter('All')}
            className={`text-left bg-[#161618] border p-2.5 sm:p-3 rounded-xl relative overflow-hidden group cursor-pointer transition-all ${
              filter === 'All' ? 'border-zinc-400 ring-1 ring-zinc-400/30' : 'border-[#222224] hover:border-zinc-700'
            }`}
          >
            <div className="flex flex-row sm:flex-col sm:items-start items-center justify-between sm:justify-start gap-1">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-mono font-bold">Tất cả lỗi</span>
              <div className="flex items-baseline gap-1 sm:mt-0.5">
                <span className="text-lg sm:text-2xl font-light text-white leading-none font-mono">{bugs.length}</span>
                {(() => {
                  const inactiveCount = bugs.filter(b => b.status === 'Cancelled' || b.status === 'Rejected').length;
                  return inactiveCount > 0 ? (
                    <span className="text-xs text-rose-500 font-mono">(-{inactiveCount})</span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="hidden sm:block absolute right-3 bottom-2 text-zinc-800/25 font-bold text-base select-none font-mono group-hover:text-zinc-800/40 transition-colors">ALL</div>
          </button>

          <button
            onClick={() => setFilter('Pending')}
            className={`text-left bg-[#161618] border p-2.5 sm:p-3 rounded-xl relative overflow-hidden group cursor-pointer transition-all ${
              filter === 'Pending' ? 'border-amber-500/80 ring-1 ring-amber-500/20' : 'border-[#222224] hover:border-amber-900/50'
            }`}
          >
            <div className="flex flex-row sm:flex-col sm:items-start items-center justify-between sm:justify-start gap-1">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-mono font-bold">Chờ xử lý</span>
              <span className="text-lg sm:text-2xl font-light text-amber-400 leading-none font-mono sm:mt-0.5">
                {bugs.filter(b => b.status === 'Pending').length}
              </span>
            </div>
            <div className="hidden sm:block absolute right-3 bottom-2 text-amber-900/10 font-bold text-base select-none font-mono group-hover:text-amber-900/20 transition-colors">PEND</div>
          </button>

          <button
            onClick={() => setFilter('In Progress')}
            className={`text-left bg-[#161618] border p-2.5 sm:p-3 rounded-xl relative overflow-hidden group cursor-pointer transition-all ${
              filter === 'In Progress' ? 'border-blue-500/80 ring-1 ring-blue-500/20' : 'border-[#222224] hover:border-blue-900/50'
            }`}
          >
            <div className="flex flex-row sm:flex-col sm:items-start items-center justify-between sm:justify-start gap-1">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-mono font-bold">Đang xử lý</span>
              <span className="text-lg sm:text-2xl font-light text-blue-400 leading-none font-mono sm:mt-0.5">
                {bugs.filter(b => b.status === 'In Progress').length}
              </span>
            </div>
            <div className="hidden sm:block absolute right-3 bottom-2 text-blue-900/10 font-bold text-base select-none font-mono group-hover:text-blue-900/20 transition-colors">PROG</div>
          </button>

          <button
            onClick={() => setFilter('Resolved')}
            className={`text-left bg-[#161618] border p-2.5 sm:p-3 rounded-xl relative overflow-hidden group cursor-pointer transition-all ${
              filter === 'Resolved' ? 'border-emerald-500/80 ring-1 ring-emerald-500/20' : 'border-[#222224] hover:border-emerald-900/50'
            }`}
          >
            <div className="flex flex-row sm:flex-col sm:items-start items-center justify-between sm:justify-start gap-1">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-mono font-bold">Hoàn tất</span>
              <span className="text-lg sm:text-2xl font-light text-emerald-400 leading-none font-mono sm:mt-0.5">
                {bugs.filter(b => b.status === 'Resolved').length}
              </span>
            </div>
            <div className="hidden sm:block absolute right-3 bottom-2 text-emerald-900/10 font-bold text-base select-none font-mono group-hover:text-emerald-900/20 transition-colors">DONE</div>
          </button>

          <button
            onClick={() => setFilter('Recheck')}
            className={`text-left bg-[#161618] border p-2.5 sm:p-3 rounded-xl relative overflow-hidden group cursor-pointer transition-all ${
              filter === 'Recheck' ? 'border-rose-500/80 ring-1 ring-rose-500/20' : 'border-[#222224] hover:border-rose-900/50'
            }`}
          >
            <div className="flex flex-row sm:flex-col sm:items-start items-center justify-between sm:justify-start gap-1">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-mono font-bold">Kiểm tra lại</span>
              <span className="text-lg sm:text-2xl font-light text-rose-450 leading-none font-mono sm:mt-0.5">
                {bugs.filter(b => b.status === 'Recheck').length}
              </span>
            </div>
            <div className="hidden sm:block absolute right-3 bottom-2 text-rose-900/10 font-bold text-base select-none font-mono group-hover:text-rose-900/20 transition-colors">RCK</div>
          </button>

          <button
            onClick={() => setFilter('Closed')}
            className={`text-left bg-[#161618] border p-2.5 sm:p-3 rounded-xl relative overflow-hidden group cursor-pointer transition-all ${
              filter === 'Closed' ? 'border-zinc-500/80 ring-1 ring-zinc-500/20' : 'border-[#222224] hover:border-zinc-700'
            }`}
          >
            <div className="flex flex-row sm:flex-col sm:items-start items-center justify-between sm:justify-start gap-1">
              <span className="text-[9px] text-zinc-550 uppercase tracking-wider font-mono font-bold">Đã đóng</span>
              <span className="text-lg sm:text-2xl font-light text-zinc-400 leading-none font-mono sm:mt-0.5">
                {bugs.filter(b => b.status === 'Closed').length}
              </span>
            </div>
            <div className="hidden sm:block absolute right-3 bottom-2 text-zinc-800/25 font-bold text-base select-none font-mono group-hover:text-zinc-800/40 transition-colors">CLSD</div>
          </button>
        </div>

 
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Right Side: Search, Filter & List of reported bugs */}
          <div className="lg:col-span-12 space-y-4">
            
            {/* Bugs Feed */}
            {filteredBugs.length === 0 ? (
              <div className="bg-[#111113] rounded-2xl border border-[#222224] p-12 text-center space-y-3">
                <div className="w-12 h-12 bg-[#161618] rounded-full flex items-center justify-center text-zinc-500 mx-auto border border-[#222224]">
                  <BugIcon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-zinc-300 text-sm">Chưa phát hiện bản ghi lỗi nào</p>
                  <p className="text-xs text-zinc-500">
                    {bugs.length === 0 
                      ? 'Hệ thống hiện tại chưa ghi nhận sự cố nào.' 
                      : 'Hãy thử lọc lại trạng thái hoặc thay đổi từ khóa tìm kiếm.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                {filteredBugs.map((bug) => (
                  <BugCard 
                    key={bug.id}
                    bug={bug}
                    onBugUpdate={handleBugUpdate}
                    currentUser={currentUser}
                  />
                ))}
              </div>
            )}

          </div>

        </div>

      </main>

      {/* Database Schema Guide Modal */}
      <DbGuideModal 
        isOpen={dbGuideOpen}
        onClose={() => setDbGuideOpen(false)}
        supabaseUrl={appConfig.supabaseUrl}
      />

      {/* Auth Modal Popup Overlay */}
      {!currentUser && !pendingGoogleProfile && (
        <div className="fixed inset-0 bg-[#070708]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <AuthModal 
            onLoginSuccess={handleLoginSuccess}
            isSupabaseActive={isSupabaseConnected && tablesExist}
          />
        </div>
      )}

      {/* Google OAuth Profile Onboarding Setup Modal */}
      {pendingGoogleProfile && (
        <div className="fixed inset-0 bg-[#070708]/90 backdrop-blur-lg flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111113] rounded-2xl border border-[#222224] shadow-2xl p-8 max-w-md w-full my-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-display font-bold text-2xl text-white tracking-tight">
                Thiết lập thông tin tài khoản
              </h2>
              <p className="text-zinc-500 text-sm">
                Lần truy cập đầu tiên bằng tài khoản Google mới. Vui lòng thiết lập ID, Họ tên và Mật khẩu.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const idInput = (form.elements.namedItem('setup-id') as HTMLInputElement).value.trim().toLowerCase().replace(/\s+/g, '');
                const nameInput = (form.elements.namedItem('setup-name') as HTMLInputElement).value.trim();
                const passInput = (form.elements.namedItem('setup-pass') as HTMLInputElement).value;
                const confirmPassInput = (form.elements.namedItem('setup-confirm-pass') as HTMLInputElement).value;

                if (!idInput || !nameInput || !passInput || !confirmPassInput) {
                  alert('Vui lòng điền đầy đủ các thông tin bắt buộc.');
                  return;
                }

                if (passInput !== confirmPassInput) {
                  alert('Mật khẩu xác nhận không trùng khớp.');
                  return;
                }

                try {
                  // Check duplicate ID
                  const { data: dupId } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', idInput)
                    .maybeSingle();

                  if (dupId) {
                    alert('ID người dùng này đã tồn tại, vui lòng chọn ID khác.');
                    return;
                  }

                  const email = pendingGoogleProfile.google_email.toLowerCase().trim();
                  let determinedRole: 'reporter' | 'fixer' | 'approver' = 'reporter';
                  if (email === 'thanhhoangcloud@gmail.com') {
                    determinedRole = 'fixer';
                  } else if (email === 'cuongdt@thanhhoang.vn') {
                    determinedRole = 'approver';
                  }

                  const newUser = {
                    id: idInput,
                    name: nameInput,
                    pass: passInput,
                    google_email: pendingGoogleProfile.google_email,
                    avatar_url: pendingGoogleProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${idInput}`,
                    role: determinedRole
                  };

                  const { error } = await supabase.from('users').insert(newUser);
                  if (error) throw error;

                  alert('Tạo tài khoản từ Google thành công!');
                  setPendingGoogleProfile(null);
                  handleLoginSuccess(newUser);
                } catch (err: any) {
                  console.error(err);
                  alert('Lỗi tạo tài khoản: ' + err.message);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono">
                  Email Google liên kết
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={pendingGoogleProfile.google_email}
                  className="w-full px-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm text-zinc-400 font-mono focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono">
                  ID Người Dùng (Viết liền, không dấu)*
                </label>
                <input
                  name="setup-id"
                  type="text"
                  placeholder="e.g. hoangthanh"
                  required
                  defaultValue={pendingGoogleProfile.google_email.split('@')[0]}
                  className="w-full px-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono">
                  Họ và tên hiển thị*
                </label>
                <input
                  name="setup-name"
                  type="text"
                  placeholder="e.g. Hoàng Thanh"
                  required
                  defaultValue={pendingGoogleProfile.name}
                  className="w-full px-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono">
                  Thiết lập Mật khẩu*
                </label>
                <input
                  name="setup-pass"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono">
                  Xác nhận Mật khẩu*
                </label>
                <input
                  name="setup-confirm-pass"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 bg-[#161618] border border-[#222224] rounded-xl text-sm focus:outline-hidden focus:border-blue-500 text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingGoogleProfile(null)}
                  className="w-1/3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98] text-sm"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl cursor-pointer transition-all active:scale-[0.98] text-sm shadow-lg shadow-blue-900/30"
                >
                  Hoàn tất thiết lập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bug Report Popup Modal */}
      {showBugModal && currentUser && (
        <div className="fixed inset-0 bg-[#070708]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111113] rounded-2xl border border-[#222224] shadow-2xl p-5 md:p-6 max-w-3xl w-full my-8 relative animate-fade-in space-y-4">
            <button
              onClick={() => setShowBugModal(false)}
              className="absolute right-4 top-4 p-1.5 bg-[#161618] hover:bg-[#1E1E20] text-zinc-400 hover:text-white border border-[#222224] rounded-lg transition-all cursor-pointer z-50"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>

            <BugForm 
              userId={currentUser.id}
              onBugSubmitted={async (newBug) => {
                await handleBugSubmitted(newBug);
                setShowBugModal(false);
              }}
              appConfig={appConfig}
            />
          </div>
        </div>
      )}

    </div>
  );
}

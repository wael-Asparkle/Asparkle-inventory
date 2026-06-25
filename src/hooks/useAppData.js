import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, appId } from '../config/firebase';
import {
  DEFAULT_ROLE,
  hasPermissionForRole,
  normalizeRole,
} from '../constants/ui';

const ACTIVE_TAB_KEY = 'asparkle_active_tab';

export default function useAppData() {
  const [activeTab, setActiveTabState] = useState(
    () => localStorage.getItem(ACTIVE_TAB_KEY) || 'ceo_executive'
  );
  const [currentUserRole, setCurrentUserRole] = useState(DEFAULT_ROLE);
  const [userProfile, setUserProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [profileReady, setProfileReady] = useState(false);
  const [movements, setMovements] = useState([]);
  const [productDetails, setProductDetails] = useState({});
  const [packages, setPackages] = useState({});

  // ── Auth State ──────────────────────────────────────────
  const [user, setUser] = useState(undefined);
  const [authStateReady, setAuthStateReady] = useState(false);

  // حفظ الصفحة النشطة في localStorage عند كل تغيير
  const setActiveTab = (tab) => {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
    setActiveTabState(tab);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setProfileError('');

      if (!firebaseUser) {
        setCurrentUserRole(DEFAULT_ROLE);
        setUserProfile(null);
        setProfileReady(true);
      } else {
        setCurrentUserRole(DEFAULT_ROLE);
        setUserProfile(null);
        setProfileReady(false);
      }

      setAuthStateReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // ── User Role Profile ───────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);

    const unsubscribeProfile = onSnapshot(
      userRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setUserProfile({
            uid: user.uid,
            email: user.email,
            role: DEFAULT_ROLE,
            isActive: false,
            missingProfile: true,
          });
          setCurrentUserRole(DEFAULT_ROLE);
          setProfileReady(true);
          return;
        }

        const data = docSnap.data();
        const isActive = data.isActive === true;
        const role = isActive ? normalizeRole(data.role) : DEFAULT_ROLE;

        setUserProfile({
          uid: user.uid,
          email: user.email,
          ...data,
          role,
          isActive,
        });
        setCurrentUserRole(role);
        setProfileReady(true);
      },
      (error) => {
        console.error('خطأ في تحميل صلاحيات المستخدم:', error);
        setProfileError('تعذر تحميل صلاحيات المستخدم');
        setUserProfile({
          uid: user.uid,
          email: user.email,
          role: DEFAULT_ROLE,
          isActive: false,
        });
        setCurrentUserRole(DEFAULT_ROLE);
        setProfileReady(true);
      }
    );

    return () => unsubscribeProfile();
  }, [user]);

  // ── Firestore — يشتغل فقط لو المستخدم مسجل ومفعل ──────────────
  useEffect(() => {
    if (!user || !profileReady || !userProfile?.isActive) {
      setMovements([]);
      setProductDetails({});
      setPackages({});
      return;
    }

    const unsubscribeMovements = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'movements'),
      (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setMovements(data);
      },
      (error) => console.error('خطأ في تحميل الحركات:', error)
    );

    const definitionsRef = doc(
      db, 'artifacts', appId, 'public', 'data', 'settings', 'definitions'
    );

    const unsubscribeDefinitions = onSnapshot(
      definitionsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProductDetails(data.productDetails || {});
          setPackages(data.packages || {});
        } else {
          setProductDetails({});
          setPackages({});
        }
      },
      (error) => console.error('خطأ في تحميل تعريفات المنتجات:', error)
    );

    return () => {
      unsubscribeMovements();
      unsubscribeDefinitions();
    };
  }, [user, profileReady, userProfile?.isActive]);

  const hasAccess = (allowedRoles = []) => {
    if (!userProfile?.isActive) return false;

    const normalizedUserRole = normalizeRole(currentUserRole);
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    return normalizedAllowedRoles.includes(normalizedUserRole);
  };

  const hasPermission = (permission) => {
    if (!userProfile?.isActive) return false;
    return hasPermissionForRole(currentUserRole, permission);
  };

  const logout = () => {
    localStorage.removeItem(ACTIVE_TAB_KEY); // عند تسجيل الخروج يرجع لصفحة الرئيس التنفيذي
    signOut(auth);
  };

  const authReady = authStateReady && (!user || profileReady);

  return {
    user,
    authReady,
    profileReady,
    userProfile,
    profileError,
    logout,
    activeTab,
    setActiveTab,
    currentUserRole,
    hasAccess,
    hasPermission,
    movements,
    productDetails,
    packages,
  };
}

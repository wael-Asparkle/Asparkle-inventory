import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, appId } from '../config/firebase';
import { ROLES, DEFAULT_ROLE } from '../constants/ui';

export default function useAppData() {
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [currentUserRole]               = useState(DEFAULT_ROLE);
  const [movements, setMovements]       = useState([]);
  const [productDetails, setProductDetails] = useState({});
  const [packages, setPackages]         = useState({});

  // ── Auth State ──────────────────────────────────────────
  const [user, setUser]         = useState(undefined); // undefined = جاري التحقق
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  // ── Firestore — يشتغل فقط لو المستخدم مسجل ──────────────
  useEffect(() => {
    if (!user) return;

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
  }, [user]);

  const hasAccess = (allowedRoles = []) => {
    if (currentUserRole === ROLES.SUPER_ADMIN) return true;
    return allowedRoles.includes(currentUserRole);
  };

  const logout = () => signOut(auth);

  return {
    // Auth
    user,
    authReady,
    logout,
    // App
    activeTab,
    setActiveTab,
    currentUserRole,
    hasAccess,
    movements,
    productDetails,
    packages,
  };
}

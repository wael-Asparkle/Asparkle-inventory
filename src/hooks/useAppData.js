import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { ROLES, DEFAULT_ROLE } from '../constants/ui';

export default function useAppData() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUserRole] = useState(DEFAULT_ROLE);

  const [movements, setMovements] = useState([]);
  const [productDetails, setProductDetails] = useState({});

  useEffect(() => {
    const unsubscribeMovements = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'movements'),
      (snapshot) => {
        const data = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));
        setMovements(data);
      },
      (error) => {
        console.error('خطأ في تحميل الحركات:', error);
      }
    );

    const definitionsRef = doc(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'settings',
      'definitions'
    );

    const unsubscribeDefinitions = onSnapshot(
      definitionsRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProductDetails(data.productDetails || {});
        } else {
          setProductDetails({});
        }
      },
      (error) => {
        console.error('خطأ في تحميل تعريفات المنتجات:', error);
      }
    );

    return () => {
      unsubscribeMovements();
      unsubscribeDefinitions();
    };
  }, []);

  const hasAccess = (allowedRoles = []) => {
    if (currentUserRole === ROLES.SUPER_ADMIN) return true;
    return allowedRoles.includes(currentUserRole);
  };

  return {
    activeTab,
    setActiveTab,
    currentUserRole,
    hasAccess,
    movements,
    productDetails,
  };
}

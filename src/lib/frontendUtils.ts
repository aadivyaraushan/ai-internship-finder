import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function fetchUserData(currentUser: User) {
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (!userDoc.exists()) {
      return { 
        goals: '', 
        connections: [],
        personalizationSettings: {
          enabled: false,
          professionalInterests: '',
          personalInterests: ''
        }
      };
    }
    const userData = userDoc.data();
    return {
      goals: userData.goals || '',
      connections: userData.connections || [],
      personalizationSettings: userData.personalizationSettings || {
        enabled: false,
        professionalInterests: '',
        personalInterests: ''
      }
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

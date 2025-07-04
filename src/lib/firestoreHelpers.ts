import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Connection {
  id?: string;
  name: string;
  imageUrl?: string;
  matchPercentage?: number;
  linkedin_url?: string;
  email?: string;
  type?: 'person' | 'program';
  program_description?: string | null;
  program_type?: string | null;
  organization?: string | null;
  website_url?: string | null;
  enrollment_info?: string | null;
  how_this_helps?: string | null;
  description?: string | null;
  status?:
    | 'not_contacted'
    | 'email_sent'
    | 'response_received'
    | 'meeting_scheduled'
    | 'rejected'
    | 'ghosted'
    | 'internship_acquired';
  current_role?: string;
  /**
   * Simplified education level for people connections. One of:
   * 'undergraduate' | 'graduate' | 'postgraduate'
   */
  education_level?: 'undergraduate' | 'graduate' | 'postgraduate' | null;
  company?: string | null;
  /**
   * Original source of the profile data (e.g. linkedin, website scrape)
   */
  profile_source?: string;

  /**
   * Match confidence scores returned by our matcher.
   */
  match_confidence?: {
    name?: number;
    role?: number;
    company?: number;
    overall?: number;
  };

  /**
   * Detailed explanation of why this connection was matched.
   */
  match_details?: {
    scoring_explanation?: string;
    [key: string]: any;
  };

  /**
   * Exact matches such as education and shared activities.
   */
  exact_matches?: {
    education?: {
      university?: string;
      graduation_year?: string;
      degree?: string;
    };
    shared_activities?: Array<{
      name: string;
      year?: string;
      type?: string;
    }>;
  };

  /** Additional matching dimensions */
  direct_matches?: any | null;
  goal_alignment?: string | null;

  /** Hiring-power metadata for person connections */
  hiring_power?: {
    role_type: string;
    can_hire_interns: boolean;
    department: string;
  };

  /** Original URL (for programs) */
  url?: string;

  /** Outreach strategy suggestion */
  outreach_strategy?: string;

  shared_background_points?: string[] | null;
}

// USERS
export async function createOrUpdateUser(userId: string, data: any) {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, data, { merge: true });
}

export async function updateUserGoals(userId: string, goals: any) {
  await setDoc(doc(db, 'users', userId), { goals }, { merge: true });
}

export async function updateUserRoles(userId: string, roles: any[]) {
  await setDoc(doc(db, 'users', userId), { roles }, { merge: true });
}

export async function updateUserConnections(
  userId: string,
  connections: any[]
) {
  await setDoc(doc(db, 'users', userId), { connections }, { merge: true });
}

export async function addUserConnection(
  userId: string,
  connection: Connection
) {
  const userRef = doc(db, 'users', userId);
  const userData = await getDoc(userRef);

  if (!userData.exists()) {
    await setDoc(userRef, { connections: [connection] });
    return;
  }

  const existingConnections = userData.data().connections || [];
  const existingIndex = existingConnections.findIndex(
    (c: Connection) => c.id === connection.id
  );

  if (existingIndex !== -1) {
    // Update existing connection
    existingConnections[existingIndex] = {
      ...existingConnections[existingIndex],
      ...connection,
      lastUpdated: new Date().toISOString(),
    };
  } else {
    // Add new connection
    existingConnections.push({
      ...connection,
      status: 'not_contacted',
      lastUpdated: new Date().toISOString(),
    });
  }

  await updateDoc(userRef, { connections: existingConnections });
}

export async function updateConnectionStatus(
  userId: string,
  connectionId: string,
  status: Connection['status'],
  notes?: string
) {
  const userRef = doc(db, 'users', userId);
  const userData = await getDoc(userRef);

  if (!userData.exists()) {
    throw new Error('User not found');
  }

  const connections = userData.data().connections || [];
  const connectionIndex = connections.findIndex(
    (c: Connection) => c.id === connectionId
  );

  if (connectionIndex === -1) {
    throw new Error('Connection not found');
  }

  connections[connectionIndex] = {
    ...connections[connectionIndex],
    status,
    lastUpdated: new Date().toISOString(),
    ...(notes && { notes }),
  };

  await updateDoc(userRef, { connections });
}

// RESUME
export async function createOrUpdateResume(userId: string, data: any) {
  const resumeRef = doc(db, 'resume', `${userId}_resume`);
  await setDoc(resumeRef, data, { merge: true });
}

// GETTERS
export async function getUser(userId: string) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

export async function getResume(userId: string) {
  const resumeRef = doc(db, 'resume', `${userId}_resume`);
  const resumeDoc = await getDoc(resumeRef);
  if (!resumeDoc.exists()) {
    return null;
  }
  return resumeDoc.data();
}

export const getCurrentUser = () => {
  return new Promise<boolean>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user !== null);
    });
  });
};

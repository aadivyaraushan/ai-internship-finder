import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Connection {
  id: string;
  name: string;
  current_role: string;
  company: string;
  hiring_power: {
    role_type: 'hiring_manager' | 'team_lead' | 'senior_with_referral';
    can_hire_interns: boolean;
    department: string;
  };
  exact_matches: {
    education: {
      university: string;
      graduation_year: string;
      degree: string;
    };
    shared_activities: Array<{
      name: string;
      year: string;
      type: 'club' | 'competition' | 'workplace' | 'certification';
    }>;
  };
  career_path: {
    starting_point: string;
    key_transition: string;
    time_in_industry: string;
  };
  outreach_strategy: {
    shared_background_points: string[];
    unique_connection_angle: string;
    suggested_approach: string;
  };
  contact_info: {
    public_profile: string;
    work_email: string | null;
    contact_source: string;
  };
  match_details: {
    total_percentage: number;
    hiring_power_score: number;
    background_match_score: number;
    career_path_score: number;
    scoring_explanation: string;
  };
  status:
    | 'not_contacted'
    | 'email_sent'
    | 'response_received'
    | 'meeting_scheduled'
    | 'rejected'
    | 'ghosted';
  lastUpdated: string;
  notes?: string;
}

// USERS
export async function createOrUpdateUser(userId: string, data: any) {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, data, { merge: true });
}

export async function updateUserGoals(userId: string, goals: any) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { goals });
}

export async function updateUserRoles(userId: string, roles: any[]) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { roles });
}

export async function updateUserNiche(userId: string, niche: any) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { niche });
}

export async function updateUserConnections(
  userId: string,
  connections: Connection[]
) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { connections });
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

export async function addEmailToConnection(
  userId: string,
  connectionId: string,
  type: 'sent' | 'received',
  content: string
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

  const emailHistory = connections[connectionIndex].emailHistory || [];
  emailHistory.push({
    date: new Date().toISOString(),
    type,
    content,
  });

  connections[connectionIndex] = {
    ...connections[connectionIndex],
    emailHistory,
    lastUpdated: new Date().toISOString(),
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

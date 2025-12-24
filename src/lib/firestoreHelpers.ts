import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, getDoc, collection } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Connection {
  id: string;
  name: string;
  imageUrl?: string;
  matchPercentage?: number;
  verified_profile_url: string | null;
  email?: string;
  type?: 'person' | 'program';
  program_description?: string | null;
  program_type?: string | null;
  organization?: string | null;
  website_url: string | null;
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
   * Original source URL where this connection was found
   */
  source?: string | null;

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
    [key: string]: unknown;
  };

  /**
   * Additional free-form factors used by some connection-finding agents.
   */
  additional_factors?: string[] | null;

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
  direct_matches?: unknown;
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
  shared_professional_interests?: string[] | null;
  shared_personal_interests?: string[] | null;
  /**
   * Short, user-facing explanation (2nd person) for why this is a good connection.
   */
  ai_connection_reason?: string | null;
  ai_outreach_message?: string | null;
  profile_data?: unknown;
  website_verified?: boolean;
}

// USERS
export async function createOrUpdateUser(
  userId: string,
  data: Record<string, unknown>
) {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, data, { merge: true });
}

export async function updateUserGoals(userId: string, goals: unknown) {
  await setDoc(doc(db, 'users', userId), { goals }, { merge: true });
}

export async function updateUserRoles(userId: string, roles: unknown[]) {
  await setDoc(doc(db, 'users', userId), { roles }, { merge: true });
}

export async function updateUserConnections(
  userId: string,
  connections: unknown[]
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
export async function createOrUpdateResume(
  userId: string,
  data: Record<string, unknown>
) {
  const resumeRef = doc(db, 'resume', `${userId}_resume`);
  await setDoc(resumeRef, data, { merge: true });
}

export async function addWaitlistEmail(email: string) {
  const emailRef = doc(db, 'waitlist', email);
  await setDoc(emailRef, { email: email });
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

// PENDING CONNECTIONS - For connection finding process
export interface PendingConnectionSession {
  id: string;
  userId: string;
  goalTitle: string;
  startedAt: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  connections: Connection[];
  totalExpected: number;
}

export async function createPendingConnectionSession(
  userId: string,
  goalTitle: string,
  totalExpected: number = 5
): Promise<string> {
  const sessionId = `${userId}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 11)}`;
  const sessionRef = doc(db, 'pending_connections', sessionId);

  const session: PendingConnectionSession = {
    id: sessionId,
    userId,
    goalTitle,
    startedAt: new Date().toISOString(),
    status: 'in_progress',
    connections: [],
    totalExpected,
  };

  await setDoc(sessionRef, session);
  return sessionId;
}

export async function addPendingConnection(
  sessionId: string,
  connection: Connection
) {
  const sessionRef = doc(db, 'pending_connections', sessionId);
  const sessionDoc = await getDoc(sessionRef);

  if (!sessionDoc.exists()) {
    throw new Error('Pending connection session not found');
  }

  const session = sessionDoc.data() as PendingConnectionSession;
  const updatedConnections = [...session.connections, connection];

  await updateDoc(sessionRef, {
    connections: updatedConnections,
    lastUpdated: new Date().toISOString(),
  });
}

export async function completePendingConnectionSession(
  sessionId: string,
  userId: string
) {
  const sessionRef = doc(db, 'pending_connections', sessionId);
  const sessionDoc = await getDoc(sessionRef);

  if (!sessionDoc.exists()) {
    return;
  }

  const session = sessionDoc.data() as PendingConnectionSession;

  // Move connections to user's main connections
  for (const connection of session.connections) {
    await addUserConnection(userId, connection);
  }

  // Update session status to completed
  await updateDoc(sessionRef, {
    status: 'completed',
    completedAt: new Date().toISOString(),
  });
}

export async function getPendingConnectionSession(
  sessionId: string
): Promise<PendingConnectionSession | null> {
  const sessionRef = doc(db, 'pending_connections', sessionId);
  const sessionDoc = await getDoc(sessionRef);

  return sessionDoc.exists()
    ? (sessionDoc.data() as PendingConnectionSession)
    : null;
}

export async function getUserPendingConnectionSessions(
  userId: string
): Promise<PendingConnectionSession[]> {
  const { getDocs, query, where } = await import('firebase/firestore');
  const pendingRef = collection(db, 'pending_connections');
  const q = query(
    pendingRef,
    where('userId', '==', userId),
    where('status', '==', 'in_progress')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as PendingConnectionSession);
}

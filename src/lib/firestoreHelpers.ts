import { doc, setDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

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
  connections: any[]
) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { connections });
}

// RESUME
export async function createOrUpdateResume(resumeId: string, data: any) {
  const resumeRef = doc(db, 'resume', resumeId);
  await setDoc(resumeRef, data, { merge: true });
}

// GETTERS
export async function getUser(userId: string) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

export async function getResume(resumeId: string) {
  const resumeRef = doc(db, 'resume', resumeId);
  const snap = await getDoc(resumeRef);
  return snap.exists() ? snap.data() : null;
}

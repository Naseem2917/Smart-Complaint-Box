import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface Category {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    enabled: boolean;
    complaintCount: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const CATEGORIES_COLLECTION = 'categories';

// Default categories to seed if collection is empty
const defaultCategories = [
    { name: 'Water Supply', description: 'Water related issues', icon: '💧', enabled: true },
    { name: 'Electricity', description: 'Power and electrical issues', icon: '⚡', enabled: true },
    { name: 'Roads & Infrastructure', description: 'Road damage, potholes, etc.', icon: '🛣️', enabled: true },
    { name: 'Sanitation', description: 'Cleanliness and waste management', icon: '🧹', enabled: true },
    { name: 'Security', description: 'Safety and security concerns', icon: '🔒', enabled: true },
    { name: 'Classroom', description: 'Academic facility issues', icon: '📚', enabled: true },
    { name: 'General', description: 'General complaints', icon: '📋', enabled: true },
    { name: 'Other', description: 'Other issues not in above categories', icon: '❓', enabled: true }
];

// Get all categories with actual complaint counts
export const getCategories = async (): Promise<Category[]> => {
    const q = query(
        collection(db, CATEGORIES_COLLECTION),
        orderBy('name', 'asc')
    );

    const snapshot = await getDocs(q);

    // If no categories exist, attempt to seed with defaults (admin only)
    if (snapshot.empty) {
        try {
            await seedCategories();
            return getCategories();
        } catch (seedError) {
            console.warn('Could not auto-seed categories (requires admin):', seedError);
        }
    }

    // Safely attempt to get complaint counts (will only succeed if caller is admin)
    const categoryCounts: Record<string, number> = {};
    try {
        const complaintsSnapshot = await getDocs(collection(db, 'complaints'));
        complaintsSnapshot.docs.forEach(doc => {
            const category = doc.data().category;
            if (category) {
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
        });
    } catch {
        // Regular users cannot read all complaints per security rules; safely continue
    }

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        complaintCount: categoryCounts[doc.data().name] || 0
    } as Category));
};

// Seed default categories
export const seedCategories = async (): Promise<void> => {
    for (const cat of defaultCategories) {
        await addDoc(collection(db, CATEGORIES_COLLECTION), {
            ...cat,
            complaintCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }
};

// Add new category
export const addCategory = async (name: string, description?: string, icon?: string): Promise<string> => {
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
        name,
        description: description || '',
        icon: icon || '📋',
        enabled: true,
        complaintCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

// Update category
export const updateCategory = async (
    id: string,
    updates: { name?: string; description?: string; icon?: string; enabled?: boolean }
): Promise<void> => {
    await updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

// Delete category
export const deleteCategory = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
};

// Toggle category enabled/disabled
export const toggleCategory = async (id: string, enabled: boolean): Promise<void> => {
    await updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
        enabled,
        updatedAt: serverTimestamp()
    });
};

// Increment complaint count for category
export const incrementCategoryCount = async (categoryName: string): Promise<void> => {
    const q = query(collection(db, CATEGORIES_COLLECTION));
    const snapshot = await getDocs(q);

    const categoryDoc = snapshot.docs.find(doc => doc.data().name === categoryName);
    if (categoryDoc) {
        const currentCount = categoryDoc.data().complaintCount || 0;
        await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryDoc.id), {
            complaintCount: currentCount + 1,
            updatedAt: serverTimestamp()
        });
    }
};

// Remove duplicate categories (keeps the first one of each name)
export const removeDuplicateCategories = async (): Promise<number> => {
    const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
    const seen = new Set<string>();
    let deletedCount = 0;

    for (const docSnap of snapshot.docs) {
        const name = docSnap.data().name;
        if (seen.has(name)) {
            // Delete duplicate
            await deleteDoc(doc(db, CATEGORIES_COLLECTION, docSnap.id));
            deletedCount++;
        } else {
            seen.add(name);
        }
    }

    return deletedCount;
};

// Ensure Other category exists (call this on app startup or categories page load)
export const ensureOtherCategory = async (): Promise<void> => {
    const q = query(
        collection(db, CATEGORIES_COLLECTION),
        where('name', '==', 'Other')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        // Add Other category
        await addDoc(collection(db, CATEGORIES_COLLECTION), {
            name: 'Other',
            description: 'Other issues not in above categories',
            icon: '❓',
            enabled: true,
            complaintCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }
};

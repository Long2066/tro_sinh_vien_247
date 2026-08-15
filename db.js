// db.js — Module kết nối Firebase Firestore (lưu trữ dữ liệu vĩnh viễn)
const admin = require('firebase-admin');

let db = null;

function getDb() {
    if (db) return db;

    try {
        // Ưu tiên biến môi trường FIREBASE_SERVICE_ACCOUNT (Vercel)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            // Fallback: đọc file firebase-key.json (local development)
            const path = require('path');
            const serviceAccount = require(path.join(__dirname, 'firebase-key.json'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        db = admin.firestore();
        console.log('[FIREBASE] ✅ Kết nối Firestore thành công!');
        return db;
    } catch (e) {
        console.error('[FIREBASE] ❌ Lỗi kết nối Firestore:', e.message);
        return null;
    }
}

// === LANDLORD ROOMS (Phòng trọ đã duyệt) ===

async function getFirestoreLandlordRooms() {
    const firestore = getDb();
    if (!firestore) return null;

    try {
        const snapshot = await firestore.collection('landlord_rooms').get();
        return snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('[FIREBASE] Lỗi đọc landlord_rooms:', e.message);
        return null;
    }
}

async function addFirestoreLandlordRoom(room) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        await firestore.collection('landlord_rooms').doc(room.id).set(room);
        console.log(`[FIREBASE] ✅ Đã lưu phòng trọ: ${room.id}`);
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi ghi landlord_rooms:', e.message);
        return false;
    }
}

async function deleteFirestoreLandlordRoom(roomId) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        // Tìm document theo field id
        const snapshot = await firestore.collection('landlord_rooms')
            .where('id', '==', roomId).get();
        if (snapshot.empty) {
            // Thử xóa theo doc ID
            await firestore.collection('landlord_rooms').doc(roomId).delete();
        } else {
            const batch = firestore.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        console.log(`[FIREBASE] ✅ Đã xóa phòng trọ: ${roomId}`);
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi xóa landlord_rooms:', e.message);
        return false;
    }
}

// === PENDING ROOMS (Phòng trọ chờ duyệt) ===

async function getFirestorePendingRooms() {
    const firestore = getDb();
    if (!firestore) return null;

    try {
        const snapshot = await firestore.collection('pending_rooms').get();
        const rooms = snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
        rooms.sort((a, b) => {
            const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : (parseInt(String(a.id).replace(/\D/g, '')) || 0);
            const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : (parseInt(String(b.id).replace(/\D/g, '')) || 0);
            return timeB - timeA;
        });
        return rooms;
    } catch (e) {
        console.error('[FIREBASE] Lỗi đọc pending_rooms:', e.message);
        return null;
    }
}

async function addFirestorePendingRoom(room) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        await firestore.collection('pending_rooms').doc(room.id).set(room);
        console.log(`[FIREBASE] ✅ Đã lưu tin chờ duyệt: ${room.id}`);
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi ghi pending_rooms:', e.message);
        return false;
    }
}

async function deleteFirestorePendingRoom(roomId) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        const snapshot = await firestore.collection('pending_rooms')
            .where('id', '==', roomId).get();
        if (snapshot.empty) {
            await firestore.collection('pending_rooms').doc(roomId).delete();
        } else {
            const batch = firestore.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        console.log(`[FIREBASE] ✅ Đã xóa tin chờ duyệt: ${roomId}`);
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi xóa pending_rooms:', e.message);
        return false;
    }
}

// === SCAM BLACKLIST (Danh sách đen) ===

async function getFirestoreBlacklist() {
    const firestore = getDb();
    if (!firestore) return null;

    try {
        const snapshot = await firestore.collection('scam_blacklist').get();
        return snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('[FIREBASE] Lỗi đọc scam_blacklist:', e.message);
        return null;
    }
}

async function addFirestoreBlacklistEntry(entry) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        const docId = entry.phone.replace(/[^0-9]/g, '');
        await firestore.collection('scam_blacklist').doc(docId).set(entry);
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi ghi scam_blacklist:', e.message);
        return false;
    }
}

// === ROOMMATES (Hồ sơ ở ghép) ===

async function getFirestoreRoommates() {
    const firestore = getDb();
    if (!firestore) return null;

    try {
        const snapshot = await firestore.collection('roommates').get();
        return snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('[FIREBASE] Lỗi đọc roommates:', e.message);
        return null;
    }
}

async function addFirestoreRoommate(profile) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        await firestore.collection('roommates').doc(profile.id).set(profile);
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi ghi roommates:', e.message);
        return false;
    }
}

async function deleteFirestoreRoommate(profileId) {
    const firestore = getDb();
    if (!firestore) return false;

    try {
        const snapshot = await firestore.collection('roommates')
            .where('id', '==', profileId).get();
        if (snapshot.empty) {
            await firestore.collection('roommates').doc(profileId).delete();
        } else {
            const batch = firestore.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        return true;
    } catch (e) {
        console.error('[FIREBASE] Lỗi xóa roommates:', e.message);
        return false;
    }
}

module.exports = {
    getDb,
    getFirestoreLandlordRooms,
    addFirestoreLandlordRoom,
    deleteFirestoreLandlordRoom,
    getFirestorePendingRooms,
    addFirestorePendingRoom,
    deleteFirestorePendingRoom,
    getFirestoreBlacklist,
    addFirestoreBlacklistEntry,
    getFirestoreRoommates,
    addFirestoreRoommate,
    deleteFirestoreRoommate
};

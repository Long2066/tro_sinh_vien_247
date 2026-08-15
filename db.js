// db.js — Module kết nối Firebase Firestore (Lưu trữ dữ liệu vĩnh viễn)
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
    if (db) return db;

    try {
        if (getApps().length === 0) {
            let serviceAccount = null;
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                try {
                    serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
                        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                        : process.env.FIREBASE_SERVICE_ACCOUNT;
                } catch (jsonErr) {
                    console.error('[FIREBASE] Lỗi parse FIREBASE_SERVICE_ACCOUNT:', jsonErr.message);
                }
            }
            
            if (!serviceAccount) {
                const keyPath = path.join(__dirname, 'firebase-key.json');
                if (fs.existsSync(keyPath)) {
                    serviceAccount = require(keyPath);
                }
            }

            if (serviceAccount) {
                initializeApp({
                    credential: cert(serviceAccount)
                });
            } else {
                console.error('[FIREBASE] ❌ Không tìm thấy thông tin Service Account!');
                return null;
            }
        }

        db = getFirestore();
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
        if (snapshot.empty) return [];
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
        await firestore.collection('landlord_rooms').doc(String(room.id)).set(room);
        console.log(`[FIREBASE] ✅ Đã lưu vĩnh viễn phòng trọ: ${room.id}`);
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
        const snapshot = await firestore.collection('landlord_rooms')
            .where('id', '==', String(roomId)).get();
        if (snapshot.empty) {
            await firestore.collection('landlord_rooms').doc(String(roomId)).delete();
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
        await firestore.collection('pending_rooms').doc(String(room.id)).set(room);
        console.log(`[FIREBASE] ✅ Đã lưu vĩnh viễn tin chờ duyệt: ${room.id}`);
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
            .where('id', '==', String(roomId)).get();
        if (snapshot.empty) {
            await firestore.collection('pending_rooms').doc(String(roomId)).delete();
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
        await firestore.collection('roommates').doc(String(profile.id)).set(profile);
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
            .where('id', '==', String(profileId)).get();
        if (snapshot.empty) {
            await firestore.collection('roommates').doc(String(profileId)).delete();
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

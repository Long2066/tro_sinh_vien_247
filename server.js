const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const fbScraper = require('./fbScraper');
const locationService = require('./locationService');

const PORT = 3000;

// Đường dẫn tệp cấu hình và dữ liệu phòng trọ chủ trọ
const configPath = path.join(__dirname, 'config.json');
const landlordRoomsPath = path.join(__dirname, 'landlord_rooms.json');
const pendingRoomsPath = path.join(__dirname, 'pending_rooms.json');
const scamBlacklistPath = path.join(__dirname, 'scam_blacklist.json');
const roommatesPath = path.join(__dirname, 'roommates.json');
const uploadsDir = path.join(__dirname, 'uploads');

// Tạo thư mục uploads nếu chưa tồn tại
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir);
        console.log("[SERVER] Đã tự động tạo thư mục: uploads");
    } catch (e) {
        console.error("[SERVER] Không thể tạo thư mục uploads:", e.message);
    }
}

// Khởi tạo hàng đợi tin chờ duyệt
function getPendingRooms() {
    if (fs.existsSync(pendingRoomsPath)) {
        try {
            return JSON.parse(fs.readFileSync(pendingRoomsPath, 'utf8'));
        } catch (e) {
            console.error("Lỗi đọc pending_rooms.json:", e.message);
        }
    }
    return [];
}

// Lấy danh sách hồ sơ ở ghép từ roommates.json
function getRoommates() {
    if (fs.existsSync(roommatesPath)) {
        try {
            return JSON.parse(fs.readFileSync(roommatesPath, 'utf8'));
        } catch (e) {
            console.error("Lỗi đọc roommates.json:", e.message);
        }
    }
    return [];
}

// Lấy danh sách đen số điện thoại lừa đảo từ server
function getScamBlacklist() {
    if (fs.existsSync(scamBlacklistPath)) {
        try {
            return JSON.parse(fs.readFileSync(scamBlacklistPath, 'utf8'));
        } catch (e) {}
    }
    const initial = [
        { phone: "0968123456", name: "Lê Văn A (Môi giới lừa đảo phí cọc)", reason: "Bắt chuyển khoản cọc giữ chân rồi chặn liên lạc.", reportedDate: "2026-06-25" },
        { phone: "0345987654", name: "Nguyễn Thị B", reason: "Lừa đảo phí làm hợp đồng, phí xem phòng.", reportedDate: "2026-06-28" },
        { phone: "0888999000", name: "Trần Văn C (Lừa đảo cọc giữ chỗ)", reason: "Yêu cầu đặt cọc giữ chỗ trước khi đến xem phòng rồi khóa máy.", reportedDate: "2026-06-29" }
    ];
    try {
        fs.writeFileSync(scamBlacklistPath, JSON.stringify(initial, null, 2), 'utf8');
    } catch (e) {}
    return initial;
}

// Tính khoảng cách Haversine (km)
function getDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return parseFloat(d.toFixed(2));
}

// Phân tích rủi ro bài viết tự động
function analyzePostRisk(title, description) {
    const text = (title + " " + description).toLowerCase();
    let score = 100;
    const redFlags = [];

    const suspiciousKeywords = [
        { keys: ["cọc giữ chỗ", "cọc giữ phòng", "chuyển khoản cọc", "cọc trước", "chuyển cọc", "nộp cọc", "gửi cọc"], penalty: 45, reason: "Yêu cầu chuyển khoản đặt cọc giữ phòng trước khi xem" },
        { keys: ["phí xem phòng", "phí dẫn đường", "phí xem trọ", "tiền dẫn đường"], penalty: 30, reason: "Yêu cầu trả phí xem phòng hoặc dẫn đường" },
        { keys: ["ở nước ngoài", "đang đi công tác", "không ở hà nội", "không thể cho xem trực tiếp", "khóa cửa tự xem"], penalty: 25, reason: "Chủ nhà viện cớ vắng mặt không thể cho xem phòng trực tiếp" },
        { keys: ["nhận tiền qua thẻ", "nạp thẻ cào", "mua thẻ cào"], penalty: 20, reason: "Đòi thanh toán bằng phương thức không thông dụng (thẻ cào)" }
    ];

    suspiciousKeywords.forEach(item => {
        const found = item.keys.some(k => text.includes(k));
        if (found) {
            score -= item.penalty;
            redFlags.push(item.reason);
        }
    });

    if (score < 10) score = 10;
    return {
        score: score,
        redFlags: redFlags
    };
}

// Khởi tạo và lấy cấu hình hệ thống
function getSystemConfig() {
    let config = { fbCookie: "", fbGroups: [], adminSecretToken: "" };
    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {}
    }
    if (!config.adminSecretToken) {
        config.adminSecretToken = "admin_secret_token_123";
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        } catch (e) {}
    }
    return config;
}

// Kiểm tra mã Token bảo mật của Admin
function checkAdminToken(req) {
    const config = getSystemConfig();
    const authHeader = req.headers['authorization'];
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = req.headers['x-admin-token'] || '';
    }
    return token === config.adminSecretToken;
}

// Phản hồi lỗi chưa xác thực
function sendUnauthorized(res) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Unauthorized. Mã token bảo mật không hợp lệ hoặc thiếu!' }));
}

// Bộ nhớ tạm lưu danh sách phòng trọ cho môi trường Vercel (Read-only filesystem)
let inMemoryLandlordRooms = null;
let inMemoryPendingRooms = null;

// Lấy danh sách phòng trọ do chủ nhà đăng ký
function getLandlordRooms() {
    if (inMemoryLandlordRooms !== null) {
        return inMemoryLandlordRooms;
    }
    if (fs.existsSync(landlordRoomsPath)) {
        try {
            inMemoryLandlordRooms = JSON.parse(fs.readFileSync(landlordRoomsPath, 'utf8'));
            return inMemoryLandlordRooms;
        } catch (e) {
            console.error("Lỗi đọc landlord_rooms.json:", e.message);
        }
    }
    inMemoryLandlordRooms = [];
    return inMemoryLandlordRooms;
}

function saveLandlordRooms(rooms) {
    inMemoryLandlordRooms = rooms;
    try {
        fs.writeFileSync(landlordRoomsPath, JSON.stringify(rooms, null, 2), 'utf8');
    } catch (e) {
        console.warn("[SERVER] Vercel read-only filesystem detected. Updated in-memory landlord rooms state.");
    }
}

function getPendingRooms() {
    if (inMemoryPendingRooms !== null) {
        return inMemoryPendingRooms;
    }
    if (fs.existsSync(pendingRoomsPath)) {
        try {
            inMemoryPendingRooms = JSON.parse(fs.readFileSync(pendingRoomsPath, 'utf8'));
            return inMemoryPendingRooms;
        } catch (e) {}
    }
    inMemoryPendingRooms = [];
    return inMemoryPendingRooms;
}

function savePendingRooms(rooms) {
    inMemoryPendingRooms = rooms;
    try {
        fs.writeFileSync(pendingRoomsPath, JSON.stringify(rooms, null, 2), 'utf8');
    } catch (e) {
        console.warn("[SERVER] Vercel read-only filesystem detected. Updated in-memory pending rooms state.");
    }
}

// Hàm giải mã và lưu hình ảnh Base64
function saveBase64Image(base64Str, index) {
    try {
        const matches = base64Str.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return null;
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');
        
        const filename = `img-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}.${ext}`;
        const filepath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filepath, buffer);
        return `/uploads/${filename}`;
    } catch (e) {
        console.error("Lỗi giải mã base64 và lưu file ảnh:", e.message);
        return null;
    }
}

// Hàm hỗ trợ gửi request HTTPS đến Chợ Tốt
function fetchFromChoTot(lat, lon, distance = 10) {
    return new Promise((resolve, reject) => {
        // Tham số cg=1050 là chuyên mục Phòng trọ của Chợ Tốt
        const chototUrl = `https://gateway.chotot.com/v1/public/ad-listing?cg=1050&latitude=${lat}&longitude=${lon}&distance=${distance}&limit=30`;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        };

        https.get(chototUrl, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error("Không thể parse JSON từ Chợ Tốt"));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Quản lý rate limit đăng tin theo IP
const ipSubmissions = {};
function checkRateLimit(ip) {
    const now = Date.now();
    if (!ipSubmissions[ip]) {
        ipSubmissions[ip] = [];
    }
    // Lọc các yêu cầu trong vòng 1 giờ qua
    ipSubmissions[ip] = ipSubmissions[ip].filter(t => now - t < 60 * 60 * 1000);
    if (ipSubmissions[ip].length >= 3) {
        return false;
    }
    ipSubmissions[ip].push(now);
    return true;
}

// Hàm phân tích tiện nghi phòng trọ từ nội dung mô tả (body)
function parseAmenities(body = '') {
    const text = body.toLowerCase();
    const amenities = [];
    
    if (text.includes('điều hòa') || text.includes('điều hoà') || text.includes('máy lạnh') || text.includes('ac')) {
        amenities.push('AC');
    }
    if (text.includes('wifi') || text.includes('mạng') || text.includes('internet')) {
        amenities.push('Wifi');
    }
    if (text.includes('giường')) {
        amenities.push('Bed');
    }
    if (text.includes('tủ quần áo') || text.includes('tủ đồ') || text.includes('tủ âm tường')) {
        amenities.push('Wardrobe');
    }
    if (text.includes('nóng lạnh') || text.includes('nước nóng') || text.includes('bình nóng')) {
        amenities.push('Heater');
    }
    if (text.includes('tủ lạnh') || text.includes('fridge')) {
        amenities.push('Fridge');
    }
    if (text.includes('ban công') || text.includes('cửa sổ thoáng')) {
        amenities.push('Balcony');
    }
    if (text.includes('bếp') || text.includes('nấu ăn')) {
        amenities.push('Kitchen');
    }
    if (text.includes('máy giặt') || text.includes('giặt đồ')) {
        amenities.push('WashingMachine');
    }
    
    // Mặc định cho ít nhất vài tiện nghi nếu bài viết quá ngắn
    if (amenities.length === 0) {
        return ['Wifi', 'Bed'];
    }
    return amenities;
}

// Hàm trích xuất SĐT từ nội dung (body) phòng trọ (Hỗ trợ dấu chấm, khoảng cách, gạch ngang)
function extractPhone(body = '', defaultPhone = '') {
    const phoneRegex = /(?:(?:\+84|84|0)[35789])(?:[\s\.-]*\d){8}\b/;
    const match = body.match(phoneRegex);
    if (match) {
        return match[0].replace(/[\s\.-]/g, '').replace(/^(\+84|84)/, '0');
    }
    return defaultPhone;
}

// Hàm xử lý request HTTP chính
const requestHandler = async (req, res) => {
    // Cài đặt CORS Header để frontend gọi từ file:// hoặc localhost đều được
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Helper trích xuất body của request POST
    const getRequestBody = (request) => {
        return new Promise((resolve, reject) => {
            let body = '';
            request.on('data', chunk => { body += chunk; });
            request.on('end', () => resolve(body));
            request.on('error', err => reject(err));
        });
    };

    // Kiểm tra bảo mật cho tất cả các API Admin
    if (pathname.startsWith('/api/admin')) {
        if (!checkAdminToken(req)) {
            sendUnauthorized(res);
            return;
        }
    }

    // --- API ĐỊA GIỚI HÀNH CHÍNH ---
    if (pathname === '/api/locations/provinces' && req.method === 'GET') {
        const provinces = locationService.getProvinces();
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(provinces));
        return;
    }

    if (pathname.startsWith('/api/locations/provinces/') && pathname.endsWith('/wards') && req.method === 'GET') {
        const parts = pathname.split('/');
        const provinceCode = parts[4]; // /api/locations/provinces/:code/wards
        const wards = locationService.getWardsByProvince(provinceCode);
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(wards));
        return;
    }

    if (pathname === '/api/locations/standardize' && req.method === 'POST') {
        getRequestBody(req).then(body => {
            try {
                const data = JSON.parse(body);
                const result = locationService.standardizeAddress(data.address);
                res.writeHead(200, { 
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(400, { 
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 'JSON invalid' }));
            }
        });
        return;
    }

    // 0. ENDPOINT API: Lấy danh sách hoặc đăng ký hồ sơ ở ghép
    if (pathname === '/api/roommates' && req.method === 'GET') {
        const roommates = getRoommates();
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(roommates));
        return;
    }

    if (pathname === '/api/roommates' && req.method === 'POST') {
        getRequestBody(req).then(body => {
            try {
                const data = JSON.parse(body);
                if (!data.name || !data.contactPhone || !data.uniId || !data.maxBudget || !data.habits) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: 'Thiếu thông tin bắt buộc!' }));
                    return;
                }

                const roommates = getRoommates();
                const newProfile = {
                    id: "rm-" + Date.now(),
                    name: data.name,
                    gender: data.gender || "Khác",
                    contactPhone: data.contactPhone,
                    uniId: data.uniId,
                    uniAbbr: data.uniAbbr || data.uniId.toUpperCase(),
                    maxBudget: parseInt(data.maxBudget),
                    habits: {
                        cleanliness: parseInt(data.habits.cleanliness) || 3,
                        smoking: data.habits.smoking || "no",
                        sleep: data.habits.sleep || "late",
                        social: data.habits.social || "sometimes"
                    },
                    description: data.description || "Không có mô tả chi tiết."
                };

                roommates.push(newProfile);
                fs.writeFileSync(roommatesPath, JSON.stringify(roommates, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ success: true, profile: newProfile }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Dữ liệu không đúng định dạng JSON!' }));
            }
        }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
        });
        return;
    }

    // 1. ENDPOINT API: Lấy danh sách phòng trọ thật từ Chợ Tốt + Facebook + Chủ trọ đăng trong bán kính tọa độ
    if (pathname === '/api/rooms') {
        const lat = parseFloat(parsedUrl.query.lat);
        const lon = parseFloat(parsedUrl.query.lon);
        const dist = parseFloat(parsedUrl.query.distance) || 5;

        if (isNaN(lat) || isNaN(lon)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Thiếu tọa độ vĩ độ (lat) hoặc kinh độ (lon)!' }));
            return;
        }

        let combinedRooms = [];

        // A. Cào tin thật từ Chợ Tốt
        try {
            console.log(`[API] Đang quét tin đăng phòng trọ thật từ Chợ Tốt tại: [${lat}, ${lon}] bán kính ${dist}km...`);
            const chototData = await fetchFromChoTot(lat, lon, dist);
            
            if (chototData.ads && chototData.ads.length > 0) {
                const formattedRooms = chototData.ads.map((ad) => {
                    const amenities = parseAmenities(ad.body);
                    const contactPhone = extractPhone(ad.body, "09" + Math.floor(10000000 + Math.random() * 90000000));
                    const ownerType = ad.company_ad ? 'broker' : 'owner';
                    
                    const tags = ["Tin thực tế"];
                    if (ad.company_ad) tags.push("Môi giới");
                    if (amenities.includes('AC')) tags.push("Có điều hòa");
                    if (amenities.includes('Balcony')) tags.push("Ban công");
                    if (amenities.includes('Kitchen')) tags.push("Bếp riêng");
                    
                    const distanceToTarget = Math.sqrt(
                        Math.pow(ad.latitude - lat, 2) + Math.pow(ad.longitude - lon, 2)
                    ) * 111.12;

                    return {
                        id: `ct-${ad.ad_id}`,
                        title: ad.subject,
                        price: ad.price,
                        deposit: ad.price,
                        address: (() => {
                            let addr = `${ad.street_name ? ad.street_name + ', ' : ''}${ad.ward_name ? ad.ward_name + ', ' : ''}${ad.area_name}`;
                            if (addr.includes("Hà Giang") && !addr.includes("Tỉnh Hà Giang")) {
                                addr += ", Tỉnh Hà Giang";
                            }
                            return addr;
                        })(),
                        coords: [ad.latitude, ad.longitude],
                        contactPhone: contactPhone,
                        ownerType: ownerType,
                        ownerName: ad.account_name || (ad.company_ad ? "Môi giới dịch vụ" : "Chính chủ trọ"),
                        rating: parseFloat((4.0 + Math.random() * 1.0).toFixed(1)),
                        amenities: amenities,
                        description: ad.body || "Không có nội dung mô tả chi tiết.",
                        nearbyUnis: [
                            { id: "selected-school", distance: parseFloat(distanceToTarget.toFixed(2)) }
                        ],
                        verified: !ad.company_ad,
                        tags: tags
                    };
                });
                combinedRooms = combinedRooms.concat(formattedRooms);
            }
        } catch (error) {
            console.error("[ERROR] Lỗi gọi API Chợ Tốt:", error.message);
        }

        // B. Nạp thêm tin cào từ Facebook (nếu có trong khoảng bán kính quét)
        const fbRoomsPath = path.join(__dirname, 'facebook_rooms.json');
        if (fs.existsSync(fbRoomsPath)) {
            try {
                const fbRooms = JSON.parse(fs.readFileSync(fbRoomsPath, 'utf8'));
                const filteredFbRooms = fbRooms.filter(room => {
                    const distanceToTarget = Math.sqrt(
                        Math.pow(room.coords[0] - lat, 2) + Math.pow(room.coords[1] - lon, 2)
                    ) * 111.12;

                    // Gán khoảng cách động cho trường học đang chọn
                    room.nearbyUnis = [{ id: "selected-school", distance: parseFloat(distanceToTarget.toFixed(2)) }];
                    return distanceToTarget <= dist;
                });
                combinedRooms = combinedRooms.concat(filteredFbRooms);
                console.log(`[API] Đã gộp thêm ${filteredFbRooms.length} tin phòng trọ cào từ Facebook.`);
            } catch (e) {
                console.error("[ERROR] Lỗi đọc facebook_rooms.json:", e.message);
            }
        }

        // C. Nạp thêm tin đăng từ Chủ trọ (lưu ở file landlord_rooms.json)
        try {
            const landlordRooms = getLandlordRooms();
            const filteredLandlordRooms = landlordRooms.filter(room => {
                const distanceToTarget = Math.sqrt(
                    Math.pow(room.coords[0] - lat, 2) + Math.pow(room.coords[1] - lon, 2)
                ) * 111.12;

                room.nearbyUnis = [{ id: "selected-school", distance: parseFloat(distanceToTarget.toFixed(2)) }];
                return distanceToTarget <= dist;
            });
            combinedRooms = combinedRooms.concat(filteredLandlordRooms);
            console.log(`[API] Đã gộp thêm ${filteredLandlordRooms.length} tin phòng trọ của Chủ trọ đăng.`);
        } catch (e) {
            console.error("[ERROR] Lỗi đọc landlord_rooms.json:", e.message);
        }

        // Chuẩn hóa địa chỉ và bổ sung thông tin địa giới hành chính
        combinedRooms = combinedRooms.map(room => {
            const std = locationService.standardizeAddress(room.address);
            return {
                ...room,
                standardizedAddress: std.standardized,
                provinceCode: std.province ? std.province.code : null,
                wardCode: std.ward ? std.ward.code : null
            };
        });

        // Lọc theo Tỉnh/Thành hoặc Phường/Xã nếu được yêu cầu
        const provinceCode = parsedUrl.query.provinceCode;
        const wardCode = parsedUrl.query.wardCode;

        if (provinceCode || wardCode) {
            combinedRooms = combinedRooms.filter(room => {
                if (provinceCode && room.provinceCode !== provinceCode) return false;
                if (wardCode && room.wardCode !== wardCode) return false;
                return true;
            });
            console.log(`[API] Đã lọc còn lại ${combinedRooms.length} phòng theo địa giới hành chính (provinceCode: ${provinceCode}, wardCode: ${wardCode}).`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(combinedRooms));
        return;
    }

    // 1.1. API ADMIN: Lấy cấu hình cài đặt
    if (pathname === '/api/admin/config' && req.method === 'GET') {
        const config = getSystemConfig();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(config));
        return;
    }

    // 1.2. API ADMIN: Lưu cấu hình cài đặt
    if (pathname === '/api/admin/config' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const newConfig = JSON.parse(body);
            
            const oldConfig = getSystemConfig();
            if (!newConfig.adminSecretToken) {
                newConfig.adminSecretToken = oldConfig.adminSecretToken;
            }
            
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi ghi cấu hình', details: e.message }));
        }
        return;
    }

    // 1.3. API ADMIN: Kích hoạt chạy Scraper Facebook ngay lập tức
    if (pathname === '/api/admin/crawl' && req.method === 'POST') {
        fbScraper.runScraper()
            .then(result => {
                console.log("[SCRAPER] Chạy hoàn tất ở background:", result);
            })
            .catch(err => {
                console.error("[SCRAPER] Lỗi chạy background:", err.message);
            });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Đã kích hoạt tiến trình cào Facebook chạy ngầm.' }));
        return;
    }

    // 1.4. API ADMIN: Lấy lịch sử Logs cào dữ liệu gần nhất
    if (pathname === '/api/admin/logs' && req.method === 'GET') {
        const logPath = path.join(__dirname, 'crawler.log');
        let logs = "Chưa có lịch sử cào dữ liệu nào.";
        if (fs.existsSync(logPath)) {
            try {
                logs = fs.readFileSync(logPath, 'utf8');
            } catch (e) {
                logs = "Lỗi đọc file logs.";
            }
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(logs);
        return;
    }

    // 1.5. API ADMIN: Lấy tất cả phòng trọ do chủ nhà đăng ký
    if (pathname === '/api/admin/landlord-rooms' && req.method === 'GET') {
        const rooms = getLandlordRooms();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rooms));
        return;
    }

    // 1.6. API ADMIN: Đăng phòng trọ mới của chủ trọ
    if (pathname === '/api/admin/rooms' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const newRoom = JSON.parse(body);
            
            if (!newRoom.title || !newRoom.price || !newRoom.contactPhone || !newRoom.coords || !newRoom.address) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Thiếu các thông tin bắt buộc!' }));
                return;
            }

            // Lưu các hình ảnh tải lên nếu có
            const savedImageUrls = [];
            if (Array.isArray(newRoom.images)) {
                newRoom.images.slice(0, 4).forEach((base64Str, idx) => {
                    const imgUrl = saveBase64Image(base64Str, idx);
                    if (imgUrl) {
                        savedImageUrls.push(imgUrl);
                    }
                });
            }

            const rooms = getLandlordRooms();
            const roomToSave = {
                id: `ll-${Date.now()}`,
                title: newRoom.title,
                price: parseFloat(newRoom.price),
                deposit: parseFloat(newRoom.deposit || newRoom.price),
                address: newRoom.address,
                coords: [parseFloat(newRoom.coords[0]), parseFloat(newRoom.coords[1])],
                contactPhone: newRoom.contactPhone,
                ownerType: 'owner',
                ownerName: newRoom.ownerName || 'Chủ trọ',
                rating: 5.0,
                amenities: Array.isArray(newRoom.amenities) ? newRoom.amenities : [],
                description: newRoom.description || 'Không có mô tả chi tiết.',
                images: savedImageUrls,
                nearbyUnis: [],
                verified: true,
                tags: ["Chính chủ", "Tin xác minh"]
            };

            rooms.push(roomToSave);
            saveLandlordRooms(rooms);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, room: roomToSave }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi đăng tin phòng trọ', details: e.message }));
        }
        return;
    }

    // 1.7. API ADMIN: Xóa phòng trọ của chủ trọ
    if (pathname === '/api/admin/landlord-rooms' && req.method === 'DELETE') {
        try {
            const roomId = parsedUrl.query.id;
            if (!roomId) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Thiếu ID phòng trọ cần xóa!' }));
                return;
            }

            let rooms = getLandlordRooms();
            const originalLength = rooms.length;
            
            // Xóa file ảnh vật lý trước khi xóa khỏi json
            const roomToDelete = rooms.find(r => r.id === roomId);
            if (roomToDelete && Array.isArray(roomToDelete.images)) {
                roomToDelete.images.forEach(imgUrl => {
                    try {
                        const parts = imgUrl.split('/');
                        const filename = parts[parts.length - 1];
                        const filepath = path.join(uploadsDir, filename);
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                            console.log(`[SERVER] Đã xóa file ảnh vật lý: ${filename}`);
                        }
                    } catch (err) {
                        console.error("Lỗi khi xóa file ảnh vật lý:", err.message);
                    }
                });
            }

            rooms = rooms.filter(r => r.id !== roomId);

            if (rooms.length === originalLength) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Không tìm thấy phòng trọ với ID tương ứng!' }));
                return;
            }

            saveLandlordRooms(rooms);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi xóa phòng trọ', details: e.message }));
        }
        return;
    }

    // 1.8. API CÔNG KHAI: Người dùng gửi tin đăng trọ chờ duyệt
    if (pathname === '/api/rooms/submit' && req.method === 'POST') {
        try {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
            if (!checkRateLimit(ip)) {
                res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Bạn đã đăng quá 3 tin trong vòng 1 giờ. Vui lòng thử lại sau!' }));
                return;
            }

            const body = await getRequestBody(req);
            const newRoom = JSON.parse(body);

            if (!newRoom.title || !newRoom.price || !newRoom.contactPhone || !newRoom.coords || !newRoom.address) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Thiếu các thông tin bắt buộc!' }));
                return;
            }

            // Kiểm tra Blacklist SĐT
            const blacklist = getScamBlacklist();
            const cleanedPhone = newRoom.contactPhone.replace(/[\s\.-]/g, '');
            const isBlacklisted = blacklist.some(b => b.phone.replace(/[\s\.-]/g, '') === cleanedPhone);
            if (isBlacklisted) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Số điện thoại này đã bị báo cáo lừa đảo trên hệ thống! Không thể gửi tin.' }));
                return;
            }

            // Lưu các hình ảnh phòng trọ tải lên nếu có
            const savedImageUrls = [];
            if (Array.isArray(newRoom.images)) {
                newRoom.images.slice(0, 4).forEach((base64Str, idx) => {
                    const imgUrl = saveBase64Image(base64Str, idx);
                    if (imgUrl) {
                        savedImageUrls.push(imgUrl);
                    }
                });
            }

            // Tính khoảng cách GPS chênh lệch
            let gpsDistanceKm = null;
            if (newRoom.userCoords && Array.isArray(newRoom.userCoords) && newRoom.userCoords.length === 2) {
                gpsDistanceKm = getDistanceKm(
                    parseFloat(newRoom.coords[0]), parseFloat(newRoom.coords[1]),
                    parseFloat(newRoom.userCoords[0]), parseFloat(newRoom.userCoords[1])
                );
            }

            // Phân tích rủi ro bài viết
            const riskAnalysis = analyzePostRisk(newRoom.title, newRoom.description || '');

            const pendingRooms = getPendingRooms();
            const pendingRoom = {
                id: `pending-${Date.now()}`,
                title: newRoom.title,
                price: parseFloat(newRoom.price),
                deposit: parseFloat(newRoom.deposit || newRoom.price),
                address: newRoom.address,
                coords: [parseFloat(newRoom.coords[0]), parseFloat(newRoom.coords[1])],
                contactPhone: newRoom.contactPhone,
                ownerType: 'owner',
                ownerName: newRoom.ownerName || 'Chủ trọ',
                rating: 5.0,
                amenities: Array.isArray(newRoom.amenities) ? newRoom.amenities : [],
                description: newRoom.description || 'Không có mô tả chi tiết.',
                images: savedImageUrls,
                userCoords: newRoom.userCoords || null,
                gpsDistanceKm: gpsDistanceKm,
                riskScore: riskAnalysis.score,
                redFlags: riskAnalysis.redFlags,
                submittedAt: new Date().toISOString()
            };

            pendingRooms.push(pendingRoom);
            savePendingRooms(pendingRooms);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Đăng tin thành công! Tin đăng của bạn đang chờ Admin kiểm duyệt.' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi gửi tin đăng phòng trọ', details: e.message }));
        }
        return;
    }

    // 1.9. API ADMIN: Lấy danh sách tin đăng đang chờ duyệt
    if (pathname === '/api/admin/pending-rooms' && req.method === 'GET') {
        const pendingRooms = getPendingRooms();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(pendingRooms));
        return;
    }

    // 1.10. API ADMIN: Phê duyệt tin đăng trọ
    if (pathname === '/api/admin/pending-rooms/approve' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const data = JSON.parse(body);
            const roomId = data.id;

            if (!roomId) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Thiếu ID phòng trọ phê duyệt!' }));
                return;
            }

            let pendingRooms = getPendingRooms();
            const roomIndex = pendingRooms.findIndex(r => r.id === roomId);

            if (roomIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Không tìm thấy phòng trọ trong hàng đợi duyệt!' }));
                return;
            }

            const room = pendingRooms[roomIndex];
            const landlordRooms = getLandlordRooms();

            // Chuyển đổi ID và gán nhãn
            const approvedRoom = {
                id: `ll-${Date.now()}`,
                title: room.title,
                price: room.price,
                deposit: room.deposit,
                address: room.address,
                coords: room.coords,
                contactPhone: room.contactPhone,
                ownerType: room.ownerType,
                ownerName: room.ownerName,
                rating: room.rating,
                amenities: room.amenities,
                description: room.description,
                images: room.images,
                verified: true,
                tags: ["Chính chủ", "Tin xác minh"]
            };

            landlordRooms.push(approvedRoom);
            saveLandlordRooms(landlordRooms);

            // Xóa khỏi hàng đợi duyệt
            pendingRooms.splice(roomIndex, 1);
            savePendingRooms(pendingRooms);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, room: approvedRoom }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi phê duyệt phòng trọ', details: e.message }));
        }
        return;
    }

    // 1.11. API ADMIN: Từ chối tin đăng trọ
    if (pathname === '/api/admin/pending-rooms/reject' && req.method === 'POST') {
        try {
            const body = await getRequestBody(req);
            const data = JSON.parse(body);
            const roomId = data.id;

            if (!roomId) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Thiếu ID phòng trọ bị từ chối!' }));
                return;
            }

            let pendingRooms = getPendingRooms();
            const roomIndex = pendingRooms.findIndex(r => r.id === roomId);

            if (roomIndex === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Không tìm thấy phòng trọ trong hàng đợi duyệt!' }));
                return;
            }

            const room = pendingRooms[roomIndex];

            // Xóa hình ảnh vật lý của phòng trọ bị từ chối
            if (Array.isArray(room.images)) {
                room.images.forEach(imgUrl => {
                    try {
                        const parts = imgUrl.split('/');
                        const filename = parts[parts.length - 1];
                        const filepath = path.join(uploadsDir, filename);
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                            console.log(`[SERVER] Đã xóa file ảnh phòng trọ bị từ chối: ${filename}`);
                        }
                    } catch (err) {
                        console.error("Lỗi khi xóa file ảnh phòng trọ bị từ chối:", err.message);
                    }
                });
            }

            // Xóa khỏi hàng đợi duyệt
            pendingRooms.splice(roomIndex, 1);
            savePendingRooms(pendingRooms);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Lỗi từ chối phòng trọ', details: e.message }));
        }
        return;
    }

    // 2. PHỤC VỤ CÁC FILE STATIC (Giao diện Web)
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    
    // Bảo vệ bảo mật thư mục
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Access Denied');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1><p>File không tồn tại trên Server.</p>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
};

// Xuất module requestHandler cho Vercel Serverless Function
module.exports = requestHandler;

// Lắng nghe cổng nếu chạy dưới môi trường Node.js local
if (!process.env.VERCEL) {
    const server = http.createServer(requestHandler);
    server.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 [SERVER KHỞI CHẠY] Smart Room Finder đang hoạt động!`);
        console.log(`👉 Truy cập giao diện chính: http://localhost:${PORT}`);
        console.log(`👉 Cổng API tin thật: http://localhost:${PORT}/api/rooms`);
        console.log(`======================================================\n`);
    });
}

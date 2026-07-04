const https = require('https');
const fs = require('fs');
const path = require('path');

// Đường dẫn lưu file kết quả phòng trọ cào từ Facebook
const ROOMS_FILE_PATH = path.join(__dirname, 'facebook_rooms.json');
const LOG_FILE_PATH = path.join(__dirname, 'crawler.log');

// Ghi log ra file và console
function writeLog(message) {
    const time = new Date().toLocaleTimeString();
    const logLine = `[${time}] ${message}\n`;
    console.log(`[FB-SCRAPER] ${message}`);
    try {
        fs.appendFileSync(LOG_FILE_PATH, logLine, 'utf8');
    } catch (err) {
        console.error("Lỗi ghi log file:", err.message);
    }
}

// Hàm chuẩn hóa và chuyển đổi định dạng Cookie (hỗ trợ cả dạng Header String và JSON Array)
function formatCookie(cookieInput = '') {
    const trimmed = cookieInput.trim();
    if (!trimmed) return '';
    
    // Nếu là định dạng JSON Array (thường xuất khẩu từ các tiện ích Chrome)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map(c => {
                    if (c.name && c.value) {
                        return `${c.name}=${c.value}`;
                    }
                    return '';
                }).filter(Boolean).join('; ');
            }
        } catch (e) {
            // Fallback nếu lỗi parse JSON
        }
    }
    return trimmed;
}

// Gửi request HTTPS Facebook Desktop
function fetchHtml(url, cookie) {
    return new Promise((resolve, reject) => {
        const formattedCookie = formatCookie(cookie);
        const options = {
            headers: {
                'Cookie': formattedCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            }
        };

        https.get(url, options, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                const redirectUrl = res.headers.location;
                writeLog(`Chuyển hướng (Redirect) sang: ${redirectUrl}`);
                fetchHtml(redirectUrl, cookie).then(resolve).catch(reject);
                return;
            }

            let html = '';
            res.on('data', (chunk) => { html += chunk; });
            res.on('end', () => resolve(html));
        }).on('error', (err) => reject(err));
    });
}

// Bóc tách tên đường/landmark để phục vụ geocoding
function extractStreetName(text) {
    // Tìm các từ khóa chỉ đường phố: ngõ 105 Xuân Thủy, đường Nguyễn Du, v.v.
    const streetRegex = /(?:ngõ|ngách|đường|phố|số|tại|khu|ngã tư|gần)\s+([0-9A-Za-zà-ỹ\s]{3,25}(?:\s+[A-ZÀ-Ỹa-zà-ỹ0-9]+){1,3})/i;
    const match = text.match(streetRegex);
    if (match) {
        let clean = match[0].trim();
        // Loại bỏ các từ mô tả phụ nếu có
        clean = clean.replace(/khép kín|giá rẻ|chính chủ|đầy đủ|điều hòa|nóng lạnh/gi, '').trim();
        return clean;
    }
    return null;
}

// Kiểm tra xem bài đăng có thực sự là tin cho thuê trọ hay không
function isRoomRentalPost(text) {
    const cleanText = text.toLowerCase();
    const rentalKeywords = [
        "cho thuê", "thuê phòng", "thuê nhà", "phòng trọ", "nhà trọ", 
        "chung cư mini", "ccmn", "phòng khép kín", "căn hộ", "ở ghép", 
        "tìm trọ", "cho thuê trọ", "kiếm trọ", "nhà nguyên căn", 
        "phòng cho thuê", "nhà cho thuê", "studio", "tìm bạn ở cùng",
        "phòng khép", "trọ khép kín", "nhà trọ khép kín", "phòng đơn", "phòng đôi"
    ];
    
    // Kiểm tra xem có chứa ít nhất 1 từ khóa tích cực về thuê trọ không
    const hasKeyword = rentalKeywords.some(kw => cleanText.includes(kw));
    
    // Một số từ khóa phủ định rõ ràng không phải thuê trọ (ví dụ: bán đồ ăn, tuyển dụng, bán hàng, ship đồ, thanh lý quần áo)
    const negativeKeywords = [
        "ship đồ", "tuyển nhân viên", "tuyển dụng", "bán xe", "thanh lý quần áo",
        "thanh lý đồ", "quần áo", "giày dép", "ăn đêm", "đồ ăn", "ship tận nơi",
        "ship hàng", "giao tận nơi", "ship 24/7", "ship đêm"
    ];
    const hasNegativeKeyword = negativeKeywords.some(kw => cleanText.includes(kw));

    return hasKeyword && !hasNegativeKeyword;
}

// Gọi API Nominatim để lấy tọa độ từ tên địa chỉ
function geocodeAddress(addressName, defaultCity = "Hà Nội") {
    return new Promise((resolve) => {
        const searchQuery = `${addressName}, ${defaultCity}, Vietnam`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;
        
        const options = {
            headers: {
                'User-Agent': 'SmartRoomFinderScraper/1.0 (Student Room Project)'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed && parsed.length > 0) {
                        resolve([parseFloat(parsed[0].lat), parseFloat(parsed[0].lon)]);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => {
            resolve(null);
        });
    });
}

// Hàm chạy cào dữ liệu từ danh sách nhóm
async function runScraper() {
    // Tạo/Xóa log cũ cho phiên mới
    fs.writeFileSync(LOG_FILE_PATH, `--- Khởi tạo phiên cào dữ liệu Facebook mới: ${new Date().toLocaleString()} ---\n`, 'utf8');
    writeLog("Đang tải tệp cấu hình config.json...");
    
    let config = { fbCookie: "", fbGroups: [] };
    const configPath = path.join(__dirname, 'config.json');
    
    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            writeLog("❌ Lỗi parse config.json! Kiểm tra lại định dạng file.");
            return { error: "Lỗi file config.json" };
        }
    } else {
        writeLog("❌ Không tìm thấy file config.json! Hãy điền cấu hình trên trang Admin trước.");
        return { error: "Thiếu config.json" };
    }

    if (!config.fbCookie) {
        writeLog("❌ Chưa có Cookie Facebook! Hãy dán Cookie tại tab Admin.");
        return { error: "Thiếu Cookie" };
    }

    if (!config.fbGroups || config.fbGroups.length === 0) {
        writeLog("⚠️ Danh sách Group trống! Vui lòng thêm link nhóm.");
        return { success: true, count: 0 };
    }

    writeLog(`Đã tải cấu hình: phát hiện ${config.fbGroups.length} nhóm cần quét.`);
    
    let allScrapedRooms = [];
    // Nếu có file kết quả cũ, đọc lên để cập nhật chứ không ghi đè mất các nhóm khác
    if (fs.existsSync(ROOMS_FILE_PATH)) {
        try {
            allScrapedRooms = JSON.parse(fs.readFileSync(ROOMS_FILE_PATH, 'utf8'));
        } catch (e) {
            allScrapedRooms = [];
        }
    }

    let newRoomsCount = 0;

    for (const groupConfig of config.fbGroups) {
        // Hỗ trợ dạng: "URL | Thành phố" hoặc chỉ "URL"
        const parts = groupConfig.split('|');
        const groupUrl = parts[0].trim();
        const defaultCity = parts[1] ? parts[1].trim() : "Hà Nội";

        // Trích xuất ID nhóm từ URL (ví dụ: facebook.com/groups/12345/ -> 12345)
        const idMatch = groupUrl.match(/\/groups\/([0-9a-zA-Z\.\-]+)/);
        if (!idMatch) {
            writeLog(`❌ URL nhóm không hợp lệ: "${groupUrl}"`);
            continue;
        }
        const groupId = idMatch[1];
        writeLog(`🔄 Bắt đầu quét Nhóm: [ID: ${groupId}] (Định vị mặc định: ${defaultCity})...`);

        const scrapeUrl = `https://www.facebook.com/groups/${groupId}`;

        try {
            const html = await fetchHtml(scrapeUrl, config.fbCookie);
            
            // Kiểm tra xem cookie có hoạt động không
            if (html.includes('login_form') || html.includes('Mật khẩu') || html.includes('Bạn phải đăng nhập')) {
                writeLog(`❌ Cookie Facebook hết hạn hoặc không hợp lệ! Vui lòng cập nhật Cookie mới.`);
                break;
            }

            // Phân tích mã nguồn Comet JSON của Facebook để bóc tách bài viết
            const posts = [];
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
            let match;

            while ((match = scriptRegex.exec(html)) !== null) {
                const content = match[1];
                if (content.includes('"comet_sections"') || content.includes('"story"') || content.includes('"message"')) {
                    const msgRegex = /"message"\s*:\s*\{\s*"text"\s*:\s*"([^"]+)"/g;
                    let msgMatch;
                    while ((msgMatch = msgRegex.exec(content)) !== null) {
                        const rawText = msgMatch[1];
                        let text = rawText;
                        try {
                            text = JSON.parse(`"${rawText}"`);
                        } catch (e) {}

                        // Chuẩn hóa emoji số thành số thường để tránh bị lọt lưới số điện thoại
                        const normalizedText = text.replace(/[\ufe0f\u20e3]/g, '')
                            .replace(/⓪|⁰|₀/g, '0')
                            .replace(/①|¹|₁/g, '1')
                            .replace(/②|²|₂/g, '2')
                            .replace(/③|³|₃/g, '3')
                            .replace(/④|⁴|₄/g, '4')
                            .replace(/⑤|⁵|₅/g, '5')
                            .replace(/⑥|⁶|₆/g, '6')
                            .replace(/⑦|⁷|₇/g, '7')
                            .replace(/⑧|⁸|₈/g, '8')
                            .replace(/⑨|⁹|₉/g, '9');

                        // Kiểm tra xem có số điện thoại không và có phải là bài đăng thuê trọ không
                        const phoneRegex = /(?:(?:\+84|84|0)[35789])(?:[\s\.-]*\d){8}\b/g;
                        const phoneMatches = normalizedText.match(phoneRegex);
                        
                        if (phoneMatches && isRoomRentalPost(normalizedText)) {
                            const contactPhone = phoneMatches[0].replace(/[\s\.-]/g, '').replace(/^(\+84|84)/, '0');
                            
                            // Trích xuất ID bài viết và tên tác giả từ vùng văn bản xung quanh
                            const msgIndex = msgMatch.index;
                            const surrounding = content.slice(Math.max(0, msgIndex - 2000), Math.min(content.length, msgIndex + 2000));
                            
                            const idMatch = surrounding.match(/"post_id"\s*:\s*"([0-9]+)"/) || 
                                            surrounding.match(/"story_fbid"\s*:\s*"([0-9]+)"/) ||
                                            surrounding.match(/"id"\s*:\s*"([0-9]+)"/);
                            
                            const postId = idMatch ? `fb-${idMatch[1]}` : `fb-${Date.now()}-${posts.length}`;

                            // Lọc các bài viết được đăng quá 3 ngày đổ lại
                            const creationTimeMatch = surrounding.match(/"creation_time"\s*:\s*([0-9]+)/);
                            if (creationTimeMatch) {
                                const creationTime = parseInt(creationTimeMatch[1]) * 1000;
                                const daysAgo = (Date.now() - creationTime) / (1000 * 60 * 60 * 24);
                                if (daysAgo > 3) {
                                    continue; // Bỏ qua bài viết cũ
                                }
                            }

                            const authorMatch = surrounding.match(/"name"\s*:\s*"([^"]+)"/);
                            const authorName = authorMatch ? JSON.parse(`"${authorMatch[1]}"`) : "Người đăng Facebook";

                            // Trích xuất hình ảnh CDN từ vùng xung quanh (nếu có)
                            const imgRegex = /https:\\\/\\\/scontent\.[a-z0-9\-]+\.fna\.fbcdn\.net\\\/v\\\/[^\s"\\]+?_n\.(?:jpg|png|webp)/gi;
                            let imgMatch;
                            const images = [];
                            while ((imgMatch = imgRegex.exec(surrounding)) !== null) {
                                let imgUrl = imgMatch[0].replace(/\\/g, '');
                                if (!images.includes(imgUrl) && images.length < 4) {
                                    images.push(imgUrl);
                                }
                            }

                            if (!posts.some(p => p.id === postId)) {
                                posts.push({
                                    id: postId,
                                    phone: contactPhone,
                                    text: text,
                                    authorName: authorName,
                                    images: images
                                });
                            }
                        }
                    }
                }
            }

            writeLog(`✔️ Quét được ${posts.length} bài đăng trên trang chủ nhóm.`);

            for (let i = 0; i < posts.length; i++) {
                const post = posts[i];
                const postId = post.id;
                const authorName = post.authorName;
                const contactPhone = post.phone;
                const cleanText = post.text.replace(/\s+/g, ' ').trim();
                const postUrl = `https://facebook.com/groups/${groupId}/permalink/${postId.replace('fb-', '')}`;
                const images = post.images;

                // Tránh ghi đè tin trùng lặp
                if (allScrapedRooms.some(r => r.id === postId)) {
                    continue;
                }

                writeLog(`➕ Phát hiện phòng trọ mới! SĐT: ${contactPhone} - Đăng bởi: ${authorName}`);
                
                // Trích xuất địa chỉ đường phố để định vị
                const streetName = extractStreetName(cleanText);
                let coords = null;
                let finalAddress = `Nhóm Facebook (${defaultCity})`;

                if (streetName) {
                    writeLog(`📍 Đang định vị địa chỉ "${streetName}" qua Nominatim OSM...`);
                    coords = await geocodeAddress(streetName, defaultCity);
                    if (coords) {
                        finalAddress = `${streetName}, Thành phố ${defaultCity}`;
                        writeLog(`📍 Định vị thành công: [${coords[0]}, ${coords[1]}]`);
                    }
                }

                    // Nếu không định vị được đường phố, lấy tọa độ mặc định hơi lệch một chút so với trung tâm thành phố để không bị chồng ghim
                    if (!coords) {
                        if (defaultCity.toLowerCase().includes("hà giang")) {
                            coords = [22.812 + (Math.random() - 0.5) * 0.02, 104.981 + (Math.random() - 0.5) * 0.02]; // Hà Giang
                            finalAddress = `Khu vực Thành phố Hà Giang, Tỉnh Hà Giang`;
                        } else {
                            coords = [21.028 + (Math.random() - 0.5) * 0.04, 105.84 + (Math.random() - 0.5) * 0.04]; // Hà Nội
                            finalAddress = `Khu vực Thành phố Hà Nội`;
                        }
                    }

                    // Trích xuất giá
                    const price = extractPrice(cleanText);

                    // Bóc tách tiện nghi
                    const amenities = [];
                    const textLower = cleanText.toLowerCase();
                    if (textLower.includes('điều hòa') || textLower.includes('máy lạnh') || textLower.includes('ac')) amenities.push('AC');
                    if (textLower.includes('wifi') || textLower.includes('mạng') || textLower.includes('internet')) amenities.push('Wifi');
                    if (textLower.includes('giường')) amenities.push('Bed');
                    if (textLower.includes('tủ quần áo') || textLower.includes('tủ đồ')) amenities.push('Wardrobe');
                    if (textLower.includes('nóng lạnh') || textLower.includes('bình nóng') || textLower.includes('nước nóng')) amenities.push('Heater');
                    if (textLower.includes('tủ lạnh')) amenities.push('Fridge');
                    if (textLower.includes('ban công')) amenities.push('Balcony');
                    if (textLower.includes('bếp') || textLower.includes('nấu ăn')) amenities.push('Kitchen');
                    if (textLower.includes('máy giặt')) amenities.push('WashingMachine');

                    if (amenities.length === 0) {
                        amenities.push('Wifi', 'Bed');
                    }

                    // Tiêu đề ngắn gọn
                    let title = cleanText.slice(0, 50) + "...";
                    if (cleanText.includes("cho thuê") || cleanText.includes("Cho thuê")) {
                        const idx = cleanText.toLowerCase().indexOf("cho thuê");
                        title = cleanText.slice(idx, idx + 60) + "...";
                    }

                    const fbRoom = {
                        id: postId,
                        title: title,
                        price: price,
                        deposit: price,
                        address: finalAddress,
                        coords: coords,
                        contactPhone: contactPhone,
                        ownerType: "owner", // Xem như chủ nhà tự đăng
                        ownerName: authorName,
                        rating: 4.5,
                        amenities: amenities,
                        description: cleanText.length > 500 ? cleanText.slice(0, 500) + "..." : cleanText,
                        nearbyUnis: [
                            { id: "selected-school", distance: 1.0 } // Sẽ được tính lại khoảng cách động ở frontend
                        ],
                        verified: false,
                        tags: ["Tin Facebook", "Cào tự động"],
                        fbPostUrl: postUrl // Đường dẫn tới bài viết gốc
                    };

                    allScrapedRooms.unshift(fbRoom); // Đưa tin mới lên đầu
                    newRoomsCount++;
                }

            // Nghỉ 3 giây giữa các group để tránh bị Facebook chặn rate-limit
            await new Promise(r => setTimeout(r, 3000));

        } catch (err) {
            writeLog(`❌ Lỗi kết nối nhóm ${groupId}: ${err.message}`);
        }
    }

    // Ghi kết quả lưu lại
    try {
        fs.writeFileSync(ROOMS_FILE_PATH, JSON.stringify(allScrapedRooms, null, 2), 'utf8');
        writeLog(`==============================================`);
        writeLog(`🎉 HOÀN THÀNH TIẾN TRÌNH CÀO DỮ LIỆU!`);
        writeLog(`👉 Đã lưu tổng cộng ${allScrapedRooms.length} tin trọ Facebook.`);
        writeLog(`👉 Số tin đăng mới tìm thấy trong phiên này: ${newRoomsCount} tin.`);
        writeLog(`==============================================`);
        return { success: true, count: newRoomsCount, total: allScrapedRooms.length };
    } catch (writeErr) {
        writeLog(`❌ Không thể ghi file kết quả: ${writeErr.message}`);
        return { error: writeErr.message };
    }
}

function extractPrice(text) {
    if (!text) return 2000000;

    const cleanText = text.toLowerCase();

    // 1. Dạng đặc biệt "2tr5" (số + tr + số) hoặc "2t5"
    const trNumRegex = /(\d+)\s*(?:tr|t)\s*(\d+)/i;
    const trNumMatch = cleanText.match(trNumRegex);
    if (trNumMatch) {
        const tr = parseInt(trNumMatch[1]);
        const leStr = trNumMatch[2];
        const le = parseInt(leStr);
        let multiplier = 1;
        if (leStr.length === 1) multiplier = 100000;
        else if (leStr.length === 2) multiplier = 10000;
        else if (leStr.length === 3) multiplier = 1000;
        return tr * 1000000 + le * multiplier;
    }

    // 2. Dạng k (ví dụ: 4000k, 1800k, 2500k, 1.800k)
    const kRegex = /(\d+[\.,]?\d*)\s*k(?![a-zA-Z0-9])/i;
    const kMatch = cleanText.match(kRegex);
    if (kMatch) {
        let val = parseFloat(kMatch[1].replace(/\./g, '').replace(',', '.'));
        if (val >= 100 && val <= 50000) {
            return val * 1000;
        }
    }

    // 3. Dạng triệu/tr/trieu (ví dụ: 4tr, 4 triệu, 2.5tr, 2,5tr)
    const trRegex = /(\d+[\.,]?\d*)\s*(tr|triệu|trieu)\b/i;
    const trMatch = cleanText.match(trRegex);
    if (trMatch) {
        let val = parseFloat(trMatch[1].replace(',', '.'));
        if (val > 0 && val < 50) {
            return val * 1000000;
        }
    }

    // 4. Dạng số đầy đủ (ví dụ: 4.000.000, 4,000,000, 4000000)
    const fullNumRegex = /(\d{1,3}(?:[\.,]\d{3})+|\d{6,8})\s*(?:vnd|đ|d)?/i;
    const fullNumMatch = cleanText.match(fullNumRegex);
    if (fullNumMatch) {
        let numStr = fullNumMatch[1].replace(/[\.,\s]/g, '');
        let val = parseInt(numStr);
        if (val >= 300000 && val <= 50000000) {
            return val;
        }
    }

    return 2000000; // Giá mặc định 2 triệu
}

module.exports = {
    runScraper
};

// Quản lý trạng thái ứng dụng
let appState = {
    rooms: [],
    blacklist: [],
    roommates: [],
    rentedRoomIds: JSON.parse(localStorage.getItem('rented_rooms')) || [], // Danh sách ID phòng trọ đã được báo thuê/hết phòng
    map: null,
    markers: {},
    uniMarker: null,
    activeTab: 'find-rooms',
    selectedRoomId: null,
    isMapVisibleOnMobile: true,
    selectedSchool: null, // Đối tượng trường học đang được chọn { id, name, coords, address }
    isSelectingLocationForPost: false,
    selectedPostImages: [],
    userCoords: null,
    postMarker: null
};

// Khởi chạy ứng dụng khi DOM tải xong
document.addEventListener('DOMContentLoaded', () => {
    initData();
    initTabNavigation();
    initMap();
    initSchoolAutocomplete();
    renderRooms(appState.rooms);
    renderBlacklist(appState.blacklist);
    initRoommates();
    initEventListeners();
    initLocationFilters();

    // Mặc định tự động chọn Phân hiệu Đại học Thái Nguyên tại Hà Giang
    if (UNIVERSITIES && UNIVERSITIES.length > 0) {
        selectSchool(UNIVERSITIES[0]);
    }

    // Tự động đồng bộ thời gian thực mỗi 6 giây (Điện thoại & Laptop luôn khớp dữ liệu chuẩn không cần F5)
    setInterval(() => {
        if (appState.selectedSchool) {
            fetchRealRooms(appState.selectedSchool.coords[0], appState.selectedSchool.coords[1], appState.selectedSchool.id);
        }
    }, 6000);
});

// 1. Khởi tạo dữ liệu (từ LocalStorage hoặc dùng dữ liệu mẫu ban đầu)
function initData() {
    appState.rooms = [...MOCK_ROOMS];
    
    // Tải danh sách đen số điện thoại từ LocalStorage hoặc dữ liệu mặc định
    const savedBlacklist = localStorage.getItem('scam_blacklist');
    if (savedBlacklist) {
        appState.blacklist = JSON.parse(savedBlacklist);
    } else {
        appState.blacklist = [...INITIAL_BLACKLIST];
        localStorage.setItem('scam_blacklist', JSON.stringify(appState.blacklist));
    }
}

// 2. Thiết lập điều hướng Tab
function initTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Xóa active cũ
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            // Thêm active mới
            btn.classList.add('active');
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
            
            appState.activeTab = targetTab;
            
            // Cập nhật lại kích thước bản đồ khi đổi tab (đề phòng bản đồ bị lệch kích thước)
            if (appState.map) {
                setTimeout(() => appState.map.invalidateSize(), 100);
            }
        });
    });
}

// 3. Khởi tạo Bản đồ Leaflet.js
function initMap() {
    // Tọa độ trung tâm Hà Nội (Khu vực Đống Đa/Hai Bà Trưng)
    const hanoiCenter = [21.012, 105.825];
    
    appState.map = L.map('map', {
        zoomControl: false // Chúng ta sẽ tự thêm zoom control ở vị trí khác cho đẹp
    }).setView(hanoiCenter, 13);

    // Thêm tile bản đồ từ OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(appState.map);

    // Thêm Zoom Control góc dưới bên phải để tránh chèn thanh tiêu đề
    L.control.zoom({
        position: 'bottomright'
    }).addTo(appState.map);

    // Bắt sự kiện Click bản đồ để định vị khi đăng phòng trọ
    appState.map.on('click', (e) => {
        if (!appState.isSelectingLocationForPost) return;

        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        document.getElementById('post-lat').value = lat.toFixed(6);
        document.getElementById('post-lon').value = lon.toFixed(6);

        if (appState.postMarker) {
            appState.postMarker.setLatLng(e.latlng);
        } else {
            appState.postMarker = L.marker(e.latlng).addTo(appState.map);
        }

        // Geocoding Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, {
            headers: { 'User-Agent': 'SmartRoomFinder/1.0' }
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.display_name) {
                const cleanAddr = data.display_name.split(',').slice(0, 4).join(',').trim();
                document.getElementById('post-address').value = cleanAddr;
            }
        })
        .catch(err => console.log("Không giải mã được địa chỉ tọa độ click:", err));
    });
}

// 4. Khởi tạo tìm kiếm trường Đại học thông minh (Autocomplete & API Geocoding)
function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function expandSchoolAbbreviations(normalizedValue) {
    return ` ${normalizedValue} `
        .replace(/\bdh\s*tn\b/g, ' dai hoc thai nguyen ')
        .replace(/\bdhtn\b/g, ' dai hoc thai nguyen ')
        .replace(/\bđhtn\b/g, ' dai hoc thai nguyen ')
        .replace(/\bhg\b/g, ' ha giang ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getSchoolSearchTerms(school) {
    const aliases = Array.isArray(school.aliases) ? school.aliases : [];
    return [school.name, school.abbr, school.address, ...aliases]
        .map(normalizeSearchText)
        .filter(Boolean);
}

function schoolMatchesQuery(school, rawQuery) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return true;

    const expandedQuery = expandSchoolAbbreviations(query);
    const searchableText = getSchoolSearchTerms(school).join(' ');

    return searchableText.includes(query) ||
        (expandedQuery !== query && searchableText.includes(expandedQuery));
}

function getLocalSchoolMatches(rawQuery) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return UNIVERSITIES;

    return UNIVERSITIES.filter(uni => schoolMatchesQuery(uni, query));
}

function getBestSchoolMatch(rawQuery) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return null;

    const expandedQuery = expandSchoolAbbreviations(query);
    const localMatches = getLocalSchoolMatches(query);
    if (localMatches.length === 0) return null;

    return localMatches.find(uni => {
        const terms = getSchoolSearchTerms(uni);
        return terms.includes(query) || terms.includes(expandedQuery);
    }) || localMatches[0];
}

function mergeSchoolSuggestions(localMatches, apiMatches) {
    const combined = [...localMatches];

    apiMatches.forEach(apiSchool => {
        const exists = combined.some(localSchool => {
            const sameName = normalizeSearchText(localSchool.name) === normalizeSearchText(apiSchool.name);
            const hasCoords = Array.isArray(localSchool.coords) && Array.isArray(apiSchool.coords);
            const sameArea = hasCoords && getDistance(
                localSchool.coords[0], localSchool.coords[1],
                apiSchool.coords[0], apiSchool.coords[1]
            ) < 0.1;

            return sameName || sameArea;
        });

        if (!exists) {
            combined.push(apiSchool);
        }
    });

    return combined;
}

function revealRoomSearchResultsOnMobile() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 900px)').matches) return;

    const container = document.querySelector('.app-container');
    const sidebar = document.getElementById('sidebar');
    const mobileToggleBtn = document.getElementById('mobile-map-toggle');
    const sheetBtnText = document.getElementById('sheet-toggle-text');
    const sheetBtnIcon = document.getElementById('sheet-toggle-icon');
    const tabWrapper = document.querySelector('.tab-content-wrapper');
    const roomList = document.getElementById('room-list');

    if (!container || !sidebar) return;

    sidebar.classList.remove('hidden');
    container.classList.add('map-collapsed');
    appState.isMapVisibleOnMobile = false;

    if (sheetBtnText) sheetBtnText.textContent = "Hiện Bản Đồ";
    if (sheetBtnIcon) sheetBtnIcon.className = "fa-solid fa-expand";
    if (mobileToggleBtn) mobileToggleBtn.innerHTML = '<i class="fa-solid fa-map"></i> Xem bản đồ';

    setTimeout(() => {
        if (tabWrapper && roomList) {
            tabWrapper.scrollTo({
                top: Math.max(roomList.offsetTop - 18, 0),
                behavior: 'smooth'
            });
        }
    }, 220);
}

function initSchoolAutocomplete() {
    const input = document.getElementById('uni-search-input');
    const suggestionsContainer = document.getElementById('uni-suggestions');
    const clearBtn = document.getElementById('clear-uni-btn');
    let debounceTimer;
    let activeSearchController = null;

    // Hiển thị gợi ý mặc định khi focus vào ô tìm kiếm
    input.addEventListener('focus', () => {
        if (input.value.trim() === '') {
            renderSchoolSuggestions(UNIVERSITIES);
        }
    });

    // Bấm ra ngoài thì ẩn gợi ý
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== suggestionsContainer && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Bắt đầu gõ bàn phím (Sử dụng cơ chế Debounce)
    input.addEventListener('input', () => {
        const query = input.value.trim();
        clearBtn.style.display = query !== '' ? 'block' : 'none';

        if (activeSearchController) {
            activeSearchController.abort();
            activeSearchController = null;
        }

        // Khi người dùng bắt đầu nhập trường mới, bỏ chọn trường cũ nhưng không xóa trắng danh sách,
        // tránh tình trạng trên điện thoại vừa gõ xong đã thấy "0 kết quả" nếu API gợi ý bị chậm.
        if (query !== '') {
            appState.selectedSchool = null;
            if (appState.uniMarker) {
                appState.map.removeLayer(appState.uniMarker);
                appState.uniMarker = null;
            }
        }

        clearTimeout(debounceTimer);

        if (query === '') {
            renderSchoolSuggestions(UNIVERSITIES);
            return;
        }

        // 1. Tìm kiếm cục bộ ngay lập tức, hỗ trợ nhập không dấu trên bàn phím điện thoại.
        const localMatches = getLocalSchoolMatches(query);
        renderSchoolSuggestions(localMatches);

        debounceTimer = setTimeout(() => {
            const requestQuery = input.value.trim();
            if (requestQuery === '') {
                renderSchoolSuggestions(UNIVERSITIES);
                return;
            }

            // 2. Tìm kiếm qua API OpenStreetMap Nominatim (lấy 6 kết quả tại Việt Nam)
            const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(requestQuery)}+Vietnam&format=json&limit=6`;
            activeSearchController = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = activeSearchController ? setTimeout(() => activeSearchController.abort(), 3500) : null;
            const fetchOptions = activeSearchController ? { signal: activeSearchController.signal } : {};

            fetch(apiUrl, fetchOptions)
            .then(res => res.json())
            .then(data => {
                // Nếu người dùng đã gõ tiếp trong lúc API trả về, bỏ qua kết quả cũ.
                if (input.value.trim() !== requestQuery) return;

                const apiMatches = (Array.isArray(data) ? data : [])
                    .map((item, index) => {
                        const parts = String(item.display_name || '').split(',');
                        const name = parts[0] || requestQuery;
                        const lat = parseFloat(item.lat);
                        const lon = parseFloat(item.lon);
                        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

                        const address = formatAddressToPostMerger(parts.slice(1, 4).join(',').trim());
                        return {
                            id: `osm-${index}-${Date.now()}`,
                            name: name,
                            abbr: name.match(/\b([A-ZĐĐ]{3,})\b/) ? name.match(/\b([A-ZĐĐ]{3,})\b/)[0] : 'ĐH/CĐ',
                            coords: [lat, lon],
                            address: address
                        };
                    })
                    .filter(Boolean);

                renderSchoolSuggestions(mergeSchoolSuggestions(getLocalSchoolMatches(requestQuery), apiMatches));
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.warn("OSM API error (offline/rate limit):", err);
                }
                renderSchoolSuggestions(getLocalSchoolMatches(input.value.trim()));
            })
            .finally(() => {
                if (timeoutId) clearTimeout(timeoutId);
                activeSearchController = null;
            });
        }, 350); // Đợi 350ms sau khi ngừng gõ để tránh spam API
    });

    // Hỗ trợ bấm Enter/Done trên bàn phím điện thoại để chọn gợi ý đầu tiên hoặc tự động chọn trường gần đúng nhất
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const suggestionsContainer = document.getElementById('uni-suggestions');
            const items = suggestionsContainer.querySelectorAll('.suggestion-item');
            if (items.length > 0) {
                // Click gợi ý đầu tiên
                items[0].click();
            } else {
                const matched = getBestSchoolMatch(input.value.trim());
                if (matched) {
                    selectSchool(matched);
                }
            }
            suggestionsContainer.style.display = 'none';
        }
    });

    // Tự động khớp và chọn khi click ra ngoài hoặc đổi giá trị
    input.addEventListener('change', () => {
        const query = input.value.trim();
        if (query === '') return;
        
        if (appState.selectedSchool && normalizeSearchText(appState.selectedSchool.name) === normalizeSearchText(query)) return;
        
        const matched = getBestSchoolMatch(query);
        if (matched) {
            selectSchool(matched);
        }
    });

    // Click nút X để xóa tìm kiếm
    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        appState.selectedSchool = null;
        if (appState.uniMarker) {
            appState.map.removeLayer(appState.uniMarker);
            appState.uniMarker = null;
        }
        // Khôi phục lại phòng trọ gốc mẫu khi hủy chọn trường
        appState.rooms = [...MOCK_ROOMS];
        applyFilters();
        renderRoommates(); // Cập nhật lại góc ở ghép
        suggestionsContainer.style.display = 'none';
    });
}

// Render kết quả gợi ý trường học
function renderSchoolSuggestions(schools) {
    const container = document.getElementById('uni-suggestions');
    container.innerHTML = '';

    if (schools.length === 0) {
        container.innerHTML = `<div style="padding: 10px 14px; font-size: 13px; color: var(--text-muted); line-height: 1.4;">Không tìm thấy trường phù hợp. Hãy thử nhập tên không dấu hoặc tên viết tắt (VD: HUST, NEU, PTIT).</div>`;
        container.style.display = 'block';
        return;
    }

    schools.forEach(school => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.setAttribute('role', 'option');
        item.tabIndex = 0;
        item.innerHTML = `
            <div class="school-header">
                <span class="school-name">${school.name}</span>
                ${school.abbr ? `<span class="school-abbr">${school.abbr}</span>` : ''}
            </div>
            <div class="school-address">${formatAddressToPostMerger(school.address)}</div>
        `;

        const handleSelect = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (item.dataset.selected === 'true') return;
            item.dataset.selected = 'true';
            selectSchool(school);
            container.style.display = 'none';
        };

        // pointerdown giúp chọn được gợi ý ngay trên iOS/Android trước khi input bị blur/ẩn bàn phím.
        item.addEventListener('pointerdown', handleSelect);
        item.addEventListener('click', handleSelect);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleSelect(e);
            }
        });

        container.appendChild(item);
    });

    container.style.display = 'block';
}

// Hàm chọn trường Đại học và bay bản đồ
function selectSchool(school) {
    if (!school) return;
    appState.selectedSchool = school;
    
    const input = document.getElementById('uni-search-input');
    const suggestionsContainer = document.getElementById('uni-suggestions');
    if (input) {
        input.value = school.name;
        input.blur();
    }
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
    document.getElementById('clear-uni-btn').style.display = 'block';

    // Reset bộ lọc Tỉnh/Thành và Phường/Xã để tránh xung đột vị trí trường mới chọn
    const provSelect = document.getElementById('filter-province');
    const wardSelect = document.getElementById('filter-ward');
    if (provSelect) provSelect.value = '';
    if (wardSelect) {
        wardSelect.innerHTML = '<option value="">-- Tất cả Phường/Xã --</option>';
        wardSelect.value = '';
    }

    // Đồng bộ bộ lọc trường bên góc ở ghép
    const rmSchoolFilter = document.getElementById('rm-filter-school');
    if (rmSchoolFilter) {
        rmSchoolFilter.value = school.id;
    }

    // XÓA LẬP TỨC tin trọ cũ, thay bằng danh sách thuộc khu vực trường mới chọn
    appState.rooms = getRoomsForLocation(school.coords[0], school.coords[1], school.id);

    // Xóa ghim cũ, thêm ghim mới của trường học
    if (appState.uniMarker) {
        appState.map.removeLayer(appState.uniMarker);
    }

    appState.map.flyTo(school.coords, 14, {
        animate: true,
        duration: 1.2
    });

    const uniIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-marker uni"><i class="fa-solid fa-graduation-cap"></i></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
    appState.uniMarker = L.marker(school.coords, { icon: uniIcon }).addTo(appState.map);
    appState.uniMarker.bindPopup(`<strong>${school.name}</strong><br>${school.address}`).openPopup();

    // Trên điện thoại, mở luôn danh sách kết quả để người dùng thấy phòng trọ sau khi chọn trường.
    revealRoomSearchResultsOnMobile();

    // Đồng bộ danh sách phòng trọ thực tế từ Local Server (Chợ Tốt) hoặc tạo phòng mẫu khu vực
    fetchRealRooms(school.coords[0], school.coords[1], school.id);
    renderRoommates(); // Cập nhật lại góc ở ghép
}

// Công thức Haversine tính khoảng cách giữa 2 tọa độ (đơn vị: km)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Bán kính Trái Đất (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 4.0. Hàm định dạng lại địa giới hành chính của địa chỉ theo chuẩn địa chính mới 2025/2026
function formatAddressToPostMerger(address) {
    if (!address) return '';
    let formatted = address;

    // Từ điển ánh xạ các đơn vị hành chính cấp xã/phường cũ sang mới sau sáp nhập
    const wardMapRules = {
        // --- Khu vực Hà Giang sáp nhập vào Tuyên Quang (Dự án giả lập) ---
        "nguyễn trãi": "Phường Hà Giang 1",
        "phương thiện": "Phường Hà Giang 1",
        "phương độ": "Phường Hà Giang 1",
        "trần phú": "Phường Hà Giang 2",
        "minh khai": "Phường Hà Giang 2",
        "ngọc hà": "Phường Hà Giang 2",
        "quang trung": "Phường Hà Giang 2",
        "ngọc đường": "Xã Ngọc Đường",

        // --- Hà Nội (Thực tế 2025) ---
        "đống mác": "Phường Đồng Nhân",
        "quỳnh lôi": "Phường Bạch Mai",
        "cầu dền": "Phường Bách Khoa",
        "trung phụng": "Phường Khâm Thiên",
        "nguyễn trung trực": "Phường Trúc Bạch",
        "thanh xuân nam": "Phường Thanh Xuân Bắc",

        // --- TP. Hồ Chí Minh (Thực tế 2025) ---
        "phường 6": "Phường Võ Thị Sáu",
        "phường 7": "Phường Võ Thị Sáu",
        "phường 8": "Phường Võ Thị Sáu",
        "phường 12": "Phường 11",
        "phường 3": "Phường 2",
        "phường 15": "Phường 14",

        // --- Đà Nẵng (Thực tế 2025) ---
        "hòa thuận đông": "Phường Bình Thuận",
        "phước ninh": "Phường Nam Dương",
        "hải châu ii": "Phường Hải Châu",

        // --- Cần Thơ (Thực tế 2025) ---
        "an hội": "Phường Tân An",
        "an lạc": "Phường Tân An"
    };

    let newWard = "";
    const addressLower = address.toLowerCase();
    
    // 1. Kiểm tra xem có sẵn phường/xã đã chuẩn hóa trong địa chỉ chưa
    if (/phường\s+hà\s+giang\s+1/i.test(addressLower)) {
        newWard = "Phường Hà Giang 1";
    } else if (/phường\s+hà\s+giang\s+2/i.test(addressLower)) {
        newWard = "Phường Hà Giang 2";
    } else if (/xã\s+ngọc\s+đường/i.test(addressLower)) {
        newWard = "Xã Ngọc Đường";
    } else if (/phường\s+võ\s+thị\s+sáu/i.test(addressLower)) {
        newWard = "Phường Võ Thị Sáu";
    } else if (/phường\s+đồng\s+nhân/i.test(addressLower)) {
        newWard = "Phường Đồng Nhân";
    } else if (/phường\s+bạch\s+mai/i.test(addressLower)) {
        newWard = "Phường Bạch Mai";
    } else if (/phường\s+bách\s+khoa/i.test(addressLower)) {
        newWard = "Phường Bách Khoa";
    } else if (/phường\s+khâm\s+thiên/i.test(addressLower)) {
        newWard = "Phường Khâm Thiên";
    } else if (/phường\s+trúc\s+bạch/i.test(addressLower)) {
        newWard = "Phường Trúc Bạch";
    } else if (/phường\s+thanh\s+xuân\s+bắc/i.test(addressLower)) {
        newWard = "Phường Thanh Xuân Bắc";
    } else if (/phường\s+nam\s+dương/i.test(addressLower)) {
        newWard = "Phường Nam Dương";
    } else if (/phường\s+tân\s+an/i.test(addressLower)) {
        newWard = "Phường Tân An";
    } else {
        // 2. Nếu chưa, tìm phường cũ tương ứng để ánh xạ
        for (const [oldWard, targetWard] of Object.entries(wardMapRules)) {
            const regex = new RegExp(`(?:phường|p\\.|xã|x\\.)?\\s*${oldWard}`, "i");
            if (regex.test(addressLower)) {
                newWard = targetWard;
                break;
            }
        }
    }

    let parts = address.split(',').map(p => p.trim());
    let cleanParts = [];
    
    parts.forEach(part => {
        const partLower = part.toLowerCase();
        
        // Loại bỏ các địa danh hành chính cũ của Hà Giang (nếu có)
        if (partLower.includes("thành phố hà giang") || partLower.includes("tp. hà giang") || partLower.includes("tp hà giang")) {
            return;
        }
        if (partLower.includes("tỉnh hà giang") || partLower === "hà giang") {
            return;
        }
        if (partLower === "tuyên quang" || partLower.includes("tỉnh tuyên quang")) {
            return;
        }

        let cleanPart = part;
        
        // Loại bỏ phường cũ
        for (const oldWard of Object.keys(wardMapRules)) {
            const regex = new RegExp(`(?:phường|p\\.|xã|x\\.)\\s*${oldWard}(?![a-zA-Z0-9à-ỹÀ-Ỹ])|^${oldWard}$`, "gi");
            cleanPart = cleanPart.replace(regex, "");
        }
        
        // Loại bỏ thành phố/tỉnh Hà Giang nếu xuất hiện trong các part lẻ
        cleanPart = cleanPart
            .replace(/\s*(?:thành phố|tp\.?)\s*hà giang\b/gi, "")
            .replace(/\s*(?:tỉnh)?\s*hà giang\b/gi, "");
            
        cleanPart = cleanPart.replace(/^\s*[-–—]\s*/, "").replace(/\s*[-–—]\s*$/, "").trim();

        if (cleanPart) {
            cleanParts.push(cleanPart);
        }
    });

    if (newWard) {
        cleanParts.push(newWard);
    }

    if ((address.includes("Tuyên Quang") || address.includes("Hà Giang")) && !address.includes("Thái Nguyên")) {
        cleanParts.push("Tuyên Quang");
    }

    formatted = cleanParts.filter((v, i, a) => v && a.indexOf(v) === i).join(', ');

    // Áp dụng bộ quy tắc sáp nhập hành chính các tỉnh khác
    const mergerRules = [
        { from: /Tỉnh Yên Bái/g, to: 'Tỉnh Lào Cai' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Yên Bái/g, to: 'Tỉnh Lào Cai' },
        { from: /Tỉnh Bắc Kạn/g, to: 'Tỉnh Thái Nguyên' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bắc Kạn/g, to: 'Tỉnh Thái Nguyên' },
        { from: /Tỉnh Vĩnh Phúc/g, to: 'Tỉnh Phú Thọ' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Vĩnh Phúc/g, to: 'Tỉnh Phú Thọ' },
        { from: /Tỉnh Hòa Bình/g, to: 'Tỉnh Phú Thọ' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Hòa Bình/g, to: 'Tỉnh Phú Thọ' },
        { from: /Tỉnh Bắc Giang/g, to: 'Tỉnh Bắc Ninh' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bắc Giang/g, to: 'Tỉnh Bắc Ninh' },
        { from: /Tỉnh Thái Bình/g, to: 'Tỉnh Hưng Yên' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Thái Bình/g, to: 'Tỉnh Hưng Yên' },
        { from: /Tỉnh Hải Dương/g, to: 'Thành phố Hải Phòng' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Hải Dương/g, to: 'Thành phố Hải Phòng' },
        { from: /Tỉnh Hà Nam/g, to: 'Tỉnh Ninh Bình' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Hà Nam/g, to: 'Tỉnh Ninh Bình' },
        { from: /Tỉnh Nam Định/g, to: 'Tỉnh Ninh Bình' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Nam Định/g, to: 'Tỉnh Ninh Bình' },
        { from: /Tỉnh Quảng Bình/g, to: 'Tỉnh Quảng Trị' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Quảng Bình/g, to: 'Tỉnh Quảng Trị' },
        { from: /Tỉnh Quảng Nam/g, to: 'Thành phố Đà Nẵng' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Quảng Nam/g, to: 'Thành phố Đà Nẵng' },
        { from: /Tỉnh Kon Tum/g, to: 'Tỉnh Quảng Ngãi' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Kon Tum/g, to: 'Tỉnh Quảng Ngãi' },
        { from: /Tỉnh Bình Định/g, to: 'Tỉnh Gia Lai' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bình Định/g, to: 'Tỉnh Gia Lai' },
        { from: /Tỉnh Phú Yên/g, to: 'Tỉnh Đắk Lắk' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Phú Yên/g, to: 'Tỉnh Đắk Lắk' },
        { from: /Tỉnh Ninh Thuận/g, to: 'Tỉnh Khánh Hòa' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Ninh Thuận/g, to: 'Tỉnh Khánh Hòa' },
        { from: /Tỉnh Đắk Nông/g, to: 'Tỉnh Lâm Đồng' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Đắk Nông/g, to: 'Tỉnh Lâm Đồng' },
        { from: /Tỉnh Bình Thuận/g, to: 'Tỉnh Lâm Đồng' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bình Thuận/g, to: 'Tỉnh Lâm Đồng' },
        { from: /Tỉnh Bình Phước/g, to: 'Tỉnh Đồng Nai' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bình Phước/g, to: 'Tỉnh Đồng Nai' },
        { from: /Tỉnh Bà Rịa - Vũng Tàu/g, to: 'Thành phố Hồ Chí Minh' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bà Rịa - Vũng Tàu/g, to: 'Thành phố Hồ Chí Minh' },
        { from: /Tỉnh Bình Dương/g, to: 'Thành phố Hồ Chí Minh' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bình Dương/g, to: 'Thành phố Hồ Chí Minh' },
        { from: /Tỉnh Long An/g, to: 'Tỉnh Tây Ninh' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Long An/g, to: 'Tỉnh Tây Ninh' },
        { from: /Tỉnh Tiền Giang/g, to: 'Tỉnh Đồng Tháp' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Tiền Giang/g, to: 'Tỉnh Đồng Tháp' },
        { from: /Tỉnh Bến Tre/g, to: 'Tỉnh Vĩnh Long' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bến Tre/g, to: 'Tỉnh Vĩnh Long' },
        { from: /Tỉnh Trà Vinh/g, to: 'Tỉnh Vĩnh Long' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Trà Vinh/g, to: 'Tỉnh Vĩnh Long' },
        { from: /Tỉnh Sóc Trăng/g, to: 'Thành phố Cần Thơ' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Sóc Trăng/g, to: 'Thành phố Cần Thơ' },
        { from: /Tỉnh Hậu Giang/g, to: 'Thành phố Cần Thơ' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Hậu Giang/g, to: 'Thành phố Cần Thơ' },
        { from: /Tỉnh Bạc Liêu/g, to: 'Tỉnh Cà Mau' },
        { from: /(?<!Thành phố\s+|TP\.\s*)Bạc Liêu/g, to: 'Tỉnh Cà Mau' }
    ];
    mergerRules.forEach(rule => {
        formatted = formatted.replace(rule.from, rule.to);
    });

    // Làm sạch các phần trùng lặp hoặc dư thừa
    formatted = formatted.replace(/Tỉnh Tuyên Quang, Tỉnh Tuyên Quang/g, 'Tỉnh Tuyên Quang');
    formatted = formatted.replace(/Thành phố Hồ Chí Minh, Thành phố Hồ Chí Minh/g, 'Thành phố Hồ Chí Minh');
    formatted = formatted.replace(/Thành phố Cần Thơ, Thành phố Cần Thơ/g, 'Thành phố Cần Thơ');
    formatted = formatted.replace(/Thành phố Hải Phòng, Thành phố Hải Phòng/g, 'Thành phố Hải Phòng');
    formatted = formatted.replace(/Thành phố Đà Nẵng, Thành phố Đà Nẵng/g, 'Thành phố Đà Nẵng');

    return formatted;
}

// 4.1. Fetch danh sách phòng trọ thực tế từ Local Server API (Chợ Tốt + Firestore)
function fetchRealRooms(lat, lon, schoolId) {
    const provinceCode = document.getElementById('filter-province') ? document.getElementById('filter-province').value : '';
    const wardCode = document.getElementById('filter-ward') ? document.getElementById('filter-ward').value : '';
    let serverUrl = `/api/rooms?lat=${lat}&lon=${lon}&distance=10&_t=${Date.now()}`;
    if (provinceCode) serverUrl += `&provinceCode=${encodeURIComponent(provinceCode)}`;
    if (wardCode) serverUrl += `&wardCode=${encodeURIComponent(wardCode)}`;

    const localMockRooms = getRoomsForLocation(lat, lon, schoolId);

    const syncController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = syncController ? setTimeout(() => syncController.abort(), 15000) : null;
    const fetchOptions = syncController ? { signal: syncController.signal, cache: 'no-store' } : { cache: 'no-store' };

    return fetch(serverUrl, fetchOptions)
        .then(res => {
            if (!res.ok) throw new Error("Không thể kết nối máy chủ");
            return res.json();
        })
        .then(realRooms => {
            if (Array.isArray(realRooms) && realRooms.length > 0) {
                console.log(`[LIVE DATA] Đã tải ${realRooms.length} tin từ Server.`);
                appState.rooms = realRooms;
            } else {
                appState.rooms = localMockRooms;
            }
        })
        .catch(err => {
            const reason = err.name === 'AbortError'
                ? 'API phản hồi chậm'
                : err.message;
            console.warn("Giữ dữ liệu phòng trọ mặc định.", reason);
        })
        .finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
            // Áp dụng bộ lọc và vẽ marker
            applyFilters();
        });
}

// Hàm lấy danh sách phòng trọ bổ sung cho vị trí (Chỉ trả về phòng thật nếu có)
function getRoomsForLocation(lat, lon, schoolId) {
    return MOCK_ROOMS.filter(room => {
        const d = getDistance(room.coords[0], room.coords[1], lat, lon);
        return d <= 10.0;
    });
}

// 5. Render danh sách phòng trọ & hiển thị ghim (Markers) lên bản đồ
function renderRooms(roomsToRender) {
    const listContainer = document.getElementById('room-list');
    listContainer.innerHTML = '';

    // Xóa các marker phòng trọ cũ trên bản đồ
    Object.keys(appState.markers).forEach(key => {
        appState.map.removeLayer(appState.markers[key]);
    });
    appState.markers = {};

    document.getElementById('results-count').textContent = roomsToRender.length;

    if (roomsToRender.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 45px 20px; color: var(--text-muted);">
                <i class="fa-solid fa-house-circle-xmark" style="font-size: 38px; margin-bottom: 12px; color: #ef4444;"></i>
                <p style="font-size: 15px; font-weight: 600; color: var(--text-primary);">Hiện chưa có phòng trọ nào được đăng tải</p>
                <p style="font-size: 12px; margin-top: 6px; color: var(--text-muted);">Chưa có tin trọ thực tế nào được cào về hoặc do chủ nhà đăng trong khu vực này.</p>
            </div>
        `;
        return;
    }

    roomsToRender.forEach(room => {
        // Tạo thẻ phòng trọ HTML
        const card = document.createElement('div');
        card.className = `room-card ${room.ownerType} ${room.id === appState.selectedRoomId ? 'active' : ''}`;
        card.setAttribute('data-id', room.id);

        const isOwner = room.ownerType === 'owner';
        const badgeClass = isOwner ? 'badge-owner' : 'badge-broker';
        const badgeText = isOwner ? 'Chủ trọ thật' : 'Môi giới';

        // Tạo chuỗi tiện nghi ngắn gọn
        const amenitiesIcons = {
            "AC": '<i class="fa-solid fa-snowflake" title="Điều hòa"></i>',
            "Wifi": '<i class="fa-solid fa-wifi" title="Wifi"></i>',
            "Bed": '<i class="fa-solid fa-bed" title="Giường"></i>',
            "Wardrobe": '<i class="fa-solid fa-table-cells" title="Tủ quần áo"></i>',
            "Heater": '<i class="fa-solid fa-temperature-empty" title="Nóng lạnh"></i>',
            "Fridge": '<i class="fa-solid fa-cookie-bite" title="Tủ lạnh"></i>',
            "Balcony": '<i class="fa-solid fa-door-open" title="Ban công"></i>',
            "Kitchen": '<i class="fa-solid fa-utensils" title="Bếp riêng"></i>',
            "WashingMachine": '<i class="fa-solid fa-soap" title="Máy giặt"></i>'
        };

        const amenitiesArr = Array.isArray(room.amenities) ? room.amenities : [];
        const roomAmenitiesHTML = amenitiesArr
            .map(a => amenitiesIcons[a] || '')
            .filter(Boolean)
            .slice(0, 5) // Hiển thị tối đa 5 icon
            .join(' ');

        // Định dạng tiền tệ
        const priceVal = parseFloat(room.price) || 0;
        const formattedPrice = priceVal > 0 ? (priceVal / 1000000).toFixed(1) + ' Tr' : 'LH Chủ Nhà (Trọ) để nhận báo giá';

        // Render nhãn tags phụ trên thẻ phòng trọ danh sách
        let tagsHTML = '';
        if (room.tags && room.tags.length > 0) {
            tagsHTML = `<div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;">` +
                room.tags.map(t => {
                    const isRealTime = t === "Tin thực tế";
                    const isScam = t === "Cảnh báo lừa đảo" || t === "Cọc online trước";
                    let style = 'background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid var(--border-color);';
                    if (isRealTime) {
                        style = 'background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);';
                    } else if (isScam) {
                        style = 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);';
                    }
                    return `<span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; ${style}">${t}</span>`;
                }).join('') +
                `</div>`;
        }

        card.innerHTML = `
            <div class="room-header">
                <h3 class="room-title">${room.title || 'Phòng trọ'}</h3>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div class="room-price" style="${priceVal <= 0 ? 'font-size: 11.5px; color: #38bdf8; font-weight: 600;' : ''}">${formattedPrice}${priceVal > 0 ? '<span>/tháng</span>' : ''}</div>
                <div style="font-size: 13px; color: var(--text-secondary); display: flex; gap: 6px; align-items: center;">
                     ${roomAmenitiesHTML}
                     ${amenitiesArr.length > 5 ? `<span style="font-size: 10px; color: var(--text-muted)">+${amenitiesArr.length - 5}</span>` : ''}
                </div>
            </div>

            <div class="room-address">
                <i class="fa-solid fa-location-dot" style="color: var(--color-danger)"></i>
                <span>${formatAddressToPostMerger(room.address || '')}</span>
            </div>
            
            ${tagsHTML}

            <div class="room-details" style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div class="room-rating">
                    <i class="fa-solid fa-star"></i>
                    <span>${room.rating || 5.0}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                    Đăng bởi: <strong>${room.ownerName || 'Chủ trọ'}</strong>
                </div>
            </div>

            <!-- Nút bấm to rõ ràng hỗ trợ di động tốt hơn -->
            <button class="btn-view-detail" style="margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12.5px; font-weight: 600; padding: 10px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); color: #60a5fa; border-radius: 8px; cursor: pointer;">
                <i class="fa-solid fa-circle-info"></i> Xem Chi Tiết Phòng Trọ
            </button>
        `;

        // Click vào card để định vị bản đồ và làm nổi bật
        card.addEventListener('click', () => {
            selectRoom(room.id, room.coords);
        });

        // Click vào Xem chi tiết trên card (hỗ trợ mượt mà trên cả Di động và Laptop)
        const viewDetailBtn = card.querySelector('.btn-view-detail');
        if (viewDetailBtn) {
            viewDetailBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectRoom(room.id, room.coords);
                showRoomDetails(room);
            });
        }

        listContainer.appendChild(card);

        // Tạo Ghim (Marker) trên bản đồ
        // Xác định icon marker dựa vào loại tin
        let markerClass = 'custom-marker';
        let markerIcon = '<i class="fa-solid fa-house"></i>';
        if (room.ownerType === 'broker') {
            markerClass += ' broker';
            markerIcon = '<i class="fa-solid fa-user-tag"></i>';
        } else if (room.title.includes('CẢNH BÁO SCAM')) {
            markerClass += ' scam';
            markerIcon = '<i class="fa-solid fa-triangle-exclamation"></i>';
        }

        const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="${markerClass}">${markerIcon}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const marker = L.marker(room.coords, { icon: customIcon }).addTo(appState.map);
        
        // Popup chi tiết khi click vào marker
        const popupContent = `
            <div class="map-popup-title">${room.title}</div>
            <div class="map-popup-price" style="${priceVal <= 0 ? 'font-size: 11.5px; color: #38bdf8;' : ''}">${formattedPrice}${priceVal > 0 ? '/tháng' : ''}</div>
            <div class="map-popup-details">
                <p><i class="fa-solid fa-phone"></i> LH: <strong>${room.contactPhone}</strong> (${room.ownerName})</p>
                <p><i class="fa-solid fa-location-crosshairs"></i> ${formatAddressToPostMerger(room.address)}</p>
            </div>
            <button class="btn btn-primary" onclick="selectRoomCard('${room.id}')" style="padding: 4px 8px; font-size: 11px; margin-top: 8px; width: 100%; justify-content: center;">
                Xem chi tiết
            </button>
        `;
        marker.bindPopup(popupContent);

        // Lưu trữ marker để quản lý
        appState.markers[room.id] = marker;

        // Bấm vào marker cũng highlight card tương ứng
        marker.on('click', () => {
            appState.selectedRoomId = room.id;
            highlightRoomCard(room.id);
        });
    });
}

// 6. Xử lý logic chọn phòng trọ
function selectRoom(roomId, coords) {
    appState.selectedRoomId = roomId;
    
    // Highlight room card
    highlightRoomCard(roomId);
    
    // Di chuyển tâm bản đồ tới tọa độ phòng trọ
    appState.map.flyTo(coords, 16, {
        animate: true,
        duration: 1.2
    });

    // Mở popup của marker
    if (appState.markers[roomId]) {
        setTimeout(() => {
            appState.markers[roomId].openPopup();
        }, 300);
    }
}

// Highlight thẻ phòng trong danh sách và cuộn đến nó
function highlightRoomCard(roomId) {
    const cards = document.querySelectorAll('.room-card');
    cards.forEach(card => {
        if (String(card.getAttribute('data-id')) === String(roomId)) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            card.classList.remove('active');
        }
    });
}

// Hàm global để marker popup có thể gọi chọn card
window.selectRoomCard = function(roomId) {
    const room = appState.rooms.find(r => String(r.id) === String(roomId));
    if (room) {
        selectRoom(roomId, room.coords);
        showRoomDetails(room);
    }
};

// 7. Xử lý bộ lọc phòng trọ
function applyFilters() {
    const selectedSchool = appState.selectedSchool; // { id, name, coords, address }
    const distanceSelect = document.getElementById('filter-distance');
    const selectedDistance = distanceSelect ? distanceSelect.value : 'all';
    
    // Đọc khoảng giá (Hỗ trợ cả nhập số triệu kiểu 1.5, 2, 3 và nhập đầy đủ 1500000, 2000000)
    const rawMin = parseFloat(document.getElementById('filter-price-min') ? document.getElementById('filter-price-min').value : '');
    const rawMax = parseFloat(document.getElementById('filter-price-max') ? document.getElementById('filter-price-max').value : '');

    let minPrice = 0;
    if (!isNaN(rawMin)) {
        minPrice = rawMin < 1000 ? rawMin * 1000000 : rawMin;
    }

    let maxPrice = Infinity;
    if (!isNaN(rawMax)) {
        maxPrice = rawMax < 1000 ? rawMax * 1000000 : rawMax;
    }

    const ownerSelect = document.getElementById('filter-owner');
    const selectedOwnerType = ownerSelect ? ownerSelect.value : 'all';

    // Lọc danh sách phòng
    const filteredRooms = appState.rooms.filter(room => {
        // Loại bỏ phòng trọ đã được báo hết/đã thuê
        if (appState.rentedRoomIds.includes(String(room.id))) {
            return false;
        }

        // Lọc theo Tỉnh/Thành
        const provSelect = document.getElementById('filter-province');
        const provinceCode = provSelect ? provSelect.value : '';
        if (provinceCode) {
            const provName = provSelect.options[provSelect.selectedIndex].text;
            const hasProvince = room.provinceCode === provinceCode || 
                                (room.address && room.address.toLowerCase().includes(provName.toLowerCase()));
            if (!hasProvince) return false;
        }

        // Lọc theo Phường/Xã
        const wardSelect = document.getElementById('filter-ward');
        const wardCode = wardSelect ? wardSelect.value : '';
        if (wardCode) {
            const wardName = wardSelect.options[wardSelect.selectedIndex].text;
            const hasWard = room.wardCode === wardCode || 
                            (room.address && room.address.toLowerCase().includes(wardName.toLowerCase()));
            if (!hasWard) return false;
        }

        // Lọc theo khoảng giá
        if (room.price > 0 && (room.price < minPrice || room.price > maxPrice)) {
            return false;
        }

        // Lọc theo đối tượng đăng tin (Chủ nhà / Môi giới)
        if (selectedOwnerType !== 'all') {
            const roomOwner = (room.ownerType || 'owner').toLowerCase();
            if (roomOwner !== selectedOwnerType.toLowerCase()) {
                return false;
            }
        }

        // Giữ vĩnh viễn tất cả phòng trọ đã được Admin duyệt / Chủ nhà đăng (bỏ qua giới hạn bán kính để không bao giờ bị tự động ẩn)
        if (room.ownerType === 'owner' || room.verified || true) {
            return true;
        }

        return true;
    });

    renderRooms(filteredRooms);
}

// 8. Thuật toán phân tích bài đăng (Post Analyzer Heuristic Engine)
function analyzePost() {
    const text = document.getElementById('analyze-input').value.trim();
    if (!text) {
        showToast('Vui lòng nhập nội dung bài đăng cần phân tích!', true);
        return;
    }

    // A. Trích xuất Số điện thoại (Hỗ trợ dấu chấm, khoảng cách, gạch ngang, đầu số nước ngoài)
    const phoneRegex = /(?:(?:\+84|84|0)[35789])(?:[\s\.-]*\d){8}\b/g;
    const phoneMatches = text.match(phoneRegex);
    
    let rawPhone = null;
    let phone = null;
    if (phoneMatches) {
        rawPhone = phoneMatches[0];
        // Chuẩn hóa: xóa chấm/khoảng cách/gạch và đổi đầu số +84/84 thành 0
        phone = rawPhone.replace(/[\s\.-]/g, '').replace(/^(\+84|84)/, '0');
    }

    // B. Trích xuất Giá ước tính
    // Tìm các từ khóa dạng: 1tr5, 1.5tr, 1,5 tr, 2.000.000, 3 triệu...
    const priceRegex = /(\d+[\.,]?\d*)\s*(tr|triệu|trieu|vnd|đ|d)\b/i;
    const priceMatch = text.match(priceRegex);
    let extractedPrice = "-";
    if (priceMatch) {
        extractedPrice = priceMatch[0];
    } else {
        const rawNumMatch = text.match(/\b\d{6,7}\b/); // Tìm số liền 1.500.000
        if (rawNumMatch) {
            const priceVal = parseInt(rawNumMatch[0]);
            extractedPrice = (priceVal / 1000000).toFixed(1) + ' triệu';
        }
    }

    // C. Kiểm tra dấu hiệu lừa đảo & tính điểm an toàn
    let safetyScore = 100;
    let risks = [];
    let isBlacklisted = false;
    let authorType = "Chưa rõ";

    // 1. Kiểm tra SĐT có trong danh sách đen không
    if (phone) {
        const blacklistMatch = appState.blacklist.find(b => b.phone.replace(/[\s\.]/g, '') === phone.replace(/[\s\.]/g, ''));
        if (blacklistMatch) {
            isBlacklisted = true;
            safetyScore -= 90;
            risks.push({
                level: 'danger',
                text: `SĐT <strong>${phone}</strong> nằm trong DANH SÁCH ĐEN lừa đảo! Lý do: ${blacklistMatch.reason}`
            });
        }
    }

    // 2. Phân tích các từ khóa lừa đảo
    const criticalScamKeywords = [
        { keys: ["cọc giữ chỗ", "cọc giữ phòng", "chuyển khoản cọc", "cọc online", "cọc trước", "chuyển khoản trước", "giữ chỗ trước"], desc: "Yêu cầu chuyển khoản đặt cọc giữ chỗ trước khi đến xem phòng thực tế." },
        { keys: ["đang ở nước ngoài", "đang bận", "không thể dẫn xem", "khách đông quá cọc luôn"], desc: "Người đăng đưa lý do bận hoặc ở xa để từ chối cho xem phòng trực tiếp, ép cọc online." }
    ];

    const warningKeywords = [
        { keys: ["phí xem phòng", "tiền dẫn đi", "phí dịch vụ xem", "phí hồ sơ"], desc: "Yêu cầu thu phí xem phòng hoặc phí dẫn đường (hành vi thường thấy của môi giới lừa đảo phí)." },
        { keys: ["giá siêu rẻ", "rẻ nhất", "cắt lỗ"], desc: "Tin sử dụng từ khóa giật tít, phóng đại để câu khách." }
    ];

    criticalScamKeywords.forEach(scam => {
        if (scam.keys.some(k => text.toLowerCase().includes(k))) {
            safetyScore -= 45;
            risks.push({ level: 'danger', text: scam.desc });
        }
    });

    warningKeywords.forEach(warn => {
        if (warn.keys.some(k => text.toLowerCase().includes(k))) {
            safetyScore -= 20;
            risks.push({ level: 'warning', text: warn.desc });
        }
    });

    // 3. Phân tích Môi giới (Broker) vs Chủ nhà (Owner)
    const brokerKeywords = ["môi giới", "bên mình còn", "inbox để xem thêm", "phí dịch vụ", "nguồn phòng", "hoa hồng", "liên hệ xem phòng khác", "chuyên cho thuê"];
    if (brokerKeywords.some(k => text.toLowerCase().includes(k))) {
        authorType = "Có thể là Môi giới";
        safetyScore -= 10;
        risks.push({ level: 'warning', text: "Bài viết chứa nhiều ngôn từ chuyên nghiệp của môi giới nhà đất/trung gian." });
    } else {
        authorType = "Chủ nhà thật hoặc ở ghép";
    }

    // Giới hạn điểm không dưới 0
    safetyScore = Math.max(0, safetyScore);

    // D. Hiển thị kết quả ra giao diện
    const resultsPanel = document.getElementById('analyzer-results');
    const summaryCard = document.getElementById('risk-summary-card');
    const riskTitle = document.getElementById('risk-title');
    const riskDesc = document.getElementById('risk-description');
    
    const extPhone = document.getElementById('ext-phone');
    const extPrice = document.getElementById('ext-price');
    const extSafety = document.getElementById('ext-safety');
    const extType = document.getElementById('ext-type');
    
    const pointsContainer = document.getElementById('risk-points-container');

    // 1. Phân loại mức độ rủi ro để tô màu
    summaryCard.className = "result-card";
    if (safetyScore >= 80) {
        summaryCard.classList.add('result-card-ok');
        riskTitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--color-primary)"></i> Tin Đăng Độ Tin Cậy Cao`;
        riskDesc.textContent = "Hệ thống không phát hiện các dấu hiệu lừa đảo phổ biến. Bạn vẫn nên đến xem phòng trực tiếp trước khi giao dịch.";
        extSafety.innerHTML = `<span style="color: var(--color-primary); font-weight: 700;">${safetyScore}% (An toàn)</span>`;
    } else if (safetyScore >= 50) {
        summaryCard.classList.add('result-card-warning');
        riskTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning)"></i> Nghi Ngờ / Có Môi Giới`;
        riskDesc.textContent = "Tin đăng có một số dấu hiệu cần lưu ý như có thể là môi giới bất động sản hoặc thông tin chưa rõ ràng.";
        extSafety.innerHTML = `<span style="color: var(--color-warning); font-weight: 700;">${safetyScore}% (Cần chú ý)</span>`;
    } else {
        summaryCard.classList.add('result-card-danger');
        riskTitle.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: var(--color-danger)"></i> RẤT NGUY HIỂM - CẢNH BÁO LỪA ĐẢO`;
        riskDesc.textContent = "Nội dung tin đăng chứa các từ khóa đòi tiền cọc trước hoặc số điện thoại nằm trong danh sách đen lừa đảo.";
        extSafety.innerHTML = `<span style="color: var(--color-danger); font-weight: 700;">${safetyScore}% (Rủi ro cực cao)</span>`;
    }

    // 2. Điền thông tin trích xuất
    extPhone.innerHTML = phone ? (isBlacklisted ? `<span style="color: var(--color-danger); font-weight:700;">${phone} [BLACKLIST]</span>` : rawPhone) : "Không tìm thấy";
    extPrice.textContent = extractedPrice;
    extType.textContent = authorType;

    // 3. Render các điểm nghi vấn chi tiết
    pointsContainer.innerHTML = '';
    if (risks.length === 0) {
        pointsContainer.innerHTML = `
            <div style="font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-circle-check" style="color: var(--color-primary)"></i> Không phát hiện điểm nghi vấn nào.
            </div>
        `;
    } else {
        risks.forEach(r => {
            const item = document.createElement('div');
            item.style.fontSize = '13px';
            item.style.display = 'flex';
            item.style.alignItems = 'flex-start';
            item.style.gap = '8px';
            
            const iconColor = r.level === 'danger' ? 'var(--color-danger)' : 'var(--color-warning)';
            const icon = r.level === 'danger' ? 'fa-circle-xmark' : 'fa-triangle-exclamation';

            item.innerHTML = `
                <i class="fa-solid ${icon}" style="color: ${iconColor}; margin-top: 2px;"></i>
                <span style="color: var(--text-secondary)">${r.text}</span>
            `;
            pointsContainer.appendChild(item);
        });
    }

    // Hiện panel kết quả
    resultsPanel.style.display = 'flex';
    showToast('Đã phân tích xong tin đăng!', false);
}

// 9. Render & Tìm kiếm danh sách đen (Blacklist)
function renderBlacklist(blacklistToRender) {
    const container = document.getElementById('blacklist-container');
    container.innerHTML = '';

    document.getElementById('blacklist-count').textContent = `${blacklistToRender.length} đối tượng`;

    if (blacklistToRender.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                <i class="fa-solid fa-shield" style="font-size: 28px; margin-bottom: 8px;"></i>
                <p>Không tìm thấy SĐT lừa đảo nào.</p>
            </div>
        `;
        return;
    }

    blacklistToRender.forEach(item => {
        const card = document.createElement('div');
        card.className = 'blacklist-card';
        card.innerHTML = `
            <div class="blacklist-phone">
                <i class="fa-solid fa-ban"></i> ${item.phone}
            </div>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-primary)">
                Đối tượng: ${item.name || 'Ẩn danh'}
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                <strong>Lý do:</strong> ${item.reason}
            </div>
            <div class="blacklist-meta">
                <span>Ngày báo cáo: ${item.reportedDate}</span>
                <span>Số lượt báo cáo: <strong style="color: var(--color-danger)">${item.evidenceCount}</strong></span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Thực hiện tìm kiếm số điện thoại trong danh sách đen
function handleBlacklistSearch() {
    const query = document.getElementById('blacklist-search-input').value.trim().replace(/[\s\.]/g, '');
    if (!query) {
        renderBlacklist(appState.blacklist);
        return;
    }

    const filteredList = appState.blacklist.filter(item => {
        const phoneClean = item.phone.replace(/[\s\.]/g, '');
        const nameClean = (item.name || '').toLowerCase();
        return phoneClean.includes(query) || nameClean.includes(query.toLowerCase());
    });

    renderBlacklist(filteredList);
}

// 10. Gửi báo cáo số điện thoại lừa đảo mới
function submitScamReport() {
    const phoneInput = document.getElementById('report-phone').value.trim();
    const nameInput = document.getElementById('report-name').value.trim();
    const reasonInput = document.getElementById('report-reason').value.trim();

    if (!phoneInput || !reasonInput) {
        showToast('Vui lòng điền đầy đủ các trường bắt buộc (*)!', true);
        return;
    }

    // Kiểm tra định dạng số điện thoại đơn giản
    if (!/^\d{9,11}$/.test(phoneInput.replace(/[\s\.-]/g, ''))) {
        showToast('Số điện thoại không hợp lệ!', true);
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Kiểm tra xem SĐT này đã từng bị báo cáo chưa
    const existingIndex = appState.blacklist.findIndex(b => b.phone.replace(/[\s\.-]/g, '') === phoneInput.replace(/[\s\.-]/g, ''));

    if (existingIndex !== -1) {
        // Tăng số lượt báo cáo lên
        appState.blacklist[existingIndex].evidenceCount += 1;
        appState.blacklist[existingIndex].reason += ` | Báo cáo mới: ${reasonInput}`;
    } else {
        // Thêm đối tượng mới
        const newReport = {
            phone: phoneInput,
            name: nameInput || 'Ẩn danh',
            reason: reasonInput,
            reportedDate: today,
            evidenceCount: 1
        };
        appState.blacklist.unshift(newReport); // Đưa lên đầu
    }

    // Lưu vào LocalStorage
    localStorage.setItem('scam_blacklist', JSON.stringify(appState.blacklist));
    
    // Đồng bộ lại UI
    renderBlacklist(appState.blacklist);
    closeReportModal();
    showToast('Gửi báo cáo thành công! Cảm ơn sự đóng góp của bạn.', false);

    // Reset Form
    document.getElementById('report-phone').value = '';
    document.getElementById('report-name').value = '';
    document.getElementById('report-reason').value = '';
}

// 11. Các Trình lắng nghe Sự kiện (Event Listeners)
function initEventListeners() {
    // Sự kiện thay đổi bộ lọc phòng trọ
    const distFilter = document.getElementById('filter-distance');
    const pMinFilter = document.getElementById('filter-price-min');
    const pMaxFilter = document.getElementById('filter-price-max');
    const ownerFilter = document.getElementById('filter-owner');

    if (distFilter) distFilter.addEventListener('change', applyFilters);
    if (pMinFilter) {
        pMinFilter.addEventListener('input', applyFilters);
        pMinFilter.addEventListener('change', applyFilters);
    }
    if (pMaxFilter) {
        pMaxFilter.addEventListener('input', applyFilters);
        pMaxFilter.addEventListener('change', applyFilters);
    }
    if (ownerFilter) ownerFilter.addEventListener('change', applyFilters);

    // Sự kiện phân tích tin đăng
    document.getElementById('analyze-btn').addEventListener('click', analyzePost);

    // Sự kiện tìm kiếm danh sách đen
    document.getElementById('blacklist-search-input').addEventListener('input', handleBlacklistSearch);

    // Sự kiện mở/đóng Modal báo cáo
    document.getElementById('open-report-btn').addEventListener('click', openReportModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeReportModal);
    document.getElementById('cancel-report-btn').addEventListener('click', closeReportModal);
    document.getElementById('submit-report-btn').addEventListener('click', submitScamReport);

    // Sự kiện mở/đóng Modal đăng trọ chủ trọ
    document.getElementById('open-post-room-btn').addEventListener('click', openPostModal);
    document.getElementById('close-post-modal-btn').addEventListener('click', closePostModal);
    document.getElementById('cancel-post-btn').addEventListener('click', closePostModal);
    document.getElementById('submit-post-btn').addEventListener('click', submitPostRoom);
    document.getElementById('post-images').addEventListener('change', handlePostImageSelect);
    // Sự kiện nhập địa chỉ để auto-search định vị trên bản đồ
    let postGeocodeTimeout = null;
    const postAddrInput = document.getElementById('post-address');
    if (postAddrInput) {
        postAddrInput.addEventListener('input', () => {
            clearTimeout(postGeocodeTimeout);
            postGeocodeTimeout = setTimeout(() => {
                geocodePostAddress();
            }, 600);
        });
        postAddrInput.addEventListener('blur', geocodePostAddress);
        postAddrInput.addEventListener('change', geocodePostAddress);
        postAddrInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(postGeocodeTimeout);
                geocodePostAddress();
            }
        });
    }

    // Sự kiện đóng Modal chi tiết phòng
    const closeBtn1 = document.getElementById('close-detail-modal-btn');
    if (closeBtn1) closeBtn1.addEventListener('click', closeRoomDetailsModal);
    const closeBtn2 = document.getElementById('close-detail-modal-btn-footer');
    if (closeBtn2) closeBtn2.addEventListener('click', closeRoomDetailsModal);

    // Bấm ra ngoài modal để đóng
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('report-modal');
        const detailModal = document.getElementById('room-detail-modal') || document.getElementById('room-details-modal');
        const postModal = document.getElementById('post-room-modal');
        if (e.target === modal) {
            closeReportModal();
        }
        if (e.target === detailModal) {
            closeRoomDetailsModal();
        }
        if (e.target === postModal) {
            closePostModal();
        }
    });

    // Sự kiện toggle Bản đồ/Danh sách trên Mobile (Nút nổi)
    const mobileToggleBtn = document.getElementById('mobile-map-toggle');
    mobileToggleBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const container = document.querySelector('.app-container');
        const sheetBtnText = document.getElementById('sheet-toggle-text');
        const sheetBtnIcon = document.getElementById('sheet-toggle-icon');

        if (appState.isMapVisibleOnMobile) {
            // Xem Danh Sách (Split screen default)
            sidebar.classList.remove('hidden');
            container.classList.remove('map-collapsed');
            if (sheetBtnText) sheetBtnText.textContent = "Ẩn Bản Đồ";
            if (sheetBtnIcon) {
                sheetBtnIcon.className = "fa-solid fa-compress";
            }
            mobileToggleBtn.innerHTML = '<i class="fa-solid fa-map"></i> Xem bản đồ';
            appState.isMapVisibleOnMobile = false;
        } else {
            // Xem Bản Đồ (Ẩn danh sách hoàn toàn)
            sidebar.classList.add('hidden');
            container.classList.remove('map-collapsed');
            mobileToggleBtn.innerHTML = '<i class="fa-solid fa-list"></i> Xem danh sách';
            appState.isMapVisibleOnMobile = true;
        }
        
        // Hồi phục lại map render
        setTimeout(() => appState.map.invalidateSize(), 300);
    });

    // Sự kiện Thu gọn / Mở rộng Bản đồ hoàn toàn từ thanh Header của Bottom Sheet
    const sheetToggleBtn = document.getElementById('sheet-toggle-btn');
    if (sheetToggleBtn) {
        sheetToggleBtn.addEventListener('click', () => {
            const container = document.querySelector('.app-container');
            const sheetBtnText = document.getElementById('sheet-toggle-text');
            const sheetBtnIcon = document.getElementById('sheet-toggle-icon');

            container.classList.toggle('map-collapsed');

            if (container.classList.contains('map-collapsed')) {
                // Đang thu gọn bản đồ (Xem toàn màn hình danh sách)
                if (sheetBtnText) sheetBtnText.textContent = "Hiện Bản Đồ";
                if (sheetBtnIcon) {
                    sheetBtnIcon.className = "fa-solid fa-expand";
                }
            } else {
                // Đang mở rộng bản đồ (Chế độ split screen)
                if (sheetBtnText) sheetBtnText.textContent = "Ẩn Bản Đồ";
                if (sheetBtnIcon) {
                    sheetBtnIcon.className = "fa-solid fa-compress";
                }
                // Hồi phục map render
                if (appState.map) {
                    setTimeout(() => appState.map.invalidateSize(), 100);
                }
            }
        });
    }
}

// Mở modal báo cáo
function openReportModal() {
    document.getElementById('report-modal').style.display = 'flex';
}

// Đóng modal báo cáo
function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
}

// 12. Helper hiển thị Thông báo (Toast Notification)
function showToast(message, isError = false) {
    const toast = document.getElementById('toast-notification');
    const toastIcon = document.getElementById('toast-icon');
    const toastMsg = document.getElementById('toast-message');

    toastMsg.textContent = message;
    
    if (isError) {
        toast.classList.add('error');
        toastIcon.className = "fa-solid fa-circle-xmark";
        toastIcon.style.color = "var(--color-danger)";
    } else {
        toast.classList.remove('error');
        toastIcon.className = "fa-solid fa-check-circle";
        toastIcon.style.color = "var(--color-primary)";
    }

    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 13. Hiển thị thông tin chi tiết phòng trọ trong Modal
function showRoomDetails(room) {
    // Render Room Images Carousel
    const imgContainer = document.getElementById('detail-images-container');
    const imgDiv = document.getElementById('detail-images');
    imgDiv.innerHTML = '';
    
    if (Array.isArray(room.images) && room.images.length > 0) {
        room.images.forEach(imgUrl => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = room.title;
            img.style.width = '100%';
            img.style.maxHeight = '280px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '12px';
            img.style.flexShrink = '0';
            img.style.scrollSnapAlign = 'start';
            img.style.border = '1px solid var(--border-color)';
            imgDiv.appendChild(img);
        });
        imgContainer.style.display = 'block';
    } else {
        imgDiv.innerHTML = `
            <div style="width: 100%; min-height: 140px; background: rgba(255, 255, 255, 0.03); border: 1px dashed var(--border-color); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); gap: 6px; padding: 20px 10px; text-align: center;">
                <i class="fa-solid fa-camera-slash" style="font-size: 28px; opacity: 0.6; color: #94a3b8;"></i>
                <span style="font-size: 13.5px; font-weight: 600; color: var(--text-secondary);">Không có bản xem trước nhà (trọ)</span>
                <span style="font-size: 11.5px; color: var(--text-muted);">Chủ nhà không tải lên hình ảnh đính kèm cho bài đăng này.</span>
            </div>
        `;
        imgContainer.style.display = 'block';
    }

    document.getElementById('detail-title').textContent = room.title || 'Chi Tiết Phòng Trọ';
    
    const priceVal = parseFloat(room.price) || 0;
    document.getElementById('detail-price').textContent = priceVal > 0 ? (priceVal / 1000000).toFixed(1) + ' Tr/tháng' : 'LH Chủ Nhà (Trọ) để nhận báo giá';
    
    const depositVal = parseFloat(room.deposit) || 0;
    document.getElementById('detail-deposit').textContent = depositVal > 0 ? (depositVal / 1000000).toFixed(1) + ' Tr' : 'Không yêu cầu';
    
    document.getElementById('detail-address').innerHTML = `<i class="fa-solid fa-location-dot" style="color: var(--color-danger); margin-right: 6px;"></i>${formatAddressToPostMerger(room.address || '')}`;
    document.getElementById('detail-desc').textContent = room.description || 'Không có mô tả chi tiết.';
    document.getElementById('detail-owner-name').textContent = room.ownerName || 'Chủ trọ';
    document.getElementById('detail-phone').textContent = room.contactPhone ? room.contactPhone : (room.fbUrl ? 'Liên hệ qua Facebook' : 'Chưa cập nhật');

    // Nút liên hệ Facebook cá nhân
    const btnFb = document.getElementById('btn-fb-contact');
    if (btnFb) {
        if (room.fbUrl) {
            btnFb.href = room.fbUrl;
            btnFb.style.display = 'inline-flex';
        } else {
            btnFb.style.display = 'none';
        }
    }

    // Render tags
    const tagsContainer = document.getElementById('detail-tags');
    tagsContainer.innerHTML = '';
    
    // Add owner/broker tag
    const ownerTag = document.createElement('span');
    ownerTag.className = `badge ${room.ownerType === 'broker' ? 'badge-broker' : 'badge-owner'}`;
    ownerTag.textContent = room.ownerType === 'broker' ? 'Môi giới' : 'Chủ nhà thật';
    tagsContainer.appendChild(ownerTag);

    // Add extra tags
    if (Array.isArray(room.tags)) {
        room.tags.forEach(t => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'badge';
            tagSpan.style.background = 'rgba(255, 255, 255, 0.05)';
            tagSpan.style.color = 'var(--text-secondary)';
            tagSpan.style.border = '1px solid var(--border-color)';
            tagSpan.textContent = t;
            tagsContainer.appendChild(tagSpan);
        });
    }

    // Render amenities
    const amenitiesContainer = document.getElementById('detail-amenities');
    amenitiesContainer.innerHTML = '';
    
    const allAmenities = {
        "AC": { text: "Điều hòa", icon: "fa-snowflake" },
        "Wifi": { text: "Wifi tốc độ cao", icon: "fa-wifi" },
        "Bed": { text: "Giường ngủ", icon: "fa-bed" },
        "Wardrobe": { text: "Tủ quần áo", icon: "fa-table-cells" },
        "Heater": { text: "Bình nóng lạnh", icon: "fa-temperature-empty" },
        "Fridge": { text: "Tủ lạnh", icon: "fa-cookie-bite" },
        "Balcony": { text: "Ban công riêng", icon: "fa-door-open" },
        "Kitchen": { text: "Bếp nấu ăn riêng", icon: "fa-utensils" },
        "WashingMachine": { text: "Máy giặt", icon: "fa-soap" }
    };

    if (Array.isArray(room.amenities)) {
        room.amenities.forEach(key => {
            const item = allAmenities[key];
            if (item) {
                const div = document.createElement('div');
                div.style.fontSize = '13px';
                div.style.color = 'var(--text-secondary)';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.gap = '8px';
                div.style.background = 'rgba(255,255,255,0.02)';
                div.style.padding = '8px 12px';
                div.style.borderRadius = '6px';
                div.style.border = '1px solid var(--border-color)';
                div.innerHTML = `<i class="fa-solid ${item.icon}" style="color: var(--color-primary);"></i> ${item.text}`;
                amenitiesContainer.appendChild(div);
            }
        });
    }

    // Copy Phone button action
    const copyBtn = document.getElementById('btn-copy-phone');
    if (copyBtn) {
        copyBtn.onclick = () => {
            if (room.contactPhone) {
                navigator.clipboard.writeText(room.contactPhone).then(() => {
                    showToast('Đã sao chép số điện thoại chủ trọ!', false);
                });
            }
        };
    }

    // Gửi nút Gọi điện và Zalo
    const cleanPhone = room.contactPhone ? room.contactPhone.replace(/[\s\.-]/g, "") : "";
    const callBtn = document.getElementById('btn-call-phone');
    if (callBtn) {
        callBtn.href = cleanPhone ? `tel:${cleanPhone}` : '#';
    }

    const zaloLink = document.getElementById('btn-zalo-contact');
    if (zaloLink) {
        zaloLink.href = cleanPhone ? `https://zalo.me/${cleanPhone}` : '#';
    }

    // Báo cáo đã thuê action (Đồng bộ toàn bộ thiết bị qua API)
    const rentedBtn = document.getElementById('btn-report-rented');
    if (rentedBtn) {
        rentedBtn.onclick = async () => {
            if (confirm("Xác nhận báo cáo phòng trọ này đã được thuê hoặc hết phòng? Tin đăng này sẽ ẩn khỏi hệ thống trên TẤT CẢ thiết bị.")) {
                const strId = String(room.id);
                if (!appState.rentedRoomIds.includes(strId)) {
                    appState.rentedRoomIds.push(strId);
                    localStorage.setItem('rented_rooms', JSON.stringify(appState.rentedRoomIds));
                }

                // Gửi API báo cáo đồng bộ lên máy chủ
                try {
                    await fetch('/api/rooms/report-rented', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ roomId: room.id })
                    });
                } catch (e) {}

                closeRoomDetailsModal();
                applyFilters();
                showToast("Đã ẩn phòng trọ đã thuê trên toàn hệ thống thành công!", false);
            }
        };
    }

    // Open the modal (hỗ trợ cả ID room-detail-modal và room-details-modal)
    const modal = document.getElementById('room-detail-modal') || document.getElementById('room-details-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }
    }
}

// Đóng modal chi tiết phòng trọ
function closeRoomDetailsModal() {
    const modal = document.getElementById('room-detail-modal') || document.getElementById('room-details-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// ==========================================
// 14. CHỨC NĂNG ĐĂNG TIN PHÒNG TRỌ (NGƯỜI DÙNG)
// ==========================================

// Mở modal Đăng trọ người dùng
function openPostModal() {
    document.getElementById('post-room-modal').style.display = 'flex';
    appState.isSelectingLocationForPost = true;
    
    // Tự động yêu cầu quyền vị trí thiết bị qua GPS ngay khi mở form để sẵn sàng
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                appState.userCoords = [position.coords.latitude, position.coords.longitude];
                console.log("[GPS] Đã định vị thành công vị trí người đăng:", appState.userCoords);
                initPostMiniMap();
            },
            (error) => {
                console.warn("[GPS] Định vị thất bại:", error.message);
                appState.userCoords = null;
                initPostMiniMap();
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    } else {
        initPostMiniMap();
    }
}

// Khởi tạo bản đồ nhỏ bên trong Modal Đăng trọ
function initPostMiniMap() {
    const defaultCenter = appState.userCoords || [21.012, 105.825];
    const zoomLevel = appState.userCoords ? 15 : 13;

    if (!appState.postMap) {
        appState.postMap = L.map('post-mini-map', {
            zoomControl: true
        }).setView(defaultCenter, zoomLevel);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(appState.postMap);

        // Bắt sự kiện Click bản đồ nhỏ
        appState.postMap.on('click', (e) => {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;

            document.getElementById('post-lat').value = lat.toFixed(6);
            document.getElementById('post-lon').value = lon.toFixed(6);

            if (appState.postMarker) {
                appState.postMarker.setLatLng(e.latlng);
            } else {
                appState.postMarker = L.marker(e.latlng).addTo(appState.postMap);
            }

            // Gọi API Nominatim
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, {
                headers: { 'User-Agent': 'SmartRoomFinder/1.0' }
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.display_name) {
                    const cleanAddr = data.display_name.split(',').slice(0, 4).join(',').trim();
                    document.getElementById('post-address').value = cleanAddr;
                }
            })
            .catch(err => console.log("Không giải mã được địa chỉ tọa độ click:", err));
        });
    } else {
        appState.postMap.setView(defaultCenter, zoomLevel);
        setTimeout(() => appState.postMap.invalidateSize(), 200);
    }

    // Ghim marker mặc định tại tọa độ GPS nếu có sẵn
    if (appState.userCoords) {
        const latlng = L.latLng(appState.userCoords[0], appState.userCoords[1]);
        if (appState.postMarker) {
            appState.postMarker.setLatLng(latlng);
        } else {
            appState.postMarker = L.marker(latlng).addTo(appState.postMap);
        }
        document.getElementById('post-lat').value = appState.userCoords[0].toFixed(6);
        document.getElementById('post-lon').value = appState.userCoords[1].toFixed(6);
    }
}

// Đóng modal Đăng trọ người dùng
function closePostModal() {
    document.getElementById('post-room-modal').style.display = 'none';
    appState.isSelectingLocationForPost = false;
    
    // Xóa marker định vị tạm thời nếu có
    if (appState.postMarker && appState.postMap) {
        appState.postMap.removeLayer(appState.postMarker);
        appState.postMarker = null;
    }
}

// Xử lý sự kiện chọn file hình ảnh của người dùng
function handlePostImageSelect(e) {
    const files = Array.from(e.target.files);
    let loadedCount = 0;
    if (files.length === 0) return;

    files.forEach(file => {
        if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
            showToast(`File ${file.name} không đúng định dạng PNG/JPG!`, true);
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            showToast(`File ${file.name} quá lớn (tối đa 3MB)!`, true);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Str = event.target.result;
            if (!appState.selectedPostImages.includes(base64Str)) {
                appState.selectedPostImages.push(base64Str);
            }
            loadedCount++;
            if (loadedCount === files.length || appState.selectedPostImages.length === 4) {
                renderPostImagePreviews();
            }
        };
        reader.readAsDataURL(file);
    });

    e.target.value = '';
}

// Render ảnh xem trước trong form Đăng trọ người dùng
function renderPostImagePreviews() {
    const container = document.getElementById('post-image-previews');
    const statusLabel = document.getElementById('post-upload-status');
    container.innerHTML = '';

    statusLabel.textContent = `Đã chọn ${appState.selectedPostImages.length} ảnh`;

    appState.selectedPostImages.forEach((base64Str, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.width = '70px';
        wrapper.style.height = '70px';

        const img = document.createElement('img');
        img.src = base64Str;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.border = '1px solid var(--border-color)';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '-6px';
        deleteBtn.style.right = '-6px';
        deleteBtn.style.background = 'var(--color-danger)';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.width = '18px';
        deleteBtn.style.height = '18px';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

        deleteBtn.onclick = () => {
            appState.selectedPostImages.splice(index, 1);
            renderPostImagePreviews();
        };

        wrapper.appendChild(img);
        wrapper.appendChild(deleteBtn);
        container.appendChild(wrapper);
    });
}

// Gửi tin đăng trọ lên máy chủ chờ duyệt
async function submitPostRoom() {
    const title = document.getElementById('post-title').value.trim();
    const isContactPrice = document.getElementById('post-price-contact')?.checked;
    const priceRaw = document.getElementById('post-price').value.trim();
    const priceVal = isContactPrice ? 0 : parseFloat(priceRaw);
    const deposit = document.getElementById('post-deposit').value.trim();
    const phone = document.getElementById('post-phone').value.trim();
    const ownerName = document.getElementById('post-owner-name').value.trim();
    const address = document.getElementById('post-address').value.trim();
    let latRaw = document.getElementById('post-lat').value.trim();
    let lonRaw = document.getElementById('post-lon').value.trim();
    const description = document.getElementById('post-desc').value.trim();
    const fbUrl = document.getElementById('post-fb-url') ? document.getElementById('post-fb-url').value.trim() : '';

    // 1. Kiểm tra từng trường thông tin và hiển thị thông báo chính xác
    if (!title) {
        showToast("Vui lòng nhập Tiêu đề tin đăng!", true);
        return;
    }
    if (!isContactPrice && (!priceRaw || isNaN(priceVal) || priceVal < 0)) {
        showToast("Vui lòng nhập Giá thuê hợp lệ hoặc chọn 'LH Chủ Nhà để nhận báo giá'!", true);
        return;
    }
    if (!phone && !fbUrl) {
        showToast("Vui lòng nhập Số điện thoại hoặc Liên kết Facebook cá nhân để người thuê liên hệ!", true);
        return;
    }
    if (!ownerName) {
        showToast("Vui lòng nhập Tên người liên hệ!", true);
        return;
    }
    if (!address) {
        showToast("Vui lòng nhập Địa chỉ chi tiết phòng trọ!", true);
        return;
    }

    // 2. Tự động xử lý bổ sung Tọa độ nếu chưa ghim bản đồ (tránh bị lỗi chặn form)
    let finalCoords = [22.823853, 104.969584]; // Tọa độ mặc định Hà Giang
    if (latRaw && lonRaw && !isNaN(parseFloat(latRaw)) && !isNaN(parseFloat(lonRaw))) {
        finalCoords = [parseFloat(latRaw), parseFloat(lonRaw)];
    } else {
        try {
            const cleanedQuery = cleanAddressForGeocoding(address) || address;
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanedQuery + ', Vietnam')}&format=json&limit=1`, {
                headers: { 'User-Agent': 'SmartRoomFinder/1.0' }
            });
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                if (geoData && geoData.length > 0) {
                    finalCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
                }
            }
        } catch (e) {
            console.log("Dùng tọa độ mặc định thành phố.");
        }
    }

    // 3. Xử lý ảnh: Không bắt buộc ảnh (giữ mảng rỗng nếu không tải ảnh nào)
    let images = [...appState.selectedPostImages];

    const amenities = [];
    document.querySelectorAll('#post-checkboxes input:checked').forEach(cb => {
        amenities.push(cb.value);
    });

    const roomData = {
        title: title,
        price: priceVal,
        deposit: parseFloat(deposit || priceVal),
        contactPhone: phone,
        fbUrl: fbUrl,
        ownerName: ownerName,
        address: address,
        coords: finalCoords,
        amenities: amenities,
        description: description,
        images: images,
        userCoords: appState.userCoords
    };

    const submitBtn = document.getElementById('submit-post-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

    try {
        const res = await fetch('/api/rooms/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData)
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message || "Gửi tin thành công! Tin đang chờ duyệt.", false);
            resetPostForm();
            closePostModal();
        } else {
            showToast(data.error || "Gửi tin thất bại!", true);
        }
    } catch (e) {
        showToast("Lỗi kết nối khi gửi tin đăng!", true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi Yêu Cầu Đăng Tin';
    }
}

// Reset form đăng trọ người dùng
function resetPostForm() {
    document.getElementById('post-title').value = '';
    const priceContactCb = document.getElementById('post-price-contact');
    if (priceContactCb) {
        priceContactCb.checked = false;
        const priceInput = document.getElementById('post-price');
        if (priceInput) {
            priceInput.disabled = false;
            priceInput.placeholder = 'VD: 3500000';
            priceInput.setAttribute('required', 'true');
        }
    }
    document.getElementById('post-price').value = '';
    document.getElementById('post-deposit').value = '';
    document.getElementById('post-phone').value = '';
    document.getElementById('post-owner-name').value = '';
    document.getElementById('post-address').value = '';
    document.getElementById('post-lat').value = '';
    document.getElementById('post-lon').value = '';
    document.getElementById('post-desc').value = '';

    document.querySelectorAll('#post-checkboxes input').forEach(cb => {
        cb.checked = false;
    });

    appState.selectedPostImages = [];
    renderPostImagePreviews();
}

// Tự động làm sạch địa chỉ để loại bỏ các thông tin rác mà Nominatim không nhận diện được
function cleanAddressForGeocoding(addr) {
    if (!addr) return '';
    return addr
        .replace(/(?:tổ|ngõ|ngách|hẻm|số|khu|xóm|đội|tòa|căn)\s+[0-9A-Za-z\-]+/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/,\s*,/g, ',')
        .replace(/^[\s,]+|[\s,]+$/g, '')
        .trim();
}

// Định vị bản đồ nhỏ dựa vào địa chỉ người dùng tự nhập ở modal đăng tin
async function geocodePostAddress() {
    const addressInput = document.getElementById('post-address');
    const address = addressInput.value.trim();
    if (!address) return;

    const statusLabel = document.getElementById('post-map-hint');
    const originalText = statusLabel ? statusLabel.innerHTML : '';
    if (statusLabel) {
        statusLabel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tự động tìm vị trí trên bản đồ...';
    }

    try {
        // Thử tìm kiếm với địa chỉ nguyên bản
        let searchQuery = address;
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery + ', Vietnam')}&format=json&limit=1`;
        let res = await fetch(url, { headers: { 'User-Agent': 'SmartRoomFinder/1.0' } });
        let data = res.ok ? await res.json() : [];

        // Nếu không ra kết quả, tự động làm sạch (bỏ tổ/ngõ/ngách/số) để tìm lại
        if (!data || data.length === 0) {
            const cleanedQuery = cleanAddressForGeocoding(address);
            if (cleanedQuery && cleanedQuery !== address) {
                url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanedQuery + ', Vietnam')}&format=json&limit=1`;
                res = await fetch(url, { headers: { 'User-Agent': 'SmartRoomFinder/1.0' } });
                data = res.ok ? await res.json() : [];
            }
        }

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            // Điền vĩ độ và kinh độ vào các input
            document.getElementById('post-lat').value = lat.toFixed(6);
            document.getElementById('post-lon').value = lon.toFixed(6);

            // Di chuyển bản đồ nhỏ & định vị marker
            if (appState.postMap) {
                appState.postMap.setView([lat, lon], 16);
                
                if (appState.postMarker) {
                    appState.postMarker.setLatLng([lat, lon]);
                } else {
                    appState.postMarker = L.marker([lat, lon]).addTo(appState.postMap);
                }
            }
            
            if (statusLabel) {
                statusLabel.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Đã tự động định vị và ghim vị trí trên bản đồ! Bạn vẫn có thể ghim lại bằng cách click trực tiếp.';
                setTimeout(() => {
                    statusLabel.innerHTML = originalText;
                }, 4000);
            }
        } else {
            if (statusLabel) {
                statusLabel.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> Không tìm thấy địa chỉ cụ thể. Hãy ghim thủ công bằng cách click lên bản đồ.';
                setTimeout(() => {
                    statusLabel.innerHTML = originalText;
                }, 4000);
            }
        }
    } catch (err) {
        console.error("Lỗi định vị:", err);
        if (statusLabel) statusLabel.innerHTML = originalText;
    }
}

// ==========================================
// 12. GÓC TÌM BẠN Ở GHÉP (ROOMMATE FINDER)
// ==========================================
function initRoommates() {
    // 1. Tải danh sách từ API
    fetchRoommates();

    // 2. Nạp dữ liệu các trường vào ô chọn lọc ở ghép
    const rmSchoolFilterSelect = document.getElementById('rm-filter-school');
    if (rmSchoolFilterSelect) {
        rmSchoolFilterSelect.innerHTML = '<option value="all">Tất cả các Trường / Khu vực</option>';
        UNIVERSITIES.forEach(uni => {
            const opt = document.createElement('option');
            opt.value = uni.id;
            opt.textContent = `${uni.name} (${uni.abbr})`;
            rmSchoolFilterSelect.appendChild(opt);
        });
        rmSchoolFilterSelect.addEventListener('change', renderRoommates);
        
        // Chọn sẵn trường hiện tại nếu có
        if (appState.selectedSchool) {
            rmSchoolFilterSelect.value = appState.selectedSchool.id;
        }
    }

    // 3. Thiết lập lắng nghe sự thay đổi của bộ lọc nhanh thói quen sinh hoạt
    const myGender = document.getElementById('my-gender');
    const mySmoking = document.getElementById('my-smoking');
    const mySleep = document.getElementById('my-sleep');
    const myCleanliness = document.getElementById('my-cleanliness');
    const myCleanlinessVal = document.getElementById('my-cleanliness-val');

    if (myGender) myGender.addEventListener('change', renderRoommates);
    if (mySmoking) mySmoking.addEventListener('change', renderRoommates);
    if (mySleep) mySleep.addEventListener('change', renderRoommates);
    
    if (myCleanliness && myCleanlinessVal) {
        myCleanliness.addEventListener('input', (e) => {
            myCleanlinessVal.innerText = `${e.target.value}/5`;
            renderRoommates();
        });
    }

    // 3. Xử lý mở/đóng Modal đăng ký hồ sơ
    const openBtn = document.getElementById('open-post-roommate-btn');
    const closeBtn = document.getElementById('close-roommate-modal-btn');
    const modal = document.getElementById('roommate-modal');
    const form = document.getElementById('roommate-form');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            // Tự động chọn trường nếu đang có trường được chọn bên ngoài bản đồ
            if (appState.selectedSchool) {
                const schoolSelect = document.getElementById('rm-school');
                if (schoolSelect) {
                    schoolSelect.value = appState.selectedSchool.id;
                }
            }
            modal.style.display = 'flex';
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // 4. Xử lý gửi Form đăng ký
    if (form && modal) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const schoolSelect = document.getElementById('rm-school');
            const schoolAbbr = schoolSelect ? schoolSelect.options[schoolSelect.selectedIndex].text.match(/\(([^)]+)\)/)?.[1] || "UNI" : "UNI";

            const data = {
                name: document.getElementById('rm-name').value,
                gender: document.getElementById('rm-gender').value,
                contactPhone: document.getElementById('rm-phone').value,
                uniId: document.getElementById('rm-school').value,
                uniAbbr: schoolAbbr,
                maxBudget: parseInt(document.getElementById('rm-budget').value),
                habits: {
                    cleanliness: parseInt(document.getElementById('rm-cleanliness-form').value),
                    smoking: document.getElementById('rm-smoking-form').value,
                    sleep: document.getElementById('rm-sleep-form').value,
                    social: "sometimes"
                },
                description: document.getElementById('rm-desc').value
            };

            try {
                const res = await fetch('/api/roommates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    showToast("🎉 Đăng ký hồ sơ ở ghép thành công!");
                    form.reset();
                    modal.style.display = 'none';
                    // Tải lại danh sách
                    await fetchRoommates();
                } else {
                    const err = await res.json();
                    alert("Lỗi: " + (err.error || "Không thể đăng ký!"));
                }
            } catch (err) {
                console.error(err);
                alert("Không thể kết nối đến server!");
            }
        });
    }
}

// Fetch tất cả hồ sơ ở ghép từ server
async function fetchRoommates() {
    try {
        const res = await fetch('/api/roommates');
        if (res.ok) {
            appState.roommates = await res.json();
            renderRoommates();
        }
    } catch (err) {
        console.error("Lỗi fetch roommates:", err);
    }
}

// Chấm điểm tương thích (%) giữa thói quen bộ lọc và thói quen hồ sơ ở ghép
function calculateMatchScore(myFilters, rmProfile) {
    let score = 0;

    // 1. Khớp giới tính (Gender Match) - Trọng số: 20%
    if (myFilters.gender === rmProfile.gender) {
        score += 20;
    }

    // 2. Khớp trường học (School Match) - Trọng số: 30%
    const rmSchoolFilter = document.getElementById('rm-filter-school');
    const filterUniId = rmSchoolFilter ? rmSchoolFilter.value : 'all';
    
    if (filterUniId !== 'all') {
        if (rmProfile.uniId === filterUniId) {
            score += 30;
        }
    } else if (appState.selectedSchool) {
        if (appState.selectedSchool.id === rmProfile.uniId) {
            score += 30;
        }
    } else {
        score += 20; // Nếu không chọn trường cụ thể, cho điểm cơ sở
    }

    // 3. Khớp thói quen hút thuốc - Trọng số: 20%
    if (myFilters.smoking === rmProfile.habits.smoking) {
        score += 20;
    }

    // 4. Khớp giờ giấc sinh hoạt (Thức khuya/Dậy sớm) - Trọng số: 15%
    if (myFilters.sleep === rmProfile.habits.sleep) {
        score += 15;
    }

    // 5. Khớp mức độ gọn gàng (Khoảng cách điểm) - Trọng số: 15%
    const cleanDiff = Math.abs(myFilters.cleanliness - rmProfile.habits.cleanliness);
    score += Math.max(0, 15 - cleanDiff * 4); // Càng lệch nhiều càng trừ nhiều

    return Math.min(100, Math.max(0, Math.round(score)));
}

// Render danh sách hồ sơ ở ghép
function renderRoommates() {
    const listContainer = document.getElementById('roommate-list');
    const countSpan = document.getElementById('roommates-count');
    if (!listContainer) return;

    // Lấy giá trị bộ lọc trường
    const schoolFilter = document.getElementById('rm-filter-school');
    const selectedSchoolId = schoolFilter ? schoolFilter.value : 'all';

    // Lọc danh sách roommates theo trường nếu được chọn lọc cụ thể
    let filteredCandidates = appState.roommates;
    if (selectedSchoolId !== 'all') {
        filteredCandidates = filteredCandidates.filter(rm => rm.uniId === selectedSchoolId);
    }

    // Lấy giá trị bộ lọc thói quen nhanh
    const myFilters = {
        gender: document.getElementById('my-gender').value,
        smoking: document.getElementById('my-smoking').value,
        sleep: document.getElementById('my-sleep').value,
        cleanliness: parseInt(document.getElementById('my-cleanliness').value)
    };

    // Chấm điểm cho từng ứng viên
    const ratedRoommates = filteredCandidates.map(rm => {
        const score = calculateMatchScore(myFilters, rm);
        return { ...rm, matchScore: score };
    });

    // Sắp xếp giảm dần theo điểm tương thích
    ratedRoommates.sort((a, b) => b.matchScore - a.matchScore);

    listContainer.innerHTML = '';
    countSpan.innerText = ratedRoommates.length;

    if (ratedRoommates.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">Không có bạn sinh viên nào tìm ở ghép ở khu vực trường này.</div>';
        return;
    }

    ratedRoommates.forEach(rm => {
        // Xác định màu sắc của điểm tương thích
        let scoreClass = 'match-low';
        if (rm.matchScore >= 80) scoreClass = 'match-high';
        else if (rm.matchScore >= 50) scoreClass = 'match-medium';

        // Xây dựng các nhãn thói quen
        const sleepText = rm.habits.sleep === 'early' ? 'Dậy sớm' : 'Cú đêm';
        const smokeText = rm.habits.smoking === 'yes' ? 'Hút thuốc' : 'Không hút thuốc';
        const cleanStars = '★'.repeat(rm.habits.cleanliness) + '☆'.repeat(5 - rm.habits.cleanliness);

        const card = document.createElement('div');
        card.className = 'roommate-card';
        card.innerHTML = `
            <div class="match-score-badge ${scoreClass}">
                <i class="fa-solid fa-heart-pulse"></i> ${rm.matchScore}%
            </div>
            <div class="roommate-header">
                <div class="roommate-name">
                    ${rm.name}
                    <span class="roommate-gender ${rm.gender === 'Nam' ? 'gender-nam' : 'gender-nu'}">${rm.gender}</span>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
                <span class="roommate-uni"><i class="fa-solid fa-graduation-cap"></i> ${rm.uniAbbr}</span>
                <span class="roommate-budget"><i class="fa-solid fa-wallet"></i> Tối đa: ${(rm.maxBudget / 1000000).toFixed(1)} Tr/tháng</span>
            </div>
            <div class="roommate-habits">
                <span class="habit-badge habit-clean"><i class="fa-solid fa-sparkles"></i> Ngăn nắp: ${cleanStars}</span>
                <span class="habit-badge habit-nosmoke"><i class="fa-solid fa-ban"></i> ${smokeText}</span>
                <span class="habit-badge"><i class="fa-solid fa-clock"></i> ${sleepText}</span>
            </div>
            <div class="roommate-desc">
                ${rm.description}
            </div>
            <div class="roommate-contact">
                <span style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-envelope"></i> Kết nối ở ghép</span>
                <a href="tel:${rm.contactPhone}" class="roommate-phone-btn">
                    <i class="fa-solid fa-phone"></i> Gọi điện / Zalo
                </a>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// Khởi tạo bộ lọc Tỉnh/Thành & Phường/Xã bằng cách load dữ liệu từ API
function initLocationFilters() {
    const provinceSelect = document.getElementById('filter-province');
    const wardSelect = document.getElementById('filter-ward');

    if (!provinceSelect || !wardSelect) return;

    fetch('/api/locations/provinces')
        .then(res => res.json())
        .then(provinces => {
            provinceSelect.innerHTML = '<option value="">Tất cả Tỉnh/Thành</option>';
            provinces.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.code;
                opt.textContent = p.fullName;
                provinceSelect.appendChild(opt);
            });
        })
        .catch(err => {
            console.warn('[Location] Failed to fetch provinces from server, using local mockup provinces.', err);
            const backupProvinces = [
                { code: "01", fullName: "Thành phố Hà Nội" },
                { code: "79", fullName: "Thành phố Hồ Chí Minh" },
                { code: "46", fullName: "Tỉnh Thái Nguyên" }
            ];
            provinceSelect.innerHTML = '<option value="">Tất cả Tỉnh/Thành</option>';
            backupProvinces.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.code;
                opt.textContent = p.fullName;
                provinceSelect.appendChild(opt);
            });
        });

    provinceSelect.addEventListener('change', () => {
        const provinceCode = provinceSelect.value;
        wardSelect.innerHTML = '<option value="">Tất cả Phường/Xã</option>';
        
        if (!provinceCode) {
            wardSelect.disabled = true;
            applyFilters();
            return;
        }

        fetch(`/api/locations/provinces/${provinceCode}/wards`)
            .then(res => res.json())
            .then(wards => {
                wardSelect.disabled = false;
                wards.forEach(w => {
                    const opt = document.createElement('option');
                    opt.value = w.code;
                    opt.textContent = w.fullName;
                    wardSelect.appendChild(opt);
                });
                applyFilters();
            })
            .catch(err => {
                console.error('[Location] Failed to fetch wards:', err);
                wardSelect.disabled = true;
                applyFilters();
            });
    });

    wardSelect.addEventListener('change', applyFilters);
}


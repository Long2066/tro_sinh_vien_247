// Dữ liệu danh sách trường Đại học lớn tại Việt Nam (Toàn quốc)
const UNIVERSITIES = [
    // --- HÀ NỘI ---
    {
        id: "hust",
        name: "Đại học Bách Khoa Hà Nội",
        abbr: "HUST",
        coords: [21.0062, 105.8431],
        address: "1 Đại Cồ Việt, Bách Khoa, Hai Bà Trưng, Hà Nội"
    },
    {
        id: "neu",
        name: "Đại học Kinh tế Quốc dân",
        abbr: "NEU",
        coords: [21.0028, 105.8427],
        address: "207 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội"
    },
    {
        id: "ftu",
        name: "Đại học Ngoại thương",
        abbr: "FTU",
        coords: [21.0225, 105.8037],
        address: "91 Chùa Láng, Láng Thượng, Đống Đa, Hà Nội"
    },
    {
        id: "vnu",
        name: "Đại học Quốc gia Hà Nội (Cầu Giấy)",
        abbr: "VNU",
        coords: [21.0378, 105.7825],
        address: "144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
    },
    {
        id: "tlu",
        name: "Trường Đại học Thủy lợi",
        abbr: "TLU",
        coords: [21.0083, 105.8236],
        address: "175 Tây Sơn, Trung Liệt, Đống Đa, Hà Nội"
    },
    {
        id: "ptit",
        name: "Học viện Công nghệ Bưu chính Viễn thông",
        abbr: "PTIT",
        coords: [20.9806, 105.7876],
        address: "96A Trần Phú, Mộ Lao, Hà Đông, Hà Nội"
    },
    {
        id: "haui",
        name: "Trường Đại học Công nghiệp Hà Nội",
        abbr: "HaUI",
        coords: [21.0538, 105.7351],
        address: "Số 298 Đường Cầu Diễn, Minh Khai, Bắc Từ Liêm, Hà Nội"
    },
    {
        id: "aof",
        name: "Học viện Tài chính",
        abbr: "AOF",
        coords: [21.0772, 105.7744],
        address: "Số 58 Lê Văn Hiến, Đức Thắng, Bắc Từ Liêm, Hà Nội"
    },
    {
        id: "hau",
        name: "Trường Đại học Kiến trúc Hà Nội",
        abbr: "HAU",
        coords: [20.9796, 105.7905],
        address: "Đường Trần Phú, Văn Quán, Hà Đông, Hà Nội"
    },
    {
        id: "ba",
        name: "Học viện Ngân hàng",
        abbr: "BA",
        coords: [21.0090, 105.8282],
        address: "12 Chùa Bộc, Quang Trung, Đống Đa, Hà Nội"
    },
    {
        id: "hmu",
        name: "Trường Đại học Y Hà Nội",
        abbr: "HMU",
        coords: [21.0026, 105.8290],
        address: "1 Tôn Thất Tùng, Kim Liên, Đống Đa, Hà Nội"
    },
    {
        id: "tuc",
        name: "Trường Cao đẳng Du lịch Hà Nội",
        abbr: "TUC",
        coords: [21.0475, 105.7942],
        address: "236 Hoàng Quốc Việt, Cổ Nhuế 1, Bắc Từ Liêm, Hà Nội"
    },
    {
        id: "tmu",
        name: "Trường Đại học Thương mại",
        abbr: "TMU",
        coords: [21.0366, 105.7748],
        address: "79 Hồ Tùng Mậu, Mai Dịch, Cầu Giấy, Hà Nội"
    },
    {
        id: "hnue",
        name: "Trường Đại học Sư phạm Hà Nội",
        abbr: "HNUE",
        coords: [21.0371, 105.7815],
        address: "136 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
    },
    {
        id: "hlu",
        name: "Trường Đại học Luật Hà Nội",
        abbr: "HLU",
        coords: [21.0205, 105.8118],
        address: "87 Nguyễn Chí Thanh, Láng Hạ, Đống Đa, Hà Nội"
    },
    {
        id: "utc",
        name: "Trường Đại học Giao thông Vận tải",
        abbr: "UTC",
        coords: [21.0275, 105.8035],
        address: "3 Cầu Giấy, Láng Thượng, Đống Đa, Hà Nội"
    },
    {
        id: "huce",
        name: "Trường Đại học Xây dựng Hà Nội",
        abbr: "HUCE",
        coords: [21.0034, 105.8425],
        address: "55 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội"
    },
    {
        id: "dav",
        name: "Học viện Ngoại giao",
        abbr: "DAV",
        coords: [21.0223, 105.8052],
        address: "69 Chùa Láng, Láng Thượng, Đống Đa, Hà Nội"
    },

    // --- THÀNH PHỐ HỒ CHÍ MINH (ĐỊA GIỚI THỦ ĐỨC MỚI) ---
    {
        id: "hcmut",
        name: "Trường Đại học Bách khoa - ĐHQG TP.HCM",
        abbr: "HCMUT",
        coords: [10.7724, 106.6579],
        address: "268 Lý Thường Kiệt, Phường 14, Quận 10, TP. Hồ Chí Minh"
    },
    {
        id: "hcmut-td",
        name: "Đại học Bách khoa TP.HCM (Cơ sở Thủ Đức)",
        abbr: "HCMUT-TD",
        coords: [10.8804, 106.8062],
        address: "Đường Kỷ Nguyên, Phường Linh Trung, Thành phố Thủ Đức, TP. Hồ Chí Minh"
    },
    {
        id: "ueh",
        name: "Đại học Kinh tế TP. Hồ Chí Minh",
        abbr: "UEH",
        coords: [10.7801, 106.6806],
        address: "59C Nguyễn Đình Chiểu, Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh"
    },
    {
        id: "ftu2",
        name: "Trường Đại học Ngoại thương (Cơ sở II - TP.HCM)",
        abbr: "FTU2",
        coords: [10.8021, 106.7145],
        address: "15 Đường D5, Phường 25, Bình Thạnh, TP. Hồ Chí Minh"
    },
    {
        id: "hcmute",
        name: "Trường Đại học Sư phạm Kỹ thuật TP.HCM",
        abbr: "HCMUTE",
        coords: [10.8512, 106.7721],
        address: "1 Võ Văn Ngân, Phường Linh Chiểu, Thành phố Thủ Đức, TP. Hồ Chí Minh"
    },
    {
        id: "nlu",
        name: "Trường Đại học Nông Lâm TP. Hồ Chí Minh",
        abbr: "NLU",
        coords: [10.8703, 106.7885],
        address: "Đường Song Hành QL1A, Phường Linh Trung, Thành phố Thủ Đức, TP. Hồ Chí Minh"
    },
    {
        id: "hcmus",
        name: "Trường Đại học Khoa học Tự nhiên - ĐHQG TP.HCM",
        abbr: "HCMUS",
        coords: [10.7624, 106.6823],
        address: "227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh"
    },
    {
        id: "hcmus-td",
        name: "Trường Đại học KHTN (Cơ sở Linh Trung)",
        abbr: "HCMUS-TD",
        coords: [10.8758, 106.7997],
        address: "Khu đô thị ĐHQG TP.HCM, Phường Linh Trung, Thành phố Thủ Đức, TP. Hồ Chí Minh"
    },
    {
        id: "hcmussh",
        name: "Đại học Khoa học Xã hội và Nhân văn - ĐHQG TP.HCM",
        abbr: "HCMUSSH",
        coords: [10.7865, 106.7021],
        address: "10-12 Đinh Tiên Hoàng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
    },
    {
        id: "hcmussh-td",
        name: "Đại học KHXH&NV (Cơ sở Linh Trung)",
        abbr: "USSH-TD",
        coords: [10.8722, 106.8025],
        address: "Khu đô thị ĐHQG TP.HCM, Phường Linh Trung, Thành phố Thủ Đức, TP. Hồ Chí Minh"
    },
    {
        id: "tdtu",
        name: "Trường Đại học Tôn Đức Thắng",
        abbr: "TDTU",
        coords: [10.7324, 106.6975],
        address: "19 Nguyễn Hữu Thọ, Tân Phong, Quận 7, TP. Hồ Chí Minh"
    },
    {
        id: "hutech",
        name: "Trường Đại học Công nghệ TP.HCM",
        abbr: "HUTECH",
        coords: [10.8016, 106.7118],
        address: "475A Điện Biên Phủ, Phường 25, Bình Thạnh, TP. Hồ Chí Minh"
    },
    {
        id: "ulaw-hcm",
        name: "Trường Đại học Luật TP. Hồ Chí Minh",
        abbr: "ULAW",
        coords: [10.7618, 106.7072],
        address: "2 Nguyễn Tất Thành, Phường 13, Quận 4, TP. Hồ Chí Minh"
    },

    // --- THÁI NGUYÊN & HÀ GIANG ---
    {
        id: "tnu-hg",
        name: "Phân hiệu Đại học Thái Nguyên tại Hà Giang",
        abbr: "TNU-HG",
        coords: [22.8123623, 104.9814349],
        address: "Đường Nguyễn Du, Tổ 16, Phường Hà Giang 1, Tuyên Quang"
    },
    {
        id: "tnu",
        name: "Đại học Thái Nguyên (Trụ sở chính)",
        abbr: "TNU",
        coords: [21.5875, 105.8115],
        address: "Phường Tân Thịnh, Thành phố Thái Nguyên, Tỉnh Thái Nguyên"
    },
    {
        id: "tnut",
        name: "Trường Đại học Công nghiệp Thái Nguyên",
        abbr: "TNUT",
        coords: [21.5862, 105.8078],
        address: "Số 666 Đường 3/2, Phường Tích Lương, Thành phố Thái Nguyên, Tỉnh Thái Nguyên"
    },
    {
        id: "tump",
        name: "Trường Đại học Y - Dược Thái Nguyên",
        abbr: "TUMP",
        coords: [21.5972, 105.8285],
        address: "284 Đường Lương Ngọc Quyến, Phường Quang Trung, Thành phố Thái Nguyên, Tỉnh Thái Nguyên"
    },

    // --- ĐÀ NẴNG ---
    {
        id: "dut",
        name: "Trường Đại học Bách khoa - Đại học Đà Nẵng",
        abbr: "DUT",
        coords: [16.0745, 108.1498],
        address: "54 Nguyễn Lương Bằng, Hòa Khánh Bắc, Liên Chiểu, Đà Nẵng"
    },
    {
        id: "due",
        name: "Trường Đại học Kinh tế - Đại học Đà Nẵng",
        abbr: "DUE",
        coords: [16.0465, 108.2435],
        address: "71 Ngũ Hành Sơn, Mỹ An, Ngũ Hành Sơn, Đà Nẵng"
    },

    // --- CẦN THƠ ---
    {
        id: "ctu",
        name: "Trường Đại học Cần Thơ",
        abbr: "CTU",
        coords: [10.0298, 105.7685],
        address: "Khu II, Đường 3/2, Phường Xuân Khánh, Ninh Kiều, Cần Thơ"
    },
    {
        id: "ctump",
        name: "Trường Đại học Y Dược Cần Thơ",
        abbr: "CTUMP",
        coords: [10.0268, 105.7572],
        address: "179 Nguyễn Văn Cừ, An Khánh, Ninh Kiều, Cần Thơ"
    }
];

// Danh sách phòng trọ mẫu
const MOCK_ROOMS = [
    {
        id: 1,
        title: "Phòng trọ khép kín full đồ ngay sau Đại học Bách Khoa",
        price: 3200000, // VND
        deposit: 3200000,
        address: "Ngõ 40 Tạ Quang Bửu, Bách Khoa, Hai Bà Trưng",
        coords: [21.0075, 105.8452],
        contactPhone: "0987654321",
        ownerType: "owner", // owner: chủ nhà thật, broker: môi giới
        ownerName: "Cô Hoa Chủ Nhà",
        rating: 4.8,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater", "Fridge"],
        description: "Phòng trọ khép kín diện tích 22m2 sạch sẽ, giờ giấc tự do không chung chủ. Phòng trang bị đầy đủ điều hòa, nóng lạnh, giường tủ, tủ lạnh mini. Chỉ cho sinh viên thuê. Điện 3.5k/số, nước 100k/người. Có khóa vân tay cửa ra vào cực kỳ an ninh.",
        nearbyUnis: [
            { id: "hust", distance: 0.3 }, // km
            { id: "neu", distance: 0.6 }
        ],
        verified: true,
        tags: ["Gần trường", "Không chung chủ", "Khóa vân tay"]
    },
    {
        id: 2,
        title: "Chung cư mini cao cấp, ban công thoáng mát gần NEU",
        price: 4500000,
        deposit: 4500000,
        address: "Số 15 Ngõ 205 Giải Phóng, Hai Bà Trưng",
        coords: [21.0015, 105.8415],
        contactPhone: "0912345678",
        ownerType: "owner",
        ownerName: "Chú Hùng",
        rating: 4.5,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater", "Fridge", "Balcony", "WashingMachine"],
        description: "Căn hộ dịch vụ tiện nghi thoáng mát có cửa sổ lớn và ban công riêng phơi đồ. Đầy đủ đồ đạc chỉ việc xách vali đến ở. Máy giặt chung trên tầng thượng miễn phí. Tòa nhà có thang máy, khóa cổng vân tay bảo mật cao.",
        nearbyUnis: [
            { id: "neu", distance: 0.2 },
            { id: "hust", distance: 0.5 }
        ],
        verified: true,
        tags: ["Có ban công", "Thang máy", "Full đồ"]
    },
    {
        id: 3,
        title: "Phòng trọ giá rẻ cho sinh viên ngõ Chùa Láng - FTU",
        price: 2200000,
        deposit: 1000000,
        address: "Ngách 82/3 Chùa Láng, Láng Thượng, Đống Đa",
        coords: [21.0242, 105.8018],
        contactPhone: "0345678901",
        ownerType: "broker",
        ownerName: "Anh Tuấn Môi Giới",
        rating: 3.5,
        amenities: ["Wifi", "Bed", "Wardrobe", "Heater"],
        description: "Còn 2 phòng trọ trống giá bình dân ngay gần Ngoại thương và Ngoại giao. Phòng rộng 15m2 sạch sẽ, vệ sinh chung giữa 2 phòng. Điện nước giá dân tự chia. Phù hợp các bạn sinh viên muốn tiết kiệm chi phí.",
        nearbyUnis: [
            { id: "ftu", distance: 0.3 }
        ],
        verified: false,
        tags: ["Giá rẻ", "Gần trường"]
    },
    {
        id: 4,
        title: "Căn hộ dịch vụ studio sang xịn mịn ngõ 144 Xuân Thủy - VNU",
        price: 5500000,
        deposit: 5500000,
        address: "Ngõ 144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy",
        coords: [21.0365, 105.7808],
        contactPhone: "0909876543",
        ownerType: "owner",
        ownerName: "Chị Thảo Manager",
        rating: 4.7,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater", "Fridge", "Kitchen", "WashingMachine"],
        description: "Studio rộng 30m2 khép kín riêng tư hoàn toàn, trang bị bếp riêng nấu ăn không sợ mùi. Có máy giặt sấy riêng trong phòng. Giờ giấc hoàn toàn tự do bằng khóa thông minh qua app. Khu vực dân trí cao, an ninh tốt.",
        nearbyUnis: [
            { id: "vnu", distance: 0.2 }
        ],
        verified: true,
        tags: ["Có bếp riêng", "Máy giặt riêng", "Khóa thông minh"]
    },
    {
        id: 5,
        title: "Phòng trọ ở ghép tìm nam ở cùng tại Triều Khúc",
        price: 1500000,
        deposit: 500000,
        address: "Ngõ 66 Triều Khúc, Thanh Xuân Nam, Thanh Xuân",
        coords: [20.9858, 105.7995],
        contactPhone: "0888777666",
        ownerType: "owner",
        ownerName: "Khánh Sinh Viên",
        rating: 4.2,
        amenities: ["AC", "Wifi", "Bed", "Fridge", "WashingMachine"],
        description: "Mình đang học K23 UTT, phòng hiện có 2 người muốn tìm thêm 1 bạn nam ở ghép để chia tiền phòng. Phòng rộng 25m2 có điều hòa, máy giặt đầy đủ đồ. Chi phí chia đều cực rẻ tầm 1tr3 - 1tr5 cả điện nước mạng.",
        nearbyUnis: [
            { id: "huc", distance: 0.2 }
        ],
        verified: false,
        tags: ["Tìm ở ghép", "Chi phí rẻ", "Thân thiện"]
    },
    {
        id: 6,
        title: "Phòng trọ giá siêu rẻ 1tr5 ngõ 105 Xuân Thủy (CẢNH BÁO SCAM)",
        price: 1500000,
        deposit: 1500000,
        address: "Ngõ 105 Xuân Thủy, Cầu Giấy",
        coords: [21.0382, 105.7845],
        contactPhone: "0944333222",
        ownerType: "broker",
        ownerName: "Kẻ Lừa Đảo",
        rating: 1.0,
        amenities: ["AC", "Wifi", "Bed"],
        description: "Phòng đẹp full đồ giá cực sốc chỉ 1tr5/tháng. Đẹp như chung cư cao cấp. Yêu cầu chuyển khoản cọc giữ phòng trước 1 triệu vì đang có rất nhiều người hỏi, ai cọc trước giữ phòng trước.",
        nearbyUnis: [
            { id: "vnu", distance: 0.3 }
        ],
        verified: false,
        tags: ["Cảnh báo lừa đảo", "Cọc online trước"]
    },
    {
        id: 7,
        title: "Phòng trọ sinh viên giá rẻ sát bên Phân hiệu ĐHTN Hà Giang",
        price: 1200000,
        deposit: 500000,
        address: "Đường Nguyễn Du, Tổ 16, Phường Hà Giang 1, Tuyên Quang",
        coords: [22.8135, 104.9825],
        contactPhone: "0912999888",
        ownerType: "owner",
        ownerName: "Bác Minh Chủ Nhà",
        rating: 4.6,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater"],
        description: "Phòng trọ giá bình dân cực kỳ phù hợp cho sinh viên phân hiệu. Phòng khép kín, rộng rãi thoáng mát, điện nước tính giá dân. An ninh đảm bảo, đi bộ 3 phút ra tới trường.",
        nearbyUnis: [
            { id: "tnu-hg", distance: 0.2 }
        ],
        verified: true,
        tags: ["Giá rẻ", "Đi bộ đi học"]
    },
    {
        id: 8,
        title: "Căn hộ mini cao cấp full đồ gần ĐHTN Hà Giang",
        price: 2000000,
        deposit: 1500000,
        address: "Tổ 16, Phường Hà Giang 1, Tuyên Quang",
        coords: [22.8105, 104.9790],
        contactPhone: "0988222111",
        ownerType: "owner",
        ownerName: "Cô Lan",
        rating: 4.7,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater", "Fridge", "WashingMachine"],
        description: "Phòng trọ trang bị đầy đủ điều hòa, nóng lạnh, máy giặt riêng, giường tủ mới tinh. Có ban công rộng phơi đồ đón nắng tự nhiên. Chỗ để xe máy free rộng rãi, có camera an ninh giám sát 24/7.",
        nearbyUnis: [
            { id: "tnu-hg", distance: 0.3 }
        ],
        verified: true,
        tags: ["Đầy đủ đồ", "Chỗ để xe rộng"]
    },
    {
        id: 9,
        title: "Phòng trọ giá rẻ cho sinh viên sư phạm sát phân hiệu ĐHTN HG",
        price: 900000,
        deposit: 300000,
        address: "Ngõ 19 Tháng 5, Phường Hà Giang 1, Tuyên Quang",
        coords: [22.8130, 104.9805],
        contactPhone: "0356111222",
        ownerType: "owner",
        ownerName: "Bác Ba",
        rating: 4.5,
        amenities: ["Wifi", "Bed", "Wardrobe", "Heater"],
        description: "Phòng trọ giá siêu sinh viên ngay sau cổng phụ phân hiệu. Diện tích 14m2 khép kín, an ninh tốt, chủ nhà dễ tính. Thích hợp cho các bạn sinh viên sư phạm muốn tiết kiệm tối đa chi phí.",
        nearbyUnis: [
            { id: "tnu-hg", distance: 0.15 }
        ],
        verified: true,
        tags: ["Giá rẻ", "Gần trường"]
    },
    {
        id: 10,
        title: "Nhà nguyên căn 2 tầng chia phòng ở ghép tại Nguyễn Trãi",
        price: 1500000,
        deposit: 1000000,
        address: "Đường Nguyễn Du, Phường Hà Giang 1, Tuyên Quang",
        coords: [22.8115, 104.9840],
        contactPhone: "0977888999",
        ownerType: "owner",
        ownerName: "Anh Nam",
        rating: 4.8,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater", "Fridge", "Kitchen", "WashingMachine"],
        description: "Nhà nguyên căn rộng rãi chia phòng cho thuê. Có phòng khách và bếp nấu ăn chung đầy đủ tủ lạnh máy giặt bếp ga. Giờ giấc tự do, khóa vân tay. Mỗi phòng ở được 2 người thoải mái.",
        nearbyUnis: [
            { id: "tnu-hg", distance: 0.3 }
        ],
        verified: true,
        tags: ["Giờ tự do", "Full bếp"]
    },
    {
        id: 11,
        title: "Phòng trọ khép kín mới xây chất lượng cao gần ĐHTN Hà Giang",
        price: 2500000,
        deposit: 2500000,
        address: "Đường Minh Khai, Phường Hà Giang 1, Tuyên Quang",
        coords: [22.8145, 104.9780],
        contactPhone: "0911555444",
        ownerType: "broker",
        ownerName: "Trung Land",
        rating: 4.0,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe", "Heater", "Fridge", "Balcony"],
        description: "Hệ thống phòng trọ khép kín mới xây 100% cực kỳ sang xịn. Đầy đủ điều hòa nóng lạnh ban công thoáng mát đón gió. Cách Phân hiệu ĐHTN chỉ 5 phút đi bộ. Xem phòng miễn phí, liên hệ ngay.",
        nearbyUnis: [
            { id: "tnu-hg", distance: 0.4 }
        ],
        verified: false,
        tags: ["Mới xây", "Ban công thoáng"]
    },
    {
        id: 12,
        title: "Phòng trọ xịn 1tr ngõ Nguyễn Du Hà Giang (CẢNH BÁO SCAM)",
        price: 1000000,
        deposit: 1000000,
        address: "Tổ 16, Phường Hà Giang 1, Tuyên Quang",
        coords: [22.8110, 104.9820],
        contactPhone: "0333444555",
        ownerType: "broker",
        ownerName: "Trần Văn C (Kẻ lừa đảo)",
        rating: 1.0,
        amenities: ["AC", "Wifi", "Bed", "Wardrobe"],
        description: "Phòng trọ đẹp lung linh full đồ, có điều hòa máy giặt giá cực rẻ chỉ 1tr/tháng cho sinh viên phân hiệu. Đang có rất nhiều người hỏi, yêu cầu chuyển khoản cọc trước 500k để giữ chỗ.",
        nearbyUnis: [
            { id: "tnu-hg", distance: 0.2 }
        ],
        verified: false,
        tags: ["Cọc trước giữ chỗ", "Cảnh báo lừa đảo"]
    }
];

// Danh sách đen số điện thoại lừa đảo ban đầu (Scam Blacklist)
const INITIAL_BLACKLIST = [
    {
        phone: "0944333222",
        name: "Lê Văn A (Giả danh chủ trọ)",
        reason: "Yêu cầu chuyển khoản cọc giữ phòng 1 triệu qua ngân hàng rồi khóa máy chặn liên lạc.",
        reportedDate: "2026-06-25",
        evidenceCount: 4
    },
    {
        phone: "0911222333",
        name: "Nguyễn Thị B (Môi giới lừa phí)",
        reason: "Bắt sinh viên đóng phí xem phòng 200k, sau đó dẫn đi xem các phòng nát hoặc không có thật.",
        reportedDate: "2026-06-28",
        evidenceCount: 2
    },
    {
        phone: "0333444555",
        name: "Trần Văn C (Lừa đảo cọc giữ chỗ)",
        reason: "Đăng tin phòng trọ đẹp lung linh giá siêu rẻ, bắt cọc gấp qua tài khoản MB Bank rồi biến mất.",
        reportedDate: "2026-06-29",
        evidenceCount: 7
    }
];

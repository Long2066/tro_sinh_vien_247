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
        id: "tnu",
        name: "Đại học Thái Nguyên (Trụ sở chính)",
        abbr: "TNU",
        coords: [21.5875, 105.8115],
        address: "Phường Tân Thịnh, Thành phố Thái Nguyên, Tỉnh Thái Nguyên"
    },
    {
        id: "tnu-hg",
        name: "Phân hiệu Đại học Thái Nguyên tại Hà Giang",
        abbr: "TNU-HG",
        aliases: [
            "Phân hiệu ĐHTN tại Hà Giang",
            "Phân hiệu ĐHTN Hà Giang",
            "ĐHTN Hà Giang",
            "DHTN HG",
            "Đại học Thái Nguyên Hà Giang"
        ],
        coords: [22.8123623, 104.9814349],
        address: "Đường Nguyễn Du, Tổ 16, Phường Nguyễn Trãi, Thành phố Hà Giang, Tỉnh Hà Giang"
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

// Danh sách phòng trọ mẫu (Đã xóa bỏ theo yêu cầu, chỉ hiển thị tin thực tế)
const MOCK_ROOMS = [];

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

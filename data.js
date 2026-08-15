// Dữ liệu danh sách trường Đại học (Tạm thời chỉ để Phân hiệu Đại học Thái Nguyên tại Hà Giang theo yêu cầu)
const UNIVERSITIES = [
    {
        id: "tnu-hg",
        name: "Phân hiệu Đại học Thái Nguyên tại Hà Giang",
        abbr: "TNU-HG",
        aliases: [
            "Phân hiệu ĐHTN tại Hà Giang",
            "Phân hiệu ĐHTN Hà Giang",
            "ĐHTN Hà Giang",
            "DHTN HG",
            "Đại học Thái Nguyên Hà Giang",
            "Hà Giang"
        ],
        coords: [22.8123623, 104.9814349],
        address: "Đường Nguyễn Du, Tổ 16, Phường Nguyễn Trãi, Thành phố Hà Giang, Tỉnh Hà Giang"
    }
];

// Danh sách phòng trọ mẫu (Đã xóa bỏ theo yêu cầu, chỉ hiển thị tin thực tế)
const MOCK_ROOMS = [];

// Danh sách đen số điện thoại lừa đảo ban đầu (Scam Blacklist)
const INITIAL_BLACKLIST = [
    {
        phone: "0944333222",
        name: "Lương Văn A",
        address: "Khu vực Cầu Giấy",
        reason: "Yêu cầu chuyển cọc 500k giữ phòng trước khi xem. Sau khi nhận tiền khóa Zalo/SĐT.",
        date: "2026-08-10"
    },
    {
        phone: "0388999111",
        name: "Nguyễn Thị B",
        address: "Khu vực Bách Khoa",
        reason: "Giả danh chủ nhà cho thuê giá rẻ 1.5 triệu, thu tiền xem phòng 200k rồi bỏ trốn.",
        date: "2026-08-12"
    }
];

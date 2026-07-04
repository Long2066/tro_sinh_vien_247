const fs = require('fs');
const path = require('path');

const cleanProvinceName = (name) => {
    if (!name) return '';
    return name.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
};

const cleanWardName = (name) => {
    if (!name) return '';
    return name.replace(/^(Phường|Xã|Thị trấn)\s+/i, '').trim();
};

const normalizeRawAddress = (addr) => {
    if (!addr) return '';
    return addr
        .replace(/\bTP\.?\s+/gi, 'Thành phố ')
        .replace(/\bTP\.?$/gi, 'Thành phố')
        .replace(/\bT\.?\s+/gi, 'Tỉnh ')
        .replace(/\bP\.?\s+/gi, 'Phường ')
        .replace(/\bX\.?\s+/gi, 'Xã ')
        .replace(/\s+/g, ' ')
        .trim();
};

class LocationService {
    constructor() {
        this.provinces = [];
        this.provincesMap = new Map();
        this.wardsMap = new Map();
        this.init();
    }

    init() {
        try {
            const dataPath = path.join(__dirname, 'provinces_vn.json');
            if (fs.existsSync(dataPath)) {
                const rawData = fs.readFileSync(dataPath, 'utf8');
                const rawProvinces = JSON.parse(rawData);

                this.provinces = rawProvinces.map(p => {
                    const provObj = {
                        code: p.Code,
                        name: p.Name || p.FullName,
                        fullName: p.FullName || p.Name,
                        codeName: p.CodeName || '',
                        wards: (p.Wards || []).map(w => ({
                            code: w.Code,
                            name: w.Name || w.FullName,
                            fullName: w.FullName || w.Name,
                            codeName: w.CodeName || '',
                            provinceCode: w.ProvinceCode || p.Code
                        }))
                    };

                    this.provincesMap.set(p.Code, provObj);
                    provObj.wards.forEach(w => {
                        this.wardsMap.set(w.code, w);
                    });

                    return {
                        code: provObj.code,
                        name: provObj.name,
                        fullName: provObj.fullName,
                        totalWards: provObj.wards.length
                    };
                });

                console.log(`[LocationService] Loaded ${this.provinces.length} provinces/cities successfully.`);
            } else {
                console.warn(`[LocationService] File provinces_vn.json not found at ${dataPath}`);
            }
        } catch (err) {
            console.error('[LocationService] Failed to load province database:', err);
        }
    }

    getProvinces() {
        return this.provinces;
    }

    getProvinceByCode(code) {
        return this.provincesMap.get(code) || null;
    }

    getWardsByProvince(provinceCode) {
        const prov = this.provincesMap.get(provinceCode);
        if (!prov) return [];
        return prov.wards.map(w => ({
            code: w.code,
            name: w.name,
            fullName: w.fullName,
            provinceCode: w.provinceCode
        }));
    }

    standardizeAddress(rawAddress) {
        if (!rawAddress || typeof rawAddress !== 'string') {
            return { raw: rawAddress, province: null, ward: null, standardized: rawAddress };
        }

        const normalized = normalizeRawAddress(rawAddress);
        const addressUpper = normalized.toUpperCase();
        
        let matchedProvince = null;
        let matchedWard = null;

        // Find matching province
        for (const [code, prov] of this.provincesMap.entries()) {
            const pFullName = (prov.fullName || '').toUpperCase();
            const pClean = cleanProvinceName(prov.fullName).toUpperCase();
            if (addressUpper.includes(pFullName) || addressUpper.includes(pClean)) {
                matchedProvince = prov;
                break;
            }
        }

        // Search wards in matching province, or search all wards if province not matched
        const searchWardsList = matchedProvince ? matchedProvince.wards : Array.from(this.wardsMap.values());

        for (const w of searchWardsList) {
            const wFullName = (w.fullName || '').toUpperCase();
            const wClean = cleanWardName(w.fullName).toUpperCase();
            
            // Check full name match first (e.g. "Phường Bách Khoa")
            if (addressUpper.includes(wFullName)) {
                matchedWard = w;
                if (!matchedProvince) {
                    matchedProvince = this.provincesMap.get(w.provinceCode);
                }
                break;
            }
            
            // Check clean name match if it's not a simple number (e.g. "Bách Khoa", but not "1")
            const isNumeric = /^\d+$/.test(wClean);
            if (!isNumeric && wClean.length > 2 && addressUpper.includes(wClean)) {
                matchedWard = w;
                if (!matchedProvince) {
                    matchedProvince = this.provincesMap.get(w.provinceCode);
                }
                break;
            }
        }

        let parts = [];
        if (matchedWard) parts.push(matchedWard.fullName);
        if (matchedProvince) parts.push(matchedProvince.fullName);

        return {
            raw: rawAddress,
            province: matchedProvince ? { code: matchedProvince.code, name: matchedProvince.name, fullName: matchedProvince.fullName } : null,
            ward: matchedWard ? { code: matchedWard.code, name: matchedWard.name, fullName: matchedWard.fullName } : null,
            standardized: parts.length > 0 ? parts.join(', ') : rawAddress
        };
    }
}

module.exports = new LocationService();

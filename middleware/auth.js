const { pool } = require('../config/db');

const verifyRole = (role) => {
    return async (req, res, next) => {
        // Hívjuk meg a getRoleFromToken függvényt
        await getRoleFromToken(req, res, async () => {
            // Ellenőrizzük, hogy a felhasználó szerepköre egyezik-e a megadottal
            if (!req.userRole || req.userRole.role !== role) {
                return res.status(403).json({
                    code: 403,
                    message: "Hozzáférés megtagadva. Nem megfelelő szerepkör.",
                    errors: [],
                    data: null,
                });
            }
            next(); // Ha minden rendben van, továbblépünk
        });
    };
};


const getRoleFromToken=async (req, res, next) => {
    try {
        const token = req.token;
        // Aszinkron adatbázis lekérdezés a role ellenőrzéséhez
        
        const sql='SELECT role, role_id FROM tokens JOIN users USING(user_id) JOIN roles USING(role_id) WHERE token = ?';
        const [results] = await pool.query(sql, [token]);
        // Lekért szerepkör adatok mentése a kérésbe
        req.userRole = results[0];
        next(); // Ha minden rendben, továbblépünk

    } catch (error) {
        console.error('Hiba a token ellenőrzése során:', error);
        return res.status(501).json({
            code: 501,
            message: "Hiba a token ellenőrzése során",
            errors: [],
            data: null
        });
    }
};

const validToken = async (req, res, next) => {
    try {
        const token = req.headers['x-auth-token'];

        if (!token) {
            throw new Error("Nincs token megadva");
        }

        const [results] = await pool.query(`SELECT token, user_id FROM tokens WHERE token = ? AND is_valid='1'`, [token]);
        
        // Ellenőrizzük, hogy létezik-e találat az adott tokenhez
        if (!results.length) {
            throw new Error("Érvénytelen token");
        }

        // Ha a token érvényes, továbblépünk
        req.token = results[0].token;
        req.user_id = results[0].user_id;
        
        next();

    } catch (error) {
        console.error('Hiba a token ellenőrzése során:', error);
        return res.status(401).json({
            code: 401,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
};

const isEnabled = (role)=>{
    return async (req, res, next) => {
        try {
            const user_id = req.user_id;
            // Lekérdezés a felhasználói táblában
            const [results] = await pool.query(
                `SELECT is_enabled FROM ${role==="institution"?"institutions":role} JOIN users USING(user_id) WHERE user_id = ?`,
                [user_id]
            );
    
            // Ellenőrizzük, hogy a felhasználó létezik-e
            if (!results.length) {
                throw new Error(`A fiók nem található.`);
            }
    
            // Ellenőrizzük, hogy a felhasználó engedélyezve van-e
            if (!results[0].is_enabled) {
                throw new Error(`A fiók le van tiltva.`);
            }
    
            // Ha minden rendben, továbblépünk
            next();
    
        } catch (error) {
            console.error(`Hiba fiók engedélyezettségének ellenőrzése során:`, error);
            return res.status(406).json({
                code: 406,
                message: error.message|| "Szerverhiba",
                errors: [],
                data: null
            });
        }
    };
}

const isAccepted = (role)=>{
    return async (req, res, next) => {
        try {
            const user_id = req.user_id;
            // Lekérdezés a felhasználói táblában
            const [results] = await pool.query(
                `SELECT is_accepted FROM ${role==="institution"?"institutions":role} JOIN users USING(user_id) WHERE user_id = ?`,
                [user_id]
            );
    
            // Ellenőrizzük, hogy a felhasználó létezik-e
            if (!results.length) {
                throw new Error(`A fiók nem található.`);
            }
    
            // Ellenőrizzük, hogy a felhasználói regisztráció jóvá van-e hagyva
            if (!results[0].is_accepted) {
                throw new Error(`A fiókregisztráció nincs jóváhagyva.`);
            }
    
            // Ha minden rendben, továbblépünk
            next();
    
        } catch (error) {
            console.error(`Hiba a fiókregisztráció jóváhagyásának ellenőrzése során:`, error);
            return res.status(405).json({
                code: 405,
                message: error.message,
                errors: [],
                data: null
            });
        }
    };
}


module.exports = { verifyRole, getRoleFromToken, validToken, isEnabled, isAccepted };

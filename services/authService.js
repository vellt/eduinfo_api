const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function generateTokenForUser(userId) {
    const insertToken = async (token) => {
        await pool.query("INSERT INTO tokens (user_id, token) VALUES (?, ?)", [userId, token]);
        return token;
    };

    const generateUniqueToken = async (attempt = 0) => {
        if (attempt >= 20) throw new Error('Túl sok próbálkozás a token generálás során');
        
        const token = uuidv4();
        const [results] = await pool.query("SELECT COUNT(*) AS count FROM tokens WHERE token = ?", [token]);

        if (results[0].count > 0) return generateUniqueToken(attempt + 1);
        return insertToken(token);
    };

    return generateUniqueToken();
}


module.exports = { generateTokenForUser};

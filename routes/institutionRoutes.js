const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { getRoleFromToken, validToken, verifyRole, isEnabled, isAccepted } = require('../middleware/auth');
const { multerErrorHandler } =require('../middleware/multerErrorHandler')
const { upload } = require('../config/multerConfig');
const fs = require('fs').promises;
const path = require('path'); 
const {getDay, getMonthAsText, getFormatTime, dynamicsDateTime} = require('../services/institutionService');

const role='institution';

//---------------------------------------------------------------------------------------------------------
//  Intézmények kezelhetik saját profiljukat, eseményeket és híreket hozhatnak létre. 
//  Lehetőség van profilkép és borítókép módosítására, valamint nyilvános elérhetőségek kezelésére. 
//  A tokennek nem csak hogy léteznie kell, hanem institution fiókhoz kell tartoznia.
//---------------------------------------------------------------------------------------------------------


//---------------------------------------------------------------------------------------------------------
//  saját fiókadatok és funkciók
//---------------------------------------------------------------------------------------------------------

// visszaadja az intézmény adatát borítókép, profilkép, név, regisztrációs email, publikus elérhetőségek (telefon, email, weboldal), leírás, intézmény besorolása) 
router.get('/profile', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        // profile
        const [institutions] = await pool.query(`SELECT * FROM institutions JOIN users USING(user_id)  WHERE institution_id = ?`,[institution_id]);

        // news
        const [rawNews]=await pool.query(
            `SELECT n.news_id, n.description, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id) as likes, n.timestamp, n.banner_image FROM news as n WHERE n.institution_id=? ORDER BY n.news_id DESC`, 
            [institution_id]
        );
        const news = rawNews.map(news => ({
            news_id: news.news_id,
            description: news.description,
            likes: news.likes,
            formatted_datetime: dynamicsDateTime(news.timestamp),
            banner_image: news.banner_image,
        }));

        // Események lekérdezése
        const [rawEvents] = await pool.query(`SELECT * FROM events WHERE institution_id = ? ORDER BY event_start ASC`, [institution_id]);
        const events = [];
        for (const event of rawEvents) {
            const [eventLinks] = await pool.query(`SELECT event_link_id, title, link FROM event_links WHERE event_id = ?`, [event.event_id]);
            events.push({
                event_id: event.event_id,
                title: event.title,
                location: event.location,
                description: event.description,
                banner_image: event.banner_image,
                month: getMonthAsText(event.event_start),
                day: getDay(event.event_start),
                time: getFormatTime(event.event_start,event.event_end),
                links: eventLinks.map(link => ({
                    link_id: link.event_link_id,
                    title: link.title,
                    link: link.link
                }))
            });
        }

        // publikus emailek
        const [emails] = await pool.query(`SELECT email_id, title, email FROM emails WHERE institution_id = ?`, [institution_id]);

        // publikus telefonok
        const [phones] = await pool.query(`SELECT phone_id, title, phone FROM phones WHERE institution_id = ?`, [institution_id]);

        // publikus weboldalak
        const [websites] = await pool.query(`SELECT website_id, title, website FROM websites WHERE institution_id = ?`, [institution_id]);

        // kategoriak
        const [categories]= await pool.query('SELECT category_id, category FROM institution_categories JOIN categories USING(category_id) WHERE institution_id = ?', [institution_id]);

        const [[{follower_count}]]=await pool.query(`SELECT COUNT(*) AS follower_count FROM following WHERE institution_id = ?`, [institution_id]);
        
        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                institution_id: institution_id,
                name: institutions[0].name,
                email: institutions[0].email,
                avatar_image: institutions[0].avatar_image,
                banner_image: institutions[0].banner_image,
                followers: follower_count,
                description: institutions[0].description,
                news: news,
                events: events,
                emails: emails,
                phones: phones,
                websites: websites,
                institution_categories: categories,
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// hírfolyamon posztot/bejegyzést/hírt hoz létre, ha nincs kép nem fog defaultot bele helyezni a bejegyzésbe
router.post('/news', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), upload.single('banner_image'), multerErrorHandler, async (req, res)=>{
    // #swagger.tags = ['institution']
    const user_id=req.user_id;
    const {description}=req.body;
    const banner_image = req.file ? req.file.filename : null;
    try {
        // institutin id kikeresése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);
        // új bejegyzés készítése
        await pool.query('INSERT INTO news (institution_id, description, banner_image) VALUES (?, ?, ?)', [institution_id, description, banner_image]);
        // lekérjük az eddigi bejegyzéseit a felhasználónak
        const [rawNews]=await pool.query(
            `SELECT n.news_id, n.description, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id) as likes, n.timestamp, n.banner_image FROM news as n WHERE n.institution_id=? ORDER BY n.news_id DESC`, 
            [institution_id]
        );

        const response = rawNews.map(news => ({
            news_id: news.news_id,
            description: news.description,
            likes: news.likes,
            formatted_datetime: dynamicsDateTime(news.timestamp),
            banner_image: news.banner_image,
        }));

        res.status(200).json({
            code: 200,
            message: "A bejegyzés sikeresen létrehozva",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// hírfolyam posztot/bejegyzést/hírt tud módosítani
router.put('/news/:news_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), upload.single('banner_image'), multerErrorHandler, async (req, res)=>{
    // #swagger.tags = ['institution']
    const news_id = req.params.news_id;
    const user_id=req.user_id;
    const {description}=req.body;
    const banner_image = req.file ? req.file.filename : null;
    try {
        if(!news_id){
            throw new Error('érvénytelen bemeneti adat');
        }
        console.log(description, banner_image);
        
        // institutin id kikeresése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        // kép nevének lekérése
        const [[old]]=await pool.query('SELECT banner_image FROM news WHERE news_id = ? AND institution_id = ?', [news_id, institution_id]);
        const old_banner_image=old.banner_image;
        console.log(old_banner_image);
        
        
        // új bejegyzés készítése
        await pool.query('UPDATE news SET description = ?, banner_image = ? WHERE news_id = ? ', [description, banner_image,news_id]);
        
        // lekérjük az eddigi bejegyzéseit a felhasználónak
        const [rawNews]=await pool.query(
            `SELECT n.news_id, n.description, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id) as likes, n.timestamp, n.banner_image FROM news as n WHERE n.institution_id=? ORDER BY n.news_id DESC`, 
            [institution_id]
        );

        const response = rawNews.map(news => ({
            news_id: news.news_id,
            description: news.description,
            likes: news.likes,
            formatted_datetime: dynamicsDateTime(news.timestamp),
            banner_image: news.banner_image,
        }));

        // ha nem null értékű az régi kép, akk azt töröljük
        if(old_banner_image!==null && old_banner_image!=="default_banner.jpg"){
            const filePath = path.join(__dirname, '..','uploads', old_banner_image);
            console.log(filePath);
            
            await fs.unlink(filePath);
        }

        res.status(200).json({
            code: 200,
            message: "A bejegyzés sikeresen módosítva",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// hírfolyam posztot/bejegyzést/hírt tud törölni
router.delete('/news/:news_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    const news_id = req.params.news_id;
    const user_id=req.user_id;
    try {
        if(!news_id){
            throw new Error('érvénytelen bemeneti adat');
        }
        
        // institutin id kikeresése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);
        
        // kép nevének lekérése
        const [[{banner_image}]]=await pool.query('SELECT banner_image FROM news WHERE news_id = ? AND institution_id = ?', [news_id, institution_id]);
        
        // töröljük a bejegyzést //affectedRows
        const [{affectedRows}]= await pool.query('DELETE FROM news WHERE news_id = ? AND institution_id = ?', [news_id, institution_id]);
        if(!affectedRows){
            throw new Error('nem létező id-t szeretnénl törölni');
        }

        // lekérjük az eddigi bejegyzéseit a felhasználónak
        const [rawNews]=await pool.query(
            `SELECT n.news_id, n.description, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id) as likes, n.timestamp, n.banner_image FROM news as n WHERE n.institution_id=? ORDER BY n.news_id DESC`, 
            [institution_id]
        );

        const response = rawNews.map(news => ({
            news_id: news.news_id,
            description: news.description,
            likes: news.likes,
            formatted_datetime: dynamicsDateTime(news.timestamp),
            banner_image: news.banner_image,
        }));

        // tötöljük a képet, ha volt.
        if(banner_image!==null && old_banner_image!=="default_banner.jpg"){
            const filePath = path.join(__dirname,  '..', 'uploads', banner_image);
            await fs.unlink(filePath);
        }
        
        res.status(200).json({
            code: 200,
            message: "A bejegyzés sikeresen törölve",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// új eseményt hoz létre
// csak egy éven belüli esemény lehet
router.post('/event', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), upload.single('banner_image'), multerErrorHandler, async (req, res)=>{
    // #swagger.tags = ['institution']
    const user_id=req.user_id;
    const {event_start, event_end, title, location, description}=req.body;
    // const links=req.body;
    // tesztelés miatt!
    let links = [];
    if (req.body.links) {
        links = Array.isArray(req.body.links)
            ? req.body.links.map(link => typeof link === 'string' ? JSON.parse(link) : link)
            : [JSON.parse(req.body.links)];
    }

    const banner_image = req.file ? req.file.filename : null;
    console.log(event_start, event_end, title, location, description, links, banner_image);
    
    try {
        // institution id kikeresése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);
        // új esemény készítése
        const [{insertId}] = await pool.query('INSERT INTO events (event_start, event_end, title, location, description, institution_id, banner_image) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [event_start, event_end, title, location, description,  institution_id, banner_image]
        );
        // Az adatok előkészítése a bulk inserthez
        const values = links.map(item => [insertId, item.title, item.link]);
        const sql = 'INSERT INTO event_links (event_id,title, link) VALUES ?';
        await pool.query(sql, [values]);

        // Események lekérdezése
        const [rawEvents] = await pool.query(`SELECT * FROM events WHERE institution_id = ? ORDER BY event_start ASC`, [institution_id]);
        
        // Lépésenkénti lekérdezés a linkekhez
        const response = [];

        for (const event of rawEvents) {
            // Lekérdezzük az eseményhez tartozó linkeket
            const [eventLinks] = await pool.query(`SELECT event_link_id, title, link FROM event_links WHERE event_id = ?`, [event.event_id]);

            // Összeállítjuk az eseményt a linkekkel
            response.push({
                event_id: event.event_id,
                title: event.title,
                location: event.location,
                description: event.description,
                banner_image: event.banner_image,
                month: getMonthAsText(event.event_start),
                day: getDay(event.event_start),
                time: getFormatTime(event.event_start,event.event_end),
                links: eventLinks.map(link => ({
                    link_id: link.event_link_id,
                    title: link.title,
                    link: link.link
                }))
            });
        }
        
        res.status(200).json({
            code: 200,
            message: "Az esemény sikeresen létrehozva",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// meglévő eseményt módosít
router.put('/event/:event_id', isAccepted(role), isEnabled(role), validToken, getRoleFromToken, verifyRole(role),upload.single('banner_image'), multerErrorHandler,  async (req, res)=>{
    // #swagger.tags = ['institution']
    const connection = await pool.getConnection();
    const event_id = req.params.event_id;
    const user_id=req.user_id;
    const {event_start, event_end, title, location, description}=req.body;
    // const links=req.body;
    // tesztelés miatt!
    let links = [];
    if (req.body.links) {
        links = Array.isArray(req.body.links)
            ? req.body.links.map(link => typeof link === 'string' ? JSON.parse(link) : link)
            : [JSON.parse(req.body.links)];
    }

    const banner_image = req.file ? req.file.filename : null;
    console.log(event_start, event_end, title, location, description, links, banner_image);
    
    try {
        if(!event_id || isNaN(event_id)){
            throw new Error('érvénytelen bemeneti adat');
        }

        if(banner_image===null){
            throw new Error('Kötelező képet megadni');
        }

        // institution id kikeresése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);
        
        // kép nevének lekérése
        const [[old]]=await pool.query('SELECT banner_image FROM events WHERE event_id = ? AND institution_id = ?', [event_id, institution_id]);
        const old_banner_image=old.banner_image;
        console.log(old_banner_image);

        // tranzakció kezdete ----------------------------------------------
        await connection.beginTransaction();

        // esemény módosítása
        await connection.query('UPDATE events SET event_start = ?, event_end = ?, title = ?, location = ?, description = ?, banner_image = ? WHERE event_id = ?', 
            [event_start, event_end, title, location, description, banner_image, event_id]
        );

        // kitöröljük az összes előző linket
        await connection.query('DELETE FROM event_links WHERE event_id = ?', [event_id]);

        // Az adatok előkészítése a bulk inserthez
        const values = links.map(item => [event_id, item.title, item.link]);
        const sql = 'INSERT INTO event_links (event_id,title, link) VALUES ?';
        await connection.query(sql, [values]);

        // Tranzakció befejezése ----------------------------------------------
        await connection.commit();

        // ha nem null értékű az régi kép, akk azt töröljük
        if(old_banner_image!==null && old_banner_image!=="default_banner.jpg"){
            const filePath = path.join(__dirname, '..','uploads', old_banner_image);
            console.log(filePath);
            
            await fs.unlink(filePath);
        }

        // Események lekérdezése
        const [rawEvents] = await pool.query(`SELECT * FROM events WHERE institution_id = ? ORDER BY event_start ASC`, [institution_id]);
        
        // Lépésenkénti lekérdezés a linkekhez
        const response = [];

        for (const event of rawEvents) {
            // Lekérdezzük az eseményhez tartozó linkeket
            const [eventLinks] = await pool.query(`SELECT event_link_id, title, link FROM event_links WHERE event_id = ?`, [event.event_id]);

            // Összeállítjuk az eseményt a linkekkel
            response.push({
                event_id: event.event_id,
                title: event.title,
                location: event.location,
                description: event.description,
                banner_image: event.banner_image,
                month: getMonthAsText(event.event_start),
                day: getDay(event.event_start),
                time: getFormatTime(event.event_start,event.event_end),
                links: eventLinks.map(link => ({
                    link_id: link.event_link_id,
                    title: link.title,
                    link: link.link
                }))
            });
        }
        
        res.status(200).json({
            code: 200,
            message: "Az esemény sikeresen módosítva",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }finally {
        if (connection) connection.release(); // Visszaadjuk a kapcsolatot a pool-nak
    }
});

// meglévő eseményt töröl
router.delete('/event/:event_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    const event_id = req.params.event_id;
    const user_id=req.user_id;
    
    try {
        if(!event_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        // institution id kikeresése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);
        
        // kép nevének lekérése
        const [[old]]=await pool.query('SELECT banner_image FROM events WHERE event_id = ? AND institution_id = ?', [event_id, institution_id]);
        const old_banner_image=old.banner_image;
        console.log(old_banner_image);

        // esemény törlése
        const [{affectedRows}]= await pool.query('DELETE FROM events WHERE event_id = ? AND institution_id = ?', [event_id, institution_id]);
        if(!affectedRows){
            throw new Error('nem létező id-t szeretnénl törölni');
        }

        // ha nem null értékű az régi kép, akk azt töröljük
        if(old_banner_image!==null && old_banner_image!=="default_banner.jpg"){
            const filePath = path.join(__dirname, '..','uploads', old_banner_image);
            console.log(filePath);
            
            await fs.unlink(filePath);
        }

        // Események lekérdezése
        const [rawEvents] = await pool.query(`SELECT * FROM events WHERE institution_id = ? ORDER BY event_start ASC`, [institution_id]);
        
        // Lépésenkénti lekérdezés a linkekhez
        const response = [];

        for (const event of rawEvents) {
            // Lekérdezzük az eseményhez tartozó linkeket
            const [eventLinks] = await pool.query(`SELECT event_link_id, title, link FROM event_links WHERE event_id = ?`, [event.event_id]);

            // Összeállítjuk az eseményt a linkekkel
            response.push({
                event_id: event.event_id,
                title: event.title,
                location: event.location,
                description: event.description,
                banner_image: event.banner_image,
                month: getMonthAsText(event.event_start),
                day: getDay(event.event_start),
                time: getFormatTime(event.event_start,event.event_end),
                links: eventLinks.map(link => ({
                    link_id: link.event_link_id,
                    title: link.title,
                    link: link.link
                }))
            });
        }
        
        res.status(200).json({
            code: 200,
            message: "Az esemény sikeresen törölve",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// lekéri az intézményi besorolásokat
router.get('/categories', async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const [result]= await pool.query('SELECT * FROM categories ORDER BY category_id ASC');
        res.status(200).json({
            code: 200,
            message: "sikeres adatlekérés",
            errors: [],
            data: result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosítja a body alapján az adatokat. kitörli az előző kapcsolatokat, és beállítja az újakat
router.put('/institution_categories', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    const connection = await pool.getConnection();
    const user_id=req.user_id;
    // const categories=req.body;
    // tesztelés miatt!
    let categories = [];
    if (req.body.categories) {
        categories = Array.isArray(req.body.categories)
            ? req.body.categories.map(category => typeof category === 'string' ? JSON.parse(category) : category)
            : [JSON.parse(req.body.categories)];
    }
    console.log(categories);
    

    try {
        // institution_id lekérése
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);
        
        // tranzakció kezdete ----------------------------------------------
        await connection.beginTransaction();

        // kitörölni az előző kapcsolatokat
        await connection.query('DELETE FROM institution_categories WHERE institution_id = ?', [institution_id]);
        
        // hozzáadni az új kapcsolatot
        // Az adatok előkészítése a bulk inserthez
        if(Array.isArray(categories) && categories.length > 0){
            const values = categories.map(item => [institution_id, item.category_id]);
            const sql = 'INSERT INTO institution_categories (institution_id,category_id) VALUES ?';
            await connection.query(sql, [values]);
        }
        

        // Tranzakció befejezése ----------------------------------------------
        await connection.commit();

        // lista visszaadása
        const [response]= await pool.query('SELECT category_id, category FROM institution_categories JOIN categories USING(category_id) WHERE institution_id = ?', [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Az esemény sikeresen módosítva",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }finally {
        if (connection) connection.release(); // Visszaadjuk a kapcsolatot a pool-nak
    }
});

// Az előző hozzátartozó képet felülírja, majd beállít neki egy új képet. Visszaadja az aktuális képet.
router.put('/avatar', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), upload.single('avatar_image'),  multerErrorHandler, async (req, res)=>{
    // #swagger.tags = ['institution']
    const user_id=req.user_id;
    const avatar_image = req.file ? req.file.filename : null;
    try {

        if(!avatar_image){
            throw new Error('Kötelező képet megadni');
        }

        // régi profilkép nevének a lekérése
        const [[old]]=await pool.query('SELECT avatar_image FROM institutions WHERE user_id = ?', [user_id]);
        const old_avatar_image=old.avatar_image;
        console.log(old_avatar_image);

        // profilkép módosítása
        await pool.query('UPDATE institutions SET avatar_image = ? WHERE user_id = ?', [avatar_image, user_id]);

        // ha nem null értékű az régi kép, akk azt töröljük
        if(old_avatar_image!==null && old_avatar_image!=="default_avatar.jpg"){
            const filePath = path.join(__dirname, '..','uploads', old_avatar_image);
            await fs.unlink(filePath);
        }

        // új progilkép nevének a lekérése
        const [[new_data]]=await pool.query('SELECT avatar_image FROM institutions WHERE user_id = ?', [user_id]);
        const new_avatar_image=new_data.avatar_image;
        console.log(new_avatar_image);

        res.status(200).json({
            code: 200,
            message: "sikeres képfeltöltés",
            errors: [],
            data: {
                avatar_image: new_avatar_image
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// Az előző hozzátartozó képet felülírja, majd beállít neki egy új képet. Visszaadja az aktuális képet.
router.put('/banner', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), upload.single('banner_image'),  multerErrorHandler, async (req, res)=>{
    // #swagger.tags = ['institution']
    const user_id=req.user_id;
    const banner_image = req.file ? req.file.filename : null;
    try {

        if(banner_image===null){
            throw new Error('Kötelező képet megadni');
        }

        // régi borítókép nevének a lekérése
        const [[old]]=await pool.query('SELECT banner_image FROM institutions WHERE user_id = ?', [user_id]);
        const old_banner_image=old.banner_image;
        console.log(old_banner_image);

        // borítókép módosítása
        await pool.query('UPDATE institutions SET banner_image = ? WHERE user_id = ?', [banner_image, user_id]);

        // ha nem null értékű az régi kép, akk azt töröljük
        if(old_banner_image!==null && old_banner_image!=="default_banner.jpg"){
            const filePath = path.join(__dirname, '..','uploads', old_banner_image);
            await fs.unlink(filePath);
        }

        // új borítókép nevének a lekérése
        const [[new_data]]=await pool.query('SELECT banner_image FROM institutions WHERE user_id = ?', [user_id]);
        const new_banner_image=new_data.banner_image;
        console.log(new_banner_image);

        res.status(200).json({
            code: 200,
            message: "sikeres képfeltöltés",
            errors: [],
            data: {
                banner_image: new_banner_image
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosítom a nevet, visszaadja a rögzített nevet
router.put('/name', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    const {name}=req.body;
    const user_id=req.user_id;
    try {
        // név módosítása
        if(!name){
            throw new Error('érvénytelen bemeneti adat');
        }

        await pool.query('UPDATE users SET name = ? WHERE user_id = ?', [name, user_id]);
        const [[response]]=await pool.query('SELECT name FROM users WHERE user_id = ?', [user_id]);
        res.status(200).json({
            code: 200,
            message: "sikeres adatmódosítás",
            errors: [],
            data: {
                name: response.name
            }
        });


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosítóm az emailt, egyedinek kell lennie, visszaadja a rögzített emailt
router.put('/email', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    const {email}=req.body;
    const user_id=req.user_id;
    try {
        if(!email){
            throw new Error('érvénytelen bemeneti adat');
        }
        // email módosítása
        await pool.query('UPDATE users SET email = ? WHERE user_id = ?', [email, user_id]);
        const [[response]]=await pool.query('SELECT email FROM users WHERE user_id = ?', [user_id]);
        res.status(200).json({
            code: 200,
            message: "sikeres adatmódosítás",
            errors: [],
            data: {
                email: response.email
            }
        });


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosítani fogja a jelszót
router.put('/password', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const { current_password, new_password} = req.body;
        const user_id=req.user_id;

        if(!current_password || !new_password){
            throw new Error('érvénytelen bemeneti adat');
        }
        // lekéri a jelszavát a felhasználókat
        const [[{password}]]=await pool.query('SELECT * FROM users WHERE user_id = ?', [user_id]);

        // a talált felhasználónak a jelszavát összevetjük a megadott jelenelgi jelszóval
        const isMatch= await bcrypt.compare(current_password, password);
        if (!isMatch) {
            throw new Error('Helytelen jelszót adtál meg');
        } 

        // Jelszó hash-elése
        const hash = await bcrypt.hash(new_password, 10);

         // beállítjuk az új jelszót
        await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hash, user_id]);

        res.status(200).json({
            code: 200,
            message: "jelszó sikeresen módosítva",
            errors: [],
            data: null
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// feltölt egy új elérhetőséget (email), visszaadja az eddigi maileket
router.post('/public/email', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const {title, email}=req.body;

        if(!title || !email){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        await pool.query('INSERT INTO emails (institution_id, title, email) VALUES (?, ?, ?)', [institution_id, title, email]);

        const [response] = await pool.query(`SELECT email_id, title, email FROM emails WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Email sikeresen hozzáadva",
            errors: [],
            data: response
        });


    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// töröl egy már létező elérhetőséget (email),  visszaadja a megmaradt emaileket
router.delete('/public/email/:email_id', isAccepted(role), isEnabled(role), validToken, getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const email_id = req.params.email_id;

        if(!email_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        const [{affectedRows}]=  await pool.query(`DELETE FROM emails WHERE email_id = ? AND institution_id = ?`, [email_id, institution_id]);

        if(!affectedRows){ // azaz 0
            throw new Error('nem létező id-t szeretnénl törölni');
        }

        const [response] = await pool.query(`SELECT email_id, title, email FROM emails WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Email sikeresen törölve",
            errors: [],
            data: response
        });
        
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosít egy már létező elérhetőséget (email)
router.put('/public/email/:email_id', isAccepted(role), isEnabled(role), validToken, getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const email_id = req.params.email_id;
        const {title, email}=req.body;

        if(!title || !email || !email_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        await pool.query('UPDATE emails SET title = ?, email = ? WHERE email_id = ? AND institution_id = ?', 
            [title, email, email_id, institution_id]
        );

        const [response] = await pool.query(`SELECT email_id, title, email FROM emails WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Email sikeresen módosítva",
            errors: [],
            data: response
        });



    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// feltölt egy új elérhetőséget (phone)
router.post('/public/phone', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const {title, phone}=req.body;

        if(!title || !phone){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        await pool.query('INSERT INTO phones (institution_id, title, phone) VALUES (?, ?, ?)', [institution_id, title, phone]);

        const [response] = await pool.query(`SELECT phone_id, title, phone FROM phones WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Telefon sikeresen hozzáadva",
            errors: [],
            data: response
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// töröl egy már létező elérhetőséget (phone)
router.delete('/public/phone/:phone_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const phone_id = req.params.phone_id;

        if(!phone_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        const [{affectedRows}]=  await pool.query(`DELETE FROM phones WHERE phone_id = ? AND institution_id = ?`, [phone_id, institution_id]);

        if(!affectedRows){ // azaz 0
            throw new Error('nem létező id-t szeretnél törölni');
        }

        const [response] = await pool.query(`SELECT phone_id, title, phone FROM phones WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Telefon sikeresen törölve",
            errors: [],
            data: response
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosít egy már létező elérhetőséget (phone)
router.put('/public/phone/:phone_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const phone_id = req.params.phone_id;
        const {title, phone}=req.body;

        if(!title || !phone || !phone_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        await pool.query('UPDATE phones SET title = ?, phone = ? WHERE phone_id = ? AND institution_id = ?', 
            [title, phone, phone_id, institution_id]
        );

        const [response] = await pool.query(`SELECT phone_id, title, phone FROM phones WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Telefon sikeresen módosítva",
            errors: [],
            data: response
        });



    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// feltölt egy új elérhetőséget (website)
router.post('/public/website', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const {title, website}=req.body;

        if(!title || !website){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        await pool.query('INSERT INTO websites (institution_id, title, website) VALUES (?, ?, ?)', [institution_id, title, website]);

        const [response] = await pool.query(`SELECT website_id, title, website FROM websites WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Weboldal sikeresen hozzáadva",
            errors: [],
            data: response
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// töröl egy már létező elérhetőséget (website)
router.delete('/public/website/:website_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const website_id = req.params.website_id;

        if(!website_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        const [{affectedRows}]=  await pool.query(`DELETE FROM websites WHERE website_id = ? AND institution_id = ?`, [website_id, institution_id]);

        if(!affectedRows){ // azaz 0
            throw new Error('nem létező id-t szeretnél törölni');
        }

        const [response] = await pool.query(`SELECT website_id, title, website FROM websites WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Weboldal sikeresen törölve",
            errors: [],
            data: response
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// módosít egy már létező elérhetőséget (website)
router.put('/public/website/:website_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const website_id = req.params.website_id;
        const {title, website}=req.body;

        if(!title || !website || !website_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        await pool.query('UPDATE websites SET title = ?, website = ? WHERE website_id = ? AND institution_id = ?', 
            [title, website, website_id, institution_id]
        );

        const [response] = await pool.query(`SELECT website_id, title, website FROM websites WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Weboldal sikeresen módosítva",
            errors: [],
            data: response
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// törli a tokenhez tartozó fiókot, és összes referenciáját
router.delete('/profile', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        await pool.query(`DELETE FROM users WHERE user_id = ?`, [user_id]);
        res.status(200).json({
            code: 200,
            message: "Sikeres fióktörlés",
            errors: [],
            data: null
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message|| "Szerverhiba",
            errors: [],
            data: null
        });
    }
});



//---------------------------------------------------------------------------------------------------------
//  beszélgetések
//---------------------------------------------------------------------------------------------------------

// visszaadja az összverzióját a beszélgetéseinek a verziói alapján, tehát az összes hozzátartozó beszélgetésszoba üzenetdb számot összeadják
router.get('/messages_version', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        const [[{version}]]= await pool.query(`SELECT COUNT(*) AS version FROM messages JOIN messaging_rooms USING(messaging_room_id) WHERE institution_id=?`, [institution_id]);
        
        res.status(200).json({
            code: 200,
            message: "sikeres adatlekérés",
            errors: [],
            data:  {
                state_version: version
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// lekéri az összes beszélgetését, minden részletig (institution_id, kép, név, komplett beszélgetés)
router.get('/messaging_rooms', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const [[{institution_id}]]=await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        const [messaging_rooms] = await pool.query(
            `
            SELECT 
                mr.messaging_room_id,
                mr.person_id,
                m.message AS last_message,
                m.timestamp AS last_message_time,
                m.from_person
            FROM messaging_rooms AS mr
            JOIN messages AS m
                USING (messaging_room_id)
            WHERE mr.institution_id = ?
            AND m.message_id = (
                SELECT MAX(message_id)
                FROM messages
                WHERE messages.messaging_room_id = mr.messaging_room_id
            )
            ORDER BY m.timestamp DESC
            `,
            [institution_id]
        );

        const rooms = await Promise.all(
            messaging_rooms.map(async (elemen) => {
                const [[person]] = await pool.query(
                    `SELECT person_id, avatar_image, name 
                     FROM person 
                     JOIN users USING(user_id) 
                     WHERE person_id = ?`,
                    [elemen.person_id]
                );
        
                return {
                    messaging_room_id: elemen.messaging_room_id,
                    last_message: elemen.last_message,
                    formatted_date: dynamicsDateTime(elemen.last_message_time),
                    from_person: Boolean(elemen.from_person),
                    person: person, 
                };
            })
        );
        
        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: rooms
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// ha van meglévő szobája ott bővíti a beszélgetést. különben beszélgetést nem tud kezdeményezni!
router.post('/send_message/:person_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id = req.user_id;
        const person_id = req.params.person_id;
        const { message } = req.body;
    
        console.log(message);
    
        if (!person_id || !message) {
            throw new Error('Hibás bemeneti adat');
        }
    
        const [[{ institution_id }]] = await pool.query(
            'SELECT institution_id FROM institutions WHERE user_id=?', 
            [user_id]
        );
    
        // Indítsunk egy tranzakciót
        const connection = await pool.getConnection();
        await connection.beginTransaction();
    
        try {
            // Ellenőrizzük, van-e már beszélgetésszoba
            const [result] = await connection.query(
                `SELECT * FROM messaging_rooms WHERE person_id=? AND institution_id=?`,
                [person_id, institution_id]
            );
    
            let room_id;
    
            // Ha nincs, akkor error, intézmények nem készíthetnek beszélgetésszobát
            if (!result.length) {
                throw new Error('Intézmények nem indíthatnak új beszélgetést');
            } else {
                room_id = result[0].messaging_room_id;
            }
    
            // Írunk a beszélgetésszobába
            const [{ insertId }] = await connection.query(
                'INSERT INTO messages (messaging_room_id, message, from_person) VALUES (? , ?, ?)',
                [room_id, message, 0]
            );
    
            const [[insert_message]] = await connection.query(
                'SELECT message_id, message, timestamp, from_person FROM messages WHERE message_id=?',
                [insertId]
            );
    
            // Ha minden rendben, véglegesítjük a tranzakciót
            await connection.commit();
    
            res.status(200).json({
                code: 200,
                message: "Üzenet sikeresen elküldve",
                errors: [],
                data: {
                    messaging_room_id: room_id,
                    message: {
                        message_id: insert_message.message_id,
                        message: insert_message.message,
                        formatted_date: dynamicsDateTime(insert_message.timestamp),
                        from_person: Boolean(insert_message.from_person),
                    }
                }
            });
        } catch (innerError) {
            // Ha hiba van a tranzakción belül, visszagördítjük
            await connection.rollback();
            throw innerError;
        } finally {
            // Felszabadítjuk a kapcsolatot
            connection.release();
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

// lekéri az adott beszélgetést
router.get('/messaging_rooms/:messaging_room_id', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    try {
        const user_id=req.user_id;
        const messaging_room_id=req.params.messaging_room_id;
        
        if(!messaging_room_id){
            throw new Error('Hibás bemeneti adat');
        }

        const [[{ institution_id }]] = await pool.query('SELECT institution_id FROM institutions WHERE user_id=?', [user_id]);

        // lekérjük, az összes beszélgetését a beszélegtésszobának, amennyiben olyan felhasználó hivja le, aki benne van a beszélgetésben
        const [raw_messages]= await pool.query(`SELECT * FROM messages JOIN messaging_rooms USING(messaging_room_id) WHERE messaging_room_id=? AND institution_id=? ORDER BY message_id DESC`, [messaging_room_id, institution_id]);
        
        if(!raw_messages.length){
            throw new Error('Nem létező chat szoba')
        }
        
        const messages=raw_messages.map(element=>({
            message_id: element.message_id,
            message: element.message,
            formatted_date: dynamicsDateTime(element.timestamp),
            from_person: Boolean(element.from_person)
        }));

        const person_id=raw_messages[0].person_id;
        const [[person]] = await pool.query(
            `SELECT person_id, avatar_image, name 
             FROM person 
             JOIN users USING(user_id) 
             WHERE person_id = ?`,
            [person_id]
        );

        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                messaging_room_id: messaging_room_id,
                person: person,
                messages: messages,
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});



module.exports = router;
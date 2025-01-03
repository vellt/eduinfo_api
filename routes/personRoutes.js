const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { getRoleFromToken, validToken, verifyRole, isEnabled, isAccepted  } = require('../middleware/auth');
const { multerErrorHandler } =require('../middleware/multerErrorHandler')
const { upload } = require('../config/multerConfig');
const fs = require('fs').promises;
const path = require('path'); 
const {getDay, getMonthAsText, getFormatTime, dynamicsDateTime} = require('../services/personService');


const role='person';

router.get('/home', validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);

        // követet intézmények azonosítói
        const [data]= await pool.query('SELECT institution_id FROM following WHERE person_id=?', [person_id]);


        // a követett intézmények eseményei, legközelebbi 3!
        let events = [];
        let news =[];
        // Az intézményi azonosítókat tömbbé alakítjuk
        const institutionIds = data.map(row => row.institution_id);
        console.log(institutionIds);
        
        // A követett intézmények eseményeinek lekérdezése
        if(institutionIds.length){
            // akkor sincs gond, ha 3 alatti mennyiségű esemény van
            const [rawEvents] = await pool.query(`SELECT e.event_id, e.event_start, e.event_end, e.title, e.location, e.description, e.institution_id, e.banner_image as cover_image, i.institution_id, i.avatar_image, i.banner_image FROM events as e JOIN institutions as i USING(institution_id) JOIN users as u USING(user_id)  WHERE e.institution_id IN (?) ORDER BY e.event_start ASC LIMIT 3`, [institutionIds]);
        
            for (const event of rawEvents) {
                // Egy eseményhez tartozó linkek lekérdezése
                const [eventLinks] = await pool.query(`SELECT event_link_id, title, link FROM event_links WHERE event_id = ?`,[event.event_id]);
    
                // Esemény objektum összeállítása
                events.push({
                    event_id: event.event_id,
                    title: event.title,
                    location: event.location,
                    description: event.description,
                    banner_image: event.cover_image,
                    month: getMonthAsText(event.event_start),
                    day: getDay(event.event_start),
                    time: getFormatTime(event.event_start, event.event_end),
                    start:event.event_start,
                    end:event.event_end,
                    links: eventLinks.map(link => ({
                        link_id: link.event_link_id,
                        title: link.title,
                        link: link.link
                    })),
                    institution:{
                        institution_id: event.institution_id,
                        avatar_image: event.avatar_image,
                        banner_image: event.banner_image,
                    }
                });
            }

            
        }
        

        // a követett intézmények bejegyzései
        if(institutionIds.length){
            const [rawNews]=await pool.query(
                `SELECT n.news_id, n.description, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id) as likes, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id AND l.person_id=?) as liked, n.timestamp, n.banner_image, i.institution_id, i.avatar_image, u.name FROM news as n JOIN institutions as i USING(institution_id) JOIN users as u USING(user_id) WHERE n.institution_id IN (?) ORDER BY n.news_id DESC`, 
                [person_id,institutionIds]
            );
    
            news = rawNews.map(news => ({
                news_id: news.news_id,
                description: news.description,
                likes: news.likes,
                liked: Boolean(news.liked),
                formatted_datetime: dynamicsDateTime(news.timestamp),
                banner_image: news.banner_image,
                institution:{
                    institution_id: news.institution_id,
                    avatar_image: news.avatar_image,
                    name: news.name,
                }
            }));
        }
       
        res.status(200).json({
            code: 200,
            message: "sikeres adatlekérés",
            errors: [],
            data: {
                events: events,
                news: news,
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

router.get('/events',  validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);


        // követet intézmények azonosítói
        const [data]= await pool.query('SELECT institution_id FROM following WHERE person_id=?', [person_id]);


        // a követett intézmények eseményei
        let events = [];
        // Az intézményi azonosítókat tömbbé alakítjuk
        const institutionIds = data.map(row => row.institution_id);
        console.log(institutionIds);
        
        // A követett intézmények eseményeinek lekérdezése
        if(institutionIds.length){
            // akkor sincs gond, ha 3 alatti mennyiségű esemény van
            const [rawEvents] = await pool.query(`SELECT e.event_id, e.event_start, e.event_end, e.title, e.location, e.description, e.institution_id, e.banner_image as cover_image, i.institution_id, i.avatar_image, i.banner_image FROM events as e JOIN institutions as i USING(institution_id) JOIN users as u USING(user_id)  WHERE e.institution_id IN (?) ORDER BY e.event_start ASC `, [institutionIds]);
        
            for (const event of rawEvents) {
                // Egy eseményhez tartozó linkek lekérdezése
                const [eventLinks] = await pool.query(`SELECT event_link_id, title, link FROM event_links WHERE event_id = ?`,[event.event_id]);
    
                // Esemény objektum összeállítása
                events.push({
                    event_id: event.event_id,
                    title: event.title,
                    location: event.location,
                    description: event.description,
                    banner_image: event.cover_image,
                    month: getMonthAsText(event.event_start),
                    day: getDay(event.event_start),
                    time: getFormatTime(event.event_start, event.event_end),
                    start:event.event_start,
                    end:event.event_end,
                    links: eventLinks.map(link => ({
                        link_id: link.event_link_id,
                        title: link.title,
                        link: link.link
                    })),
                    institution:{
                        institution_id: event.institution_id,
                        avatar_image: event.avatar_image,
                        banner_image: event.banner_image,
                    }
                });
            }

            
        }
        
        res.status(200).json({
            code: 200,
            message: "sikeres adatlekérés",
            errors: [],
            data: events
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

router.post('/like/:news_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role),  async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const news_id = req.params.news_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);
        
        if(!news_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        // ha már adott le erre a posztra like-ot mégegyszer nem adhat
        const [[{redundance}]]= await pool.query('SELECT COUNT(*) AS redundance FROM likes WHERE news_id=? AND person_id=?',[news_id, person_id]);
        if(redundance){
            throw new Error(`Két lájkot nem adhatsz le egy bejegyzésre`);
        }

        // ellenőrízni nem kell, hogy jó-e, a megadott id, mert le se futna az sql, cascase kapcsolat!!
        await pool.query(`INSERT INTO likes (person_id, news_id) VALUES (?, ?) `, [person_id, news_id]);

        // lájkok száma
        const [[{like_count}]]= await pool.query('SELECT COUNT(*) AS like_count FROM likes WHERE news_id=?',[news_id]);

        res.status(200).json({
            code: 200,
            message: "Sikeresen lájkolva a bejegyzés",
            errors: [],
            data: {
                like_count:like_count,
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

router.delete('/unlike/:news_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role),  async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const news_id = req.params.news_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);
        
        if(!news_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [{affectedRows}]=  await pool.query(`DELETE FROM likes WHERE news_id=? AND person_id=?`, [news_id, person_id]);
        if(!affectedRows){ // azaz 0
            throw new Error('már vissza van vonva a lájk');
        }

        // lájkok száma
        const [[{like_count}]]= await pool.query('SELECT COUNT(*) AS like_count FROM likes WHERE news_id=?',[news_id]);

        res.status(200).json({
            code: 200,
            message: "Sikeresen unlájkolva a bejegyzés",
            errors: [],
            data: {
                like_count:like_count,
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

router.get('/categories', async (req, res)=>{
    // #swagger.tags = ['person']
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
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.get('/institutions_by_category/:category_id', async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const category_id = req.params.category_id;
        if(!category_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [institutions] = await pool.query(`SELECT institution_id, avatar_image, name FROM institutions JOIN users USING(user_id) JOIN  institution_categories USING(institution_id) WHERE category_id = ?`,[category_id]);
        
        res.status(200).json({
            code: 200,
            message: "sikeres adatlekérés",
            errors: [],
            data: institutions
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

router.get('/institutions/:institution_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role),  async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const institution_id= req.params.institution_id;

        if(!institution_id){
            throw new Error('hibás bemeneti adat');
        }

        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);

        // profile
        const [institutions] = await pool.query(`SELECT * FROM institutions JOIN users USING(user_id)  WHERE institution_id = ?`,[institution_id]);

        if(!institutions.length){
            throw new Error('Érvényteéen intézményi azonosító');
        }

        // news
        const [rawNews]=await pool.query(
            `SELECT n.news_id, n.description, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id) as likes, (SELECT COUNT(*) FROM likes as l WHERE l.news_id=n.news_id AND l.person_id=?) as liked, n.timestamp, n.banner_image FROM news as n WHERE n.institution_id=? ORDER BY n.news_id DESC`, 
            [person_id,institution_id]
        );

        const news = rawNews.map(news => ({
            news_id: news.news_id,
            description: news.description,
            likes: news.likes,
            liked: Boolean(news.liked),
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
                start:event.event_start,
                end:event.event_end,
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

        // követések
        const [[{follower_count}]]=await pool.query(`SELECT COUNT(*) AS follower_count FROM following WHERE institution_id = ?`, [institution_id]);
        
        // követem-e
        const [[{is_followed}]]=await pool.query(`SELECT COUNT(*) AS is_followed FROM following WHERE institution_id=? AND person_id=?`, [institution_id, person_id]);
        
        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                institution_id: parseInt(institution_id),
                name: institutions[0].name,
                avatar_image: institutions[0].avatar_image,
                banner_image: institutions[0].banner_image,
                followers: follower_count,
                followed: Boolean(is_followed),
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

router.post('/follow/:institution_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role),  async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const institution_id = req.params.institution_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);
        
        if(!institution_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        // ha már adott le erre a posztra like-ot mégegyszer nem adhat
        const [[{redundance}]]= await pool.query('SELECT COUNT(*) AS redundance FROM following WHERE institution_id=? AND person_id=?',[institution_id, person_id]);
        if(redundance){
            throw new Error(`Már követed az inézményt`);
        }

        // ellenőrízni nem kell, hogy jó-e, a megadott id, mert le se futna az sql, cascase kapcsolat!!
        await pool.query(`INSERT INTO following (institution_id, person_id) VALUES (?, ?) `, [parseInt(institution_id), person_id]);

        // követések száma
        const [[{follower_count}]]=await pool.query(`SELECT COUNT(*) AS follower_count FROM following WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Az intézmény sikeresen követve",
            errors: [],
            data: {
                follower_count:follower_count,
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

router.delete('/unfollow/:institution_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role),  async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const institution_id = req.params.institution_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);
        
        if(!institution_id){
            throw new Error('érvénytelen bemeneti adat');
        }

        const [{affectedRows}]=  await pool.query(`DELETE FROM following WHERE institution_id=? AND person_id=?`, [institution_id, person_id]);
        if(!affectedRows){ // azaz 0
            throw new Error('már kikövetted');
        }

        // követések száma
        const [[{follower_count}]]=await pool.query(`SELECT COUNT(*) AS follower_count FROM following WHERE institution_id = ?`, [institution_id]);

        res.status(200).json({
            code: 200,
            message: "Az intézmény sikeresen kikövetve",
            errors: [],
            data: {
                follower_count:follower_count,
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

router.get('/profile',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;

        // felhasználó adatai
        const [[user]]=await pool.query('SELECT * FROM person JOIN users USING(user_id) WHERE user_id=?', [user_id]);
        
        const [followed_institutions] = await pool.query('SELECT * FROM following JOIN institutions USING(institution_id) JOIN users USING(user_id) WHERE person_id =?', [user.person_id]);
        const institutions = followed_institutions.map(element => ({
            institution_id: element.institution_id,
            avatar_image: element.avatar_image,
            name: element.name,
        }));
        
        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                avatar_image: user.avatar_image,
                name: user.name,
                email: user.email,
                followed_institutions: institutions,
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: error.message  || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.get('/enabled', validToken, isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    res.status(200).json({
        code: 200,
        message: "A fiók enedéléyezve van",
        errors: [],
        data: null,
    });
});

router.get('/accepted', validToken, isAccepted(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['institution']
    res.status(200).json({
        code: 200,
        message: "A fiók jóváhagyásra került",
        errors: [],
        data: null,
    });
});

router.put('/avatar',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), upload.single('avatar_image'), multerErrorHandler,  async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const avatar_image = req.file ? req.file.filename : null;
        
        if(!avatar_image){
            throw new Error('Kötelező képet megadni');
        }

        // régi profilkép nevének a lekérése
        const [[old]]=await pool.query('SELECT avatar_image FROM person WHERE user_id = ?', [user_id]);
        const old_avatar_image=old.avatar_image;
        console.log(old_avatar_image);

        // profilkép módosítása
        await pool.query('UPDATE person SET avatar_image = ? WHERE user_id = ?', [avatar_image, user_id]);

        // ha nem null értékű az régi kép, akk azt töröljük
        if(old_avatar_image && old_avatar_image!=="default_avatar.jpg"){
            const filePath = path.join(__dirname, '..','uploads', old_avatar_image);
            await fs.unlink(filePath);
        }

        // új progilkép nevének a lekérése
        const [[new_data]]=await pool.query('SELECT avatar_image FROM person WHERE user_id = ?', [user_id]);
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
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.put('/name',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const {name}=req.body;
        
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
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.put('/email',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const {email}=req.body;
        
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
            message: error.message  || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.put('/password',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const { current_password, new_password} = req.body;
        
        if(!current_password || !new_password){
            throw new Error('érvénytelen bemeneti adat');
        }

        // lekéri a jelszavát a felhasználókat
        const [[{password}]]=await pool.query('SELECT * FROM users WHERE user_id = ?', [user_id]);

        // a talált felhasználónak a jelszavát összevetjük a megadott jelenelgi jelszóval
        const isMatch= await bcrypt.compare(current_password, password);

        if (!isMatch) {
            throw new Error('Helytelen jeleszót adtál meg');
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
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.delete('/profile',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const [result] = await pool.query(
            `SELECT p.avatar_image FROM person as p WHERE p.user_id=? AND p.avatar_image <> "default_avatar.jpg"`, [user_id]
        );
        await pool.query(`DELETE FROM users WHERE user_id = ?`, [user_id]);
        if(result.length===1){
            const image = result[0].avatar_image;
            const filePath = path.join(__dirname, '..', 'uploads', image);
            try {
                await fs.unlink(filePath);
                console.log(`Törölve: ${filePath}`);
            } catch (err) {
                console.error(`Nem sikerült törölni: ${filePath} - Hiba: ${err.message}`);
            }
        }
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
            message: error.message || "Szerverhiba",
            errors: [],
            data: null
        });
    }
});

router.get('/messages_version',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);

        const [[{version}]]= await pool.query(`SELECT COUNT(*) AS version FROM messages JOIN messaging_rooms USING(messaging_room_id) WHERE person_id=?`, [person_id]);
        
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
});0

router.get('/messaging_rooms',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);

        const [messaging_rooms] = await pool.query(
            `
            SELECT 
                mr.messaging_room_id,
                mr.institution_id,
                m.message AS last_message,
                m.timestamp AS last_message_time,
                m.from_person
            FROM messaging_rooms AS mr
            JOIN messages AS m
                USING (messaging_room_id)
            WHERE mr.person_id = ?
            AND m.message_id = (
                SELECT MAX(message_id)
                FROM messages
                WHERE messages.messaging_room_id = mr.messaging_room_id
            )
            ORDER BY m.timestamp DESC
            `,
            [person_id]
        );

        const rooms = await Promise.all(
            messaging_rooms.map(async (elemen) => {
                const [[institution]] = await pool.query(
                    `SELECT institution_id, avatar_image, name 
                     FROM institutions 
                     JOIN users USING(user_id) 
                     WHERE institution_id = ?`,
                    [elemen.institution_id]
                );
        
                return {
                    messaging_room_id: elemen.messaging_room_id,
                    last_message: elemen.last_message,
                    formatted_date: dynamicsDateTime(elemen.last_message_time),
                    from_person: Boolean(elemen.from_person),
                    institution: institution, 
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

router.post('/send_message/:institution_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id = req.user_id;
        const institution_id = req.params.institution_id;
        const { message } = req.body;
    
        console.log(message);
    
        if (!institution_id || !message) {
            throw new Error('Hibás bemeneti adat');
        }
    
        const [[{ person_id }]] = await pool.query(
            'SELECT person_id FROM person WHERE user_id=?', 
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
    
            // Ha nincs, létrehozzuk
            if (!result.length) {
                const [{ insertId }] = await connection.query(
                    'INSERT INTO messaging_rooms (person_id, institution_id) VALUES (?, ?)',
                    [person_id, institution_id]
                );
                room_id = insertId;
            } else {
                room_id = result[0].messaging_room_id;
            }
    
            // Írunk a beszélgetésszobába
            const [{ insertId }] = await connection.query(
                'INSERT INTO messages (messaging_room_id, message, from_person) VALUES (? , ?, ?)',
                [room_id, message, 1]
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

router.get('/messaging_rooms/:messaging_room_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const messaging_room_id=req.params.messaging_room_id;
        
        if(!messaging_room_id){
            throw new Error('Hibás bemeneti adat');
        }

        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);

        // lekérjük, az összes beszélgetését a beszélegtésszobának, amennyiben olyan felhasználó hivja le, aki benne van a beszélgetésben
        const [raw_messages]= await pool.query(`SELECT * FROM messages JOIN messaging_rooms USING(messaging_room_id) WHERE messaging_room_id=? AND person_id=? ORDER BY message_id DESC`, [messaging_room_id, person_id]);
        
        if(!raw_messages.length){
            throw new Error('Nem létező chat szoba')
        }
        
        const messages=raw_messages.map(element=>({
            message_id: element.message_id,
            message: element.message,
            formatted_date: dynamicsDateTime(element.timestamp),
            from_person: Boolean(element.from_person)
        }));

        const institution_id=raw_messages[0].institution_id;
        const [[institution]] = await pool.query(
            `SELECT institution_id, avatar_image, name 
             FROM institutions 
             JOIN users USING(user_id) 
             WHERE institution_id = ?`,
            [institution_id]
        );

        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                messaging_room_id: parseInt(messaging_room_id),
                institution: institution,
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

router.get('/find_messaging_rooms/:institution_id',validToken, isAccepted(role), isEnabled(role), getRoleFromToken, verifyRole(role), async (req, res)=>{
    // #swagger.tags = ['person']
    try {
        const user_id=req.user_id;
        const insttutionId=req.params.institution_id;
        
        if(!insttutionId){
            throw new Error('Hibás bemeneti adat');
        }

        const [[{person_id}]]=await pool.query('SELECT person_id FROM person WHERE user_id=?', [user_id]);

        // lekérjük, az összes beszélgetését a beszélegtésszobának, amennyiben olyan felhasználó hivja le, aki benne van a beszélgetésben
        //;
        const [messaging_room]= await pool.query(`SELECT * FROM messaging_rooms as m WHERE m.institution_id=? AND m.person_id=?`, [insttutionId, person_id]);
        
        let messaging_room_id=-1;
        if(!messaging_room.length){
            // készítünk egyet  
            const [{insertId}] = await pool.query(`INSERT INTO messaging_rooms (person_id, institution_id) VALUES (?, ?)`, [person_id, insttutionId])
            console.log(insertId);
            
            messaging_room_id=insertId;
        }else{
            messaging_room_id= messaging_room[0].messaging_room_id;
        }

        const [raw_messages]= await pool.query(`SELECT * FROM messages JOIN messaging_rooms as m USING(messaging_room_id) WHERE m.institution_id=? AND m.person_id=? ORDER BY message_id DESC`, [insttutionId, person_id]);
        const messages=raw_messages.map(element=>({
            message_id: element.message_id,
            message: element.message,
            formatted_date: dynamicsDateTime(element.timestamp),
            from_person: Boolean(element.from_person)
        }));

        
        const [[institution]] = await pool.query(
            `SELECT institution_id, avatar_image, name 
             FROM institutions 
             JOIN users USING(user_id) 
             WHERE institution_id = ?`,
            [parseInt(insttutionId)]
        );

        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                messaging_room_id: parseInt(messaging_room_id),
                institution: institution,
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
const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const {
  getRoleFromToken,
  validToken,
  verifyRole,
} = require("../middleware/auth");
const {getDay, getMonthAsText, getFormatTime, dynamicsDateTime} = require('../services/personService');

const role = "admin";

//---------------------------------------------------------------------------------------------------------
//  Intézmények és felhasználók kezelése, beleértve a letiltást és engedélyezést.
//  A tokennek nem csak hogy léteznie kell, hanem admin fiókhoz kell tartoznia.
//---------------------------------------------------------------------------------------------------------

// betölti az intézményeket és a felhasználókat
router.get(
  "/users",
  validToken,
  getRoleFromToken,
  verifyRole(role),
  async (req, res) => {
    // #swagger.tags = ['admin']
    try {
      const [institutions] = await pool.query(
        "SELECT institution_id, is_enabled, is_accepted, avatar_image, name, email FROM institutions JOIN users USING(user_id) ORDER BY institution_id DESC"
      );
      const [person] = await pool.query(
        "SELECT person_id, is_enabled, is_accepted, avatar_image, name, email FROM person JOIN users USING(user_id) ORDER BY person_id DESC"
      );
      console.log(person);

      res.status(200).json({
        code: 200,
        message: "Sikeres adatlekérés",
        errors: [],
        data: {
          institutions: institutions.map((element) => ({
            institution_id: element.institution_id,
            is_enabled: Boolean(element.is_enabled),
            is_accepted: Boolean(element.is_accepted),
            avatar_image: element.avatar_image,
            name: element.name,
            email: element.email,
          })),
          person: person.map((element) => ({
            person_id: element.person_id,
            is_enabled: Boolean(element.is_enabled),
            is_accepted: Boolean(element.is_accepted),
            avatar_image: element.avatar_image,
            name: element.name,
            email: element.email,
          })),
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: "Hiba az adatlekérdezés során",
        errors: [],
        data: null,
      });
    }
  }
);

// letiltja az adott intézményt
router.put(
  "/disable_institution/:institution_id",
  validToken,
  getRoleFromToken,
  verifyRole(role),
  async (req, res) => {
     // #swagger.tags = ['admin']
    const institutionId = req.params.institution_id;
    try {
      if (!institutionId || isNaN(institutionId)) {
        throw new Error("érvénytelen bemeneti adat");
      }
      await pool.query(
        "UPDATE institutions SET is_enabled = 0 WHERE institution_id = ?",
        [institutionId]
      );
      res.status(200).json({
        code: 200,
        message: "Az intézmény sikeresen le lett tiltva",
        errors: [],
        data: null,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: error.message,
        errors: [],
        data: null,
      });
    }
  }
);

// feloldja az adott intézmény tiltását
router.put(
  "/enable_institution/:institution_id",
  validToken,
  getRoleFromToken,
  verifyRole(role),
  async (req, res) => {
     // #swagger.tags = ['admin']
    const institutionId = req.params.institution_id;
    try {
      if (!institutionId || isNaN(institutionId)) {
        throw new Error("érvénytelen bemeneti adat");
      }
      await pool.query(
        "UPDATE institutions SET is_enabled = 1 WHERE institution_id = ?",
        [institutionId]
      );
      res.status(200).json({
        code: 200,
        message: "Az intézménynek tiltása sikeresen feololdva",
        errors: [],
        data: null,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: "Hiba az intézmény tiltásának a feloldása során",
        errors: [],
        data: null,
      });
    }
  }
);

// elfogadja az adott intézmény regisztrációját
router.put(
  "/accept_institution/:institution_id",
  validToken,
  getRoleFromToken,
  verifyRole(role),
  async (req, res) => {
     // #swagger.tags = ['admin']
    const institutionId = req.params.institution_id;
    try {
      if (!institutionId || isNaN(institutionId)) {
        throw new Error("érvénytelen bemeneti adat");
      }
      await pool.query(
        "UPDATE institutions SET is_accepted = 1 WHERE institution_id = ?",
        [institutionId]
      );
      res.status(200).json({
        code: 200,
        message: "Az intézményi regisztráció jóváhagyva",
        errors: [],
        data: null,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: "Hiba az intézményi regisztráció jóváhagyása során",
        errors: [],
        data: null,
      });
    }
  }
);

// letiltja az adott felhasználót
router.put(
  "/disable_person/:person_id",
  validToken,
  getRoleFromToken,
  verifyRole(role),
  async (req, res) => {
     // #swagger.tags = ['admin']
    const personId = req.params.person_id;
    try {
      if (!personId || isNaN(personId)) {
        throw new Error("érvénytelen bemeneti adat");
      }
      await pool.query(
        "UPDATE person SET is_enabled = 0 WHERE person_id = ?",
        [personId]
      );
      res.status(200).json({
        code: 200,
        message: "A fiók sikeresen le lett tiltva",
        errors: [],
        data: null,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: "Hiba a fiók tiltás során",
        errors: [],
        data: null,
      });
    }
  }
);

// feloldja az adott felhasználó tiltását
router.put(
  "/enable_person/:person_id",
  validToken,
  getRoleFromToken,
  verifyRole(role),
  async (req, res) => {
     // #swagger.tags = ['admin']
    const personId = req.params.person_id;
    try {
      if (!personId || isNaN(personId)) {
        throw new Error("érvénytelen bemeneti adat");
      }
      await pool.query(
        "UPDATE person SET is_enabled = 1 WHERE person_id = ?",
        [personId]
      );
      res.status(200).json({
        code: 200,
        message: "A fiók tiltása sikeresen feloldva",
        errors: [],
        data: null,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: "Hiba a fiók tiltásának a feloldása során",
        errors: [],
        data: null,
      });
    }
  }
);

// visszaadja az összes publikus adatát egy intézménynek
router.get("/institution/:institution_id", async (req, res) => {
     // #swagger.tags = ['admin']
    try {
        const institution_id= req.params.institution_id;

        if(!institution_id){
            throw new Error('hibás bemeneti adat');
        }

        // profile
        const [institutions] = await pool.query(`SELECT * FROM institutions JOIN users USING(user_id)  WHERE institution_id = ?`,[institution_id]);

        if(!institutions.length){
            throw new Error('Érvényteéen intézményi azonosító');
        }

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

        // követések
        const [[{follower_count}]]=await pool.query(`SELECT COUNT(*) AS follower_count FROM following WHERE institution_id = ?`, [institution_id]);
        
        res.status(200).json({
            code: 200,
            message: "Sikeres adatlekérés",
            errors: [],
            data: {
                institution_id: institution_id,
                name: institutions[0].name,
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



module.exports = router;

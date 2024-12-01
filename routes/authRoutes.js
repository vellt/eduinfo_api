const express = require("express");
const router = express.Router();
const { generateTokenForUser } = require("../services/authService");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const {
  getRoleFromToken,
  validToken,
  verifyRole,
} = require("../middleware/auth");

//---------------------------------------------------------------------------------------------------------
//  Regisztráció, bejelentkezés és kijelentkezés kezelése.
//---------------------------------------------------------------------------------------------------------

// Regisztráció
// képkezeléssel lesznek gondok, hogy én állítok be képet nekik, mert ha módoosítják akkor törölni fogjék a default képet!
// átgodnolni!!!!
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Nem valós email cím"),
    body("name").notEmpty().withMessage("Töltsd ki a nevet!"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("A jelszónak legalább 6 karakternek kell lennie!"),
    body("as")
      .isIn(["person", "institution"])
      .withMessage("Nem megfelelő felhasználói szerep"),
  ],
  async (req, res) => {
    // #swagger.tags = ['auth']
    console.log("/register");
    const connection = await pool.getConnection();
    const errors = validationResult(req);

    try {
      if (!errors.isEmpty()) {
        throw new Error("Hibás bemeneti adat(ok)");
      }

      const { email, name, password, as } = req.body;
      const role_id = as === "person" ? 2 : 3;
      // Ellenőrizzük, hogy létezik-e már az email
      const [existingUser] = await connection.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );

      if (existingUser.length > 0) {
        throw new Error("Az email cím már foglalt");
      }

      // Jelszó hash-elése
      const hash = await bcrypt.hash(password, 10);

      // tranzakció kezdete ----------------------------------------------
      await connection.beginTransaction();

      // Felhasználó hozzáadása az adatbázishoz
      const [userResult] = await connection.query(
        "INSERT INTO users (email, password, name, role_id) VALUES (?, ?, ?, ?)",
        [email, hash, name, role_id]
      );

      // Felhasználó ID-ja
      const userId = userResult.insertId;

      // Személy vagy intézmény adatok hozzáadása
      let sqlInsert =
        "INSERT INTO person (user_id, avatar_image, is_enabled, is_accepted) VALUES (?, 'default_avatar.jpg', '1', '1')";
      if (as === "institution") {
        sqlInsert =
          "INSERT INTO institutions (user_id, avatar_image, banner_image, description, is_enabled, is_accepted) VALUES (?, 'default_avatar.jpg', 'default_banner.jpg', '', '1', '0')";
      }

      await connection.query(sqlInsert, [userId]);

      // Tranzakció befejezése ----------------------------------------------
      await connection.commit();

      // Válasz a felhasználónak
      res.status(201).json({
        code: 201,
        message: "Sikeres regisztráció",
        errors: [],
        data: null,
      });
    } catch (error) {
      console.error(error);
      await connection.rollback(); // Hiba esetén visszavonjuk a tranzakciót
      return res.status(500).json({
        code: 500,
        message: error.message || "Hiba a regisztráció során",
        errors: errors.array(),
        data: null,
      });
    } finally {
      if (connection) connection.release(); // Visszaadjuk a kapcsolatot a pool-nak
    }
  }
);

// Standard bejelentkezés
router.post(
  "/standard_login",
  [
    body("email").isEmail().withMessage("Nem valós email cím"),
    body("password").notEmpty().withMessage("A jelszó megadása kötelező!"),
  ],
  async (req, res) => {
    // #swagger.tags = ['auth']
    console.log("/standard_login");
    const errors = validationResult(req);

    try {
      if (!errors.isEmpty()) {
        throw new Error("Hibás bemeneti adat(ok)");
      }

      const { email, password } = req.body;

      // lekéri az email alapján a felhasználókat
      const [results] = await pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );
      if (results.length === 0) {
        return res.status(404).json({
          code: 404,
          message: "A felhasználó nem található",
          errors: errors.array(),
          data: null,
        });
      }
      // a talált felhasználónak a jelszavát összevetjük a megadott jelszóval
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          code: 401,
          message: "Hibás belépési adatok",
          errors: errors.array(),
          data: null,
        });
      }

      // Token generálása
      const token = await generateTokenForUser(user.user_id);

      // Válasz a felhasználónak
      res.status(201).json({
        code: 201,
        message: "Sikeres bejelentezés",
        errors: errors.array(),
        data: {
          token: token,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: "Hiba a bejelentkezés során",
        errors: errors.array(),
        data: null,
      });
    }
  }
);

// Tokenes bejelentkezés
router.post("/token_login", validToken, async (req, res) => {
    // #swagger.tags = ['auth']
  // token loginnál, tötöljük a bejövő tokent és újat készítünk
  const { token, user_id } = req;
  try {
    // töljük a tokent (valid értéket 0-ra állítjuk)
    await pool.query(`UPDATE tokens SET is_valid = '0' WHERE token = ?`, [
      token,
    ]);
    // új tokent készítünk
    const ujToken = await generateTokenForUser(user_id);
    // odaadjuk a felhasználónak az új tokent
    res.status(200).json({
      code: 200,
      message: "Sikeres bejelentezés",
      errors: [],
      data: {
        token: ujToken,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 500,
      message: "Hiba a bejelentkezés során",
      errors: [],
      data: null,
    });
  }
});

// logout
router.put("/logout", validToken, async (req, res) => {
    // #swagger.tags = ['auth']
  const token = req.token;
  try {
    // töljük a tokent (valid értéket 0-ra állítjuk)
    await pool.query(`UPDATE tokens SET is_valid = '0' WHERE token = ?`, [
      token,
    ]);
    res.status(200).json({
      code: 200,
      message: "Sikeres kijelentkezés",
      errors: [],
      data: null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 500,
      message: "Hiba a kijelentkezés során",
      errors: [],
      data: null,
    });
  }
});

// visszaadja a token alapján, h mi a szerepköröm
router.get("/role", validToken, getRoleFromToken, (req, res) => {
    // #swagger.tags = ['auth']
  res.status(200).json({
    code: 200,
    message: "Sikeres azonosítás",
    errors: [],
    data: {
      role: req.userRole.role,
    },
  });
});

router.post(
  "/admin_reg",
  [
    body("email").isEmail().withMessage("Nem valós email cím"),
    body("name").notEmpty().withMessage("Töltsd ki a nevet!"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("A jelszónak legalább 6 karakternek kell lennie!"),
  ],
  async (req, res) => {
    // #swagger.tags = ['auth']
    const errors = validationResult(req);
    try {
      if (!errors.isEmpty()) {
        throw new Error("Hibás bemeneti adat(ok)");
      }
      const { email, name, password } = req.body;
      const [existingUser] = await pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
      );

      if (existingUser.length > 0) {
        throw new Error("Az email cím már foglalt");
      }

      // Jelszó hash-elése
      const hash = await bcrypt.hash(password, 10);

      // Felhasználó hozzáadása az adatbázishoz
      const [userResult] = await pool.query(
        "INSERT INTO users (email, password, name, role_id) VALUES (?, ?, ?, 1)",
        [email, hash, name]
      );

      // Felhasználó ID-ja
      const userId = userResult.insertId;

      // Token generálása
      const token = await generateTokenForUser(userId);

      // Válasz a felhasználónak
      res.status(201).json({
        code: 201,
        message: "Sikeres regisztráció",
        errors: [],
        data: {
          token: token,
        },
      });
    } catch (error) {
      console.error(error);
      await connection.rollback(); // Hiba esetén visszavonjuk a tranzakciót
      return res.status(500).json({
        code: 500,
        message: error.message || "Hiba a regisztráció során",
        errors: errors.array(),
        data: null,
      });
    }
  }
);

module.exports = router;

import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import { Request, Response } from "express";
import crypto from "crypto"


const app = express();
const port = 3000;

// middleware
app.use(express.json());
app.use(cors());

// Databas uppkoppling
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "banksajt2025",
  port: 8889, // Obs! 3306 för windowsanvändare
});
// Helper function to make a request to the DB / Returns Array with User
async function query<T>(sql: string, params: any[]): Promise<T> {
  const [result] = await pool.execute(sql, params);
  return result as T;
}

type User = {
  id: number;
  username: string;
  password: string;
};

type InsertResult = {
  insertId: number;
  affectedRows: number;
};

//create user
app.post("/users", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await query<InsertResult>(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, password]
    );
    const userId = result.insertId;
    const initialBalance = 0;

    await query("INSERT INTO accounts (user_id, balance) VALUES (?, ?)", [
      userId,
      initialBalance,
    ]);
    res.status(201).json({
      user: { username },
      account: { balance: initialBalance },
    });
  } catch (error) {
    console.log("Error creating users", error);
    res.status(500).send("error creating user");
  }
});

// Login
app.post("/sessions", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await query<User[]>(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    const user = result[0];

    if (user.password === password) {
      const token = crypto.randomBytes(32).toString("hex");

      await query("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [
        user.id,
        token,
      ]);

      res.status(200).send({ token: token });
    } else {
      res.status(401).send("invalid username or password");
    }
  } catch (error) {
    console.log("Error logging in", error);
  }
});


app.post("/me/account", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  try {
    const result = await query<{ user_id: number }[]>("SELECT * FROM sessions WHERE token = ?", [token]);

    if (result.length === 0) {
      res.status(401).json({ message: "Session does not exist." });
      return;
    }

    const userId = result[0].user_id;
    console.log(userId);
    // Fetch account
    const resAccount = await query<{ balance: number }[]>("SELECT * FROM accounts WHERE user_id = ?", [userId]);

    
    console.log(resAccount);

    // 201 created something
    res.status(200).json({
      balance: resAccount[0].balance
    });
  } catch(err) {
    console.error("Account fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route -Transaction: Deposit.
app.post("/me/account/transaction", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { amount } = req.body;

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  console.log("Recieved token");

  try {
    const result = await query<{ user_id: number }[]>("SELECT * FROM sessions WHERE token = ?", [token]);

    if (result.length === 0) {
      res.status(401).json({ message: "Session does not exist." });
      return;
    }

    const userId = result[0].user_id;

    // Update balance
    await query("UPDATE accounts SET balance = balance + ? WHERE user_id = ?", [amount, userId]);
    const account = await query<{ balance: number }[]>("SELECT balance FROM accounts WHERE user_id = ?", [userId]);

    // 200 OK response
    res.status(200).json({
      message: account[0].balance
    });

  } catch(err) {
    console.error("Account fetch error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


//fetch account token
// app.post("/me/account", async (req, res) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   // console.log(token);
//   if (!token) {
//     res.status(401).json({ message: "No token founded" });
//     return;
//   }
//   try {
//     const result = await query<{ userid: number }[]>(
//       "SELECT * FROM sessions WHERE token = ?",
//       [token]
//     );
//     if (result.length === 0) {
//       res.status(401).json({ message: "Session doesn't exist" });
//       return;
//     }
//     const userId = result[0].userid;
//     console.log(result);

//     const resAccount = await query<{ balance: number }[]>(
//       "SELECT * FROM accounts WHERE user_id = ?",
//       [userId]
//     );
//     console.log(resAccount);
//     res.status(200).json({
//       balance: resAccount[0].balance,
//     });
//   } catch (error) {
//     console.error("Account fetch error", error);
//     res.status(500).json({ message: "Token internal server error" });
//   }
// });

// app.post("me/account/");

app.listen(port, () => {
  console.log("Listening on port: " + port);
});

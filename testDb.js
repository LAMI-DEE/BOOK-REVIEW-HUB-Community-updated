import { query } from "./db/db.js";

const testConnection = async () => {
  try {
    const res = await query("SELECT NOW()");
    console.log("✅ DB connected:", res.rows[0]);
  } catch (err) {
    console.error("❌ DB test failed:", err);
  }
};

testConnection();
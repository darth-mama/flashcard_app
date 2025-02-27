const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const port = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// PostgreSQL connection
const pool = new Pool({
  user: "postgres", // Replace with your PostgreSQL username
  host: "localhost",
  database: "flashcards",
  password: "your_password", // Replace with your PostgreSQL password
  port: 5432,
});

// Input validation function
function validateInput(input, fieldName, maxLength = 255) {
  if (!input || typeof input !== "string") {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  if (input.trim().length === 0) {
    throw new Error(`${fieldName} cannot be just whitespace`);
  }
  if (input.length > maxLength) {
    throw new Error(`${fieldName} must be less than ${maxLength} characters`);
  }
  const dangerousPattern = /[;`'"\--]/;
  if (dangerousPattern.test(input)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }
  return input.trim();
}

// Validate base64 image
function validateImage(image, fieldName) {
  if (!image) return null;
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new Error(`${fieldName} must be a valid base64 image`);
  }
  return image;
}

// Get all decks with card counts
app.get("/decks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.name,
        COUNT(c.id)::int AS card_count
      FROM decks d
      LEFT JOIN cards c ON d.id = c.deck_id
      GROUP BY d.id, d.name
      ORDER BY d.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new deck
app.post("/decks", async (req, res) => {
  const { name } = req.body;
  try {
    const validatedName = validateInput(name, "Deck name");
    const result = await pool.query(
      "INSERT INTO decks (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *",
      [validatedName]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Deck name already exists" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res.status(err.message ? 400 : 500).json({
      error: err.message || "Internal server error",
    });
  }
});

// Get all cards for a specific deck
app.get("/cards/:deckId", async (req, res) => {
  const { deckId } = req.params;
  try {
    const parsedDeckId = parseInt(deckId);
    if (isNaN(parsedDeckId) || parsedDeckId <= 0) {
      throw new Error("Invalid deck ID");
    }
    const result = await pool.query(
      "SELECT * FROM cards WHERE deck_id = $1 ORDER BY id",
      [parsedDeckId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(err.message ? 400 : 500).json({
      error: err.message || "Internal server error",
    });
  }
});

// Get all cards marked for review
app.get("/review", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cards WHERE review = TRUE ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add a new card to a specific deck
app.post("/cards", async (req, res) => {
  const { deckId, term, definition, termImage, definitionImage } = req.body;
  try {
    const parsedDeckId = parseInt(deckId);
    if (isNaN(parsedDeckId) || parsedDeckId <= 0) {
      throw new Error("Invalid deck ID");
    }
    const validatedTerm = validateInput(term, "Term");
    const validatedDefinition = validateInput(definition, "Definition", 1000);
    const validatedTermImage = validateImage(termImage, "Term image");
    const validatedDefinitionImage = validateImage(
      definitionImage,
      "Definition image"
    );

    const result = await pool.query(
      "INSERT INTO cards (deck_id, term, definition, term_image, definition_image, review) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *",
      [
        parsedDeckId,
        validatedTerm,
        validatedDefinition,
        validatedTermImage,
        validatedDefinitionImage,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res.status(err.message ? 400 : 500).json({
      error: err.message || "Internal server error",
    });
  }
});

// Update review status of a card
app.put("/cards/:cardId/review", async (req, res) => {
  const { cardId } = req.params;
  const { review } = req.body;
  try {
    const parsedCardId = parseInt(cardId);
    if (isNaN(parsedCardId) || parsedCardId <= 0) {
      throw new Error("Invalid card ID");
    }
    if (typeof review !== "boolean") {
      throw new Error("Review status must be a boolean");
    }
    const result = await pool.query(
      "UPDATE cards SET review = $1 WHERE id = $2 RETURNING *",
      [review, parsedCardId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Card not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res.status(err.message ? 400 : 500).json({
      error: err.message || "Internal server error",
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

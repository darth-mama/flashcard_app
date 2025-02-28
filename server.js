const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const port = 3000;

app.use(express.json({ limit: "10mb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
    setHeaders: (res, filePath) => {
      console.log(`Serving file: ${filePath}`);
    },
  })
);

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "flashcards",
  password: "your_password",
  port: 5432,
});

function validateInput(input, fieldName, maxLength = 255) {
  if (!input || typeof input !== "string")
    throw new Error(`${fieldName} must be a non-empty string`);
  if (input.trim().length === 0)
    throw new Error(`${fieldName} cannot be just whitespace`);
  if (input.length > maxLength)
    throw new Error(`${fieldName} must be less than ${maxLength} characters`);
  // Removed restrictive regex to allow Spanish characters (á, é, í, ó, ú, ñ, ¿, ¡)
  // Optionally, add specific validation if needed, but UTF-8 chars are safe
  return input.trim();
}

function validateImage(image, fieldName) {
  if (!image) return null;
  if (typeof image !== "string" || !image.startsWith("data:image/"))
    throw new Error(`${fieldName} must be a valid base64 image`);
  return image;
}

app.get("/decks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.name, COUNT(c.id)::int AS card_count
      FROM decks d
      LEFT JOIN cards c ON d.id = c.deck_id
      GROUP BY d.id, d.name
      ORDER BY d.name
    `);
    console.log("Returning decks:", result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/decks/:deckId", async (req, res) => {
  const { deckId } = req.params;
  const { name } = req.body;
  try {
    const parsedDeckId = parseInt(deckId);
    if (isNaN(parsedDeckId) || parsedDeckId <= 0)
      throw new Error("Invalid deck ID");
    const validatedName = validateInput(name, "Deck name");
    const result = await pool.query(
      "UPDATE decks SET name = $1 WHERE id = $2 RETURNING *",
      [validatedName, parsedDeckId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Deck not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.post("/decks", async (req, res) => {
  const { name } = req.body;
  try {
    const validatedName = validateInput(name, "Deck name");
    const result = await pool.query(
      "INSERT INTO decks (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *",
      [validatedName]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ error: "Deck name already exists" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.delete("/decks/:deckId", async (req, res) => {
  const { deckId } = req.params;
  try {
    const parsedDeckId = parseInt(deckId);
    if (isNaN(parsedDeckId) || parsedDeckId <= 0)
      throw new Error("Invalid deck ID");
    await pool.query("DELETE FROM cards WHERE deck_id = $1", [parsedDeckId]);
    const result = await pool.query(
      "DELETE FROM decks WHERE id = $1 RETURNING *",
      [parsedDeckId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Deck not found" });
    res.json({ message: "Deck deleted successfully" });
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.get("/cards/:deckId", async (req, res) => {
  const { deckId } = req.params;
  try {
    const parsedDeckId = parseInt(deckId);
    if (isNaN(parsedDeckId) || parsedDeckId <= 0)
      throw new Error("Invalid deck ID");
    const result = await pool.query(
      "SELECT * FROM cards WHERE deck_id = $1 ORDER BY id",
      [parsedDeckId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.get("/review-pile", async (req, res) => {
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

app.post("/cards", async (req, res) => {
  const { deckId, term, definition, termImage, definitionImage } = req.body;
  try {
    const parsedDeckId = parseInt(deckId);
    if (isNaN(parsedDeckId) || parsedDeckId <= 0)
      throw new Error("Invalid deck ID");
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
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.put("/cards/:cardId", async (req, res) => {
  const { cardId } = req.params;
  const { term, definition, termImage, definitionImage } = req.body;
  try {
    const parsedCardId = parseInt(cardId);
    if (isNaN(parsedCardId) || parsedCardId <= 0)
      throw new Error("Invalid card ID");
    const validatedTerm = validateInput(term, "Term");
    const validatedDefinition = validateInput(definition, "Definition", 1000);
    const validatedTermImage = validateImage(termImage, "Term image");
    const validatedDefinitionImage = validateImage(
      definitionImage,
      "Definition image"
    );

    const result = await pool.query(
      "UPDATE cards SET term = $1, definition = $2, term_image = $3, definition_image = $4 WHERE id = $5 RETURNING *",
      [
        validatedTerm,
        validatedDefinition,
        validatedTermImage,
        validatedDefinitionImage,
        parsedCardId,
      ]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Card not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.delete("/cards/:cardId", async (req, res) => {
  const { cardId } = req.params;
  try {
    const parsedCardId = parseInt(cardId);
    if (isNaN(parsedCardId) || parsedCardId <= 0)
      throw new Error("Invalid card ID");
    const result = await pool.query(
      "DELETE FROM cards WHERE id = $1 RETURNING *",
      [parsedCardId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Card not found" });
    res.json({ message: "Card deleted successfully" });
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.put("/cards/:cardId/review", async (req, res) => {
  const { cardId } = req.params;
  const { review } = req.body;
  try {
    const parsedCardId = parseInt(cardId);
    if (isNaN(parsedCardId) || parsedCardId <= 0)
      throw new Error("Invalid card ID");
    if (typeof review !== "boolean")
      throw new Error("Review status must be a boolean");
    const result = await pool.query(
      "UPDATE cards SET review = $1 WHERE id = $2 RETURNING *",
      [review, parsedCardId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Card not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.stack);
    res
      .status(err.message ? 400 : 500)
      .json({ error: err.message || "Internal server error" });
  }
});

app.delete("/review-pile", async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE cards SET review = FALSE WHERE review = TRUE RETURNING *"
    );
    res.json({ message: `Cleared ${result.rowCount} cards from review pile` });
  } catch (err) {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  console.log("Serving landing page: index.html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/review", (req, res) => {
  console.log("Serving review page: review.html");
  res.sendFile(path.join(__dirname, "public", "review.html"));
});

app.get("/create", (req, res) => {
  console.log("Serving create page: create.html");
  res.sendFile(path.join(__dirname, "public", "create.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

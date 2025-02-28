let tempCards = [];
let currentDeckId = null;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function createDeck() {
  const name = document.getElementById("deckNameInput").value;
  if (!name) {
    alert("Please enter a deck name!");
    return;
  }
  try {
    const response = await fetch("/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(await response.text());
    const newDeck = await response.json();
    if (!newDeck.id) throw new Error("Deck creation failed");
    currentDeckId = newDeck.id;

    for (const card of tempCards) {
      const response = await fetch("/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...card, deckId: currentDeckId }),
      });
      if (!response.ok) throw new Error(await response.text());
    }

    alert("Deck created successfully!");
    window.location.href = "/review";
  } catch (error) {
    console.error("Error creating deck:", error);
    alert(error.message);
  }
}

async function addTempCard() {
  const term = document.getElementById("termInput").value;
  const definition = document.getElementById("definitionInput").value;
  const termImageFile = document.getElementById("termImageInput").files[0];
  const definitionImageFile = document.getElementById("definitionImageInput")
    .files[0];

  if (!term || !definition) {
    alert("Please provide both term and definition!");
    return;
  }

  try {
    let termImage = null;
    let definitionImage = null;
    if (termImageFile) termImage = await fileToBase64(termImageFile);
    if (definitionImageFile)
      definitionImage = await fileToBase64(definitionImageFile);

    const card = { term, definition, termImage, definitionImage };
    tempCards.push(card);

    const tempCardsDiv = document.getElementById("temp-cards");
    const cardDiv = document.createElement("div");
    cardDiv.textContent = `${term} - ${definition}`;
    tempCardsDiv.appendChild(cardDiv);

    document.getElementById("termInput").value = "";
    document.getElementById("definitionInput").value = "";
    document.getElementById("termImageInput").value = "";
    document.getElementById("definitionImageInput").value = "";
  } catch (error) {
    console.error("Error adding temporary card:", error);
    alert(error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("create.js loaded");
});

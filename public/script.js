let decks = [];
let cards = [];
let currentCard = 0;
let isFlipped = false;
let currentDeckId = null;
let isReviewPile = false;

const card = document.getElementById("card");
const front = document.getElementById("front");
const back = document.getElementById("back");
const frontText = document.getElementById("frontText");
const backText = document.getElementById("backText");
const frontImage = document.getElementById("frontImage");
const backImage = document.getElementById("backImage");
const deckSelect = document.getElementById("deckSelect");
const reviewCheckbox = document.getElementById("reviewCheckbox");
const counter = document.getElementById("counter");

// Load all decks from the server
async function loadDecks() {
  try {
    const response = await fetch("/decks");
    if (!response.ok) throw new Error("Failed to fetch decks");
    decks = await response.json();
    updateDeckSelect();
    if (decks.length > 0 && !currentDeckId && !isReviewPile) {
      currentDeckId = decks[0].id;
      loadCards();
    }
  } catch (error) {
    console.error("Error loading decks:", error);
  }
}

// Update the deck dropdown
function updateDeckSelect() {
  deckSelect.innerHTML = '<option value="">Select a deck</option>';
  decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = `${deck.name} (${deck.card_count} cards)`;
    if (deck.id === currentDeckId && !isReviewPile) option.selected = true;
    deckSelect.appendChild(option);
  });
}

// Create a new deck
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
    decks.push(newDeck);
    currentDeckId = newDeck.id;
    isReviewPile = false;
    cards = [];
    currentCard = 0;
    document.getElementById("deckNameInput").value = "";
    updateDeckSelect();
    updateCard();
    updateCounter();
  } catch (error) {
    console.error("Error creating deck:", error);
    alert(error.message);
  }
}

// Load cards for the selected deck
async function loadCards() {
  if (!currentDeckId || isReviewPile) return;
  try {
    const response = await fetch(`/cards/${currentDeckId}`);
    if (!response.ok) throw new Error("Failed to fetch cards");
    cards = await response.json();
    currentCard = 0;
    updateCard();
    updateCounter();
    updateNavigationButtons();
  } catch (error) {
    console.error("Error loading cards:", error);
  }
}

// Load the review pile
async function loadReviewPile() {
  try {
    const response = await fetch("/review");
    if (!response.ok) throw new Error("Failed to fetch review pile");
    cards = await response.json();
    currentDeckId = null;
    isReviewPile = true;
    currentCard = 0;
    updateDeckSelect();
    updateCard();
    updateCounter();
    updateNavigationButtons();
  } catch (error) {
    console.error("Error loading review pile:", error);
  }
}

// Load the selected deck when changed
function loadSelectedDeck() {
  const selectedDeckId = deckSelect.value;
  if (selectedDeckId) {
    currentDeckId = parseInt(selectedDeckId);
    isReviewPile = false;
    loadCards();
  } else {
    currentDeckId = null;
    isReviewPile = false;
    cards = [];
    currentCard = 0;
    updateCard();
    updateCounter();
    updateNavigationButtons();
  }
}

// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Add a new card
async function addCard() {
  if (!currentDeckId) {
    alert("Please select or create a deck first!");
    return;
  }

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

    if (termImageFile) {
      termImage = await fileToBase64(termImageFile);
      console.log("Uploaded term image:", termImage.substring(0, 50));
    }
    if (definitionImageFile) {
      definitionImage = await fileToBase64(definitionImageFile);
      console.log(
        "Uploaded definition image:",
        definitionImage.substring(0, 50)
      );
    }

    const response = await fetch("/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deckId: currentDeckId,
        term,
        definition,
        termImage,
        definitionImage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${await response.text()}`);
    }

    const newCard = await response.json();
    if (!newCard.id) {
      throw new Error("Card creation failed: No ID returned from server");
    }

    cards.push(newCard);
    document.getElementById("termInput").value = "";
    document.getElementById("definitionInput").value = "";
    document.getElementById("termImageInput").value = "";
    document.getElementById("definitionImageInput").value = "";

    if (cards.length === 1) {
      currentCard = 0;
      updateCard();
    }
    updateCounter();
    updateNavigationButtons();
    loadDecks();
  } catch (error) {
    console.error("Error adding card:", error);
    alert(error.message);
  }
}

// Toggle review status
async function toggleReview() {
  if (cards.length === 0 || isReviewPile) return;
  const cardId = cards[currentCard].id;
  const newReviewStatus = reviewCheckbox.checked;
  try {
    const response = await fetch(`/cards/${cardId}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review: newReviewStatus }),
    });
    if (!response.ok) throw new Error(await response.text());
    const updatedCard = await response.json();
    if (!updatedCard.id) throw new Error("Failed to update review status");
    cards[currentCard].review = newReviewStatus;
  } catch (error) {
    console.error("Error toggling review:", error);
    alert(error.message);
    reviewCheckbox.checked = !newReviewStatus;
  }
}

// Flip the card
function flipCard() {
  if (cards.length > 0) {
    isFlipped = !isFlipped;
    card.classList.toggle("flipped");
  }
}

// Update the displayed card
function updateCard() {
  if (cards.length > 0) {
    frontText.textContent = cards[currentCard].term;
    backText.textContent = cards[currentCard].definition;

    if (cards[currentCard].term_image) {
      frontImage.src = cards[currentCard].term_image;
      frontImage.style.display = "block";
      console.log("Term image length:", cards[currentCard].term_image.length);
    } else {
      frontImage.src = "";
      frontImage.style.display = "none";
    }

    if (cards[currentCard].definition_image) {
      backImage.src = cards[currentCard].definition_image;
      backImage.style.display = "block";
      console.log(
        "Definition image length:",
        cards[currentCard].definition_image.length
      );
    } else {
      backImage.src = "";
      backImage.style.display = "none";
    }

    reviewCheckbox.checked = cards[currentCard].review;
    reviewCheckbox.disabled = isReviewPile;

    if (isFlipped) {
      card.classList.add("flipped");
    } else {
      card.classList.remove("flipped");
    }
  } else {
    frontText.textContent = currentDeckId
      ? "No cards in this deck"
      : isReviewPile
      ? "No cards in review pile"
      : "No deck selected";
    backText.textContent = "Add some cards or create a deck!";
    frontImage.style.display = "none";
    backImage.style.display = "none";
    reviewCheckbox.checked = false;
    reviewCheckbox.disabled = true;
    card.classList.remove("flipped");
  }
  updateNavigationButtons();
}

// Update card counter
function updateCounter() {
  if (counter) {
    counter.textContent = `${cards.length > 0 ? currentCard + 1 : 0} / ${
      cards.length
    }`;
  }
}

// Enable/disable navigation buttons
function updateNavigationButtons() {
  const prevButton = document.querySelector("#controls button:nth-child(1)");
  const nextButton = document.querySelector("#controls button:nth-child(2)");
  if (prevButton && nextButton) {
    prevButton.disabled = cards.length === 0 || currentCard === 0;
    nextButton.disabled =
      cards.length === 0 || currentCard === cards.length - 1;
  }
}

// Navigate to previous card
function prevCard() {
  if (cards.length > 0 && currentCard > 0) {
    currentCard--;
    isFlipped = false;
    updateCard();
    updateCounter();
  }
}

// Navigate to next card
function nextCard() {
  if (cards.length > 0 && currentCard < cards.length - 1) {
    currentCard++;
    isFlipped = false;
    updateCard();
    updateCounter();
  }
}

// Initial load
document.addEventListener("DOMContentLoaded", () => {
  loadDecks();
});

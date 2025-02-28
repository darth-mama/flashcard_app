let decks = [];
let cards = [];
let currentCard = 0;
let isFlipped = false;
let currentDeckId = null;
let isReviewPile = false;

console.log("review.js loaded - starting execution");

async function loadDecks() {
  console.log("Fetching decks...");
  try {
    const response = await fetch("/decks");
    if (!response.ok)
      throw new Error(
        `Fetch failed: ${response.status} - ${await response.text()}`
      );
    decks = await response.json();
    console.log("Decks fetched:", decks);
    updateDeckSelect();
    const urlParams = new URLSearchParams(window.location.search);
    const preselectedDeckId = urlParams.get("deckId");
    if (
      preselectedDeckId &&
      decks.some((d) => d.id === parseInt(preselectedDeckId))
    ) {
      currentDeckId = parseInt(preselectedDeckId);
      console.log("Preselecting deck from URL:", currentDeckId);
      await loadCards();
    } else if (decks.length > 0 && !currentDeckId && !isReviewPile) {
      currentDeckId = decks[0].id;
      console.log("Auto-selecting deck:", currentDeckId);
      await loadCards();
    }
  } catch (error) {
    console.error("Error fetching decks:", error);
    document.getElementById("deckSelect").innerHTML =
      '<option value="">Error loading decks</option>';
  }
}

function updateDeckSelect() {
  console.log("Updating deck select with:", decks);
  const deckSelect = document.getElementById("deckSelect");
  deckSelect.innerHTML = '<option value="">Select a deck</option>';
  decks.forEach((deck) => {
    console.log("Adding deck:", deck.id, deck.name, deck.card_count);
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = `${deck.name} (${deck.card_count} cards)`;
    if (deck.id === currentDeckId && !isReviewPile) option.selected = true;
    deckSelect.appendChild(option);
  });
}

async function deleteDeck() {
  if (!currentDeckId) {
    alert("Please select a deck to delete!");
    return;
  }
  const deckToDelete = decks.find((d) => d.id === currentDeckId);
  if (!deckToDelete) {
    alert("Selected deck not found in list!");
    return;
  }
  if (
    !confirm(
      `Are you sure you want to delete "${deckToDelete.name}" and all its cards?`
    )
  )
    return;

  console.log(`Attempting to delete deck ID: ${currentDeckId}`);
  try {
    const response = await fetch(`/decks/${currentDeckId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    console.log("Delete response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete deck: ${response.status} - ${errorText}`
      );
    }
    decks = decks.filter((deck) => deck.id !== currentDeckId);
    currentDeckId = null;
    cards = [];
    currentCard = 0;
    updateDeckSelect();
    updateCard();
    updateCounter();
    console.log("Deck deleted locally, UI updated");
    alert("Deck deleted successfully!");
  } catch (error) {
    console.error("Error deleting deck:", error);
    alert(`Error: ${error.message}`);
  }
}

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

async function loadReviewPile() {
  try {
    const response = await fetch("/review-pile");
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

async function clearReviewPile() {
  if (
    !confirm("Are you sure you want to clear all cards from the review pile?")
  )
    return;
  try {
    const response = await fetch("/review-pile", { method: "DELETE" });
    if (!response.ok) throw new Error(await response.text());
    if (isReviewPile) {
      cards = [];
      currentCard = 0;
      updateCard();
      updateCounter();
    }
    loadDecks();
    alert("Review pile cleared successfully!");
  } catch (error) {
    console.error("Error clearing review pile:", error);
    alert(error.message);
  }
}

function loadSelectedDeck() {
  const selectedDeckId = document.getElementById("deckSelect").value;
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addCard() {
  if (!currentDeckId) {
    alert("Please select a deck first!");
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
    if (termImageFile) termImage = await fileToBase64(termImageFile);
    if (definitionImageFile)
      definitionImage = await fileToBase64(definitionImageFile);

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

    if (!response.ok) throw new Error(await response.text());
    const newCard = await response.json();
    if (!newCard.id) throw new Error("Card creation failed");

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

async function deleteCard() {
  if (cards.length === 0) {
    alert("No card selected to delete!");
    return;
  }
  if (!confirm(`Are you sure you want to delete "${cards[currentCard].term}"?`))
    return;
  try {
    const cardId = cards[currentCard].id;
    const response = await fetch(`/cards/${cardId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await response.text());
    cards.splice(currentCard, 1);
    if (currentCard >= cards.length && cards.length > 0)
      currentCard = cards.length - 1;
    updateCard();
    updateCounter();
    updateNavigationButtons();
    loadDecks();
    alert("Card deleted successfully!");
  } catch (error) {
    console.error("Error deleting card:", error);
    alert(error.message);
  }
}

async function toggleReview() {
  if (cards.length === 0 || isReviewPile) return;
  const cardId = cards[currentCard].id;
  const newReviewStatus = document.getElementById("reviewCheckbox").checked;
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
    document.getElementById("reviewCheckbox").checked = !newReviewStatus;
  }
}

function flipCard() {
  if (cards.length > 0) {
    isFlipped = !isFlipped;
    card.classList.toggle("flipped");
  }
}

function updateCard() {
  if (cards.length > 0) {
    frontText.textContent = cards[currentCard].term;
    backText.textContent = cards[currentCard].definition;
    frontImage.src = cards[currentCard].term_image || "";
    frontImage.style.display = cards[currentCard].term_image ? "block" : "none";
    backImage.src = cards[currentCard].definition_image || "";
    backImage.style.display = cards[currentCard].definition_image
      ? "block"
      : "none";
    document.getElementById("reviewCheckbox").checked =
      cards[currentCard].review;
    document.getElementById("reviewCheckbox").disabled = isReviewPile;
    if (isFlipped) card.classList.add("flipped");
    else card.classList.remove("flipped");
  } else {
    frontText.textContent = currentDeckId
      ? "No cards in this deck"
      : isReviewPile
      ? "No cards in review pile"
      : "No deck selected";
    backText.textContent = "Add some cards or select a deck!";
    frontImage.style.display = "none";
    backImage.style.display = "none";
    document.getElementById("reviewCheckbox").checked = false;
    document.getElementById("reviewCheckbox").disabled = true;
    card.classList.remove("flipped");
  }
  updateNavigationButtons();
}

function updateCounter() {
  if (counter)
    counter.textContent = `${cards.length > 0 ? currentCard + 1 : 0} / ${
      cards.length
    }`;
}

function updateNavigationButtons() {
  const prevButton = document.querySelector("#controls button:nth-child(1)");
  const nextButton = document.querySelector("#controls button:nth-child(2)");
  if (prevButton && nextButton) {
    prevButton.disabled = cards.length === 0 || currentCard === 0;
    nextButton.disabled =
      cards.length === 0 || currentCard === cards.length - 1;
  }
}

function prevCard() {
  if (cards.length > 0 && currentCard > 0) {
    currentCard--;
    isFlipped = false;
    updateCard();
    updateCounter();
  }
}

function nextCard() {
  if (cards.length > 0 && currentCard < cards.length - 1) {
    currentCard++;
    isFlipped = false;
    updateCard();
    updateCounter();
  }
}

loadDecks();

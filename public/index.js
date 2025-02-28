let allDecks = [];

console.log("index.js loaded - starting execution");

async function loadDecks() {
  try {
    const response = await fetch("/decks");
    if (!response.ok) throw new Error("Failed to fetch decks");
    allDecks = await response.json();
    console.log("Decks loaded:", allDecks);
    updateDeckSelect(allDecks);
  } catch (error) {
    console.error("Error loading decks:", error);
    document.getElementById("deckSelect").innerHTML =
      '<option value="">Error loading decks</option>';
  }
}

function updateDeckSelect(decks) {
  const deckSelect = document.getElementById("deckSelect");
  deckSelect.innerHTML = '<option value="">Select a deck</option>';
  decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = `${deck.name} (${deck.card_count} cards)`;
    deckSelect.appendChild(option);
  });
}

function goToDeck() {
  const deckSelect = document.getElementById("deckSelect");
  const selectedDeckId = deckSelect.value;
  if (selectedDeckId) {
    console.log("Navigating to deck:", selectedDeckId);
    window.location.href = `/review?deckId=${selectedDeckId}`;
  } else {
    alert("Please select a deck!");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded");

  const deckSearch = document.getElementById("deckSearch");

  deckSearch.addEventListener("input", () => {
    const searchTerm = deckSearch.value.toLowerCase();
    const filteredDecks = allDecks.filter((deck) =>
      deck.name.toLowerCase().includes(searchTerm)
    );
    updateDeckSelect(filteredDecks);
  });

  loadDecks();
});

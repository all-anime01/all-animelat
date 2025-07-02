const episodesContainer = document.getElementById("episodes");
const seasonSelector = document.getElementById("seasonSelector");
const searchInput = document.getElementById("searchInput");
const toggleViewBtn = document.getElementById("toggleView");
const modal = document.getElementById("modal");
const videoFrame = document.getElementById("videoFrame");
const episodeTitle = document.getElementById("episodeTitle");
const episodeMeta = document.getElementById("episodeMeta");
const episodeDesc = document.getElementById("episodeDesc");
const closeModal = document.getElementById("closeModal");
const btnPlay = document.getElementById("btnPlay");

let currentSeason = 2;
let view = "grid";

function renderEpisodes() {
  episodesContainer.innerHTML = "";
  const episodes = allEpisodes[currentSeason].filter((ep) =>
    ep.title.toLowerCase().includes(searchInput.value.toLowerCase())
  );
  episodes.forEach((ep) => {
    const card = document.createElement("div");
    card.className = "episode";
    card.innerHTML = `
      <img src="${ep.thumbnail}" alt="${ep.title}" />
      <h3>${ep.title}</h3>
      <p>${ep.releaseDate} • ${ep.duration}</p>
    `;
    card.onclick = () => openModal(ep);
    episodesContainer.appendChild(card);
  });
}

function openModal(ep) {
  modal.classList.remove("hidden");
  videoFrame.src = ep.videoUrl;
  episodeTitle.textContent = ep.title;
  episodeMeta.textContent = `${ep.episodeNumber} • ${ep.releaseDate} • ${ep.duration}`;
  episodeDesc.textContent = ep.description;
}

function closeModalWindow() {
  modal.classList.add("hidden");
  videoFrame.src = "";
}

seasonSelector.onchange = (e) => {
  currentSeason = Number(e.target.value);
  renderEpisodes();
};

searchInput.oninput = () => renderEpisodes();

toggleViewBtn.onclick = () => {
  view = view === "grid" ? "list" : "grid";
  episodesContainer.className = `episodes ${view}-view`;
  renderEpisodes();
};

btnPlay.onclick = () => {
  const lastEp =
    allEpisodes[currentSeason][allEpisodes[currentSeason].length - 1];
  openModal(lastEp);
};

closeModal.onclick = closeModalWindow;

window.onload = renderEpisodes;

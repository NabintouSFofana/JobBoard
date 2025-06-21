document.addEventListener("DOMContentLoaded", () => {
  // --- Grab DOM elements first ---
  const jobList       = document.getElementById("jobList");
  const searchTitle   = document.getElementById("searchTitle");
  const locationFilter = document.getElementById("locationFilter");
  const typeFilter    = document.getElementById("typeFilter");

  const currentPage = window.location.pathname.split("/").pop(); // e.g., 'index.html'
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach(link => {
    if (link.getAttribute("href") === currentPage) {
      link.classList.add("active");
    }
  });

  // --- App state ---
  let jobs = [];

  // --- Load jobs safely ---
  async function loadJobs() {
    try {
      const res = await fetch("data/jobs.json");
      if (!res.ok) throw new Error("Network response was not ok");
      jobs = await res.json();
      displayJobs(jobs);
    } catch (err) {
      jobList.innerHTML = "<p class='text-red-600'>Failed to load jobs.</p>";
      console.error(err);
    }
  }


  // --- Render job cards ---
function displayJobs(jobArray) {
  jobList.innerHTML = "";
  jobArray.forEach((job, index) => {
    const card = document.createElement("div");
    card.className = "job-card";
    card.style.animationDelay = `${index * 100}ms`; // stagger effect

    card.innerHTML = `
      <h3>${job.title}</h3>
      <p class="meta">${job.company} — ${job.location}</p>
      <p class="desc">${job.description}</p>
      <span class="badge">${job.type}</span>
      <a class="bookmark" href="#" onclick="bookmarkJob(${job.id})">🔖 Bookmark</a>
    `;

    jobList.appendChild(card);
  });
}


  // --- Filtering ---
  function filterJobs() {
    const titleQuery = searchTitle.value.toLowerCase();
    const location   = locationFilter.value;
    const type       = typeFilter.value;

    const filtered = jobs.filter((job) => {
      const matchesTitle    = job.title.toLowerCase().includes(titleQuery);
      const matchesLocation = location ? job.location === location : true;
      const matchesType     = type ? job.type === type : true;
      return matchesTitle && matchesLocation && matchesType;
    });

    displayJobs(filtered);
  }

  // --- Bookmarking ---
  function bookmarkJob(id) {
    const job       = jobs.find((j) => j.id === id);
    const bookmarks = JSON.parse(localStorage.getItem("bookmarkedJobs")) || [];

    if (!bookmarks.some((b) => b.id === id)) {
      bookmarks.push(job);
      localStorage.setItem("bookmarkedJobs", JSON.stringify(bookmarks));
      alert("Job bookmarked!");
    } else {
      alert("Already bookmarked!");
    }
  }
  window.bookmarkJob = bookmarkJob; // expose to inline onclick

  // --- Event listeners ---
  searchTitle.addEventListener("input", filterJobs);
  locationFilter.addEventListener("change", filterJobs);
  typeFilter.addEventListener("change", filterJobs);


  // --- Kick things off ---
  loadJobs();
});
